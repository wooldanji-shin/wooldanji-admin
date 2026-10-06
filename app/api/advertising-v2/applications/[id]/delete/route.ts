import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

/**
 * 종료된 광고를 삭제한다. 파트너 알림은 보내지 않는다.
 *
 * 종료(ended) 상태만 허용한다 — 살아 있는 구독이 있는 광고를 지우면 청구 중인 구독이 함께 사라진다.
 * FK가 ON DELETE CASCADE라 노출 아파트·서브카테고리·구독·결제 이력이 함께 삭제된다.
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

    if ((ad as { adStatus: string }).adStatus !== 'ended') {
      return NextResponse.json({ error: '종료된 광고만 삭제할 수 있습니다.' }, { status: 400 });
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
