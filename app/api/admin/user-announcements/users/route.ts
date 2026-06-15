import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') ?? '';
    const status = url.searchParams.get('status') ?? 'ALL';
    const role = url.searchParams.get('role') ?? 'ALL';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? PAGE_SIZE), 200);
    const offset = Number(url.searchParams.get('offset') ?? 0);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
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
        return NextResponse.json({ error: roleErr.message }, { status: 500 });
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
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
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
      { error: 'internal_error', message: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
