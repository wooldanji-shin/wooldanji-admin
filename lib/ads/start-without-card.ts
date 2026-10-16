import type { createAdminClient } from '@/lib/supabase/server';

/**
 * 카드 없이 개시한 광고의 다음 결제일.
 *
 * inicis-charge-billing은 nextBillingDate가 오늘 이하인 구독만 청구 대상으로 잡는데,
 * 빌링키 유효성 검사가 0원 스킵 분기보다 먼저 돈다. 즉 100% 할인만으로는 배치를 못 비껴가고
 * 카드가 없다는 이유로 광고가 종료된다 — 청구를 막는 장치는 이 날짜 하나뿐이므로 덮어쓰지 않는다.
 */
export const NEVER_BILLING_DATE = '2099-01-01T00:00:00.000Z';

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

/** 살아 있는 구독 — ad_subscriptions_v2의 부분 UNIQUE 인덱스(광고당 1건) 대상 상태와 같다 */
const LIVE_SUBSCRIPTION_STATUSES = ['active', 'grace_period', 'cancel_pending'];

export const LIVE_SUBSCRIPTION_EXISTS_MESSAGE =
  '이미 진행 중인 구독이 있어 광고를 시작할 수 없습니다. 광고 상태와 구독 상태를 확인해 주세요.';

const START_FAILED_MESSAGE = '광고 시작에 실패했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 카드 없이 개시하기 전에 살아 있는 구독이 없는지 확인한다.
 * 구독 INSERT는 유니크 인덱스에 걸려 실패하는데, 그 전에 쓴 광고·아파트 변경은 남는다 —
 * 그래서 어떤 쓰기보다도 먼저 불러야 한다. 막아야 하면 응답할 status·메시지를, 아니면 null을 돌려준다.
 */
export async function checkNoLiveSubscription(
  admin: ReturnType<typeof createAdminClient>,
  advertisementId: string
): Promise<{ status: number; error: string } | null> {
  const { data, error } = await admin
    .from('ad_subscriptions_v2')
    .select('id')
    .eq('advertisementId', advertisementId)
    .in('subscriptionStatus', LIVE_SUBSCRIPTION_STATUSES)
    .limit(1);

  if (error) {
    console.error('Failed to check live subscription:', error);
    return { status: 500, error: START_FAILED_MESSAGE };
  }

  if ((data ?? []).length > 0) {
    return { status: 409, error: LIVE_SUBSCRIPTION_EXISTS_MESSAGE };
  }

  return null;
}

/**
 * 카드 없이 개시한 광고의 구독을 만든다.
 *
 * freeEndDate에 개시 시각을 그대로 넣어 '무료기간 없음'으로 둔다
 * (inicis-activate-subscription이 무료개월 0일 때 쓰는 관례와 동일).
 * 미래로 두면 파트너 앱 배지가 '무료체험중'으로 바뀐다.
 * 해지는 cancel-subscription이 카드 없는 0원 구독을 즉시 종료로 처리한다.
 *
 * 성공하면 만든 구독 id를, 실패하면 에러 메시지를 돌려준다.
 * 롤백은 이 id로만 지운다 — 광고 단위로 지우면 다른 구독까지 사라진다.
 */
export async function insertCardlessSubscription(
  admin: ReturnType<typeof createAdminClient>,
  params: CardlessSubscriptionParams
): Promise<{ subscriptionId: string; error: null } | { subscriptionId: null; error: string }> {
  const kstToday = new Date(Date.now() + KST_OFFSET_MS);

  const { data, error } = await admin
    .from('ad_subscriptions_v2')
    .insert({
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
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create cardless subscription:', error);
    // 사전 확인과 INSERT 사이에 다른 요청이 구독을 만든 경우 — 유니크 인덱스 위반
    const message = error?.code === '23505' ? LIVE_SUBSCRIPTION_EXISTS_MESSAGE : START_FAILED_MESSAGE;
    return { subscriptionId: null, error: message };
  }

  return { subscriptionId: data.id as string, error: null };
}

/** 개시된 광고에 붙일 컬럼 — 결제를 건너뛰었지만 운영 상태는 결제 완료와 같다 */
export function startedAdColumns(startedAt: string) {
  return {
    adStatus: 'running',
    paymentStatus: 'paid',
    activatedAt: startedAt,
  };
}
