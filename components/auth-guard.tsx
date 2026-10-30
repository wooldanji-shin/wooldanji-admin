'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShellSkeleton } from '@/components/admin-shell-skeleton';
import { AuthUserProvider, type AuthUser } from '@/components/auth-user-context';
import { getCurrentUser, getUserRolesById } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function checkAuth(): Promise<void> {
      // 로그인 확인은 여기서 한 번만 하고, 헤더·사이드바는 이 결과를 함께 쓴다
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const roles = await getUserRolesById(user.id);
      setAuthUser({ ...user, roles });
    }
    checkAuth();
  }, [router]);

  if (!authUser) {
    return <AdminShellSkeleton />;
  }

  return <AuthUserProvider value={authUser}>{children}</AuthUserProvider>;
}
