import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 이벤트 강제 종료 — 되돌릴 수 없다.
 * 종료 즉시 앱 노출(홈 배너 등)에서 빠지므로 approved 상태에서만 허용한다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r =>
      ['SUPER_ADMIN', 'MANAGER'].includes(r.role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: '이 작업을 할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { data: event, error: fetchError } = await supabase
      .from('partner_events')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' },
        { status: 404 }
      );
    }

    if (event.status !== 'approved') {
      return NextResponse.json(
        { error: '진행 중(승인됨)인 이벤트만 강제 종료할 수 있습니다. 화면을 새로고침해 이벤트 상태를 확인해 주세요.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('partner_events')
      .update({
        status: 'ended',
        endedAt: new Date().toISOString(),
        endedBy: currentUser.id,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to end event:', updateError);
      return NextResponse.json(
        { error: '이벤트를 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Event ended successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
