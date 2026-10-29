import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { calcDiscountedTotalAmount } from '@/lib/ads/pricing';
import {
  dbErrorMessage,
  notifyPartner,
  requireAdmin,
  startSoloPopupWithoutPayment,
} from '@/lib/ads/solo-popup-server';

/**
 * 단독 팝업 광고 신청 승인 (pending → approved). 할인율·영업 담당자·메모를 함께 저장한다.
 * startImmediately(할인율 100%만)이면 승인 직후 결제 없이 running 으로 시작한다 (수정 화면의 바로 시작과 동일 헬퍼).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, error } = await requireAdmin();
    if (error) return error;
    const db = supabase as any;

    const body = await request.json().catch(() => ({}));
    const rate = Math.min(100, Math.max(0, Number(body?.discountRate) || 0));
    const adminMemo: string | undefined = body?.adminMemo;
    const salesRepId: string | null | undefined = body?.salesRepId;
    const startImmediately = body?.startImmediately === true;
    // 승인 UPDATE 전에 거절해야 잘못된 요청이 부분 상태를 남기지 않는다
    if (startImmediately && rate !== 100) {
      return NextResponse.json({ error: '바로 시작은 할인율이 100%일 때만 선택할 수 있습니다.' }, { status: 400 });
    }

    const { data: ad } = await db
      .from('solo_popup_ads_v2')
      .select('status, partnerId, totalAmount, baseAdId, weeks')
      .eq('id', id)
      .single();
    if (!ad) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' }, { status: 404 });
    if (ad.status !== 'pending') {
      return NextResponse.json({ error: '심사 중인 신청만 승인할 수 있습니다. 이미 처리됐을 수 있으니 화면을 새로고침해 주세요.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await db
      .from('solo_popup_ads_v2')
      .update({
        status: 'approved',
        approvedDiscountRate: rate > 0 ? rate : null,
        discountedTotalAmount: calcDiscountedTotalAmount(ad.totalAmount as number, rate),
        adminMemo: adminMemo?.trim() || null,
        ...(salesRepId !== undefined ? { salesRepId: salesRepId || null } : {}),
        rejectedReason: null,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');
    if (updateError) {
      console.error('Failed to approve solo popup ad:', updateError);
      return NextResponse.json({ error: dbErrorMessage(updateError) }, { status: 500 });
    }
    if (!updated?.length) return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 409 });

    if (!startImmediately) {
      await notifyPartner({
        partnerUserId: ad.partnerId,
        soloPopupAdId: id,
        baseAdId: ad.baseAdId,
        title: '단독 팝업 광고 심사 결과',
        body: rate > 0
          ? `단독 팝업 광고가 승인되었습니다. ${rate}% 할인이 적용되었습니다.`
          : '단독 팝업 광고가 승인되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
        type: 'solo_popup_ad_approved',
      });
      return NextResponse.json({ success: true, startImmediately: false });
    }

    // 승인은 이미 저장됐으므로 바로 시작 실패는 별도 안내 (헬퍼가 '광고 시작' 알림까지 보낸다)
    let started = false;
    try {
      started = await startSoloPopupWithoutPayment(createAdminClient(), {
        id,
        partnerId: ad.partnerId,
        baseAdId: ad.baseAdId,
        weeks: ad.weeks,
      });
    } catch (startError) {
      console.error('Failed to start solo popup ad on approval:', startError);
    }
    if (!started) {
      return NextResponse.json(
        { error: '승인은 완료됐지만 바로 시작하지 못했습니다. 화면을 새로고침한 뒤 수정 화면에서 \'바로 시작\'을 다시 선택해 주세요.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, startImmediately: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
