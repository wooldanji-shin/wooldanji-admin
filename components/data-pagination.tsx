'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataPaginationProps {
  /** Current page (1-indexed). */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /** Optional left-side label override. e.g. "5 of 234 selected". */
  leftLabel?: React.ReactNode;
  className?: string;
}

export function DataPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  leftLabel,
  className,
}: DataPaginationProps): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalCount);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border/60 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="text-muted-foreground tabular-nums">
        {leftLabel ?? (
          totalCount > 0 ? (
            <>
              <span className="font-medium text-foreground">{start.toLocaleString()}</span>
              {' – '}
              <span className="font-medium text-foreground">{end.toLocaleString()}</span>
              {' / '}
              <span>{totalCount.toLocaleString()}</span>
            </>
          ) : (
            '0개'
          )
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground tabular-nums sm:text-sm">
          페이지 <span className="font-medium text-foreground">{safePage}</span> / {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={!canPrev}
            aria-label="첫 페이지"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(safePage - 1)}
            disabled={!canPrev}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(safePage + 1)}
            disabled={!canNext}
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!canNext}
            aria-label="마지막 페이지"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
