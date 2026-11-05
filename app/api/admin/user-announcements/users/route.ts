import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    // 서비스 롤로 전체 회원·파트너 데이터를 다루므로 관리자 세션을 먼저 확인한다
    const authClient = await createServerClient();
    const { data: { user: currentUser } } = await authClient.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    const { data: roles } = await authClient
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: '이 작업을 할 권한이 없습니다.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') ?? '';
    const status = url.searchParams.get('status') ?? 'ALL';
    const role = url.searchParams.get('role') ?? 'ALL';
    const overlay = url.searchParams.get('overlay') ?? 'ALL';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? PAGE_SIZE), 200);
    const offset = Number(url.searchParams.get('offset') ?? 0);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '서버 설정 문제로 회원 목록을 불러올 수 없습니다. 개발 담당자에게 알려 주세요.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 아파트명 검색 — 일치하는 아파트 ID만 선조회해서 apartmentId로 거른다
    // (회원 id 목록을 URL에 넣으면 큰 아파트에서 길이 초과·1000행 잘림 발생)
    let aptIds: string[] = [];
    const s = search.trim();
    if (s) {
      const { data: aptData } = await supabase
        .from('apartments')
        .select('id')
        .ilike('name', `%${s}%`);
      aptIds = (aptData ?? []).map((a: any) => a.id as string);
    }

    // 회원 유형 필터는 조인으로 거른다 (userId 목록을 URL에 넣으면 길이 초과·1000행 잘림 발생)
    // 표시용 user_roles(role)는 전체 역할을 보여줘야 해서 거르기용 조인을 별칭으로 따로 붙인다
    const roleFilterJoin = role !== 'ALL' ? ', role_filter:user_roles!inner(role)' : '';

    let query = supabase
      .from('user')
      .select(
        `id, name, phoneNumber, email, approvalStatus, fcmToken, marketingAgreed, openDoorCount, platform, registrationType, overlayPermissionGranted, apartments!user_apartmentId_fkey(name), user_roles(role)${roleFilterJoin}`,
        { count: 'exact' },
      );

    if (s) {
      const orParts = [
        `name.ilike.%${s}%`,
        `phoneNumber.ilike.%${s}%`,
        `email.ilike.%${s}%`,
      ];
      if (aptIds.length > 0) {
        orParts.push(`apartmentId.in.(${aptIds.join(',')})`);
      }
      query = query.or(orParts.join(','));
    }

    if (status !== 'ALL') {
      query = query.eq('approvalStatus', status);
    }
    if (role !== 'ALL') {
      query = query.eq('role_filter.role', role);
    }
    // 다른 앱 위에 표시 권한은 Android 아파트 회원만 앱이 동기화하므로 그 범위로 한정
    if (overlay === 'granted' || overlay === 'denied') {
      query = query
        .eq('platform', 'aos')
        .eq('registrationType', 'APARTMENT')
        .eq('overlayPermissionGranted', overlay === 'granted');
    }

    query = query.order('createdAt', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error: fetchErr, count } = await query;
    if (fetchErr) {
      console.error('[user-announcements/users] fetch error:', fetchErr);
      return NextResponse.json({ error: '회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    const rows = (data ?? []).map((u: any) => ({
      id: u.id,
      name: u.name,
      phoneNumber: u.phoneNumber,
      email: u.email,
      apartmentName: u.apartments?.name ?? null,
      approvalStatus: u.approvalStatus,
      roles: (u.user_roles as { role: string }[] ?? []).map((r) => r.role),
      hasFcmToken: Array.isArray(u.fcmToken) && u.fcmToken.length > 0,
      marketingAgreed: u.marketingAgreed,
      openDoorCount: u.openDoorCount ?? 0,
      // Android 아파트 회원이 아니면 권한 개념이 없어 null
      overlayPermissionGranted:
        u.platform === 'aos' && u.registrationType === 'APARTMENT' ? !!u.overlayPermissionGranted : null,
    }));

    return NextResponse.json({ rows, totalCount: count ?? 0 });
  } catch (err: any) {
    console.error('[user-announcements/users] error:', err);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}
