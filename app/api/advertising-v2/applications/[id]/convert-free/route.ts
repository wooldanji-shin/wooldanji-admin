import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { calcMonthlyAmount, fetchPricePerHousehold, PRICE_LOOKUP_FAILED_MESSAGE } from '@/lib/ads/pricing';
import {
  NEVER_BILLING_DATE,
  insertCardlessSubscription,
  startedAdColumns,
} from '@/lib/ads/start-without-card';

/** 무료 전환으로 바뀌는 승인값 — 카드 없이 개시한 광고와 같은 상태로 맞춘다 */
const FREE_AD_COLUMNS = {
  approvedDiscountRate: 100,
  approvedMonthlyAmount: 0,
  modificationStatus: null,
  modificationRejectedReason: null,
};

/**
 * 관리자가 광고를 무료(100% 할인)로 전환한다. 파트너 알림은 보내지 않는다.
 *
 * - 광고중(running): 승인값을 100%/0원으로 바꾸고, 살아 있는 구독의 청구액을 0원·다음 결제일을 2099년으로
 *   밀어 정기결제가 더 이상 돌지 않게 한다(카드 없이 개시한 광고와 동일). 해지 예약은 그대로 둔다.
 * - 종료됨(ended): 살아 있는 구독이 없으므로 카드 없이 개시와 같은 방식으로 0원 구독을 만들어 다시 시작한다.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: ad } = await admin
      .from('advertisements_v2')
      .select('id, partnerId, adStatus, approvedDiscountRate, apartmentChangeStatus, modificationStatus')
      .eq('id', id)
      .maybeSingle();

    if (!ad) {
      return NextResponse.json({ error: '광고를 찾을 수 없습니다.' }, { status: 404 });
    }

    const existing = ad as {
      partnerId: string;
      adStatus: string;
      approvedDiscountRate: number | null;
      apartmentChangeStatus: string | null;
      modificationStatus: string | null;
    };

    if (existing.adStatus !== 'running' && existing.adStatus !== 'ended') {
      return NextResponse.json(
        { error: '광고중 또는 종료된 광고만 무료로 전환할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 아파트 변경·수정 심사가 걸려 있으면 어느 값을 기준으로 전환하는지 모호해진다 — 먼저 끝내게 한다
    if (existing.apartmentChangeStatus || existing.modificationStatus === 'pending') {
      return NextResponse.json(
        { error: '아파트 변경 또는 수정 심사가 진행 중입니다. 먼저 처리한 뒤 전환해주세요.' },
        { status: 409 }
      );
    }

    if (existing.adStatus === 'running' && existing.approvedDiscountRate === 100) {
      return NextResponse.json({ error: '이미 무료 광고입니다.' }, { status: 400 });
    }

    const { error: adUpdateError } = await admin
      .from('advertisements_v2')
      .update(FREE_AD_COLUMNS)
      .eq('id', id);

    if (adUpdateError) {
      console.error('Failed to convert ad to free:', adUpdateError);
      return NextResponse.json({ error: '무료 전환에 실패했습니다.' }, { status: 500 });
    }

    if (existing.adStatus === 'running') {
      return convertRunningSubscriptions(admin, id);
    }
    return restartEndedAdForFree(admin, id, existing.partnerId);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** 광고중 광고의 살아 있는 구독을 0원·청구 없음으로 바꾼다. 해지 예약(cancel_pending)은 유지한다 */
async function convertRunningSubscriptions(
  admin: ReturnType<typeof createAdminClient>,
  advertisementId: string
) {
  const { data: subs, error: subsError } = await admin
    .from('ad_subscriptions_v2')
    .select('id, subscriptionStatus')
    .eq('advertisementId', advertisementId)
    .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending']);

  if (subsError) {
    console.error('Failed to fetch subscriptions for free conversion:', subsError);
    return NextResponse.json({ error: '구독 조회에 실패했습니다.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  for (const sub of (subs ?? []) as { id: string; subscriptionStatus: string }[]) {
    const { error } = await admin
      .from('ad_subscriptions_v2')
      .update({
        monthlyAmount: 0,
        discountRate: 100,
        nextBillingDate: NEVER_BILLING_DATE,
        // 결제 실패 유예 중이었다면 더 받을 돈이 없으므로 정상 상태로 되돌린다
        ...(sub.subscriptionStatus === 'grace_period'
          ? { subscriptionStatus: 'active', graceEndDate: null, retryCount: 0, lastRetryAt: null }
          : {}),
        updatedAt: now,
      })
      .eq('id', sub.id);

    if (error) {
      console.error('Failed to update subscription for free conversion:', error);
      return NextResponse.json({ error: '구독 변경에 실패했습니다.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, restarted: false });
}

/** 종료된 광고를 카드 없이 개시와 같은 방식으로 무료 재시작한다 */
async function restartEndedAdForFree(
  admin: ReturnType<typeof createAdminClient>,
  advertisementId: string,
  partnerId: string
) {
  const { data: apartments, error: apartmentsError } = await admin
    .from('advertisement_apartments_v2')
    .select('totalHouseholds')
    .eq('advertisementId', advertisementId);

  if (apartmentsError) {
    console.error('Failed to fetch apartments for free restart:', apartmentsError);
    return NextResponse.json({ error: '노출 아파트를 조회할 수 없습니다.' }, { status: 500 });
  }

  const totalHouseholds = ((apartments ?? []) as { totalHouseholds: number }[])
    .reduce((sum, a) => sum + (a.totalHouseholds ?? 0), 0);

  if (totalHouseholds <= 0) {
    return NextResponse.json(
      { error: '노출 아파트가 없어 다시 시작할 수 없습니다. 수정 화면에서 아파트를 먼저 지정해주세요.' },
      { status: 400 }
    );
  }

  let pricePerHousehold: number;
  try {
    pricePerHousehold = await fetchPricePerHousehold(admin);
  } catch {
    return NextResponse.json({ error: PRICE_LOOKUP_FAILED_MESSAGE }, { status: 500 });
  }

  const startedAt = new Date().toISOString();
  const subscriptionError = await insertCardlessSubscription(admin, {
    advertisementId,
    originalMonthlyAmount: calcMonthlyAmount(totalHouseholds, pricePerHousehold, 0),
    discountRate: 100,
    monthlyAmount: 0,
    startedAt,
  });

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError }, { status: 500 });
  }

  const { error: startError } = await admin
    .from('advertisements_v2')
    .update(startedAdColumns(startedAt))
    .eq('id', advertisementId);

  // running으로 못 넘겼는데 구독만 남으면 종료된 광고에 살아 있는 구독이 붙는다
  if (startError) {
    console.error('Failed to restart ended ad for free:', startError);
    await admin
      .from('ad_subscriptions_v2')
      .delete()
      .eq('advertisementId', advertisementId)
      .eq('periodStartDate', startedAt);
    return NextResponse.json({ error: '광고 재시작에 실패했습니다.' }, { status: 500 });
  }

  await admin.from('partner_users').update({ hasHadRunningAd: true }).eq('id', partnerId);

  return NextResponse.json({ success: true, restarted: true });
}
