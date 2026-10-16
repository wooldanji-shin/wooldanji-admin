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

    // 관리자 권한 확인 (SUPER_ADMIN, MANAGER 가능)
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
    const { rejectionReason } = body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: '보류 사유를 입력해 주세요.' },
        { status: 400 }
      );
    }

    // 재신청 정보 조회
    const { data: reconfirm, error: fetchError } = await supabase
      .from('user_reconfirm')
      .select('status, userId')
      .eq('id', id)
      .single();

    if (fetchError || !reconfirm) {
      return NextResponse.json(
        { error: '재신청 내역을 찾을 수 없습니다. 이미 처리됐을 수 있으니 목록을 새로고침해 주세요.' },
        { status: 404 }
      );
    }

    if (reconfirm.status !== 'pending') {
      return NextResponse.json(
        { error: '이미 처리된 재신청입니다. 목록을 새로고침해 처리 결과를 확인해 주세요.' },
        { status: 400 }
      );
    }

    // 1. user_reconfirm 레코드 업데이트 (status를 'rejected'로 변경 및 rejectionReason 저장)
    const { error: updateError } = await supabase
      .from('user_reconfirm')
      .update({
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        reviewedBy: currentUser.id,
        reviewedAt: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject reconfirm:', updateError);
      return NextResponse.json(
        { error: '재신청을 보류 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    // 2. user 테이블도 suspended로 되돌리고 거절 사유 저장 (파트너 앱에서 상태 인식 가능하도록)
    await supabase
      .from('user')
      .update({
        approvalStatus: 'suspended',
        suspensionReason: rejectionReason.trim(),
      })
      .eq('id', reconfirm.userId);

    return NextResponse.json({
      success: true,
      message: 'Reconfirm rejected successfully'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
