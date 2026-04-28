import type React from 'react';
import { cookies } from 'next/headers';
import { AuthGuard } from '@/components/auth-guard';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset className="bg-background">
          <AppHeader />
          <main className="flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
