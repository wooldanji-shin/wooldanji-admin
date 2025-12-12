import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: managerId } = await params;

    // 1. Auth 사용자 삭제 (CASCADE로 관련 데이터 자동 삭제)
    const { error: authError } = await supabase.auth.admin.deleteUser(managerId);

    if (authError) {
      console.error('Auth delete error:', authError);
      return NextResponse.json(
        { error: '사용자 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manager deletion error:', error);
    return NextResponse.json(
      { error: '매니저 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
