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

    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // 재신청 정보 조회
    const { data: reconfirm, error: fetchError } = await supabase
      .from('user_reconfirm')
      .select('status')
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

    // user_reconfirm 레코드 업데이트 (status를 'rejected'로 변경 및 rejectionReason 저장)
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
        { error: 'Failed to reject reconfirm' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reconfirm rejected successfully'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
