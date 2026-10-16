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

    // 회원 유형(role) 필터 — user_roles에서 해당 role 보유한 userId 목록 선조회
    let roleUserIds: string[] | null = null;
    if (role !== 'ALL') {
      const { data: roleData, error: roleErr } = await supabase
        .from('user_roles')
        .select('userId')
        .eq('role', role);
      if (roleErr) {
        console.error('[user-announcements/users] role filter error:', roleErr);
        return NextResponse.json({ error: '회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
      }
      roleUserIds = (roleData ?? []).map((r: any) => r.userId as string);
      // 해당 역할 유저가 없으면 빈 결과 즉시 반환
      if (roleUserIds.length === 0) {
        return NextResponse.json({ rows: [], totalCount: 0 });
      }
    }

    // 아파트명 검색 — apartments에서 일치하는 ID 목록 선조회
    let aptUserIds: string[] | null = null;
    const s = search.trim();
    if (s) {
      const { data: aptData } = await supabase
        .from('apartments')
        .select('id')
        .ilike('name', `%${s}%`);
      const aptIds = (aptData ?? []).map((a: any) => a.id as string);
      if (aptIds.length > 0) {
        const { data: aptUserData } = await supabase
          .from('user')
          .select('id')
          .in('apartmentId', aptIds);
        aptUserIds = (aptUserData ?? []).map((u: any) => u.id as string);
      } else {
        aptUserIds = [];
      }
    }

    let query = supabase
      .from('user')
      .select(
        'id, name, phoneNumber, email, approvalStatus, fcmToken, marketingAgreed, openDoorCount, apartments!user_apartmentId_fkey(name), user_roles(role)',
        { count: 'exact' },
      );

    if (s) {
      const orParts = [
        `name.ilike.%${s}%`,
        `phoneNumber.ilike.%${s}%`,
        `email.ilike.%${s}%`,
      ];
      if (aptUserIds && aptUserIds.length > 0) {
        orParts.push(`id.in.(${aptUserIds.join(',')})`);
      }
      query = query.or(orParts.join(','));
    }

    if (status !== 'ALL') {
      query = query.eq('approvalStatus', status);
    }
    if (roleUserIds !== null) {
      query = query.in('id', roleUserIds);
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
