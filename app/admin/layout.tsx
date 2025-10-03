import type React from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AdminSidebar } from '@/components/admin-sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className='flex h-screen bg-background'>
        <AdminSidebar />
        <main className='flex-1 overflow-auto'>{children}</main>
      </div>
    </AuthGuard>
  );
}
