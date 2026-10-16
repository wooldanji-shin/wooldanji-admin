import { NextRequest, NextResponse } from 'next/server';
import { notifyPartner, requireAdmin } from '@/lib/ads/solo-popup-server';

/** 단독 팝업 광고 신청 거절 (pending → rejected) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, error } = await requireAdmin();
    if (error) return error;
    const db = supabase as any;

    const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
    if (!reason?.trim()) return NextResponse.json({ error: '거절 사유를 입력해주세요' }, { status: 400 });

    const { data: ad } = await db
      .from('solo_popup_ads_v2')
      .select('status, partnerId, baseAdId')
      .eq('id', id)
      .single();
    if (!ad) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' }, { status: 404 });
    if (ad.status !== 'pending') {
      return NextResponse.json({ error: '심사 중인 신청만 거절할 수 있습니다. 이미 처리됐을 수 있으니 화면을 새로고침해 주세요.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await db
      .from('solo_popup_ads_v2')
      .update({ status: 'rejected', rejectedReason: reason.trim() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');
    if (updateError) {
      console.error('Failed to reject solo popup ad:', updateError);
      return NextResponse.json({ error: '단독 팝업 광고를 거절하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    if (!updated?.length) return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 409 });

    await notifyPartner({
      partnerUserId: ad.partnerId,
      soloPopupAdId: id,
      baseAdId: ad.baseAdId,
      title: '단독 팝업 광고 심사 결과',
      body: `단독 팝업 광고 신청이 거절되었습니다. 사유: ${reason.trim()}`,
      type: 'solo_popup_ad_rejected',
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
