import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

/**
 * 프리미엄 광고를 삭제한다. 파트너 알림은 보내지 않는다.
 *
 * 임시저장(draft)을 뺀 모든 상태를 허용한다 — 프리미엄이 남아 있으면 기본 광고를 지울 수 없으므로
 * 하나라도 막으면 그 기본 광고를 영영 지울 수 없게 된다.
 * FK가 ON DELETE CASCADE라 프리미엄 결제 이력·분석 데이터가 함께 삭제된다.
 * 진행 중이면 그 순간 앱 노출이 멈추며, 이미 결제한 금액은 환불하지 않는다.
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

    const { data: premium } = await admin
      .from('premium_advertisements_v2')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (!premium) {
      return NextResponse.json({ error: '프리미엄 광고를 찾을 수 없습니다.' }, { status: 404 });
    }

    if ((premium as { status: string }).status === 'draft') {
      return NextResponse.json({ error: '임시저장 상태의 프리미엄 광고는 삭제할 수 없습니다.' }, { status: 400 });
    }

    const { error: deleteError } = await admin
      .from('premium_advertisements_v2')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete premium advertisement:', deleteError);
      return NextResponse.json({ error: '프리미엄 광고 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
