import type { createAdminClient } from '@/lib/supabase/server';

/**
 * 카드 없이 개시한 광고의 다음 결제일.
 *
 * inicis-charge-billing은 nextBillingDate가 오늘 이하인 구독만 청구 대상으로 잡는데,
 * 빌링키 유효성 검사가 0원 스킵 분기보다 먼저 돈다. 즉 100% 할인만으로는 배치를 못 비껴가고
 * 카드가 없다는 이유로 광고가 종료된다 — 청구를 막는 장치는 이 날짜 하나뿐이므로 덮어쓰지 않는다.
 */
const NEVER_BILLING_DATE = '2099-01-01T00:00:00.000Z';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 카드 없이 개시할 수 있는 요청인지 판정한다.
 * 클라이언트 값은 그대로 믿지 않고 서버가 확정한 할인율로 다시 본다 — 받을 돈이 0원일 때만 허용.
 */
export function canStartWithoutCard(
  requested: boolean | undefined,
  discountRate: number
): boolean {
  return requested === true && discountRate === 100;
}

interface CardlessSubscriptionParams {
  advertisementId: string;
  /** 할인 전 정상가 */
  originalMonthlyAmount: number;
  discountRate: number;
  /** 할인 적용 후 실제 청구액 — 카드 없이 개시하는 건 0원일 때뿐이다 */
  monthlyAmount: number;
  /** 개시 시각 (ISO) */
  startedAt: string;
}

/**
 * 카드 없이 개시한 광고의 구독을 만든다.
 *
 * freeEndDate에 개시 시각을 그대로 넣어 '무료기간 없음'으로 둔다
 * (inicis-activate-subscription이 무료개월 0일 때 쓰는 관례와 동일).
 * 미래로 두면 파트너 앱 배지가 '무료체험중'으로 바뀐다.
 * 해지는 cancel-subscription이 카드 없는 0원 구독을 즉시 종료로 처리한다.
 *
 * 실패하면 에러 메시지를, 성공하면 null을 돌려준다.
 */
export async function insertCardlessSubscription(
  admin: ReturnType<typeof createAdminClient>,
  params: CardlessSubscriptionParams
): Promise<string | null> {
  const kstToday = new Date(Date.now() + KST_OFFSET_MS);

  const { error } = await admin.from('ad_subscriptions_v2').insert({
    advertisementId: params.advertisementId,
    billingKeyId: null,
    subscriptionStatus: 'active',
    originalMonthlyAmount: params.originalMonthlyAmount,
    discountRate: params.discountRate,
    monthlyAmount: params.monthlyAmount,
    periodStartDate: params.startedAt,
    freeEndDate: params.startedAt,
    nextBillingDate: NEVER_BILLING_DATE,
    billingAnchorDay: kstToday.getUTCDate(),
  });

  if (error) {
    console.error('Failed to create cardless subscription:', error);
    return 'Failed to start advertisement';
  }

  return null;
}

/** 개시된 광고에 붙일 컬럼 — 결제를 건너뛰었지만 운영 상태는 결제 완료와 같다 */
export function startedAdColumns(startedAt: string) {
  return {
    adStatus: 'running',
    paymentStatus: 'paid',
    activatedAt: startedAt,
  };
}
