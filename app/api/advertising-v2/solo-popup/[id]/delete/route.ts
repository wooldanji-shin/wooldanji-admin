import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/ads/solo-popup-server';

/**
 * 단독 팝업 광고를 삭제한다. 파트너 알림은 보내지 않는다.
 * 진행 중이면 그 순간 노출이 멈추며 이미 결제한 금액은 환불하지 않는다.
 * 카드별 통계는 함께 삭제되고, 결제 이력은 보존된다(soloPopupAdId 만 NULL, ON DELETE SET NULL).
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
    const { data: ad } = await admin.from('solo_popup_ads_v2').select('id').eq('id', id).maybeSingle();
    if (!ad) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다.' }, { status: 404 });

    const { error: deleteError } = await admin.from('solo_popup_ads_v2').delete().eq('id', id);
    if (deleteError) {
      console.error('Failed to delete solo popup ad:', deleteError);
      return NextResponse.json({ error: '단독 팝업 광고 삭제에 실패했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
