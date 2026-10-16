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
        { error: '이 작업을 할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!['approve', 'pending'].includes(status)) {
      return NextResponse.json(
        { error: '알 수 없는 승인 상태입니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' },
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
        { error: '회원 승인 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

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