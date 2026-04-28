import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PageContent,
  PageHeader,
  PageShell,
} from '@/components/page-shell';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  /** Number of stat cards to render at the top. Set to 0 to hide. */
  stats?: number;
  /** Whether to render a search/filter bar placeholder above the main card. */
  searchBar?: boolean;
  /** Number of rows in the main table card. Set to 0 to hide the card. */
  rows?: number;
  /** Number of columns in the main table card. */
  columns?: number;
  className?: string;
}

/**
 * Full-page skeleton used while a list/table page loads.
 * Mirrors the standard PageShell -> PageHeader -> [stats] -> [search] -> [table] layout.
 */
export function PageSkeleton({
  stats = 0,
  searchBar = true,
  rows = 8,
  columns = 5,
  className,
}: PageSkeletonProps): React.ReactElement {
  return (
    <PageShell className={className}>
      <PageHeader>
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
        </div>
      </PageHeader>

      <PageContent>
        {stats > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: stats }).map((_, i) => (
              <Card key={`stat-${i}`} className="border-border/70 shadow-card">
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {searchBar && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:max-w-md" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        )}

        {rows > 0 && (
          <Card className="overflow-hidden border-border/70 shadow-card">
            <TableSkeleton rows={rows} columns={columns} />
          </Card>
        )}
      </PageContent>
    </PageShell>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

/** Renders inside an existing Card to skeleton-load just the table area. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps): React.ReactElement {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={`th-${i}`} className="py-3">
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={`tr-${r}`} className="border-border">
              {Array.from({ length: columns }).map((_, c) => (
                <TableCell key={`td-${r}-${c}`} className="py-4">
                  <Skeleton
                    className={cn(
                      'h-4',
                      c === 0 ? 'w-32' : c === columns - 1 ? 'w-16 ml-auto' : 'w-24'
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface DetailSkeletonProps {
  /** Number of card sections to render. */
  sections?: number;
  className?: string;
}

/** Full-page skeleton for detail/view pages. */
export function DetailSkeleton({
  sections = 3,
  className,
}: DetailSkeletonProps): React.ReactElement {
  return (
    <PageShell className={className}>
      <div>
        <Skeleton className="mb-3 h-8 w-20" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <PageContent>
        {Array.from({ length: sections }).map((_, i) => (
          <Card key={`sec-${i}`} className="border-border/70 shadow-card">
            <CardHeader className="border-b border-border/60 pb-4">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-4 w-full max-w-lg" />
              {i % 2 === 0 && (
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </PageContent>
    </PageShell>
  );
}

/** Just the spinner-replacement: a centered set of rectangle skeletons. */
export function InlineLoadingSkeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}): React.ReactElement {
  return (
    <div className={cn('space-y-3 p-6', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-2/3'
          )}
        />
      ))}
    </div>
  );
}
