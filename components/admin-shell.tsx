'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@mantine/core';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { useAdminShell } from '@/components/useAdminShell';
import { useTableCardLabels } from '@/components/useTableCardLabels';

const NAVBAR_WIDTH = 250;
const NAVBAR_RAIL_WIDTH = 70;

interface AdminShellProps {
  defaultOpen: boolean;
  children: ReactNode;
}

export function AdminShell({ defaultOpen, children }: AdminShellProps): React.ReactElement {
  const shell = useAdminShell(defaultOpen);
  // 휴대폰에서 표를 카드로 바꿀 때 쓸 열 이름 표시
  useTableCardLabels();

  return (
    <AppShell
      layout="alt"
      withBorder={false}
      header={{ height: 70 }}
      navbar={{
        width: shell.desktopOpened ? NAVBAR_WIDTH : NAVBAR_RAIL_WIDTH,
        breakpoint: 'sm',
        collapsed: { mobile: !shell.mobileOpened },
      }}
    >
      <AppShell.Header style={{ boxShadow: 'var(--app-shadow-soft)' }}>
        <AppHeader shell={shell} />
      </AppShell.Header>
      <AppShell.Navbar bg="var(--app-sidebar-bg)">
        <AppSidebar
          collapsed={!shell.desktopOpened && !shell.isMobile}
          onCloseMobile={shell.closeMobile}
        />
      </AppShell.Navbar>
      <AppShell.Main bg="var(--app-bg-muted)" miw={0} style={{ overflowX: 'auto' }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
