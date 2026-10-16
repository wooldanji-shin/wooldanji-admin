import { NextRequest, NextResponse } from 'next/server';
import { calcDiscountedTotalAmount } from '@/lib/ads/pricing';
import { dbErrorMessage, notifyPartner, requireAdmin } from '@/lib/ads/solo-popup-server';

/** 단독 팝업 광고 신청 승인 (pending → approved). 할인율·영업 담당자·메모를 함께 저장한다. */
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

    const { data: ad } = await db
      .from('solo_popup_ads_v2')
      .select('status, partnerId, totalAmount, baseAdId')
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
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
