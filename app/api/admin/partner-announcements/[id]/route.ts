import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  if (!id) return NextResponse.json({ error: '삭제할 알림 정보가 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: '서버 설정 문제로 알림을 삭제할 수 없습니다. 개발 담당자에게 알려 주세요.' }, { status: 500 });
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
    return NextResponse.json({ error: '알림을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
