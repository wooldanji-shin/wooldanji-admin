import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { PartnerAuthInfo } from '@/lib/types/partner';

/**
 * 파트너의 auth 계정 정보(이메일, 로그인 방식, 최근 로그인)를 조회한다.
 * auth.users는 클라이언트에서 접근할 수 없어 service-role로만 읽을 수 있으므로
 * 관리자 인증을 거친 뒤 서버에서 조회한다.
 *
 * partnerId는 partner_users.id 기준이며, 내부에서 auth user id로 변환한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
): Promise<NextResponse> {
  try {
    // 관리자 인증 확인
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some((r) => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { partnerId } = await params;
    const adminSupabase = createAdminClient();

    const { data: partner, error: partnerError } = await adminSupabase
      .from('partner_users')
      .select('userId')
      .eq('id', partnerId)
      .maybeSingle();

    if (partnerError || !partner) {
      return NextResponse.json({ error: '파트너를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: authUser, error: authError } = await adminSupabase.auth.admin.getUserById(
      (partner as { userId: string }).userId
    );

    if (authError || !authUser?.user) {
      return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const user = authUser.user;
    const appMeta = (user.app_metadata ?? {}) as {
      provider?: string;
      providers?: string[];
    };

    const info: PartnerAuthInfo = {
      email: user.email ?? null,
      phone: user.phone ?? null,
      provider: appMeta.provider ?? null,
      providers: appMeta.providers ?? [],
      lastSignInAt: user.last_sign_in_at ?? null,
      signedUpAt: user.created_at ?? null,
    };

    return NextResponse.json(info);
  } catch (error) {
    console.error('[partner auth-info] 조회 실패:', error);
    return NextResponse.json({ error: '계정 정보 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
