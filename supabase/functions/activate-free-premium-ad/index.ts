import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 프리미엄 광고 무료(할인율 100%) 즉시 활성화 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (discountedTotalAmount === 0 케이스)
 * 역할:
 *   1. JWT 사용자 검증
 *   2. 파트너 ID 조회
 *   3. 광고 검증: status==='approved', paymentStatus==='unpaid', discountedTotalAmount===0
 *   4. ad_payment_history_v2 INSERT (amount=0, paymentKey=null)
 *   5. premium_advertisements_v2 → running 상태 + 기간 설정
 *   6. FCM 알림
 *
 * 토스 결제창 없이 바로 running 전환 — discountedTotalAmount가 0원인 경우에만 사용 가능.
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

    const { premiumAdId } = await req.json();
    if (!premiumAdId) {
      return new Response(
        JSON.stringify({ error: 'premiumAdId는 필수입니다.' }),
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

    // 광고 검증
    const { data: ad, error: adError } = await supabase
      .from('premium_advertisements_v2')
      .select('"totalAmount", "discountedTotalAmount", weeks, status, "paymentStatus", "partnerId"')
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
        JSON.stringify({ error: '본인의 광고만 활성화할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: `승인된 광고만 활성화 가능합니다. (현재: ${ad.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.paymentStatus === 'paid') {
      return new Response(
        JSON.stringify({ error: '이미 결제된 광고입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 0원 여부 검증 — 이 함수는 discountedTotalAmount === 0인 경우에만 사용 가능
    const discountedTotalAmount = ad.discountedTotalAmount as number | null;
    if (discountedTotalAmount !== 0) {
      return new Response(
        JSON.stringify({
          error: `무료 활성화는 할인 금액이 0원인 경우에만 가능합니다. (현재: ${discountedTotalAmount}원)`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const weeks = ad.weeks as number;
    const now = new Date();
    const endedAt = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    // 결제 내역 INSERT (0원 무료 처리)
    const { error: paymentError } = await supabase
      .from('ad_payment_history_v2')
      .insert({
        partnerId,
        premiumAdId,
        amount: 0,
        supplyAmount: 0,
        vatAmount: 0,
        status: 'paid',
        paymentType: 'premium',
        paymentDate: now.toISOString(),
        billingPeriodStart: now.toISOString(),
        billingPeriodEnd: endedAt.toISOString(),
        paymentKey: null,
        receiptUrl: null,
      });

    if (paymentError) {
      console.error('[ActivateFreePremiumAd] 결제 내역 INSERT 실패:', paymentError);
      return new Response(
        JSON.stringify({ error: '결제 내역 기록에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 프리미엄 광고 상태 → running
    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update({
        status: 'running',
        paymentStatus: 'paid',
        startedAt: now.toISOString(),
        endedAt: endedAt.toISOString(),
        updatedAt: now.toISOString(),
      })
      .eq('id', premiumAdId);

    if (updateError) {
      console.error('[ActivateFreePremiumAd] 광고 상태 업데이트 실패:', updateError);
      return new Response(
        JSON.stringify({ error: '광고 상태 업데이트에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // FCM 알림 (non-critical)
    try {
      const endedAtKst = new Date(endedAt.getTime() + 9 * 60 * 60 * 1000);
      const endDateStr = `${endedAtKst.getUTCFullYear()}.${String(endedAtKst.getUTCMonth() + 1).padStart(2, '0')}.${String(endedAtKst.getUTCDate()).padStart(2, '0')}`;

      await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '프리미엄 광고 시작',
          body: `프리미엄 광고가 무료로 시작되었습니다. 광고 종료일: ${endDateStr}`,
          type: 'premium_ad_started',
          navigationData: { type: 'premium_ad_detail', params: { premiumAdId } },
        }),
      });
    } catch (fcmError) {
      console.error('[ActivateFreePremiumAd] FCM 전송 실패 (non-critical):', fcmError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        startedAt: now.toISOString(),
        endedAt: endedAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[ActivateFreePremiumAd] 서버 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});