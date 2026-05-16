import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
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
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
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
      { error: 'internal_error', message: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
