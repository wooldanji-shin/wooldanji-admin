import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard outer container for admin pages. Provides consistent max-width,
 * horizontal padding, vertical rhythm and centered layout.
 */
export function PageShell({ children, className }: PageShellProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-6 px-6 py-6 md:py-8',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderTitleProps {
  title: string;
  description?: string;
  className?: string;
}

export function PageHeaderTitle({
  title,
  description,
  className,
}: PageHeaderTitleProps): React.ReactElement {
  return (
    <div className={cn('min-w-0', className)}>
      <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-[1.625rem]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-base font-medium text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

interface PageHeaderActionsProps {
  children: ReactNode;
  className?: string;
}

export function PageHeaderActions({
  children,
  className,
}: PageHeaderActionsProps): React.ReactElement {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export function PageContent({ children, className }: PageContentProps): React.ReactElement {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>;
}
