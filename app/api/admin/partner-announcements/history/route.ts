import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Design Ref: §4.3 history route — partner_notifications에서 type 필터로 발송 이력 조회
// 같은 (title, body, 분단위 createdAt) 조합으로 그룹핑하여 발송 단위 1행 표현
// Decision: 별도 이력 테이블 없이 partner_notifications 재활용 (Plan Q6)

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
    const cursor = url.searchParams.get('cursor'); // ISO string

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
    }

    // 발송 row 다수를 가져와 클라이언트(API 측)에서 그룹핑
    // limit * 50 = 한 발송당 최대 50명 가정 (그 이상은 다음 cursor로)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const FETCH_LIMIT = limit * 50;

    let query = supabase
      .from('partner_notifications')
      .select('id, title, body, createdAt, partnerUserId')
      .eq('type', 'admin_announcement')
      .order('createdAt', { ascending: false })
      .limit(FETCH_LIMIT);

    if (cursor) query = query.lt('createdAt', cursor);

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      console.error('[partner-announcements/history] fetch error:', fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // 같은 발송 단위 그룹핑 — 같은 title+body, createdAt 분 단위
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        body: string;
        sentAt: string;
        recipients: number;
      }
    >();

    for (const row of data ?? []) {
      const minute = (row.createdAt as string).slice(0, 16); // 'YYYY-MM-DDTHH:MM'
      const key = `${minute}|${row.title}|${row.body}`;
      const g = groups.get(key);
      if (g) {
        g.recipients++;
      } else {
        groups.set(key, {
          key,
          title: row.title as string,
          body: row.body as string,
          sentAt: row.createdAt as string,
          recipients: 1,
        });
      }
    }

    // 최근 발송순으로 정렬 후 limit 적용
    const groupArray = Array.from(groups.values()).sort((a, b) =>
      a.sentAt < b.sentAt ? 1 : -1,
    );
    const sliced = groupArray.slice(0, limit);
    const nextCursor = sliced.length > 0 ? sliced[sliced.length - 1].sentAt : null;

    return NextResponse.json({
      rows: sliced,
      nextCursor,
      hasMore: groupArray.length > limit,
    });
  } catch (err: any) {
    console.error('[partner-announcements/history] error:', err);
    return NextResponse.json(
      { error: 'internal_error', message: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
