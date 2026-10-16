import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 관리자 인증 확인
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: '이 작업을 할 권한이 없습니다.' }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: '승인할 회원 정보가 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.' }, { status: 400 });
    }

    // service-role key로 RLS bypass
    const adminSupabase = createAdminClient();

    // user 테이블에서 해당 유저 조회
    const { data: targetUser, error: userError } = await adminSupabase
      .from('user')
      .select('id, approvalStatus')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: '회원을 찾을 수 없습니다. 탈퇴했을 수 있으니 목록을 새로고침해 주세요.' }, { status: 404 });
    }

    if (targetUser.approvalStatus !== 'pending') {
      return NextResponse.json({ error: '멤버십 전환 심사 대기 중인 회원이 아닙니다. 이미 처리됐을 수 있으니 목록을 새로고침해 주세요.' }, { status: 400 });
    }

    // approvalStatus를 approve로 UPDATE
    const { error: updateError } = await adminSupabase
      .from('user')
      .update({ approvalStatus: 'approve' })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update approval status:', updateError);
      return NextResponse.json({ error: '멤버십 전환을 승인하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    // FCM 알림 전송을 위해 partner_users에서 partnerUserId 역조회
    const { data: partnerUser } = await adminSupabase
      .from('partner_users')
      .select('id')
      .eq('userId', userId)
      .maybeSingle();

    // 승인 알림 전송 (non-critical: 실패해도 200 반환)
    if (partnerUser) {
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
            partnerUserId: partnerUser.id,
            title: '아파트 회원 승인 완료',
            body: '아파트 회원 신청이 승인되었습니다. 앱에서 확인해주세요!',
            type: 'membership_approved',
          }),
        });
      } catch (notificationError) {
        console.error('승인 알림 전송 실패 (non-critical):', notificationError);
      }
    }

    return NextResponse.json({ success: true, message: '멤버십 전환 승인이 완료되었습니다.' });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
