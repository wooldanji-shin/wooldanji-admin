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
        { error: 'Unauthorized' },
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
        { error: 'Forbidden - Admin access required' },
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
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved events can be force-ended' },
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
        { error: 'Failed to end event' },
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
