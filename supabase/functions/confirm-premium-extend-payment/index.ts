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
    case 'ALREADY_PROCESSED_PAYMENT':
      return '이미 처리된 결제입니다.';
    case 'NOT_FOUND_PAYMENT_SESSION':
      return '결제 세션이 만료되었습니다. 다시 시도해주세요.';
    case 'NOT_FOUND_PAYMENT':
      return '결제 정보를 찾을 수 없습니다.';
    case 'REJECT_CARD_PAYMENT':
      return '카드 한도초과 또는 잔액부족으로 결제에 실패했습니다.';
    case 'REJECT_CARD_COMPANY':
      return '카드사에서 결제를 거절했습니다. 카드사에 문의해주세요.';
    case 'REJECT_ACCOUNT_PAYMENT':
      return '잔액 부족으로 결제에 실패했습니다.';
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
    case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
      return '카드 일일 결제 한도를 초과했습니다.';
    case 'EXCEED_MAX_PAYMENT_AMOUNT':
      return '결제 가능 금액을 초과했습니다.';
    case 'EXCEED_MAX_AUTH_COUNT':
      return '최대 인증 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.';
    case 'EXCEED_MAX_ONE_DAY_AMOUNT':
      return '카드 일일 결제 한도를 초과했습니다.';
    case 'NOT_AVAILABLE_BANK':
      return '은행 점검 시간입니다. 잠시 후 다시 시도해주세요.';
    case 'COMMON_ERROR':
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 'NOT_REGISTERED_BUSINESS':
      return '등록되지 않은 가맹점입니다. 고객센터에 문의해주세요.';
    case 'INVALID_REQUEST':
      return '결제 요청 정보가 올바르지 않습니다.';
    case 'FORBIDDEN_REQUEST':
      return '결제 요청이 거부되었습니다.';
    case 'UNAUTHORIZED_KEY':
      return '결제 인증에 실패했습니다.';
    case 'PAY_PROCESS_CANCELED':
      return '결제가 취소되었습니다.';
    case 'PAY_PROCESS_ABORTED':
      return '결제가 중단되었습니다. 다시 시도해주세요.';
    default:
      return '결제 승인에 실패했습니다.';
  }
}

/**
 * 프리미엄 광고 연장 단발성 결제 승인 Edge Function
 *
 * 호출 주체: Flutter 파트너 앱 (결제창 successUrl 콜백 후, mode=extension)
 * 역할:
 *   1. 광고 + weeks 위변조 검증 (서버 재계산 amount === 클라 amount)
 *   2. 토스 결제 승인 API 호출 (POST /v1/payments/confirm)
 *   3. confirm_premium_extension RPC 호출 (단일 트랜잭션)
 *      - ad_payment_history_v2 INSERT (paymentType='extension')
 *      - premium_advertisements_v2.endedAt 연장 (기존 endedAt + weeks×7일)
 *   4. RPC 실패 시: 토스 결제 자동 취소(best-effort) + 500 응답
 *      - orderId UNIQUE 위반은 DUPLICATE_PAYMENT 로 구분 응답
 *   5. FCM "연장 결제 완료 (N원), 광고 종료일: YYYY.MM.DD" (non-critical, RPC 성공 후)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 일반결제 시크릿 키 — 자동결제(빌링) 키와 별개 MID로 발급됨.
    const TOSS_SECRET_KEY =
      Deno.env.get('TOSS_PAYMENT_SECRET_KEY') ?? Deno.env.get('TOSS_SECRET_KEY')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!TOSS_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
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

    if (!premiumAdId || !paymentKey || !orderId || amount == null || weeks == null) {
      return new Response(
        JSON.stringify({
          error: 'premiumAdId, weeks, paymentKey, orderId, amount는 필수입니다.',
        }),
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

    // 광고 조회 + 검증
    const { data: ad, error: adError } = await supabase
      .from('premium_advertisements_v2')
      .select('"partnerId", status, "paymentStatus", "endedAt", "snapshotApartments"')
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

    // 단가 조회 (서버 재계산 source)
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
    const expectedAmount = totalHouseholds * pricePerHouseholdPerWeek * weeksNum;

    // 금액 위변조 검증 (서버가 source of truth)
    if (expectedAmount !== amount) {
      console.error(
        `[ConfirmPremiumExtendPayment] 금액 불일치: server=${expectedAmount} client=${amount}`,
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
        Authorization: 'Basic ' + btoa(TOSS_SECRET_KEY + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[ConfirmPremiumExtendPayment] 토스 승인 실패:', tossData);
      const userMessage = getConfirmErrorMessage(tossData.code ?? '');
      return new Response(
        JSON.stringify({ error: userMessage, code: tossData.code }),
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

    // 결제 성공 처리
    const now = new Date();
    // 연장 기간 계산: 기존 endedAt 기준 (now 기준 아님)
    const currentEndedAt = ad.endedAt ? new Date(ad.endedAt) : now;
    const newEndedAt = new Date(currentEndedAt.getTime() + weeksNum * 7 * 24 * 60 * 60 * 1000);

    const supplyAmount = Math.round(amount / 1.1);
    const vatAmount = amount - supplyAmount;

    // Design Ref: §2.2 — INSERT + UPDATE 를 RPC 단일 트랜잭션으로 처리
    // Plan SC: 연장 결제마다 ad_payment_history_v2 INSERT 100% 성공 (원자성)
    const { error: rpcError } = await supabase.rpc('confirm_premium_extension', {
      p_ad_id: premiumAdId,
      p_partner_id: partnerId,
      p_weeks: weeksNum,
      p_amount: amount,
      p_supply_amount: supplyAmount,
      p_vat_amount: vatAmount,
      p_payment_key: tossData.paymentKey,
      p_order_id: orderId,
      p_receipt_url: tossData.receipt?.url ?? null,
      p_current_ended_at: currentEndedAt.toISOString(),
      p_new_ended_at: newEndedAt.toISOString(),
    });

    if (rpcError) {
      // 토스 결제는 이미 승인된 상태 — DB 기록 실패
      // (1) 토스 결제 자동 취소 시도 (best-effort, 실패해도 운영 알림으로 이관)
      console.error('[ConfirmPremiumExtendPayment] RPC 실패:', {
        premiumAdId,
        orderId,
        paymentKey: tossData.paymentKey,
        rpcError,
      });

      try {
        const cancelRes = await fetch(
          `https://api.tosspayments.com/v1/payments/${tossData.paymentKey}/cancel`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + btoa(TOSS_SECRET_KEY + ':'),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cancelReason: 'DB 기록 실패로 인한 자동 환불',
            }),
          },
        );
        if (!cancelRes.ok) {
          const cancelErr = await cancelRes.json().catch(() => ({}));
          console.error('[ConfirmPremiumExtendPayment] 토스 자동 취소 실패:', cancelErr);
        }
      } catch (cancelException) {
        console.error('[ConfirmPremiumExtendPayment] 토스 자동 취소 예외:', cancelException);
      }

      // 멱등성 위반(이중 confirm) 인 경우 사용자에게 더 명확한 메시지
      const isDuplicate =
        typeof rpcError.message === 'string' &&
        rpcError.message.includes('ad_payment_history_v2_order_id_uniq');

      return new Response(
        JSON.stringify({
          error: isDuplicate
            ? '이미 처리된 결제입니다.'
            : '결제 기록 저장에 실패하여 자동 환불 처리되었습니다. 잠시 후 다시 시도해주세요.',
          code: isDuplicate ? 'DUPLICATE_PAYMENT' : 'PAYMENT_RECORD_FAILED',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // FCM 알림 (non-critical)
    try {
      const newEndedAtKst = new Date(newEndedAt.getTime() + 9 * 60 * 60 * 1000);
      const endDateStr = `${newEndedAtKst.getUTCFullYear()}.${String(newEndedAtKst.getUTCMonth() + 1).padStart(2, '0')}.${String(newEndedAtKst.getUTCDate()).padStart(2, '0')}`;
      const amountStr = (amount as number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
          navigationData: {
            type: 'premium_ad_detail',
            params: { premiumAdId },
          },
        }),
      });
    } catch (fcmError) {
      console.error('[ConfirmPremiumExtendPayment] FCM 전송 실패 (non-critical):', fcmError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        newEndedAt: newEndedAt.toISOString(),
        totalAmount: amount,
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
