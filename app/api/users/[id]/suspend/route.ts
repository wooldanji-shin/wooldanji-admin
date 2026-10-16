import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const { suspensionReason } = body;

    if (!suspensionReason || !suspensionReason.trim()) {
      return NextResponse.json(
        { error: '보류 사유를 입력해 주세요.' },
        { status: 400 }
      );
    }

    // 회원 승인 상태를 suspended로 업데이트하고 suspensionReason 저장
    const { data, error } = await supabase
      .from('user')
      .update({
        approvalStatus: 'suspended',
        suspensionReason: suspensionReason.trim()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to suspend user:', error);
      return NextResponse.json(
        { error: '승인 보류 처리를 하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    // 알림은 trigger_user_status_change DB 트리거가 자동 처리

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
