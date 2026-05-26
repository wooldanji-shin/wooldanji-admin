import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getConfirmErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'ALREADY_PROCESSED_PAYMENT': return '이미 처리된 결제입니다.';
    case 'NOT_FOUND_PAYMENT_SESSION': return '결제 세션이 만료되었습니다. 다시 시도해주세요.';
    case 'NOT_FOUND_PAYMENT': return '결제 정보를 찾을 수 없습니다.';
    case 'REJECT_CARD_PAYMENT': return '카드 한도초과 또는 잔액부족으로 결제에 실패했습니다.';
    case 'REJECT_CARD_COMPANY': return '카드사에서 결제를 거절했습니다. 카드사에 문의해주세요.';
    case 'REJECT_ACCOUNT_PAYMENT': return '잔액 부족으로 결제에 실패했습니다.';
    case 'INVALID_CARD_NUMBER': return '카드번호를 다시 확인해주세요.';
    case 'INVALID_CARD_EXPIRATION': return '카드 유효기간을 다시 확인해주세요.';
    case 'INVALID_CARD_PASSWORD': return '카드 비밀번호를 다시 확인해주세요.';
    case 'INVALID_CARD_IDENTITY': return '주민번호 또는 사업자번호가 카드 소유주 정보와 일치하지 않습니다.';
    case 'INVALID_CARD_INSTALLMENT_PLAN': return '할부 개월 수가 올바르지 않습니다.';
    case 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT': return '해당 카드 또는 가맹점에서 할부가 지원되지 않습니다.';
    case 'INVALID_STOPPED_CARD': return '정지된 카드입니다.';
    case 'NOT_SUPPORTED_CARD_TYPE':
    case 'NOT_SUPPORTED_METHOD': return '지원되지 않는 카드 종류입니다. 다른 카드를 사용해주세요.';
    case 'NOT_REGISTERED_CARD_COMPANY': return '카드 등록이 필요합니다. 카드사에 문의해주세요.';
    case 'EXCEED_MAX_DAILY_PAYMENT_COUNT': return '카드 일일 결제 한도를 초과했습니다.';
    case 'EXCEED_MAX_PAYMENT_AMOUNT': return '결제 가능 금액을 초과했습니다.';
    case 'EXCEED_MAX_AUTH_COUNT': return '최대 인증 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.';
    case 'EXCEED_MAX_ONE_DAY_AMOUNT': return '카드 일일 결제 한도를 초과했습니다.';
    case 'NOT_AVAILABLE_BANK': return '은행 점검 시간입니다. 잠시 후 다시 시도해주세요.';
    case 'COMMON_ERROR': return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 'NOT_REGISTERED_BUSINESS': return '등록되지 않은 가맹점입니다. 고객센터에 문의해주세요.';
    case 'INVALID_REQUEST': return '결제 요청 정보가 올바르지 않습니다.';
    case 'FORBIDDEN_REQUEST': return '결제 요청이 거부되었습니다.';
    case 'UNAUTHORIZED_KEY': return '결제 인증에 실패했습니다.';
    case 'PAY_PROCESS_CANCELED': return '결제가 취소되었습니다.';
    case 'PAY_PROCESS_ABORTED': return '결제가 중단되었습니다. 다시 시도해주세요.';
    default: return '결제 승인에 실패했습니다.';
  }
}

/**
 * 프리미엄 광고 연장 결제 승인 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (결제창 successUrl 콜백 후, mode=extension)
 * 역할:
 *   1. running 상태 광고 + 소유자 검증
 *   2. 서버측 금액 재계산 (할인 포함) → 위변조 검증
 *   3. 토스 결제 승인 API 호출 (POST /v1/payments/confirm)
 *   4. ad_payment_history_v2 INSERT (paymentType='extension')
 *   5. premium_advertisements_v2.endedAt 연장 (기존 endedAt + weeks × 7일)
 *   6. FCM 알림 (non-critical)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const { premiumAdId, weeks, paymentKey, orderId, amount } = await req.json();
    if (!premiumAdId || !weeks || !paymentKey || !orderId || amount == null) {
      return new Response(
        JSON.stringify({ error: 'premiumAdId, weeks, paymentKey, orderId, amount는 필수입니다.' }),
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
      .select('"partnerId", status, "snapshotApartments", "approvedDiscountRate", "endedAt"')
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
    const expectedAmount = discountRate > 0
      ? Math.round(totalAmount * (100 - discountRate) / 100 / 10) * 10
      : totalAmount;

    if (expectedAmount !== amount) {
      console.error(`[ConfirmPremiumExtendPayment] 금액 불일치: DB=${expectedAmount} 클라=${amount}`);
      return new Response(
        JSON.stringify({ error: '결제 금액이 일치하지 않습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
      console.error('[ConfirmPremiumExtendPayment] 토스 승인 실패:', tossData);
      return new Response(
        JSON.stringify({ error: getConfirmErrorMessage(tossData.code ?? ''), code: tossData.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (tossData.status !== 'DONE') {
      console.error('[ConfirmPremiumExtendPayment] 토스 status !== DONE:', tossData.status);
      return new Response(
        JSON.stringify({ error: `결제 상태 이상: ${tossData.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date();
    const currentEndedAt = ad.endedAt ? new Date(ad.endedAt) : now;
    const newEndedAt = new Date(currentEndedAt.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const supplyAmount = Math.round(amount / 1.1);
    const vatAmount = amount - supplyAmount;

    const { error: paymentError } = await supabase
      .from('ad_payment_history_v2')
      .insert({
        partnerId,
        premiumAdId,
        amount,
        supplyAmount,
        vatAmount,
        status: 'paid',
        paymentType: 'extension',
        paymentDate: now.toISOString(),
        billingPeriodStart: currentEndedAt.toISOString(),
        billingPeriodEnd: newEndedAt.toISOString(),
        paymentKey: tossData.paymentKey ?? null,
        receiptUrl: tossData.receipt?.url ?? null,
      });

    if (paymentError) {
      console.error('[ConfirmPremiumExtendPayment] 결제 내역 INSERT 실패:', paymentError);
      return new Response(
        JSON.stringify({ error: '결제는 완료되었으나 내역 기록에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ended 상태였던 광고는 연장 결제 완료 시 running으로 복원
    const updatePayload: Record<string, unknown> = {
      endedAt: newEndedAt.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (ad.status === 'ended') updatePayload.status = 'running';

    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update(updatePayload)
      .eq('id', premiumAdId);

    if (updateError) {
      console.error('[ConfirmPremiumExtendPayment] 광고 endedAt 업데이트 실패:', updateError);
      return new Response(
        JSON.stringify({ error: '결제는 완료되었으나 종료일 업데이트에 실패했습니다. 고객센터에 문의해주세요.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    try {
      const newEndedAtKst = new Date(newEndedAt.getTime() + 9 * 60 * 60 * 1000);
      const endDateStr = `${newEndedAtKst.getUTCFullYear()}.${String(newEndedAtKst.getUTCMonth() + 1).padStart(2, '0')}.${String(newEndedAtKst.getUTCDate()).padStart(2, '0')}`;
      const amountStr = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

      await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '연장 결제 완료',
          body: `${amountStr}원 결제가 완료되었습니다. 광고 종료일: ${endDateStr}`,
          type: 'premium_ad_extended',
          navigationData: { type: 'premium_ad_detail', params: { premiumAdId } },
        }),
      });
    } catch (fcmError) {
      console.error('[ConfirmPremiumExtendPayment] FCM 전송 실패 (non-critical):', fcmError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        newEndedAt: newEndedAt.toISOString(),
        receiptUrl: tossData.receipt?.url ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[ConfirmPremiumExtendPayment] 서버 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
