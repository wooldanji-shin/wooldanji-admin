import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, phoneNumber, address, businessRegistration, memo } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '필수 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 비밀번호 검증: 8글자 이상, 특수문자 1개 이상
    const passwordRegex = /^(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: '비밀번호는 8글자 이상이며 특수문자를 1개 이상 포함해야 합니다.' },
        { status: 400 }
      );
    }

    // Admin 권한 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // SUPER_ADMIN 권한 확인
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', user.id)
      .eq('role', 'SUPER_ADMIN')
      .single();

    if (!roles) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Admin client 사용 (auth.admin API용)
    const adminClient = createAdminClient();

    // 1. 이메일 중복 확인
    const { data: existingUser } = await adminClient
      .from('user')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      );
    }

    // 2. Supabase Auth로 사용자 생성
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    if (authError || !authData.user) {
      console.error('Auth error:', authError);
      // 이메일 중복 에러 처리
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: '이미 사용 중인 이메일입니다.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError?.message || '사용자 생성에 실패했습니다.' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 3. user 테이블에 레코드 생성 (이름, 전화번호 등)
    const { error: userInsertError } = await adminClient
      .from('user')
      .insert({
        id: userId,
        email: email,
        name,
        phoneNumber: phoneNumber || null,
        apartmentId: null, // 매니저는 아파트와 직접 연결되지 않음
        registerMethods: ['local'],
        registrationType: 'APARTMENT',
        premium: false,
        shareUserCount: 0,
        openDoorCount: 0,
        rssLevel: -80, // 기본 RSS 레벨
        approvalStatus: 'approve', // 매니저는 승인 필요 없음
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
        overlayPermissionGranted: false,
      });

    if (userInsertError) {
      console.error('User insert error:', userInsertError);
      // 사용자 삭제 시도
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: '사용자 정보 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 4. user_roles에 MANAGER 역할 추가
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({
        userId,
        role: 'MANAGER',
      });

    if (roleError) {
      console.error('Role error:', roleError);
      // 사용자 삭제 시도
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: '역할 추가에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 5. manager_profiles에 추가 정보 저장
    const { error: profileError } = await adminClient
      .from('manager_profiles')
      .insert({
        userId,
        address: address || null,
        businessRegistration: businessRegistration || null,
        memo: memo || null,
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      // 역할은 CASCADE로 삭제되므로 사용자만 삭제
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: '프로필 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('Manager creation error:', error);
    return NextResponse.json(
      { error: '매니저 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
