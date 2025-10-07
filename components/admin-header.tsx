'use client';

import { getCurrentUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

export function AdminHeader({ title }: { title: string }) {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (user) {
        setUserName(user.name);
      }
    }
    loadUser();
  }, []);

  return (
    <div className='flex h-16 items-center justify-between border-b border-border bg-card px-6'>
      <h2 className='text-2xl font-semibold text-card-foreground'>{title}</h2>
      <div className='flex items-center gap-3'>
        <div className='text-sm text-muted-foreground'>{userName}</div>
        <div className='h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center'>
          <span className='text-sm font-medium text-primary'>
            {userName.charAt(0)}
          </span>
        </div>
      </div>
    </div>
  );
}
