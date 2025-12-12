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

    // 재신청 정보 조회 (reConfirmImageUrl 포함)
    const { data: reconfirm, error: fetchError } = await supabase
      .from('user_reconfirm')
      .select('userId, status, reConfirmImageUrl')
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

    // 기존 유저 정보 조회 (이전 이미지 URL 가져오기)
    const { data: user, error: userFetchError } = await supabase
      .from('user')
      .select('confirmImageUrl')
      .eq('id', reconfirm.userId)
      .single();

    if (userFetchError) {
      console.error('Failed to fetch user:', userFetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    // 1. 이전 이미지가 있으면 Storage에서 삭제
    if (user?.confirmImageUrl) {
      try {
        // URL에서 파일 경로 추출
        const urlParts = user.confirmImageUrl.split('/storage/v1/object/public/');
        if (urlParts.length > 1) {
          const pathParts = urlParts[1].split('/');
          const bucketName = pathParts[0]; // 예: 'user-confirms'
          const filePath = pathParts.slice(1).join('/'); // 예: 'abc.jpg'

          const { error: deleteStorageError } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

          if (deleteStorageError) {
            console.error('Failed to delete old image from storage:', deleteStorageError);
            // 이미지 삭제 실패해도 계속 진행 (중요한 작업은 아니므로)
          }
        }
      } catch (err) {
        console.error('Error parsing image URL:', err);
        // URL 파싱 실패해도 계속 진행
      }
    }

    // 2. user 테이블 업데이트
    const { error: updateError } = await supabase
      .from('user')
      .update({
        approvalStatus: 'approve',
        suspensionReason: null,
        confirmImageUrl: reconfirm.reConfirmImageUrl
      })
      .eq('id', reconfirm.userId);

    if (updateError) {
      console.error('Failed to update user:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // 3. user_reconfirm 레코드 삭제
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
