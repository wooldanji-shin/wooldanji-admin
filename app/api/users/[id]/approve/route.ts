import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function PUT(
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

    // 관리자 권한 확인 (APT_ADMIN, SUPER_ADMIN, MANAGER 가능)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r =>
      ['APT_ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(r.role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!['approve', 'pending'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approve" or "pending"' },
        { status: 400 }
      );
    }

    // 회원 승인 상태 업데이트
    const { data, error } = await supabase
      .from('user')
      .update({ approvalStatus: status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update approval status:', error);
      return NextResponse.json(
        { error: 'Failed to update approval status' },
        { status: 500 }
      );
    }

    // 승인 시 FCM 알림 전송 (non-critical)
    if (status === 'approve') {
      try {
        const adminSupabase = createAdminClient();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // 파트너 전환 신청자 여부 확인 (FCM 토큰이 partner_users에 있음)
        const { data: partnerUser } = await adminSupabase
          .from('partner_users')
          .select('id')
          .eq('userId', id)
          .maybeSingle();

        if (partnerUser) {
          // 파트너→아파트 전환 승인: partner_users.fcmToken으로 전송
          await fetch(`${supabaseUrl}/functions/v1/send-partner-fcm-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              partnerUserId: partnerUser.id,
              title: '아파트 회원 승인 완료',
              body: '아파트 회원 신청이 승인되었습니다. 앱에서 확인해주세요!',
              type: 'membership_approved',
            }),
          });
        } else {
          // 일반 아파트 회원 승인: user.fcmToken으로 전송
          await fetch(`${supabaseUrl}/functions/v1/send-approval-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ userId: id, userName: data.name ?? '' }),
          });
        }
      } catch (notificationError) {
        console.error('승인 알림 전송 실패 (non-critical):', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}