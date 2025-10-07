'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
      } else {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    }
    checkAuth();
  }, [router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='text-muted-foreground'>로딩 중...</div>
      </div>
    );
  }

  return <>{children}</>;
}
