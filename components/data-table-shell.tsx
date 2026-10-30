import type { ReactNode } from 'react';
import { Box, Paper, Stack, Table } from '@mantine/core';

interface DataTableShellProps {
  /** Toolbar rendered at the top of the card. Typically <DataToolbar/>. */
  toolbar?: ReactNode;
  /** 표 카드 맨 위 요약 줄 (예: 총 N건 · 합계 금액) */
  summary?: ReactNode;
  /** Footer rendered at the bottom. Typically <DataPagination/>. */
  pagination?: ReactNode;
  /** The table itself, or any list content. */
  children: ReactNode;
  className?: string;
  /** 이보다 좁아지면 표를 찌그러뜨리지 않고 가로 스크롤한다 (기본 720px) */
  minWidth?: number;
}

/**
 * Standard data list container (기준: banselin-admin).
 * 검색·필터 툴바는 위쪽의 별도 카드에, 표와 페이지네이션은 아래 카드에 둔다.
 */
export function DataTableShell({
  toolbar,
  summary,
  pagination,
  children,
  className,
  minWidth = 720,
}: DataTableShellProps): React.ReactElement {
  return (
    <Stack gap="lg">
      {toolbar && (
        <Paper p={{ base: 'md', sm: 'lg' }} className="app-filter-card">
          {toolbar}
        </Paper>
      )}
      <Paper p={{ base: 'md', sm: 'lg' }} className={['app-table-card', className].filter(Boolean).join(' ')}>
        {summary && <Box mb="md">{summary}</Box>}
        <Table.ScrollContainer minWidth={minWidth} type="native">
          {children}
        </Table.ScrollContainer>
        {pagination && <Box mt="md">{pagination}</Box>}
      </Paper>
    </Stack>
  );
}
