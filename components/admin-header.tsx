'use client';

import type { ReactNode } from 'react';
import { PageHeader, PageHeaderActions, PageHeaderTitle } from '@/components/page-shell';

interface AdminHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * @deprecated Use `PageHeader` + `PageHeaderTitle` from `@/components/page-shell`
 * instead. This shim is kept only for legacy pages and renders the same row that
 * PageShell/PageHeaderTitle would render.
 */
export function AdminHeader({
  title,
  description,
  actions,
  className,
}: AdminHeaderProps): React.ReactElement {
  return (
    <PageHeader className={className}>
      <PageHeaderTitle title={title} description={description} />
      {actions && <PageHeaderActions>{actions}</PageHeaderActions>}
    </PageHeader>
  );
}
