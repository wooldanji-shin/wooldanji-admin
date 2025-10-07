import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // pending 상태이면서 APP_USER 역할을 가진 사용자들 조회
    const { data: pendingUsers, error: fetchError } = await supabase
      .from('user')
      .select(`
        id,
        email,
        name,
        user_roles!inner(role)
      `)
      .eq('approvalStatus', 'pending')
      .eq('user_roles.role', 'APP_USER');

    if (fetchError) {
      console.error('Failed to fetch pending users:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending users' },
        { status: 500 }
      );
    }

    if (!pendingUsers || pendingUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending users to approve',
        approved: 0
      });
    }

    // 각 사용자를 approve 상태로 업데이트
    const userIds = pendingUsers.map(user => user.id);

    const { data: updatedUsers, error: updateError } = await supabase
      .from('user')
      .update({ approvalStatus: 'approve' })
      .in('id', userIds)
      .select();

    if (updateError) {
      console.error('Failed to approve users:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve users' },
        { status: 500 }
      );
    }

    // 로그 기록 (선택사항 - 추후 로그 테이블 생성시 사용)
    console.log(`Auto-approved ${updatedUsers.length} users at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: `Successfully approved ${updatedUsers.length} users`,
      approved: updatedUsers.length,
      users: updatedUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name
      }))
    });

  } catch (error) {
    console.error('Server error in auto-approve:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET 메서드로 현재 대기중인 사용자 수 확인
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('user')
      .select('*', { count: 'exact', head: true })
      .eq('approvalStatus', 'pending');

    if (error) {
      console.error('Failed to count pending users:', error);
      return NextResponse.json(
        { error: 'Failed to count pending users' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pendingCount: count || 0
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}