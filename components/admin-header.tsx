'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * @deprecated Use `PageHeader` + `PageHeaderTitle` from `@/components/page-shell`
 * instead. This shim is kept only for legacy pages and renders the same row that
 * PageShell/PageHeaderTitle would render so legacy pages get the new typography.
 */
export function AdminHeader({
  title,
  description,
  actions,
  className,
}: AdminHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-[1.625rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-base font-medium text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
