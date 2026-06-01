import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'server misconfigured (env)' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // CASCADE로 partner_announcement_recipients도 자동 삭제됨
  const { error } = await supabase
    .from('partner_announcements')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[partner-announcements/delete] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
