import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 관리자 인증 확인
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { applicationId } = await request.json();
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }

    // service-role key로 RLS bypass
    const adminSupabase = createAdminClient();

    // 신청 데이터 조회
    const { data: app, error: appError } = await adminSupabase
      .from('partner_to_apartment_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (app.status !== 'pending') {
      return NextResponse.json({ error: 'Application is not pending' }, { status: 400 });
    }

    // partner_users에서 auth userId 조회
    const { data: partnerUser, error: partnerError } = await adminSupabase
      .from('partner_users')
      .select('userId')
      .eq('id', app.partnerUserId)
      .single();

    if (partnerError || !partnerUser) {
      return NextResponse.json({ error: 'Partner user not found' }, { status: 404 });
    }

    // 이미 user 테이블에 존재하는지 확인
    const { data: existingUser } = await adminSupabase
      .from('user')
      .select('id')
      .eq('id', partnerUser.userId)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: '이미 아파트 회원으로 등록된 사용자입니다.' }, { status: 400 });
    }

    // user 테이블에 아파트 회원 insert
    const { error: insertUserError } = await adminSupabase.from('user').insert({
      id: partnerUser.userId,
      email: app.userEmail,
      name: app.name,
      phoneNumber: app.phoneNumber,
      birthDay: app.birthDay,
      address: app.address,
      detailAddress: app.detailAddress,
      apartmentId: app.apartmentId,
      buildingNumber: app.buildingNumber,
      unit: app.unit,
      registrationType: app.registrationType,
      confirmImageUrl: app.confirmImageUrl,
      termsAgreed: app.termsAgreed,
      privacyAgreed: app.privacyAgreed,
      marketingAgreed: app.marketingAgreed,
      regionSido: app.regionSido,
      regionSigungu: app.regionSigungu,
      regionDong: app.regionDong,
      // 어드민이 직접 승인하는 route이므로 타입 무관하게 approve
      approvalStatus: 'approve',
      premium: false,
      shareUserCount: 0,
      openDoorCount: 0,
      rssLevel: -90,
      registerMethods: ['local'],
    });

    if (insertUserError) {
      console.error('Failed to insert user:', insertUserError);
      return NextResponse.json({ error: 'Failed to create apartment user' }, { status: 500 });
    }

    // user_roles insert (APP_USER)
    const { error: insertRoleError } = await adminSupabase.from('user_roles').insert({
      userId: partnerUser.userId,
      role: 'APP_USER',
    });

    if (insertRoleError) {
      console.error('Failed to insert user role:', insertRoleError);
      // user 롤백
      await adminSupabase.from('user').delete().eq('id', partnerUser.userId);
      return NextResponse.json({ error: 'Failed to assign user role' }, { status: 500 });
    }

    // 신청 레코드 삭제 (승인 완료)
    const { error: deleteError } = await adminSupabase
      .from('partner_to_apartment_applications')
      .delete()
      .eq('id', applicationId);

    if (deleteError) {
      console.error('Failed to delete application:', deleteError);
      return NextResponse.json({ error: 'Failed to delete application record' }, { status: 500 });
    }

    // 승인 알림 전송 (non-critical: 실패해도 200 반환)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-partner-fcm-notification`;

      await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: app.partnerUserId,
          title: '아파트 회원 승인 완료',
          body: '아파트 회원 신청이 승인되었습니다. 앱에서 확인해주세요!',
          type: 'membership_approved',
        }),
      });
    } catch (notificationError) {
      console.error('승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({ success: true, message: '멤버십 전환 승인이 완료되었습니다.' });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
