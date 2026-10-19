import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { calcDiscountedTotalAmount } from '@/lib/ads/pricing';
import {
  buildSoloContent,
  computeSoloAmounts,
  dbErrorMessage,
  notifyPartner,
  requireAdmin,
  soloEndedAt,
  SoloInputError,
  type SoloWriteBody,
} from '@/lib/ads/solo-popup-server';

/** 0원 결제 이력 — 무료 활성화(activate-free-solo-popup-ad)와 같은 형식. 실패해도 광고 시작은 유지 */
async function recordFreePayment(
  admin: any,
  soloPopupAdId: string,
  partnerId: string,
  weeks: number,
  startedAt: Date,
  endedAt: Date
): Promise<void> {
  const { error } = await admin.from('ad_payment_history_v2').insert({
    partnerId,
    soloPopupAdId,
    periodWeeks: weeks,
    amount: 0,
    supplyAmount: 0,
    vatAmount: 0,
    status: 'paid',
    paymentType: 'solo_popup',
    paymentDate: startedAt.toISOString(),
    billingPeriodStart: startedAt.toISOString(),
    billingPeriodEnd: endedAt.toISOString(),
    paymentKey: null,
    receiptUrl: null,
  });
  if (error) console.error('Failed to record free payment (non-critical):', error);
}

/**
 * 관리자가 파트너를 대신해 단독 팝업 광고를 등록한다 (approved + unpaid → 파트너 결제만 남음).
 * 기본 광고가 운영 중(running + paid)이어야 한다. weeks·스냅샷·금액은 DB 함수로 서버 계산.
 * startImmediately(할인율 100%만)이면 결제 대기 없이 running + paid 로 바로 시작한다 (activate-free-solo-popup-ad EF와 동일).
 * 쓰기는 service_role (관리자 확인 후).
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = (await request.json()) as SoloWriteBody;
    const { partnerId, baseAdId } = body;
    if (!partnerId || !baseAdId) {
      return NextResponse.json({ error: '파트너와 기본 광고를 선택해주세요.' }, { status: 400 });
    }

    const admin = createAdminClient() as any;
    const { data: baseAd } = await admin
      .from('advertisements_v2')
      .select('id, partnerId, adStatus, paymentStatus')
      .eq('id', baseAdId)
      .maybeSingle();
    if (!baseAd) return NextResponse.json({ error: '기본 광고를 찾을 수 없습니다.' }, { status: 404 });
    if (baseAd.partnerId !== partnerId) {
      return NextResponse.json({ error: '선택한 파트너의 광고가 아닙니다.' }, { status: 400 });
    }
    if (baseAd.adStatus !== 'running' || baseAd.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: '운영 중(결제 완료)인 기본 광고에만 단독 팝업을 등록할 수 있습니다.' },
        { status: 400 }
      );
    }

    const content = await buildSoloContent(admin, body);
    const { periodUnit, periodCount } = body;
    if ((periodUnit !== 'week' && periodUnit !== 'month') || typeof periodCount !== 'number') {
      return NextResponse.json({ error: '기간 단위와 기간을 선택해주세요.' }, { status: 400 });
    }
    const amounts = await computeSoloAmounts(admin, baseAdId, periodUnit, periodCount);
    const rate = Math.min(100, Math.max(0, Number(body.discountRate) || 0));
    const discountedTotalAmount = calcDiscountedTotalAmount(amounts.totalAmount, rate);
    const startImmediately = body.startImmediately === true;
    if (startImmediately && rate !== 100) {
      return NextResponse.json({ error: '바로 시작은 할인율이 100%일 때만 선택할 수 있습니다.' }, { status: 400 });
    }
    const startedAt = new Date();
    const endedAt = soloEndedAt(startedAt, amounts.weeks);

    const { data: inserted, error: insertError } = await admin
      .from('solo_popup_ads_v2')
      .insert({
        partnerId,
        baseAdId,
        ...content,
        periodUnit,
        periodCount,
        weeks: amounts.weeks,
        status: startImmediately ? 'running' : 'approved',
        paymentStatus: startImmediately ? 'paid' : 'unpaid',
        ...(startImmediately ? { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() } : {}),
        totalAmount: amounts.totalAmount,
        approvedDiscountRate: rate > 0 ? rate : null,
        discountedTotalAmount,
        snapshotApartments: amounts.snapshot,
        adminMemo: body.adminMemo?.trim() || null,
        salesRepId: body.salesRepId || null,
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('Failed to create solo popup ad:', insertError);
      const status = insertError?.code === '23505' ? 409 : 500;
      return NextResponse.json({ error: dbErrorMessage(insertError ?? {}) }, { status });
    }

    if (startImmediately) await recordFreePayment(admin, inserted.id, partnerId, amounts.weeks, startedAt, endedAt);

    await notifyPartner({
      partnerUserId: partnerId,
      soloPopupAdId: inserted.id,
      baseAdId,
      title: startImmediately ? '단독 팝업 광고 시작' : '단독 팝업 광고 등록 안내',
      body: startImmediately
        ? '단독 팝업 광고가 시작되었습니다. 앱에서 확인해보세요.'
        : '단독 팝업 광고가 등록되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
      type: startImmediately ? 'solo_popup_ad_started' : 'solo_popup_ad_approved',
    });

    return NextResponse.json({
      success: true,
      soloPopupAdId: inserted.id,
      startImmediately,
      totalAmount: amounts.totalAmount,
      discountedTotalAmount,
    });
  } catch (err) {
    if (err instanceof SoloInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
