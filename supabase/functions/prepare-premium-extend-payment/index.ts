import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 프리미엄 광고 연장 단발성 결제 준비 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (PaymentRequestScreen 진입 시, mode=extension)
 * 역할:
 *   1. 광고 상태 검증 (running + paid + 본인 소유)
 *   2. weeks 범위 검증 (1~5)
 *   3. 연장 amount 계산 (totalHouseholds × pricePerWeek × weeks) — 서버가 source of truth
 *   4. orderId 발급 (PREMIUM-EXT-{adId 앞 8자}-{timestamp})
 *
 * confirm 단계에서 weeks 기반 amount를 다시 계산해 검증함.
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
    if (!premiumAdId) {
      return new Response(
        JSON.stringify({ error: 'premiumAdId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const weeksNum = Number(weeks);
    if (!Number.isInteger(weeksNum) || weeksNum < 1 || weeksNum > 5) {
      return new Response(
        JSON.stringify({ error: '연장 주수는 1~5주 사이여야 합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // JWT로 사용자 검증
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

    // 파트너 ID 조회
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

    // 프리미엄 광고 조회 (소유자 + running + paid 검증)
    const { data: ad, error: adError } = await supabase
      .from('premium_advertisements_v2')
      .select('"partnerId", status, "paymentStatus", "snapshotApartments"')
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

    if (ad.status !== 'running') {
      return new Response(
        JSON.stringify({ error: `운영 중인 광고만 연장할 수 있습니다. (현재: ${ad.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.paymentStatus !== 'paid') {
      return new Response(
        JSON.stringify({ error: '결제 완료된 광고만 연장할 수 있습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 연장 금액 계산 (ad_pricing_v2에서 단가 조회)
    const { data: pricing } = await supabase
      .from('ad_pricing_v2')
      .select('"premiumPricePerHouseholdPerWeek"')
      .order('effectiveFrom', { ascending: false })
      .limit(1)
      .single();

    const pricePerHouseholdPerWeek =
      (pricing?.premiumPricePerHouseholdPerWeek as number) ?? 20;
    const snapshotApartments =
      (ad.snapshotApartments as Array<{ totalHouseholds: number }>) ?? [];
    const totalHouseholds = snapshotApartments.reduce(
      (sum, apt) => sum + (apt.totalHouseholds ?? 0),
      0,
    );
    const totalAmount = totalHouseholds * pricePerHouseholdPerWeek * weeksNum;

    if (totalAmount <= 0) {
      return new Response(
        JSON.stringify({ error: '결제 금액이 0원입니다. 아파트 정보를 확인해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // orderId 생성 — Toss 규격: 영문/숫자/-/_/= 6~64자
    // {prefix}-{adId 앞 8자(하이픈 제거)}-{timestamp(13자)}
    const orderId = `PREMIUM-EXT-${(premiumAdId as string).replace(/-/g, '').slice(0, 8)}-${Date.now()}`;
    const orderName = `울단지 프리미엄 광고 연장 (${weeksNum}주)`;

    return new Response(
      JSON.stringify({ orderId, amount: totalAmount, orderName }),
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
