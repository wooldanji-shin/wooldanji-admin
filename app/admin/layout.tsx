import type React from 'react';
import { cookies } from 'next/headers';
import { AuthGuard } from '@/components/auth-guard';
import { AdminShell } from '@/components/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get('sidebar_state')?.value;
  const defaultOpen = sidebarState !== 'false';

  return (
    <AuthGuard>
      <AdminShell defaultOpen={defaultOpen}>{children}</AdminShell>
    </AuthGuard>
  );
}
