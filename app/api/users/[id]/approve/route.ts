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
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인 (APT_ADMIN, REGION_ADMIN, SUPER_ADMIN만 가능)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r =>
      ['APT_ADMIN', 'REGION_ADMIN', 'SUPER_ADMIN'].includes(r.role)
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