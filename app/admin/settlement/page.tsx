'use client';

import { Download, ExternalLink, Inbox, Receipt, Search, TrendingUp, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbarSearch } from '@/components/data-toolbar';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { PartnerCombobox } from '@/components/partner-combobox';
import { DateInput } from '@/components/date-input';
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useSettlementPage } from './useSettlementPage';
import type { SettlementPaymentType, StatusFilter, TypeFilter } from './types';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '결제완료', value: 'success' },
  { label: '무료체험', value: 'freeTrial' },
  { label: '결제실패', value: 'failed' },
];

const TYPE_TABS: { label: string; value: TypeFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '기본광고', value: 'basic' },
  { label: '프리미엄 최초', value: 'premium' },
  { label: '프리미엄 연장', value: 'extension' },
  { label: '단독 팝업 최초', value: 'solo_popup' },
  { label: '단독 팝업 연장', value: 'solo_popup_extension' },
];

const PAYMENT_TYPE_LABEL: Record<SettlementPaymentType, string> = {
  basic: '기본광고',
  premium: '프리미엄 최초',
  extension: '프리미엄 연장',
  solo_popup: '단독 팝업 최초',
  solo_popup_extension: '단독 팝업 연장',
};

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps): React.ReactElement | null {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): number[] => {
    let start = Math.max(1, page - 4);
    const end = Math.min(totalPages, start + 9);
    start = Math.max(1, end - 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <Group
      justify="center"
      gap={4}
      px="md"
      py="sm"
      style={{ borderTop: '1px solid var(--app-divider)' }}
    >
      <Button
        variant="default"
        size="xs"
        leftSection={<ChevronLeft size={16} />}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </Button>
      {getPageNumbers().map((n) => (
        <Button
          key={n}
          variant={n === page ? 'filled' : 'default'}
          color={n === page ? 'blue' : 'gray'}
          size="xs"
          w={36}
          px={0}
          onClick={() => onPageChange(n)}
        >
          {n}
        </Button>
      ))}
      <Button
        variant="default"
        size="xs"
        rightSection={<ChevronRight size={16} />}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </Group>
  );
}

export default function SettlementPage(): React.ReactElement {
  const {
    loading,
    dateFromDraft,
    dateToDraft,
    setDateFromDraft,
    setDateToDraft,
    applyDateRange,
    monthOptions,
    selectedMonth,
    applyMonth,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    partnerFilter,
    setPartnerFilter,
    searchTerm,
    setSearchTerm,
    allPartners,
    summary,
    paginatedPayments,
    page,
    setPage,
    totalPages,
    filteredCount,
    handleExportCsv,
  } = useSettlementPage();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="정산 관리"
          description="파트너 광고비 결제 내역을 조회하고 매출을 집계합니다."
        />
        <PageHeaderActions>
          <Button
            variant="default"
            size="sm"
            leftSection={<Download size={16} />}
            onClick={handleExportCsv}
          >
            CSV 내보내기
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        {/* KPI 요약 카드 */}
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
          <StatCard
            label="기간 매출 합계"
            value={`${summary.totalRevenue.toLocaleString()}원`}
            icon={Receipt}
            delta={summary.totalRevenueDeltaPct ?? undefined}
            deltaLabel="이전 기간 대비"
            accent="primary"
            loading={loading}
          />
          <StatCard
            label="결제 성공 건수"
            value={`${summary.successCount.toLocaleString()}건`}
            icon={TrendingUp}
            delta={summary.successCountDeltaPct ?? undefined}
            deltaLabel="이전 기간 대비"
            accent="success"
            loading={loading}
          />
          <StatCard
            label="결제 실패 건수"
            value={`${summary.failedCount.toLocaleString()}건`}
            icon={XCircle}
            hint="즉시 확인 필요"
            accent="destructive"
            loading={loading}
          />
          <StatCard
            label="프리미엄·단독 팝업 매출 비중"
            value={`${summary.premiumRevenueRatioPct.toFixed(1)}%`}
            icon={Receipt}
            accent="info"
            loading={loading}
          />
        </SimpleGrid>

        <DataTableShell
          toolbar={
            <Stack gap="md">
              {/* 기간 + 파트너 + 검색 */}
              <Group gap="xs" wrap="wrap">
                <Select
                  placeholder="월 선택"
                  data={monthOptions.map((m) => ({ value: m.value, label: m.label }))}
                  value={selectedMonth}
                  onChange={(v) => {
                    if (v === null) return;
                    applyMonth(v);
                  }}
                  allowDeselect={false}
                  w={130}
                />
                <Box w={130}>
                  <DateInput
                    value={dateFromDraft}
                    onChange={setDateFromDraft}
                    onKeyDown={(e) => e.key === 'Enter' && applyDateRange()}
                  />
                </Box>
                <Text c="dimmed">~</Text>
                <Box w={130}>
                  <DateInput
                    value={dateToDraft}
                    onChange={setDateToDraft}
                    onKeyDown={(e) => e.key === 'Enter' && applyDateRange()}
                  />
                </Box>
                <Button
                  variant="default"
                  leftSection={<Search size={16} />}
                  onClick={applyDateRange}
                >
                  조회
                </Button>
                <PartnerCombobox
                  partners={allPartners}
                  value={partnerFilter}
                  onChange={setPartnerFilter}
                  placeholder="파트너 필터"
                />
                <DataToolbarSearch
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="상호명·광고명 검색"
                  className="sm:max-w-[240px]"
                />
              </Group>

              <Divider />

              <FilterRow label="결제 상태">
                <FilterChips options={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
              </FilterRow>

              <FilterRow label="결제 유형">
                <FilterChips options={TYPE_TABS} value={typeFilter} onChange={setTypeFilter} />
              </FilterRow>
            </Stack>
          }
          summary={
            !loading && filteredCount > 0 ? (
              <Text size="sm" c="dimmed">
                총 {filteredCount.toLocaleString()}건 · {page}/{totalPages} 페이지
              </Text>
            ) : undefined
          }
          pagination={
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          }
        >
          {loading ? (
            <TableSkeleton rows={6} columns={11} />
          ) : paginatedPayments.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="결제 내역이 없습니다"
              description="선택한 기간·필터에 해당하는 결제 내역이 없습니다."
            />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>파트너명</Table.Th>
                  <Table.Th>대표자명</Table.Th>
                  <Table.Th>결제유형</Table.Th>
                  <Table.Th>광고명</Table.Th>
                  <Table.Th ta="right">공급가액</Table.Th>
                  <Table.Th ta="right">부가세</Table.Th>
                  <Table.Th ta="right">합계금액</Table.Th>
                  <Table.Th>결제일</Table.Th>
                  <Table.Th>청구기간</Table.Th>
                  <Table.Th ta="center">상태</Table.Th>
                  <Table.Th ta="center">영수증</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedPayments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td fw={500}>{payment.partnerBusinessName ?? '-'}</Table.Td>
                    <Table.Td c="dimmed">{payment.representativeName ?? '-'}</Table.Td>
                    <Table.Td c="dimmed">{PAYMENT_TYPE_LABEL[payment.paymentType]}</Table.Td>
                    <Table.Td maw={220}>
                      {payment.adTitle ? (
                        <Text size="sm" truncate>
                          {payment.adTitle}
                        </Text>
                      ) : (
                        <Text span c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {payment.supplyAmount.toLocaleString()}원
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {payment.vatAmount.toLocaleString()}원
                    </Table.Td>
                    <Table.Td
                      ta="right"
                      fz="sm"
                      fw={600}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {payment.amount.toLocaleString()}원
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {new Date(payment.paymentDate).toLocaleDateString('ko-KR')}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {payment.billingPeriodStart && payment.billingPeriodEnd
                        ? `${new Date(payment.billingPeriodStart).toLocaleDateString('ko-KR')} ~ ${new Date(payment.billingPeriodEnd).toLocaleDateString('ko-KR')}`
                        : '-'}
                    </Table.Td>
                    <Table.Td ta="center">
                      {payment.status === 'failed' && payment.failReason ? (
                        <Tooltip
                          label={payment.failReason}
                          position="top"
                          multiline
                          maw={320}
                          openDelay={300}
                        >
                          <Box component="span" style={{ cursor: 'default' }}>
                            <StatusBadge.Settlement status={payment.status} />
                          </Box>
                        </Tooltip>
                      ) : (
                        <StatusBadge.Settlement status={payment.status} />
                      )}
                    </Table.Td>
                    <Table.Td ta="center">
                      {payment.receiptUrl ? (
                        <ActionIcon
                          component="a"
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="subtle"
                          color="gray"
                          aria-label="영수증 새 탭에서 열기"
                        >
                          <ExternalLink size={16} />
                        </ActionIcon>
                      ) : (
                        <Text span c="dimmed">-</Text>
                      )}
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
