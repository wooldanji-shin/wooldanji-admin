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
