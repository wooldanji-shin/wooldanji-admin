import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

/**
 * 광고중·종료된 광고를 삭제한다. 파트너 알림은 보내지 않는다.
 *
 * FK가 ON DELETE CASCADE라 노출 아파트·서브카테고리·구독·결제 이력이 함께 삭제된다.
 * 광고중 광고는 구독이 함께 사라지므로 그 순간부터 정기결제가 멈춘다(이미 결제한 금액은 환불하지 않는다).
 *
 * 프리미엄 광고가 연결돼 있으면 막는다 — 프리미엄은 노출 아파트·카테고리를 기본 광고에서 가져오므로
 * 기본 광고 없이 남은 프리미엄은 앱에 노출되지 못한다. 프리미엄부터 삭제하게 한다.
 * 임시저장 프리미엄은 결제 전 초안이라 막지 않고 함께 지운다.
 * 프리미엄 광고와 그 분석 데이터는 남고 baseAdId만 NULL이 된다(ON DELETE SET NULL, 2026-10-06 dev 반영).
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
      .select('id, adStatus')
      .eq('id', id)
      .maybeSingle();

    if (!ad) {
      return NextResponse.json({ error: '광고를 찾을 수 없습니다.' }, { status: 404 });
    }

    const adStatus = (ad as { adStatus: string }).adStatus;
    if (adStatus !== 'running' && adStatus !== 'ended') {
      return NextResponse.json({ error: '광고중이거나 종료된 광고만 삭제할 수 있습니다.' }, { status: 400 });
    }

    const { count, error: premiumError } = await admin
      .from('premium_advertisements_v2')
      .select('id', { count: 'exact', head: true })
      .eq('baseAdId', id)
      .neq('status', 'draft');

    if (premiumError) {
      console.error('Failed to check premium ads:', premiumError);
      return NextResponse.json({ error: '연결된 프리미엄 광고를 확인하지 못했습니다.' }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: '연결된 프리미엄 광고를 먼저 삭제해주세요.' },
        { status: 409 }
      );
    }

    const { error: draftDeleteError } = await admin
      .from('premium_advertisements_v2')
      .delete()
      .eq('baseAdId', id)
      .eq('status', 'draft');

    if (draftDeleteError) {
      console.error('Failed to delete draft premium ads:', draftDeleteError);
      return NextResponse.json({ error: '광고 삭제에 실패했습니다.' }, { status: 500 });
    }

    const { error: deleteError } = await admin
      .from('advertisements_v2')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete advertisement:', deleteError);
      return NextResponse.json({ error: '광고 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
