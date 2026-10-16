import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

    // 재신청 정보 조회 (reConfirmImageUrl 포함)
    const { data: reconfirm, error: fetchError } = await supabase
      .from('user_reconfirm')
      .select('userId, status, reConfirmImageUrl')
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

    // 기존 유저 정보 조회 (이전 이미지 URL 가져오기)
    const { data: user, error: userFetchError } = await supabase
      .from('user')
      .select('confirmImageUrl')
      .eq('id', reconfirm.userId)
      .single();

    if (userFetchError) {
      console.error('Failed to fetch user:', userFetchError);
      return NextResponse.json(
        { error: '회원 정보를 불러오지 못해 승인하지 않았습니다. 잠시 후 다시 시도해 주세요.' },
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
        { error: '회원을 승인하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
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
        { error: '회원 승인은 완료됐지만 재신청 기록을 정리하지 못했습니다. 다시 승인하지 말고 개발 담당자에게 알려 주세요.' },
        { status: 500 }
      );
    }

    // FCM 알림 전송 (non-critical)
    try {
      const adminSupabase = createAdminClient();
      const { data: partnerUser } = await adminSupabase
        .from('partner_users')
        .select('id')
        .eq('userId', reconfirm.userId)
        .maybeSingle();

      if (partnerUser) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        await fetch(`${supabaseUrl}/functions/v1/send-partner-fcm-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            partnerUserId: partnerUser.id,
            title: '아파트 회원 재신청 승인',
            body: '아파트 회원 재신청이 승인되었습니다. 앱에서 확인해주세요!',
            type: 'membership_approved',
          }),
        });
      }
    } catch (notificationError) {
      console.error('재신청 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Reconfirm approved successfully'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
