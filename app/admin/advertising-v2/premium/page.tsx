'use client';

import Link from 'next/link';
import { Check, Plus, Search, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { StatusBadge, type PremiumStatus } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { ApartmentCombobox } from '@/components/apartment-combobox';
import { SalesRepFilter } from '@/components/sales-rep-filter';
import { AdCategoryFilter } from '@/components/ad-category-filter';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import {
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { usePremiumPage } from './usePremiumPage';

const STATUS_FILTERS: { value: PremiumStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'running', label: '진행' },
  { value: 'pending', label: '승인대기' },
  { value: 'modification_pending', label: '수정심사' },
  { value: 'ended', label: '종료' },
  { value: 'rejected', label: '거절' },
];

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

export default function PremiumAdListPage(): React.ReactElement {
  const {
    isLoading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    salesRepFilter,
    setSalesRepFilter,
    categoryFilter,
    setCategoryFilter,
    subCategoryFilter,
    setSubCategoryFilter,
    categories,
    subCategories,
    categoryCounts,
    allApartments,
    statusCounts,
    paginatedAds,
    page,
    setPage,
    totalPages,
    filteredCount,
    handleRowClick,
    selectedAd,
    approveDialog,
    setApproveDialog,
    rejectDialog,
    setRejectDialog,
    discountRate,
    setDiscountRate,
    adminMemo,
    setAdminMemo,
    rejectReason,
    setRejectReason,
    processing,
    handleOpenApprove,
    handleApproveConfirm,
    handleOpenReject,
    handleReject,
    handleToggleAutoApprove,
    grantAnalytics,
    setGrantAnalytics,
  } = usePremiumPage();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="프리미엄 광고 목록"
          description="프리미엄 광고 신청과 진행 상태를 관리합니다."
        />
        <PageHeaderActions>
          <Button
            component={Link}
            href="/admin/advertising-v2/premium/new"
            leftSection={<Plus size={16} />}
          >
            프리미엄 대리 등록
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <Stack gap="md">
              {/* 검색 · 아파트 · 담당자 */}
              <Group gap="xs">
                <TextInput
                  placeholder="업체명·광고 제목 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  leftSection={<Search size={16} />}
                  w={260}
                />
                <ApartmentCombobox
                  apartments={allApartments}
                  value={apartmentFilter}
                  onChange={setApartmentFilter}
                  placeholder="아파트 필터"
                />
                <SalesRepFilter value={salesRepFilter} onChange={setSalesRepFilter} />
              </Group>

              <Divider />

              <FilterRow label="광고 상태">
                <FilterChips
                  options={STATUS_FILTERS.map((f) => ({
                    value: f.value,
                    label: f.label,
                    count: statusCounts[f.value] ?? 0,
                  }))}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </FilterRow>

              <AdCategoryFilter
                categories={categories}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categoryCounts={categoryCounts}
                subCategories={subCategories}
                subCategoryFilter={subCategoryFilter}
                onSubCategoryChange={setSubCategoryFilter}
              />
            </Stack>
          }
          pagination={
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          }
        >
          {isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : paginatedAds.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="해당하는 프리미엄 광고가 없습니다"
              description="필터를 변경해서 다른 상태의 광고를 확인해 보세요."
            />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>업체명</Table.Th>
                  <Table.Th>광고 제목</Table.Th>
                  <Table.Th>기간</Table.Th>
                  <Table.Th>금액</Table.Th>
                  <Table.Th>상태</Table.Th>
                  <Table.Th>광고 시작일</Table.Th>
                  <Table.Th>광고 종료일</Table.Th>
                  <Table.Th>영업 담당자</Table.Th>
                  <Table.Th ta="center">노출수</Table.Th>
                  <Table.Th ta="center">클릭수</Table.Th>
                  <Table.Th ta="center">전화클릭수</Table.Th>
                  <Table.Th ta="center">자동승인</Table.Th>
                  <Table.Th ta="center">액션</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedAds.map((ad) => {
                  // 앱과 동일하게 DB weeks 직접 사용
                  const cumulativeWeeks = ad.weeks;
                  const extWeeks = 0;
                  // totalAmount = EF가 누적 관리하는 정상가 (payment_history 합산 불필요)
                  const baseAmount = ad.totalAmount;
                  const hasDiscount = (ad.approvedDiscountRate ?? 0) > 0;
                  const amount = hasDiscount
                    ? (ad.discountedTotalAmount ?? baseAmount)
                    : baseAmount;

                  return (
                    <Table.Tr
                      key={ad.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(ad.id)}
                    >
                      <Table.Td fw={500}>
                        {ad.partnerBusinessName ?? '-'}
                      </Table.Td>
                      <Table.Td>{ad.title ?? '(제목 없음)'}</Table.Td>
                      <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Stack gap={2}>
                          {ad.startedAt && ad.endedAt ? (
                            <Text size="sm">
                              {new Date(ad.startedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                              {' ~ '}
                              {new Date(ad.endedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">날짜 미정</Text>
                          )}
                          <Text size="xs" c="dimmed">
                            {cumulativeWeeks}주
                            {extWeeks > 0 && ` (원 ${ad.weeks} + 연장 ${extWeeks})`}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Group gap={6}>
                          {hasDiscount && (
                            <StatusBadge variant="error" withDot={false}>
                              할인{ad.approvedDiscountRate}%
                            </StatusBadge>
                          )}
                          {hasDiscount && baseAmount != null && (
                            <Text span size="xs" c="dimmed" td="line-through">{baseAmount.toLocaleString()}원</Text>
                          )}
                          <Text span size="sm" fw={500}>{amount != null ? `${amount.toLocaleString()}원` : '-'}</Text>
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
                      <Table.Td c="dimmed">
                        {ad.startedAt
                          ? new Date(ad.startedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {ad.endedAt
                          ? new Date(ad.endedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {ad.salesRepName ?? '-'}
                      </Table.Td>
                      <Table.Td ta="center" fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ad.totalImpressions > 0 ? ad.totalImpressions.toLocaleString() : '-'}
                      </Table.Td>
                      <Table.Td ta="center" fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ad.totalClicks > 0 ? ad.totalClicks.toLocaleString() : '-'}
                      </Table.Td>
                      <Table.Td ta="center" fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ad.totalPhoneClicks > 0 ? ad.totalPhoneClicks.toLocaleString() : '-'}
                      </Table.Td>
                      {/* 행 클릭이 상세로 넘어가므로 체크박스 조작은 여기서 막는다 */}
                      <Table.Td
                        ta="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ad.status === 'running' ? (
                          <Group justify="center">
                            <Checkbox
                              checked={ad.autoApproveModification}
                              aria-label="수정 심사 자동승인"
                              onChange={(e) =>
                                handleToggleAutoApprove(ad, e.currentTarget.checked)
                              }
                            />
                          </Group>
                        ) : (
                          <Text span c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td
                        ta="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Group justify="center" gap={4} wrap="nowrap">
                          {ad.status === 'pending' && (
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              color="blue"
                              leftSection={<Check size={12} />}
                              onClick={() => handleOpenApprove(ad)}
                            >
                              승인
                            </Button>
                          )}
                          {ad.status === 'pending' && (
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              color="red"
                              leftSection={<X size={12} />}
                              onClick={() => handleOpenReject(ad)}
                            >
                              거절
                            </Button>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </DataTableShell>

        {/* 결과 개수 안내 */}
        {!isLoading && filteredCount > 0 && (
          <Text ta="right" size="xs" c="dimmed">
            총 {filteredCount.toLocaleString()}건 · {page}/{totalPages} 페이지
          </Text>
        )}
      </PageContent>

      {/* 승인 다이얼로그 */}
      <Modal
        opened={approveDialog}
        onClose={() => setApproveDialog(false)}
        title="프리미엄 광고 승인"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            할인율을 입력하면 파트너에게 할인된 금액으로 결제 요청됩니다.
          </Text>
          {/* 광고 분석 열람 권한 부여 */}
          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-blue-light)">
            <Checkbox
              checked={grantAnalytics}
              disabled={selectedAd?.partnerAnalyticsEnabled}
              onChange={(e) => setGrantAnalytics(!!e.currentTarget.checked)}
              label="광고 분석 열람 권한 부여"
              description={
                selectedAd?.partnerAnalyticsEnabled
                  ? '이미 분석 열람 권한이 허용된 파트너입니다.'
                  : '승인 시 파트너가 앱에서 광고 통계를 열람할 수 있습니다.'
              }
              styles={{ label: { fontWeight: 600 } }}
            />
          </Paper>
          <TextInput
            label="할인율 (%)"
            type="number"
            min={0}
            max={100}
            placeholder="0 (할인 없음)"
            value={discountRate || ''}
            onChange={(e) => {
              const val = e.target.value;
              setDiscountRate(
                val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0))
              );
            }}
          />
          {selectedAd?.totalAmount != null && discountRate > 0 && (
            <Paper radius="md" p="sm" bg="var(--mantine-color-default-hover)">
              <Text size="sm">
                <Text span inherit c="dimmed">할인 후 결제금액: </Text>
                <Text span inherit fw={600}>
                  {(
                    Math.round(
                      (selectedAd.totalAmount * (100 - discountRate)) / 100 / 10
                    ) * 10
                  ).toLocaleString()}
                  원
                </Text>
                <Text span inherit c="dimmed" ml={4}>
                  (정상가 {selectedAd.totalAmount.toLocaleString()}원)
                </Text>
              </Text>
            </Paper>
          )}
          <Stack gap={4}>
            <Textarea
              label={
                <>
                  관리 메모{' '}
                  <Text span inherit fw={500} c="dimmed">(내부용, 파트너 비공개)</Text>
                </>
              }
              minRows={3}
              autosize
              placeholder="승인 관련 내부 메모를 남겨주세요..."
              maxLength={500}
              value={adminMemo}
              onChange={(e) => setAdminMemo(e.target.value)}
            />
            <Text ta="right" size="xs" c="dimmed">{adminMemo.length}/500</Text>
          </Stack>
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setApproveDialog(false)} disabled={processing}>
            취소
          </Button>
          <Button onClick={handleApproveConfirm} disabled={processing}>
            {processing ? '처리 중...' : '승인 확정'}
          </Button>
        </Group>
      </Modal>

      {/* 거절 다이얼로그 */}
      <Modal
        opened={rejectDialog}
        onClose={() => setRejectDialog(false)}
        title="프리미엄 광고 거절"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            거절 사유를 입력해주세요. 파트너가 이 사유를 확인할 수 있습니다.
          </Text>
          <Textarea
            minRows={5}
            autosize
            placeholder="거절 사유를 입력해주세요..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button
            variant="default"
            onClick={() => setRejectDialog(false)}
            disabled={processing}
          >
            취소
          </Button>
          <Button color="red" onClick={handleReject} disabled={processing}>
            {processing ? '처리 중...' : '거절'}
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
