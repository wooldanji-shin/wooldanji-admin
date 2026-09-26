'use client';

import { Inbox } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataPagination } from '@/components/data-pagination';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  usePartnerEventsPage,
  PARTICIPATION_TYPE_LABEL,
  type EventStatusFilter,
  type PartnerEventListItem,
} from './usePartnerEventsPage';

const STATUS_TABS: { label: string; value: EventStatusFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '승인대기', value: 'pending' },
  { label: '승인됨', value: 'approved' },
  { label: '거절', value: 'rejected' },
  { label: '종료', value: 'ended' },
];

const PAGE_SIZE = 20;

function toDateText(value: string): string {
  return new Date(value).toLocaleDateString('ko-KR');
}

/** 대상 아파트 열 — 목록이 길어도 한 줄로, 나머지는 title 속성으로 hover 확인 */
function ApartmentCell({ names }: { names: string[] }): React.ReactElement {
  if (names.length === 0) return <span className="text-muted-foreground">-</span>;
  const [first, ...rest] = names;
  return (
    <span title={names.join(', ')} className="text-sm">
      {first}
      {rest.length > 0 && ` 외 ${rest.length}곳`}
    </span>
  );
}

function ScheduleCell({ event }: { event: PartnerEventListItem }): React.ReactElement {
  return (
    <span className="text-sm text-muted-foreground">
      {/* 앱 배너 카드와 같은 기준 (응모 시작 ~ 당첨 발표) */}
      {toDateText(event.entryStartAt)} ~ {toDateText(event.announceAt)}
    </span>
  );
}

export default function PartnerEventsPage(): React.ReactElement {
  const {
    loading,
    statusFilter,
    setStatusFilter,
    statusCounts,
    paginatedEvents,
    page,
    setPage,
    totalCount,
    handleRowClick,
  } = usePartnerEventsPage();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="이벤트 관리"
          description="파트너가 등록한 응모/추첨·선착순 이벤트를 검토하고 승인 상태를 관리합니다."
        />
      </PageHeader>

      <PageContent>
        {/* 상태 탭 — 개수 배지 포함 */}
        <div className="inline-flex w-full max-w-3xl items-center gap-1 rounded-lg border border-border/70 bg-card p-1.5 shadow-card">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.value;
            const count = statusCounts[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-card'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {tab.label}
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-5 min-w-5 justify-center px-1.5 text-xs tabular-nums',
                    isActive && 'bg-primary-foreground/20 text-primary-foreground'
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        <DataTableShell
          pagination={
            <DataPagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onPageChange={setPage}
              className="py-3"
            />
          }
        >
          {loading ? (
            <TableSkeleton rows={6} columns={8} />
          ) : paginatedEvents.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="이벤트가 없습니다"
              description="선택한 상태에 해당하는 파트너 이벤트가 없습니다."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이벤트명</TableHead>
                  <TableHead>파트너 상호명</TableHead>
                  <TableHead className="text-center">참여방식</TableHead>
                  <TableHead className="text-center">당첨인원</TableHead>
                  <TableHead>대상 아파트</TableHead>
                  <TableHead>일정</TableHead>
                  <TableHead className="text-center">응모수</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEvents.map((event) => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(event.id)}
                  >
                    <TableCell className="max-w-[240px] truncate font-medium">
                      {event.title}
                    </TableCell>
                    <TableCell>{event.businessName}</TableCell>
                    <TableCell className="text-center">
                      {PARTICIPATION_TYPE_LABEL[event.participationType]}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {event.winnerCount.toLocaleString()}명
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <ApartmentCell names={event.apartmentNames} />
                    </TableCell>
                    <TableCell>
                      <ScheduleCell event={event} />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {event.entryCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge.Event status={event.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTableShell>

        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-end text-xs text-muted-foreground">
            총 {totalCount.toLocaleString()}건
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
