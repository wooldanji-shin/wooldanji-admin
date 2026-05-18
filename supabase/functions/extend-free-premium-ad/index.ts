import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 프리미엄 광고 무료(할인율 100%) 연장 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (effectiveAmount === 0 케이스, 연장 화면)
 * 역할:
 *   1. JWT 사용자 검증
 *   2. running 상태 광고 + 소유자 + 할인율 100% 검증
 *   3. ad_payment_history_v2 INSERT (amount=0, paymentType='extension')
 *   4. premium_advertisements_v2.endedAt 연장 (기존 endedAt + weeks × 7일)
 *   5. FCM 알림 (non-critical)
 *
 * activate-free-premium-ad와 달리 status/paymentStatus 변경 없음 (이미 running).
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
      .select('"partnerId", status, "approvedDiscountRate", "endedAt"')
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

    const discountRate = ad.approvedDiscountRate as number | null;
    if (discountRate !== 100) {
      return new Response(
        JSON.stringify({
          error: `무료 연장은 할인율이 100%인 경우에만 가능합니다. (현재: ${discountRate ?? 0}%)`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date();
    const currentEndedAt = ad.endedAt ? new Date(ad.endedAt) : now;
    const newEndedAt = new Date(currentEndedAt.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const { error: paymentError } = await supabase
      .from('ad_payment_history_v2')
      .insert({
        partnerId,
        premiumAdId,
        amount: 0,
        supplyAmount: 0,
        vatAmount: 0,
        status: 'paid',
        paymentType: 'extension',
        paymentDate: now.toISOString(),
        billingPeriodStart: currentEndedAt.toISOString(),
        billingPeriodEnd: newEndedAt.toISOString(),
        paymentKey: null,
        receiptUrl: null,
      });

    if (paymentError) {
      console.error('[ExtendFreePremiumAd] 결제 내역 INSERT 실패:', paymentError);
      return new Response(
        JSON.stringify({ error: '결제 내역 기록에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update({ endedAt: newEndedAt.toISOString(), updatedAt: now.toISOString() })
      .eq('id', premiumAdId);

    if (updateError) {
      console.error('[ExtendFreePremiumAd] 광고 endedAt 업데이트 실패:', updateError);
      return new Response(
        JSON.stringify({ error: '종료일 업데이트에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    try {
      const newEndedAtKst = new Date(newEndedAt.getTime() + 9 * 60 * 60 * 1000);
      const endDateStr = `${newEndedAtKst.getUTCFullYear()}.${String(newEndedAtKst.getUTCMonth() + 1).padStart(2, '0')}.${String(newEndedAtKst.getUTCDate()).padStart(2, '0')}`;

      await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '연장 완료',
          body: `프리미엄 광고가 무료로 연장되었습니다. 광고 종료일: ${endDateStr}`,
          type: 'premium_ad_extended',
          navigationData: { type: 'premium_ad_detail', params: { premiumAdId } },
        }),
      });
    } catch (fcmError) {
      console.error('[ExtendFreePremiumAd] FCM 전송 실패 (non-critical):', fcmError);
    }

    return new Response(
      JSON.stringify({ success: true, newEndedAt: newEndedAt.toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[ExtendFreePremiumAd] 서버 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
