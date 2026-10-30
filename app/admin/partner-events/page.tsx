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
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { Table, Text } from '@mantine/core';
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
  if (names.length === 0) return <Text span size="sm" c="dimmed">-</Text>;
  const [first, ...rest] = names;
  return (
    <Text span size="sm" title={names.join(', ')}>
      {first}
      {rest.length > 0 && ` 외 ${rest.length}곳`}
    </Text>
  );
}

function ScheduleCell({ event }: { event: PartnerEventListItem }): React.ReactElement {
  return (
    <Text span size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
      {/* 앱 배너 카드와 같은 기준 (응모 시작 ~ 당첨 발표) */}
      {toDateText(event.entryStartAt)} ~ {toDateText(event.announceAt)}
    </Text>
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
        <DataTableShell
          toolbar={
            <FilterRow label="상태">
              <FilterChips
                options={STATUS_TABS.map((tab) => ({
                  value: tab.value,
                  label: tab.label,
                  count: statusCounts[tab.value],
                }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </FilterRow>
          }
          summary={
            !loading && totalCount > 0 ? (
              <Text size="sm" c="dimmed">
                총 {totalCount.toLocaleString()}건
              </Text>
            ) : undefined
          }
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
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>이벤트명</Table.Th>
                  <Table.Th>파트너 상호명</Table.Th>
                  <Table.Th ta="center">참여방식</Table.Th>
                  <Table.Th ta="center">당첨인원</Table.Th>
                  <Table.Th>대상 아파트</Table.Th>
                  <Table.Th>일정</Table.Th>
                  <Table.Th ta="center">응모수</Table.Th>
                  <Table.Th ta="center">상태</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedEvents.map((event) => (
                  <Table.Tr
                    key={event.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(event.id)}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500} maw={240} truncate>
                        {event.title}
                      </Text>
                    </Table.Td>
                    <Table.Td>{event.businessName}</Table.Td>
                    <Table.Td ta="center">
                      {PARTICIPATION_TYPE_LABEL[event.participationType]}
                    </Table.Td>
                    <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {event.winnerCount.toLocaleString()}명
                    </Table.Td>
                    <Table.Td maw={200}>
                      <ApartmentCell names={event.apartmentNames} />
                    </Table.Td>
                    <Table.Td>
                      <ScheduleCell event={event} />
                    </Table.Td>
                    <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {event.entryCount.toLocaleString()}
                    </Table.Td>
                    <Table.Td ta="center">
                      <StatusBadge.Event status={event.status} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
