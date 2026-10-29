import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyPartner, requireAdmin } from '@/lib/ads/solo-popup-server';

/**
 * 게재 중(running) 단독 팝업 광고를 관리자가 지금 종료 처리한다 (삭제 아님).
 * 노출은 즉시 멈추고 환불은 없으며 통계·결제 이력은 남는다.
 * 파트너용 stop_solo_popup_ad RPC 는 본인 소유·0원 조건이 고정이라 쓰지 않고 service_role 로 직접 갱신한다.
 * 대기 중인 수정 심사는 만료 cron(expire-solo-popup-ads)과 같은 규칙으로 함께 정리한다.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await requireAdmin();
    if (error) return error;

    const admin = createAdminClient() as any;
    const { data: ad } = await admin
      .from('solo_popup_ads_v2')
      .select('status, partnerId, baseAdId, modificationStatus')
      .eq('id', id)
      .maybeSingle();
    if (!ad) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다.' }, { status: 404 });
    if (ad.status !== 'running') {
      return NextResponse.json({ error: '게재 중인 광고만 중단할 수 있습니다. 화면을 새로고침해 주세요.' }, { status: 400 });
    }

    const { data: stopped, error: updateError } = await admin
      .from('solo_popup_ads_v2')
      .update({
        status: 'ended',
        endedAt: new Date().toISOString(),
        ...(ad.modificationStatus === 'pending' ? { modificationStatus: null, pendingChanges: null } : {}),
      })
      .eq('id', id)
      .eq('status', 'running')
      .select('id');
    if (updateError) {
      console.error('Failed to stop solo popup ad:', updateError);
      return NextResponse.json({ error: '광고를 중단하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    if (!stopped?.length) return NextResponse.json({ error: '이미 상태가 바뀌었습니다. 화면을 새로고침해 주세요.' }, { status: 409 });

    await notifyPartner({
      partnerUserId: ad.partnerId,
      soloPopupAdId: id,
      baseAdId: ad.baseAdId,
      title: '단독 팝업 광고 종료',
      body: '단독 팝업 광고 게재가 종료되었습니다.',
      type: 'solo_popup_ad_ended',
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
