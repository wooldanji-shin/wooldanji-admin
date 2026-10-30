'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Group, Pagination } from '@mantine/core';

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

  return (
    <Group justify="center" gap="xs" className={className}>
      <Button
        variant="default"
        size="xs"
        leftSection={<ChevronLeft size={16} />}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        이전
      </Button>
      <Pagination
        total={totalPages}
        value={currentPage}
        onChange={onPageChange}
        withControls={false}
      />
      <Button
        variant="default"
        size="xs"
        rightSection={<ChevronRight size={16} />}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        다음
      </Button>
    </Group>
  );
}
