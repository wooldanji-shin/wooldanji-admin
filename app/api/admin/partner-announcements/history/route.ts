import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

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
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: '서버 설정 문제로 발송 이력을 불러올 수 없습니다. 개발 담당자에게 알려 주세요.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error: fetchErr } = await supabase
      .from('partner_announcements')
      .select('id, title, body, sentAt, recipientCount')
      .order('sentAt', { ascending: false })
      .limit(limit);

    if (fetchErr) {
      console.error('[partner-announcements/history] fetch error:', fetchErr);
      return NextResponse.json({ error: '발송 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }

    const rows = (data ?? []).map((row) => ({
      key: row.id as string,
      title: row.title as string,
      body: row.body as string,
      sentAt: row.sentAt as string,
      recipients: row.recipientCount as number,
    }));

    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error('[partner-announcements/history] error:', err);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}
