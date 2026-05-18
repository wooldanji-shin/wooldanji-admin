import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 토스 결제 승인 에러코드 → 사용자 친화적 메시지
// 참고: https://docs.tosspayments.com/reference/error-codes
function getConfirmErrorMessage(errorCode: string): string {
  switch (errorCode) {
    // 중복/세션
    case 'ALREADY_PROCESSED_PAYMENT':
      return '이미 처리된 결제입니다.';
    case 'NOT_FOUND_PAYMENT_SESSION':
      return '결제 세션이 만료되었습니다. 다시 시도해주세요.';
    case 'NOT_FOUND_PAYMENT':
      return '결제 정보를 찾을 수 없습니다.';

    // 카드사 거절 / 잔액
    case 'REJECT_CARD_PAYMENT':
      return '카드 한도초과 또는 잔액부족으로 결제에 실패했습니다.';
    case 'REJECT_CARD_COMPANY':
      return '카드사에서 결제를 거절했습니다. 카드사에 문의해주세요.';
    case 'REJECT_ACCOUNT_PAYMENT':
      return '잔액 부족으로 결제에 실패했습니다.';

    // 카드 정보 오류
    case 'INVALID_CARD_NUMBER':
      return '카드번호를 다시 확인해주세요.';
    case 'INVALID_CARD_EXPIRATION':
      return '카드 유효기간을 다시 확인해주세요.';
    case 'INVALID_CARD_PASSWORD':
      return '카드 비밀번호를 다시 확인해주세요.';
    case 'INVALID_CARD_IDENTITY':
      return '주민번호 또는 사업자번호가 카드 소유주 정보와 일치하지 않습니다.';
    case 'INVALID_CARD_INSTALLMENT_PLAN':
      return '할부 개월 수가 올바르지 않습니다.';
    case 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT':
      return '해당 카드 또는 가맹점에서 할부가 지원되지 않습니다.';
    case 'INVALID_STOPPED_CARD':
      return '정지된 카드입니다.';
    case 'NOT_SUPPORTED_CARD_TYPE':
    case 'NOT_SUPPORTED_METHOD':
      return '지원되지 않는 카드 종류입니다. 다른 카드를 사용해주세요.';
    case 'NOT_REGISTERED_CARD_COMPANY':
      return '카드 등록이 필요합니다. 카드사에 문의해주세요.';

    // 한도/횟수
    case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
      return '카드 일일 결제 한도를 초과했습니다.';
    case 'EXCEED_MAX_PAYMENT_AMOUNT':
      return '결제 가능 금액을 초과했습니다.';
    case 'EXCEED_MAX_AUTH_COUNT':
      return '최대 인증 횟수를 초과했습니다. 잊시 후 다시 시도해주세요.';
    case 'EXCEED_MAX_ONE_DAY_AMOUNT':
      return '카드 일일 결제 한도를 초과했습니다.';

    // 점검/일시 오류
    case 'NOT_AVAILABLE_BANK':
      return '은행 점검 시간입니다. 잊시 후 다시 시도해주세요.';
    case 'COMMON_ERROR':
      return '일시적인 오류가 발생했습니다. 잊시 후 다시 시도해주세요.';

    // 가맹점/요청 오류
    case 'NOT_REGISTERED_BUSINESS':
      return '등록되지 않은 가맹점입니다. 고객센터에 문의해주세요.';
    case 'INVALID_REQUEST':
      return '결제 요청 정보가 올바르지 않습니다.';
    case 'FORBIDDEN_REQUEST':
      return '결제 요청이 거부되었습니다.';
    case 'UNAUTHORIZED_KEY':
      return '결제 인증에 실패했습니다.';

    // 사용자 취소
    case 'PAY_PROCESS_CANCELED':
      return '결제가 취소되었습니다.';
    case 'PAY_PROCESS_ABORTED':
      return '결제가 중단되었습니다. 다시 시도해주세요.';

    default:
      return '결제 승인에 실패했습니다.';
  }
}

/**
 * 프리미엄 광고 단발성 결제 승인 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (결제창 successUrl 콜백 후)
 * 역할:
 *   1. 광고 + 금액 위변조 검증 (DB의 discountedTotalAmount ?? totalAmount === 클라 amount)
 *   2. 토스 결제 승인 API 호출 (POST /v1/payments/confirm)
 *   3. ad_payment_history_v2 INSERT (paymentType='premium')
 *   4. premium_advertisements_v2 → running 상태 + 기간 설정
 *   5. FCM 알림 (non-critical)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 일반결제 시크릿 키 — 자동결제(빌링) 키와 별개 MID로 발급됨.
    // 미설정 시 기존 TOSS_BILLING_SECRET_KEY 폴백 (테스트 환경 단일 키 운용 시).
    const TOSS_BILLING_SECRET_KEY =
      Deno.env.get('TOSS_WIDGET_SECRET_KEY') ?? Deno.env.get('TOSS_BILLING_SECRET_KEY')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!TOSS_BILLING_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 정보가 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { premiumAdId, paymentKey, orderId, amount } = await req.json();

    if (!premiumAdId || !paymentKey || !orderId || amount == null) {
      return new Response(
        JSON.stringify({ error: 'premiumAdId, paymentKey, orderId, amount는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 사용자 검증
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

    // 광고 + 금액 위변조 검증
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

    const totalAmount = ad.totalAmount as number;
    const weeks = ad.weeks as number;
    const expectedAmount = (ad.discountedTotalAmount as number | null) ?? totalAmount;

    // 금액 위변조 검증 (서버가 source of truth)
    if (expectedAmount !== amount) {
      console.error(
        `[ConfirmPremiumPayment] 금액 불일치: DB=${expectedAmount} 클라=${amount}`,
      );
      return new Response(
        JSON.stringify({ error: '결제 금액이 일치하지 않습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 토스 결제 승인 API
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[ConfirmPremiumPayment] 토스 승인 실패:', tossData);
      const userMessage = getConfirmErrorMessage(tossData.code ?? '');
      return new Response(
        JSON.stringify({ error: userMessage, code: tossData.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (tossData.status !== 'DONE') {
      console.error('[ConfirmPremiumPayment] 토스 status !== DONE:', tossData.status);
      return new Response(
        JSON.stringify({ error: `결제 상태 이상: ${tossData.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 결제 성공 처리
    const now = new Date();
    const endedAt = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const supplyAmount = Math.round(amount / 1.1);
    const vatAmount = amount - supplyAmount;

    // 결제 내역 INSERT
    const { error: paymentError } = await supabase
      .from('ad_payment_history_v2')
      .insert({
        partnerId,
        premiumAdId,
        amount: amount,
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
      console.error('[ConfirmPremiumPayment] 결제 내역 INSERT 실패:', paymentError);
      return new Response(
        JSON.stringify({
          error: '결제는 완료되었으나 내역 기록에 실패했습니다. 고객센터에 문의해주세요.',
        }),
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
      console.error('[ConfirmPremiumPayment] 광고 상태 업데이트 실패:', updateError);
      return new Response(
        JSON.stringify({
          error: '결제는 완료되었으나 광고 상태 업데이트에 실패했습니다. 고객센터에 문의해주세요.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // FCM 알림 (non-critical)
    try {
      const endedAtKst = new Date(endedAt.getTime() + 9 * 60 * 60 * 1000);
      const endDateStr = `${endedAtKst.getUTCFullYear()}.${String(endedAtKst.getUTCMonth() + 1).padStart(2, '0')}.${String(endedAtKst.getUTCDate()).padStart(2, '0')}`;
      const amountStr = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
          navigationData: { type: 'premium_ad_detail', params: { premiumAdId } },
        }),
      });
    } catch (fcmError) {
      console.error('[ConfirmPremiumPayment] FCM 전송 실패 (non-critical):', fcmError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        startedAt: now.toISOString(),
        endedAt: endedAt.toISOString(),
        receiptUrl: tossData.receipt?.url ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[ConfirmPremiumPayment] 서버 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});