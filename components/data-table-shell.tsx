import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DataTableShellProps {
  /** Toolbar rendered at the top of the card. Typically <DataToolbar/>. */
  toolbar?: ReactNode;
  /** Footer rendered at the bottom. Typically <DataPagination/>. */
  pagination?: ReactNode;
  /** The table itself, or any list content. */
  children: ReactNode;
  className?: string;
}

/**
 * Standard data list container: Card with optional Toolbar header, content body,
 * and Pagination footer. Card has zero internal padding so the toolbar/pagination
 * can render their own borders edge-to-edge.
 */
export function DataTableShell({
  toolbar,
  pagination,
  children,
  className,
}: DataTableShellProps): React.ReactElement {
  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden border-border/70 py-0 shadow-card',
        className
      )}
    >
      {toolbar}
      <div className="overflow-x-auto">{children}</div>
      {pagination}
    </Card>
  );
}
