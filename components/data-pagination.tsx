'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** 한 번에 노출할 페이지 번호 버튼 개수 */
const VISIBLE_PAGE_COUNT = 10;

interface DataPaginationProps {
  /** Current page (1-indexed). */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * 목록 하단 중앙에 놓이는 페이지네이션.
 * 이전/다음 버튼과 페이지 번호 버튼을 함께 노출하며,
 * 페이지가 1개뿐이면 아무것도 렌더링하지 않는다.
 */
export function DataPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  className,
}: DataPaginationProps): React.ReactElement | null {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const currentPage = Math.min(Math.max(1, page), totalPages);
  const visibleCount = Math.min(VISIBLE_PAGE_COUNT, totalPages);

  // 현재 페이지를 기준으로 노출할 번호 구간을 계산
  const getPageNumber = (index: number): number => {
    if (totalPages <= VISIBLE_PAGE_COUNT) return index + 1;
    if (currentPage <= 5) return index + 1;
    if (currentPage >= totalPages - 4) return totalPages - (VISIBLE_PAGE_COUNT - 1) + index;
    return currentPage - 4 + index;
  };

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        이전
      </Button>

      <div className="flex gap-1">
        {Array.from({ length: visibleCount }, (_, i) => {
          const pageNum = getPageNumber(i);
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="w-10"
            >
              {pageNum}
            </Button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        다음
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
