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
        { error: 'Unauthorized' },
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
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // 재신청 정보 조회
    const { data: reconfirm, error: fetchError } = await supabase
      .from('user_reconfirm')
      .select('userId, status')
      .eq('id', id)
      .single();

    if (fetchError || !reconfirm) {
      return NextResponse.json(
        { error: 'Reconfirm not found' },
        { status: 404 }
      );
    }

    if (reconfirm.status !== 'pending') {
      return NextResponse.json(
        { error: 'Reconfirm is not pending' },
        { status: 400 }
      );
    }

    // 1. user_reconfirm 레코드 삭제
    const { error: deleteError } = await supabase
      .from('user_reconfirm')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete user_reconfirm:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete reconfirm record' },
        { status: 500 }
      );
    }

    // 2. user 테이블의 approvalStatus를 'approve'로 변경
    const { error: updateError } = await supabase
      .from('user')
      .update({ approvalStatus: 'approve' })
      .eq('id', reconfirm.userId);

    if (updateError) {
      console.error('Failed to update user approval status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user approval status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reconfirm approved successfully'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
