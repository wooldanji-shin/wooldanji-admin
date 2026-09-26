import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ENTRY_STARTED_MESSAGE = '응모 시작 시각이 지나 승인할 수 없습니다. 일정을 수정한 뒤 승인해주세요.';

function isEntryStarted(entryStartAt: string): boolean {
  return new Date(entryStartAt).getTime() <= Date.now();
}

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
      .select('status, entryStartAt, partnerUserId, title')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.status !== 'pending') {
      return NextResponse.json(
        { error: 'Event is not pending' },
        { status: 400 }
      );
    }

    // 응모 시작이 지난 뒤 승인하면 응모 기간이 줄거나 응모 0명이 된다 — 일정 수정 후 승인
    if (isEntryStarted(event.entryStartAt)) {
      return NextResponse.json(
        { error: ENTRY_STARTED_MESSAGE },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('partner_events')
      .update({
        status: 'approved',
        approvedAt: new Date().toISOString(),
        rejectionReason: null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve event:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve event' },
        { status: 500 }
      );
    }

    // 파트너에게 승인 알림 (실패해도 승인은 유지) — 알림함 기록 + 푸시, 탭하면 이벤트 상세로 이동
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: event.partnerUserId,
          title: '이벤트 승인 완료',
          body: `"${event.title}" 이벤트 승인이 완료되었습니다.`,
          type: 'event_approved',
          navigationData: {
            type: 'partner_event_detail',
            params: { eventId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('이벤트 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Event approved successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
