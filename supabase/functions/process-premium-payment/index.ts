import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 프리미엄 광고 신규 결제 처리 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (신규 신청 결제하기 버튼)
 * 역할:
 *   1. 광고 상태 검증 (approved + unpaid)
 *   2. 빌링키 복호화 → 토스페이먼츠 실결제
 *   3. ad_payment_history_v2 결제 내역 INSERT (paymentType='premium')
 *   4. premium_advertisements_v2 → running 상태 전환 + 기간 설정
 *   5. FCM 알림 "N원 결제 완료, 광고 시작"
 *
 * 연장 결제는 extend-premium-ad Edge Function을 사용할 것
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TOSS_BILLING_SECRET_KEY = Deno.env.get('TOSS_BILLING_SECRET_KEY')!;
    const BILLING_KEY_SECRET = Deno.env.get('BILLING_KEY_SECRET')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!TOSS_BILLING_SECRET_KEY || !BILLING_KEY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.');
    }

    // 파트너 앱에서 전달한 JWT로 사용자 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 정보가 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const { premiumAdId, billingKeyId } = body as {
      premiumAdId: string;
      billingKeyId: string;
    };

    if (!premiumAdId || !billingKeyId) {
      return new Response(
        JSON.stringify({ error: 'premiumAdId, billingKeyId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 사용자 검증용 클라이언트 (JWT 사용)
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 서비스 롤 클라이언트 (DB 쓰기 권한)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. 파트너 ID 조회
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

    // 2. 프리미엄 광고 조회 (소유자 + 상태 검증)
    const { data: ad, error: adError } = await supabase
      .from('premium_advertisements_v2')
      .select('"totalAmount", weeks, status, "paymentStatus", "partnerId"')
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
        JSON.stringify({ error: '본인의 광고만 결제할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: `승인된 광고만 결제 가능합니다. (현재: ${ad.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (ad.paymentStatus === 'paid') {
      return new Response(
        JSON.stringify({ error: '이미 결제된 광고입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const totalAmount = (ad.totalAmount as number) ?? 0;
    const weeks = ad.weeks as number;

    // 3. 빌링키 조회 및 활성화 확인
    const { data: billingKeyRow, error: billingKeyError } = await supabase
      .from('ad_billing_keys_v2')
      .select('"customerKey", "isActive"')
      .eq('id', billingKeyId)
      .eq('partnerId', partnerId)
      .single();

    if (billingKeyError || !billingKeyRow) {
      return new Response(
        JSON.stringify({ error: '빌링키를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!billingKeyRow.isActive) {
      return new Response(
        JSON.stringify({ error: '비활성화된 카드입니다. 카드를 다시 등록해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. 빌링키 복호화
    const { data: decryptedKey, error: decryptError } = await supabase.rpc(
      'decrypt_billing_key',
      {
        p_billing_key_id: billingKeyId,
        p_billing_key_secret: BILLING_KEY_SECRET,
      },
    );

    if (decryptError || !decryptedKey) {
      throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`);
    }

    // 5. 토스페이먼츠 빌링 API 실결제
    const orderId = `PREMIUM-${premiumAdId}-${Date.now()}`;
    const orderName = `울단지 프리미엄 광고 (${weeks}주)`;

    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/billing/${decryptedKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: billingKeyRow.customerKey,
          amount: totalAmount,
          orderId,
          orderName,
        }),
      },
    );

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[ProcessPremiumPayment] 토스 결제 실패:', tossData);
      return new Response(
        JSON.stringify({ error: tossData.message ?? '결제에 실패했습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. 결제 성공 처리
    const now = new Date();
    const endedAt = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const vatAmount = totalAmount - Math.round(totalAmount / 1.1);
    const supplyAmount = Math.round(totalAmount / 1.1);

    // 6a. 결제 내역 INSERT (paymentType='premium')
    const { error: paymentError } = await supabase
      .from('ad_payment_history_v2')
      .insert({
        partnerId,
        premiumAdId,
        amount: totalAmount,
        supplyAmount,
        vatAmount,
        status: 'paid',
        paymentType: 'premium',
        paymentDate: now.toISOString(),
        billingPeriodStart: now.toISOString(),
        billingPeriodEnd: endedAt.toISOString(),
        paymentKey: tossData.paymentKey ?? null,
        receiptUrl: tossData.receipt?.url ?? null,
      });

    if (paymentError) {
      console.error('[ProcessPremiumPayment] 결제 내역 INSERT 실패:', paymentError);
      return new Response(
        JSON.stringify({ error: '결제는 완료되었으나 내역 기록에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6b. 프리미엄 광고 상태 → running
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
      console.error('[ProcessPremiumPayment] 상태 업데이트 실패:', updateError);
      return new Response(
        JSON.stringify({ error: '결제는 완료되었으나 광고 상태 업데이트에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 7. FCM 알림 (non-critical)
    try {
      const endedAtKst = new Date(endedAt.getTime() + 9 * 60 * 60 * 1000);
      const endDateStr = `${endedAtKst.getUTCFullYear()}.${String(endedAtKst.getUTCMonth() + 1).padStart(2, '0')}.${String(endedAtKst.getUTCDate()).padStart(2, '0')}`;
      const amountStr = totalAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

      await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '프리미엄 광고 시작',
          body: `${amountStr}원 결제가 완료되었습니다. 광고 종료일: ${endDateStr}`,
          type: 'premium_ad_started',
          navigationData: {
            type: 'premium_ad_detail',
            params: { premiumAdId },
          },
        }),
      });
    } catch (fcmError) {
      console.error('[ProcessPremiumPayment] FCM 알림 전송 실패 (non-critical):', fcmError);
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
    console.error('[ProcessPremiumPayment] 서버 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
