import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { SoloPeriodUnit } from '@/lib/ads/solo-popup';
import {
  computeSoloAmounts,
  dbErrorMessage,
  notifySoloStarted,
  recordFreeSoloPayment,
  requireAdmin,
  SoloInputError,
  soloEndedAt,
} from '@/lib/ads/solo-popup-server';

/** 관리자 재시작은 항상 무료라 할인율 100% 로 기록한다 (앱이 무료 광고로 보고 연장 버튼을 숨긴다) */
const FREE_DISCOUNT_RATE = 100;

/**
 * 종료된(ended) 단독 팝업 광고를 관리자가 결제 없이(0원) 오늘부터 다시 게재한다.
 * 같은 row 를 갱신하므로 통계는 이어서 쌓이고, 예전 게재 이력은 결제 이력에만 남는다.
 * 유료 재개는 파트너 앱 '광고 재개하기'(resume_solo_popup_ad) 로만 한다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await requireAdmin();
    if (error) return error;

    const body = (await request.json().catch(() => ({}))) as { periodUnit?: SoloPeriodUnit; periodCount?: number };
    const admin = createAdminClient() as any;

    const { data: ad } = await admin
      .from('solo_popup_ads_v2')
      .select('status, partnerId, baseAdId')
      .eq('id', id)
      .maybeSingle();
    if (!ad) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다.' }, { status: 404 });
    if (ad.status !== 'ended') {
      return NextResponse.json({ error: '종료된 광고만 다시 시작할 수 있습니다. 화면을 새로고침해 주세요.' }, { status: 400 });
    }
    if (!ad.baseAdId) {
      return NextResponse.json({ error: '연결된 기본 광고가 없어 다시 시작할 수 없습니다.' }, { status: 400 });
    }

    // 파트너 재개(resume_solo_popup_ad)와 같은 조건: 기본 광고가 실제로 노출 중이어야 한다
    const { data: base } = await admin
      .from('advertisements_v2')
      .select('adStatus, paymentStatus, isHidden')
      .eq('id', ad.baseAdId)
      .maybeSingle();
    if (!base || base.adStatus !== 'running' || base.paymentStatus !== 'paid' || base.isHidden) {
      return NextResponse.json({ error: '연결된 기본 광고가 게재 중일 때만 다시 시작할 수 있습니다.' }, { status: 400 });
    }

    const amounts = await computeSoloAmounts(admin, ad.baseAdId, body.periodUnit!, body.periodCount!);
    const startedAt = new Date();
    const endedAt = soloEndedAt(startedAt, amounts.weeks);

    const { data: restarted, error: updateError } = await admin
      .from('solo_popup_ads_v2')
      .update({
        status: 'running',
        paymentStatus: 'paid',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        periodUnit: body.periodUnit,
        periodCount: body.periodCount,
        weeks: amounts.weeks,
        snapshotApartments: amounts.snapshot,
        totalAmount: amounts.totalAmount,
        approvedDiscountRate: FREE_DISCOUNT_RATE,
        discountedTotalAmount: 0,
        rejectedReason: null,
        modificationStatus: null,
        modificationRejectedReason: null,
        pendingChanges: null,
        notifiedExpiry7days: false,
      })
      .eq('id', id)
      .eq('status', 'ended')
      .select('id');
    if (updateError) {
      console.error('Failed to restart solo popup ad:', updateError);
      return NextResponse.json({ error: dbErrorMessage(updateError) }, { status: updateError.code === '23505' ? 409 : 500 });
    }
    if (!restarted?.length) return NextResponse.json({ error: '이미 상태가 바뀌었습니다. 화면을 새로고침해 주세요.' }, { status: 409 });

    await recordFreeSoloPayment(admin, id, ad.partnerId, amounts.weeks, startedAt, endedAt);
    await notifySoloStarted(ad.partnerId, id, ad.baseAdId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SoloInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
