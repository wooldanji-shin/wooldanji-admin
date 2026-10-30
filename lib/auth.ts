import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface User {
  id: string;
  email: string;
  name: string;
}

export async function login(
  email: string,
  password: string
): Promise<User | null> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || '',
    name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || '관리자',
  };
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || '관리자',
  };
}

/**
 * 화면(브라우저)에서 로그인한 관리자의 id·이메일이 필요할 때 쓴다.
 * 브라우저에 저장된 세션을 읽기만 해서 인증 서버를 다시 부르지 않는다 (만료됐으면 자동 갱신).
 * 로그인 여부 확인은 AuthGuard가 getUser()로 한 번 하고, 실제 권한은 DB(RLS)·API 라우트가 확인한다.
 * 서버 코드(API 라우트 등)에서는 쓰지 말고 getUser()를 쓴다.
 */
export async function getSessionUser(): Promise<{ data: { user: SupabaseUser | null } }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return { data: { user: session?.user ?? null } };
}

export async function getUserRoles(): Promise<string[]> {
  const { data: { user } } = await getSessionUser();

  if (!user) return [];

  return getUserRolesById(user.id);
}

/** 이미 확인한 사용자 id로 권한만 조회한다 (인증 서버를 다시 부르지 않는다) */
export async function getUserRolesById(userId: string): Promise<string[]> {
  const supabase = createClient();

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('userId', userId);

  return (roles as { role: string }[] | null)?.map(r => r.role) || [];
}

export async function hasRole(role: string): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.includes(role);
}

export async function isSuperAdmin(): Promise<boolean> {
  return hasRole('SUPER_ADMIN');
}

export async function isManager(): Promise<boolean> {
  return hasRole('MANAGER');
}
