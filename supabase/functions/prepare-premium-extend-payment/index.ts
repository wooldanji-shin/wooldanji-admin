import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 프리미엄 광고 연장 결제 준비 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (PaymentRequestScreen 진입 시, mode=extension)
 * 역할:
 *   1. running 상태 광고 + 소유자 검증
 *   2. snapshotApartments + ad_pricing_v2로 totalAmount 계산
 *   3. approvedDiscountRate로 할인 적용 → effectiveAmount
 *   4. orderId 발급 + amount/orderName 반환 (서버가 source of truth)
 *
 * effectiveAmount가 0이면 에러 — 100% 할인 연장은 extend-free-premium-ad EF로 처리.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 정보가 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { premiumAdId, weeks } = await req.json();
    if (!premiumAdId || !weeks) {
      return new Response(
        JSON.stringify({ error: 'premiumAdId, weeks는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: partnerData, error: partnerError } = await supabase
      .from('partner_users')
      .select('id')
      .eq('userId', user.id)
      .single();

    if (partnerError || !partnerData) {
      return new Response(
        JSON.stringify({ error: '파트너 정보를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const partnerId = partnerData.id as string;

    const { data: ad, error: adError } = await supabase
      .from('premium_advertisements_v2')
      .select('"partnerId", status, "snapshotApartments", "approvedDiscountRate"')
      .eq('id', premiumAdId)
      .single();

    if (adError || !ad) {
      return new Response(
        JSON.stringify({ error: '프리미엄 광고를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.partnerId !== partnerId) {
      return new Response(
        JSON.stringify({ error: '본인의 광고만 연장할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.status !== 'running' && ad.status !== 'ended') {
      return new Response(
        JSON.stringify({ error: `운영 중이거나 종료된 광고만 연장할 수 있습니다. (현재: ${ad.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: pricing } = await supabase
      .from('ad_pricing_v2')
      .select('"premiumPricePerHouseholdPerWeek"')
      .order('effectiveFrom', { ascending: false })
      .limit(1)
      .single();

    const pricePerHouseholdPerWeek = (pricing?.premiumPricePerHouseholdPerWeek as number) ?? 20;
    const snapshotApartments = (ad.snapshotApartments as Array<{ totalHouseholds: number }>) ?? [];
    const totalHouseholds = snapshotApartments.reduce((sum, apt) => sum + apt.totalHouseholds, 0);
    const totalAmount = totalHouseholds * pricePerHouseholdPerWeek * weeks;

    const discountRate = (ad.approvedDiscountRate as number | null) ?? 0;
    const effectiveAmount = discountRate > 0
      ? Math.round(totalAmount * (100 - discountRate) / 100 / 10) * 10
      : totalAmount;

    if (effectiveAmount <= 0) {
      return new Response(
        JSON.stringify({ error: '할인율 100%는 무료 연장으로 처리해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const orderId = `EXTEND-${premiumAdId.replace(/-/g, '').slice(0, 8)}-${Date.now()}`;
    const orderName = `울단지 프리미엄 광고 연장 (${weeks}주)`;

    return new Response(
      JSON.stringify({ orderId, amount: effectiveAmount, orderName }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[PreparePremiumExtendPayment] 서버 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
