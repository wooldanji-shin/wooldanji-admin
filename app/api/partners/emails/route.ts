import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * 파트너들의 계정 이메일을 한 번에 조회한다.
 *
 * auth.users는 클라이언트에서 접근할 수 없어 service-role로만 읽을 수 있다.
 * 전체 사용자 목록(listUsers)은 앱 회원까지 포함해 수천 건이므로,
 * partner_users에 있는 계정만 id로 직접 조회한다.
 *
 * Returns: { emails: { [partnerId]: email } }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

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

    const admin = createAdminClient();
    const { data: partners, error } = await admin
      .from('partner_users')
      .select('id, userId');

    if (error) {
      console.error('Failed to load partners:', error);
      return NextResponse.json({ error: 'Failed to load partners' }, { status: 500 });
    }

    const rows = (partners ?? []) as { id: string; userId: string }[];
    const results = await Promise.all(
      rows.map(async ({ id, userId }) => {
        const { data } = await admin.auth.admin.getUserById(userId);
        return [id, data?.user?.email ?? null] as const;
      })
    );

    const emails: Record<string, string | null> = {};
    for (const [partnerId, email] of results) {
      emails[partnerId] = email;
    }

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
