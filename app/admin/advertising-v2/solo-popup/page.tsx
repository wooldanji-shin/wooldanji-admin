'use client';

import Link from 'next/link';
import { DoorOpen, Plus, Search } from 'lucide-react';
import { PageContent, PageHeader, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Button, Checkbox, Divider, Group, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { periodLabel } from '@/lib/ads/solo-popup';
import { useSoloPopupPage, type SoloStatusFilter } from './useSoloPopupPage';

const STATUS_FILTERS: { value: SoloStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'running', label: '진행' },
  { value: 'pending', label: '승인대기' },
  { value: 'modification', label: '수정심사' },
  { value: 'approved', label: '결제대기' },
  { value: 'ended', label: '종료' },
  { value: 'rejected', label: '거절' },
];

const formatDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');

export default function SoloPopupListPage(): React.ReactElement {
  const p = useSoloPopupPage();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="단독 팝업 광고 목록"
          description="문 열림 시 노출되는 단독 팝업 광고 신청과 진행 상태를 관리합니다."
        />
        <Button
          component={Link}
          href="/admin/advertising-v2/solo-popup/new"
          leftSection={<Plus size={16} />}
        >
          단독 팝업 대리 등록
        </Button>
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <Stack gap="md">
              <Group gap="xs">
                <TextInput
                  w={260}
                  placeholder="업체명·광고 제목 검색"
                  value={p.searchTerm}
                  onChange={(e) => p.setSearchTerm(e.target.value)}
                  leftSection={<Search size={16} />}
                />
              </Group>

              <Divider />

              <FilterRow label="광고 상태">
                <FilterChips
                  options={STATUS_FILTERS.map((f) => ({
                    value: f.value,
                    label: f.label,
                    count: p.statusCounts[f.value],
                  }))}
                  value={p.statusFilter}
                  onChange={p.setStatusFilter}
                />
              </FilterRow>
            </Stack>
          }
          pagination={
            p.totalPages > 1 ? (
              <Group justify="center" gap="sm" py="sm">
                <Button variant="default" size="xs" disabled={p.page <= 1} onClick={() => p.setPage(p.page - 1)}>이전</Button>
                <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.page} / {p.totalPages}</Text>
                <Button variant="default" size="xs" disabled={p.page >= p.totalPages} onClick={() => p.setPage(p.page + 1)}>다음</Button>
              </Group>
            ) : undefined
          }
        >
          {p.loading ? (
            <TableSkeleton rows={6} columns={8} />
          ) : p.pageRows.length === 0 ? (
            <EmptyState icon={DoorOpen} title="해당하는 단독 팝업 광고가 없습니다" description="필터를 변경해 보세요." />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>업체명</Table.Th>
                  <Table.Th>팝업 제목</Table.Th>
                  <Table.Th>기간</Table.Th>
                  <Table.Th>금액</Table.Th>
                  <Table.Th>상태</Table.Th>
                  <Table.Th>시작일</Table.Th>
                  <Table.Th>종료일</Table.Th>
                  <Table.Th>영업 담당자</Table.Th>
                  <Table.Th ta="center">문열림 노출</Table.Th>
                  <Table.Th ta="center">문열림 클릭</Table.Th>
                  <Table.Th ta="center">홈 노출</Table.Th>
                  <Table.Th ta="center">홈 클릭</Table.Th>
                  <Table.Th ta="center">자동승인</Table.Th>
                  <Table.Th ta="center">
                    <Tooltip
                      openDelay={300}
                      multiline
                      w={320}
                      withArrow
                      label={
                        <>
                          체크한 단독 팝업은 문열림 팝업 맨 앞 카드로 나옵니다 (여러 개면 그들끼리 섞임).
                          <br />
                          기본 광고 &apos;팝업 우선&apos;보다도 앞에 나옵니다.
                          <br />
                          체크한 수가 최대 카드 수보다 많으면 그중에서 무작위로 나옵니다.
                        </>
                      }
                    >
                      <Text
                        span
                        size="sm"
                        fw={700}
                        style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                      >
                        첫 화면
                      </Text>
                    </Tooltip>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {p.pageRows.map((ad) => {
                  const hasDiscount = (ad.approvedDiscountRate ?? 0) > 0;
                  const amount = hasDiscount ? (ad.discountedTotalAmount ?? ad.totalAmount) : ad.totalAmount;
                  return (
                    <Table.Tr key={ad.id} style={{ cursor: 'pointer' }} onClick={() => p.handleRowClick(ad.id)}>
                      <Table.Td fw={500}>{ad.partnerBusinessName}</Table.Td>
                      <Table.Td>{ad.title}</Table.Td>
                      <Table.Td>{periodLabel(ad.periodUnit, ad.periodCount)}</Table.Td>
                      <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Group gap={6}>
                          {hasDiscount && (
                            <StatusBadge variant="error" withDot={false}>할인{ad.approvedDiscountRate}%</StatusBadge>
                          )}
                          <Text size="sm" fw={500}>{amount.toLocaleString()}원</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={6} align="flex-start">
                          <StatusBadge.Premium status={ad.status} />
                          {ad.status === 'running' && ad.modificationStatus === 'pending' && (
                            <StatusBadge variant="primary">수정 심사</StatusBadge>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td c="dimmed">{formatDate(ad.startedAt)}</Table.Td>
                      <Table.Td c="dimmed">{formatDate(ad.endedAt)}</Table.Td>
                      <Table.Td c="dimmed">{ad.salesRepName ?? '-'}</Table.Td>
                      <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>{ad.impressions.toLocaleString()}</Table.Td>
                      <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>{ad.clicks.toLocaleString()}</Table.Td>
                      <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>{ad.homeImpressions.toLocaleString()}</Table.Td>
                      <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>{ad.homeClicks.toLocaleString()}</Table.Td>
                      {/* 행 클릭이 상세로 넘어가므로 체크박스 조작은 여기서 막는다 */}
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        {ad.status === 'running' ? (
                          <Group justify="center">
                            <Checkbox
                              checked={ad.autoApproveModification}
                              aria-label="수정 심사 자동승인"
                              disabled={p.togglingId !== null}
                              onChange={(e) => p.handleToggleAutoApprove(ad, e.currentTarget.checked)}
                            />
                          </Group>
                        ) : (
                          <Text ta="center" size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        {ad.status === 'running' ? (
                          <Group justify="center">
                            <Checkbox
                              checked={ad.isDoorPopupFirst}
                              aria-label="문열림 팝업 첫 화면 노출"
                              disabled={p.togglingId !== null}
                              onChange={(e) => p.handleToggleDoorPopupFirst(ad, e.currentTarget.checked)}
                            />
                          </Group>
                        ) : (
                          <Text ta="center" size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
