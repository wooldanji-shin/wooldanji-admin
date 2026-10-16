import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const body = await request.json();
    const { rejectionReason } = body as { rejectionReason: string };

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: '거절 사유를 입력해 주세요.' },
        { status: 400 }
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

    if (event.status !== 'pending') {
      return NextResponse.json(
        { error: '승인 대기 중인 이벤트만 거절할 수 있습니다. 이미 처리됐을 수 있으니 화면을 새로고침해 주세요.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('partner_events')
      .update({
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        rejectedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject event:', updateError);
      return NextResponse.json(
        { error: '이벤트를 거절하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Event rejected successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
