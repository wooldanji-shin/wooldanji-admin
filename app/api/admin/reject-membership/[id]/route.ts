import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 관리자 인증 확인
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

    const { rejectionReason } = await request.json();

    const adminSupabase = createAdminClient();

    // 신청 상태 확인 (partnerUserId도 함께 조회 — 알림 전송에 사용)
    const { data: app, error: appError } = await adminSupabase
      .from('partner_to_apartment_applications')
      .select('status, partnerUserId')
      .eq('id', id)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (app.status !== 'pending') {
      return NextResponse.json({ error: 'Application is not pending' }, { status: 400 });
    }

    // 거절 처리: status = 'rejected' + rejectionReason + reviewedAt + reviewedBy
    const { error: updateError } = await adminSupabase
      .from('partner_to_apartment_applications')
      .update({
        status: 'rejected',
        rejectionReason: rejectionReason || null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser.id,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject application:', updateError);
      return NextResponse.json({ error: 'Failed to reject application' }, { status: 500 });
    }

    // 거절 알림 전송 (non-critical: 실패해도 200 반환)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-partner-fcm-notification`;

      await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: app.partnerUserId,
          title: '아파트 회원 신청 결과',
          body: '신청이 반려되었습니다. 앱에서 사유를 확인해주세요.',
          type: 'membership_rejected',
        }),
      });
    } catch (notificationError) {
      console.error('거절 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({ success: true, message: '멤버십 전환 신청이 거절되었습니다.' });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
