'use client';

import Link from 'next/link';
import { AlertCircle, Check, Download, Inbox, Plus, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { AdCategoryFilter } from '@/components/ad-category-filter';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { ApartmentCombobox } from '@/components/apartment-combobox';
import { SalesRepFilter } from '@/components/sales-rep-filter';
import { SalesRepSelect } from '@/components/sales-rep-select';
import { formatBizCallNumber } from '@/lib/utils/format';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  HoverCard,
  Input,
  Modal,
  Paper,
  Popover,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useRowHoverPreview } from './useRowHoverPreview';
import {
  useApplicationsPage,
  type AdApplication,
  type ApartmentSummary,
  type StatusFilter,
  type BizCallFilter,
} from './useApplicationsPage';

interface ApartmentTooltipProps {
  apartments: ApartmentSummary[];
  pricePerHousehold: number;
  discountRate?: number | null;
  children: React.ReactNode;
}

function ApartmentTooltip({
  apartments,
  pricePerHousehold,
  discountRate,
  children,
}: ApartmentTooltipProps): React.ReactElement {
  if (apartments.length === 0) return <>{children}</>;

  const hasDiscount = (discountRate ?? 0) > 0;
  const totalHouseholds = apartments.reduce((sum, a) => sum + a.totalHouseholds, 0);
  const totalBase = totalHouseholds * pricePerHousehold;
  const totalDiscounted = hasDiscount ? Math.round((totalBase * (1 - (discountRate ?? 0) / 100)) / 10) * 10 : totalBase;

  return (
    <HoverCard position="bottom" openDelay={300} shadow="md" withinPortal>
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown maw={320} p="sm">
        <Stack gap={6}>
          {apartments.map((apt) => {
            const base = apt.totalHouseholds * pricePerHousehold;
            const discounted = hasDiscount ? Math.round((base * (1 - (discountRate ?? 0) / 100)) / 10) * 10 : base;
            return (
              <Group key={apt.apartmentId} justify="space-between" gap="lg" wrap="nowrap">
                <Text size="xs" fw={500}>
                  {apt.apartmentName}
                </Text>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {apt.totalHouseholds.toLocaleString()}세대 ·{' '}
                  {hasDiscount && (
                    <Text span inherit td="line-through" opacity={0.5}>
                      {base.toLocaleString()}원 </Text>
                  )}
                  {discounted.toLocaleString()}원
                </Text>
              </Group>
            );
          })}
          {apartments.length > 1 && (
            <>
              <Divider />
              <Group justify="space-between" gap="lg" wrap="nowrap">
                <Text size="xs" fw={600}>
                  합계
                </Text>
                <Text size="xs" fw={600}>
                  {totalHouseholds.toLocaleString()}세대 ·{' '}
                  {hasDiscount && (
                    <Text span inherit fw={500} td="line-through" opacity={0.5}>
                      {totalBase.toLocaleString()}원 </Text>
                  )}
                  {totalDiscounted.toLocaleString()}원
                </Text>
              </Group>
            </>
          )}
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

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

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '무료진행', value: 'free_running' },
  { label: '유료진행', value: 'paid_running' },
  { label: '미결제', value: 'unpaid' },
  { label: '승인대기', value: 'pending' },
  { label: '수정심사', value: 'modification' },
  { label: '종료', value: 'ended' },
  { label: '거절', value: 'rejected' },
  { label: '숨김', value: 'hidden' },
];

/** 행에 3초 머물면 뜨는 광고 미리보기 — 앱 노출 모습과 운영 수치를 한 번에 본다 */
function AdHoverPreview({
  ad,
  pricePerHousehold,
}: {
  ad: AdApplication;
  pricePerHousehold: number;
}): React.ReactElement {
  const thumbnail = ad.imageUrls[0] ?? null;
  const totalHouseholds = ad.apartments.reduce((sum, a) => sum + a.totalHouseholds, 0);
  const monthlyAmount =
    ad.approvedMonthlyAmount ?? totalHouseholds * pricePerHousehold;
  const period = [ad.activatedAt, ad.nextBillingDate]
    .map((d) => (d ? new Date(d).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : null));

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {thumbnail ? (
          // 광고 이미지는 원격 도메인이 파트너마다 달라 next/image 최적화 대상이 아니다
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="object-cover"
            style={{
              width: 80,
              height: 80,
              flexShrink: 0,
              borderRadius: 'var(--mantine-radius-sm)',
              border: '1px solid var(--app-divider)',
            }}
          />
        ) : (
          <Box
            w={80}
            h={80}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--mantine-radius-sm)',
              border: '1px dashed var(--app-divider)',
            }}
          >
            <Text size="xs" c="dimmed">
              이미지 없음
            </Text>
          </Box>
        )}
        <Stack gap={2} miw={0}>
          <Text size="sm" fw={600} truncate>
            {ad.title ?? '(제목 없음)'}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {ad.ad_categories_v2?.categoryName ?? '카테고리 없음'}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {ad.partner_users?.businessName ?? '-'}
          </Text>
        </Stack>
      </Group>

      {ad.content && (
        <Text size="xs" c="dimmed" lineClamp={3} lh={1.6}>
          {ad.content}
        </Text>
      )}

      <Divider />
      <Stack gap={4}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">월 금액</Text>
          <Text size="xs" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {monthlyAmount.toLocaleString()}원
            {(ad.approvedDiscountRate ?? 0) > 0 && ` (${ad.approvedDiscountRate}%↓)`}
            {ad.freeMonths > 0 && ` · 무료 ${ad.freeMonths}개월`}
          </Text>
        </Group>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">광고 기간</Text>
          <Text size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {period[0] ? `${period[0]} ~ ${period[1] ?? '-'}` : '시작 전'}
          </Text>
        </Group>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">아파트</Text>
          <Text size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {ad.apartments.length}개 · {totalHouseholds.toLocaleString()}세대
          </Text>
        </Group>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">노출 · 클릭 · 전화</Text>
          <Text size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {ad.totalImpressions.toLocaleString()} · {ad.totalClicks.toLocaleString()} ·{' '}
            {ad.totalPhoneClicks.toLocaleString()}
          </Text>
        </Group>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">영업 담당자</Text>
          <Text size="xs">{ad.salesRepName ?? '-'}</Text>
        </Group>
      </Stack>
    </Stack>
  );
}

const BIZ_CALL_FILTERS: { label: string; value: BizCallFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '비즈콜 사용', value: 'used' },
  { label: '미사용', value: 'unused' },
];

export default function AdApplicationsPage(): React.ReactElement {
  const {
    loading,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    subCategoryFilter,
    setSubCategoryFilter,
    bizCallFilter,
    setBizCallFilter,
    bizCallCounts,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    salesRepFilter,
    setSalesRepFilter,
    categories,
    subCategories,
    allApartments,
    pricePerHousehold,
    statusCounts,
    categoryCounts,
    paginatedApplications,
    page,
    setPage,
    totalPages,
    filteredCount,
    totalMonthlyAmount,
    handleExportCsv,
    handleToggleHidden,
    handleToggleDoorPopup,
    handleRowClick,
    selectedAd,
    approveDialog,
    setApproveDialog,
    rejectDialog,
    setRejectDialog,
    freeMonths,
    setFreeMonths,
    overrideEnabled,
    setOverrideEnabled,
    discountRate,
    setDiscountRate,
    startImmediately,
    setStartImmediately,
    discountNote,
    setDiscountNote,
    adminMemo,
    setAdminMemo,
    bizCallNumber,
    setBizCallNumber,
    bizCallDuplicateName,
    salesRepId,
    setSalesRepId,
    rejectReason,
    setRejectReason,
    processing,
    handleOpenApprove,
    handleApprove,
    handleOpenReject,
    handleReject,
    handleToggleAutoApprove,
    grantAnalytics,
    setGrantAnalytics,
    allCategoriesWithSubs,
    approveCategory,
    handleApproveCategoryChange,
    approveSubCategoryIds,
    setApproveSubCategoryIds,
  } = useApplicationsPage();

  const preview = useRowHoverPreview<AdApplication>();

  const selectedAdIsFirstAd = selectedAd
    ? selectedAd.isFirstAdApplication && !selectedAd.partner_users?.hasHadRunningAd
    : false;
  const selectedAdTotalHouseholds = selectedAd
    ? selectedAd.apartments.reduce((sum, a) => sum + a.totalHouseholds, 0)
    : 0;
  const selectedAdMonthlyAmount = selectedAdTotalHouseholds * pricePerHousehold;
  const approveCategoryData = allCategoriesWithSubs.find((c) => c.id === approveCategory);

  return (
    <>
      <PageShell>
        <PageHeader>
          <PageHeaderTitle
            title="기본광고 관리"
            description="광고 신청을 검토하고 승인 상태를 관리합니다."
          />
          <PageHeaderActions>
            <Button
              variant="default"
              leftSection={<Download size={16} />}
              onClick={handleExportCsv}
              disabled={loading}
            >
              CSV 내보내기
            </Button>
            <Button
              component={Link}
              href="/admin/advertising-v2/applications/new"
              leftSection={<Plus size={16} />}
            >
              광고 대리 등록
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
                    placeholder="상호명·광고 제목 검색"
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
                    options={STATUS_TABS.map((tab) => ({
                      value: tab.value,
                      label: tab.label,
                      count: statusCounts[tab.value],
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

                {/* 비즈콜(안심번호) 부여 여부 */}
                <FilterRow label="비즈콜">
                  <FilterChips
                    options={BIZ_CALL_FILTERS.map((f) => ({
                      value: f.value,
                      label: f.label,
                      count: bizCallCounts[f.value],
                    }))}
                    value={bizCallFilter}
                    onChange={setBizCallFilter}
                  />
                </FilterRow>
              </Stack>
            }
            summary={
              !loading && filteredCount > 0 ? (
                <Group gap="lg">
                  <Text size="sm" c="dimmed">
                    총 <Text span fw={700} c="var(--mantine-color-text)">{filteredCount.toLocaleString()}</Text>건
                  </Text>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      월 광고료 합계
                    </Text>
                    <Text fw={700} c="blue" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {totalMonthlyAmount.toLocaleString()}원
                    </Text>
                  </Group>
                </Group>
              ) : undefined
            }
            pagination={
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            }
          >
            {loading ? (
              <TableSkeleton rows={6} columns={9} />
            ) : paginatedApplications.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="신청 내역이 없습니다"
                description="아직 등록된 광고 신청이 없습니다."
              />
            ) : (
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>상호명</Table.Th>
                    <Table.Th ta="center">구분</Table.Th>
                    <Table.Th>광고 제목</Table.Th>
                    <Table.Th ta="center">신청 아파트</Table.Th>
                    <Table.Th ta="center">광고 상태</Table.Th>
                    <Table.Th ta="center">결제 상태</Table.Th>
                    <Table.Th ta="right">금액(월)</Table.Th>
                    <Table.Th>광고 시작일</Table.Th>
                    <Table.Th>광고 종료일</Table.Th>
                    <Table.Th>무료체험 종료일</Table.Th>
                    <Table.Th>영업 담당자</Table.Th>
                    <Table.Th ta="center">노출수</Table.Th>
                    <Table.Th ta="center">클릭수</Table.Th>
                    <Table.Th ta="center">전화클릭수</Table.Th>
                    <Table.Th ta="center">
                      <Tooltip
                        multiline
                        w={320}
                        position="bottom"
                        openDelay={300}
                        label={
                          <>
                            켜면 파트너 수정 요청을 10분마다 자동승인합니다.
                            <br />
                            꺼두어도 매일 저녁 7시에 남은 수정 요청이 일괄 자동승인됩니다.
                          </>
                        }
                      >
                        <Text
                          span
                          inherit
                          td="underline"
                          style={{ cursor: 'default', textDecorationStyle: 'dashed', textUnderlineOffset: 2 }}
                        >
                          자동승인
                        </Text>
                      </Tooltip>
                    </Table.Th>
                    <Table.Th ta="center">숨김</Table.Th>
                    <Table.Th ta="center">
                      <Tooltip
                        multiline
                        w={360}
                        openDelay={300}
                        label={
                          <>
                            체크한 광고가 하나라도 있으면 문열림 광고 팝업은 체크한 광고 중에서만 나옵니다.
                            <br />
                            전부 해제하면 운영 중 광고 전체에서 무작위로 나옵니다.
                            <br />
                            단독 팝업 모드에서는 이 광고가 단독 팝업 카드(첫 번째 사진·제목·광고 내용)로 맨 앞에 노출됩니다 (단독 팝업 &apos;첫 화면&apos; 광고가 있으면 그 다음).
                            <br />
                            체크한 수만큼 유료 단독 팝업 자리가 줄어드니, 영업 시연이 끝나면 꼭 해제해 주세요.
                          </>
                        }
                      >
                        <Text
                          span
                          inherit
                          td="underline"
                          style={{ cursor: 'help', textDecorationStyle: 'dotted' }}
                        >
                          팝업 우선
                        </Text>
                      </Tooltip>
                    </Table.Th>
                    <Table.Th ta="center">액션</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedApplications.map((app) => (
                    <Table.Tr
                      key={app.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(app.id)}
                      onMouseEnter={() => preview.handleRowEnter(app)}
                      onMouseMove={preview.handleRowMove}
                      onMouseLeave={preview.handleRowLeave}
                    >
                      <Table.Td fw={500}>
                        {app.partner_users?.businessName ?? '-'}
                      </Table.Td>
                      <Table.Td ta="center">
                        {app.subscriptionStatus === 'cancel_pending' ? (
                          <StatusBadge variant="error" size="sm" withDot={false}>
                            중단예정
                          </StatusBadge>
                        ) : app.isFirstAdApplication ? (
                          <StatusBadge variant="info" size="sm" withDot={false}>
                            첫광고
                          </StatusBadge>
                        ) : (
                          <Text span c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td maw={240}>
                        {app.title ? (
                          <Text size="sm" truncate>
                            {app.title}
                          </Text>
                        ) : (
                          <Text span c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="center">
                        <ApartmentTooltip
                          apartments={app.apartments}
                          pricePerHousehold={pricePerHousehold}
                          discountRate={app.approvedDiscountRate}
                        >
                          <Text
                            span
                            inherit
                            c="blue"
                            fw={600}
                            td="underline"
                            style={{ cursor: 'help', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {app.apartments.length}개
                          </Text>
                        </ApartmentTooltip>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Stack gap={4} align="center">
                          <StatusBadge.Ad status={app.adStatus} />
                          {app.adStatus === 'running' && app.freeMonths > 0 && (
                            <StatusBadge variant="free">
                              무료체험
                            </StatusBadge>
                          )}
                          {app.modificationStatus && (
                            <StatusBadge.Modification status={app.modificationStatus} />
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td ta="center">
                        <StatusBadge.Payment status={app.paymentStatus} />
                      </Table.Td>
                      <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {(() => {
                          const totalHouseholds = app.apartments.reduce((s, a) => s + a.totalHouseholds, 0);
                          const hasDiscount = (app.approvedDiscountRate ?? 0) > 0;
                          // 정상가는 세대수 × 단가로 계산 (approvedMonthlyAmount는 이미 할인이 적용된 최종 금액)
                          const base = totalHouseholds * pricePerHousehold;
                          const discounted =
                            app.approvedMonthlyAmount ??
                            (hasDiscount
                              ? Math.round((base * (1 - (app.approvedDiscountRate ?? 0) / 100)) / 10) * 10
                              : base);
                          if (base === 0) return <Text span c="dimmed">-</Text>;
                          return (
                            <Stack gap={2} align="flex-end">
                              <Group gap={6} wrap="nowrap">
                                {hasDiscount && (
                                  <Text span size="xs" c="dimmed" td="line-through">{base.toLocaleString()}원</Text>
                                )}
                                <Text span size="sm" fw={500}>{discounted.toLocaleString()}원</Text>
                              </Group>
                              {hasDiscount && (
                                <StatusBadge variant="error" withDot={false}>
                                  할인{app.approvedDiscountRate}%
                                </StatusBadge>
                              )}
                            </Stack>
                          );
                        })()}
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {app.activatedAt
                          ? new Date(app.activatedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {app.nextBillingDate
                          ? new Date(app.nextBillingDate).toLocaleDateString('ko-KR')
                          : '-'}
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {app.freeEndDate
                          ? new Date(app.freeEndDate).toLocaleDateString('ko-KR')
                          : '-'}
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {app.salesRepName ?? '-'}
                      </Table.Td>
                      <Table.Td ta="center" fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {app.totalImpressions > 0 ? app.totalImpressions.toLocaleString() : '-'}
                      </Table.Td>
                      <Table.Td ta="center" fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {app.totalClicks > 0 ? app.totalClicks.toLocaleString() : '-'}
                      </Table.Td>
                      <Table.Td ta="center" fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {app.totalPhoneClicks > 0 ? app.totalPhoneClicks.toLocaleString() : '-'}
                      </Table.Td>
                      {/* 행 클릭이 상세로 넘어가므로 체크박스 조작은 여기서 막는다 */}
                      <Table.Td
                        ta="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {app.adStatus === 'running' ? (
                          <Group justify="center">
                            <Checkbox
                              checked={app.autoApproveModification}
                              aria-label="수정 심사 자동승인"
                              onChange={(e) =>
                                handleToggleAutoApprove(app, e.currentTarget.checked)
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
                        <Group justify="center">
                          <Checkbox
                            checked={app.isHidden}
                            aria-label="앱 노출에서 숨기기"
                            onChange={(e) => handleToggleHidden(app, e.currentTarget.checked)}
                          />
                        </Group>
                      </Table.Td>
                      <Table.Td
                        ta="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Group justify="center">
                          <Checkbox
                            checked={app.showInDoorPopup}
                            aria-label="문열림 팝업 우선 노출"
                            disabled={app.adStatus !== 'running'}
                            onChange={(e) => handleToggleDoorPopup(app, e.currentTarget.checked)}
                          />
                        </Group>
                      </Table.Td>
                      <Table.Td
                        ta="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Group justify="center" gap={4} wrap="nowrap">
                          {app.adStatus === 'pending' && (
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              color="blue"
                              leftSection={<Check size={12} />}
                              onClick={() => handleOpenApprove(app)}
                            >
                              승인
                            </Button>
                          )}
                          {app.adStatus === 'pending' && (
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              color="red"
                              leftSection={<X size={12} />}
                              onClick={() => handleOpenReject(app)}
                            >
                              거절
                            </Button>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            {/* 마우스 좌표에 붙는 0x0 앵커 — 카드가 커서 옆에 뜨게 한다 */}
            {/* 열림 여부는 훅이 제어하므로 controlled Popover로 띄운다 (HoverCard는 자체 hover 동작만 지원) */}
            <Popover
              opened={preview.hovered !== null}
              position="right-start"
              offset={16}
              width={380}
              shadow="md"
              hideDetached={false}
            >
              <Popover.Target>
                <span
                  ref={preview.anchorRef}
                  aria-hidden
                  style={{ pointerEvents: 'none', position: 'fixed', width: 0, height: 0 }}
                />
              </Popover.Target>
              <Popover.Dropdown
                onMouseEnter={preview.handleCardEnter}
                onMouseLeave={preview.handleCardLeave}
              >
                {preview.hovered && (
                  <AdHoverPreview
                    ad={preview.hovered}
                    pricePerHousehold={pricePerHousehold}
                  />
                )}
              </Popover.Dropdown>
            </Popover>
          </DataTableShell>

          {/* 결과 개수 안내 (합계는 테이블 우측 상단으로 이동) */}
          {!loading && filteredCount > 0 && (
            <Group justify="flex-end" gap="md">
              <Text size="xs" c="dimmed">
                총 {filteredCount.toLocaleString()}건 · {page}/{totalPages} 페이지
              </Text>
            </Group>
          )}
        </PageContent>
      </PageShell>

      {/* 승인 다이얼로그 */}
      {/* 입력 항목이 많아 작은 화면에서 잘리므로 내용 영역을 스크롤 가능하게 둔다 */}
      <Modal
        opened={approveDialog}
        onClose={() => setApproveDialog(false)}
        title="광고 신청 승인"
        size="md"
      >
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            <Text span inherit fw={700} c="var(--mantine-color-text)">
              {selectedAd?.partner_users?.businessName}
            </Text>
            의 광고 신청을 승인합니다.
          </Text>
          {!selectedAdIsFirstAd && (
            <Alert color="yellow" variant="light" icon={<AlertCircle size={16} />} p="sm">
              <Stack gap="xs">
                <Text size="sm">
                  이 파트너는 이미 광고를 운영한 이력이 있습니다.
                </Text>
                <Checkbox
                  checked={overrideEnabled}
                  onChange={(e) => setOverrideEnabled(e.target.checked)}
                  label="예외 적용 (파트너 협의 완료)"
                  styles={{ label: { fontWeight: 500 } }}
                />
              </Stack>
            </Alert>
          )}
          {/* 광고 분석 열람 권한 부여 */}
          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-blue-light)">
            <Checkbox
              checked={grantAnalytics}
              disabled={selectedAd?.partner_users?.analyticsEnabled}
              onChange={(e) => setGrantAnalytics(!!e.currentTarget.checked)}
              label="광고 분석 열람 권한 부여"
              description={
                selectedAd?.partner_users?.analyticsEnabled
                  ? '이미 분석 열람 권한이 허용된 파트너입니다.'
                  : '승인 시 파트너가 앱에서 광고 통계를 열람할 수 있습니다.'
              }
              styles={{ label: { fontWeight: 600 } }}
            />
          </Paper>
          <Stack gap="xs">
            <Select
              label={
                <>
                  카테고리{' '}
                  <Text span size="sm" fw={500} c="dimmed">
                    (변경 시에만 수정)
                  </Text>
                </>
              }
              placeholder="카테고리 선택"
              data={allCategoriesWithSubs.map((cat) => ({
                value: cat.id,
                label: cat.categoryName,
              }))}
              value={approveCategory || null}
              onChange={(v) => {
                if (v === null) return;
                handleApproveCategoryChange(v);
              }}
              allowDeselect={false}
            />
            {approveCategoryData && approveCategoryData.subCategories.length > 0 && (
              <Stack gap={6}>
                <Text size="sm" fw={500} c="dimmed">
                  서브카테고리
                </Text>
                <Group gap="sm">
                  {approveCategoryData.subCategories.map((sub) => (
                    <Checkbox
                      key={sub.id}
                      label={sub.subCategoryName}
                      checked={approveSubCategoryIds.includes(sub.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setApproveSubCategoryIds(
                          checked
                            ? [...approveSubCategoryIds, sub.id]
                            : approveSubCategoryIds.filter((id) => id !== sub.id)
                        );
                      }}
                    />
                  ))}
                </Group>
              </Stack>
            )}
          </Stack>
          <Stack gap={6}>
            <TextInput
              label="무료 개월 수"
              type="number"
              min={0}
              max={24}
              placeholder="0"
              disabled={!selectedAdIsFirstAd && !overrideEnabled}
              value={freeMonths || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFreeMonths(val === '' ? 0 : Math.min(24, Math.max(0, parseInt(val) || 0)));
              }}
            />
            {(selectedAdIsFirstAd || overrideEnabled) && (
              <Text size="sm" c="dimmed">
                무료 기간: <strong>{freeMonths}개월</strong>
              </Text>
            )}
          </Stack>
          <Stack gap={6}>
            <TextInput
              label={overrideEnabled ? '예외 결제 할인율 (%)' : '첫 결제 할인율 (%)'}
              type="number"
              min={0}
              max={100}
              placeholder="0"
              disabled={!selectedAdIsFirstAd && !overrideEnabled}
              value={discountRate || ''}
              onChange={(e) => {
                const val = e.target.value;
                setDiscountRate(
                  val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0))
                );
              }}
            />
            {(selectedAdIsFirstAd || overrideEnabled) && (
              <Text size="sm" c="dimmed">
                적용 후 월 결제금액:{' '}
                <strong>
                  {(
                    Math.round(
                      (selectedAdMonthlyAmount * (1 - discountRate / 100)) / 10
                    ) * 10
                  ).toLocaleString()}
                  원
                </strong>
              </Text>
            )}
          </Stack>
          {/* 받을 돈이 0원일 때만 카드 없이 개시할 수 있다 — 등록·수정 폼과 같은 조건 */}
          {(selectedAdIsFirstAd || overrideEnabled) && discountRate === 100 && (
            <Paper component="label" withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)" style={{ cursor: 'pointer' }}>
              {/* 원래처럼 상자 전체(설명 포함)를 눌러도 체크된다 */}
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Checkbox
                  checked={startImmediately}
                  onChange={(e) => setStartImmediately(e.currentTarget.checked)}
                  mt={2}
                />
                <div>
                  <Text size="sm" fw={500}>카드 등록 없이 바로 광고 시작</Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    승인과 동시에 노출됩니다. 파트너 결제를 건너뛰고 정기결제는 돌지 않습니다.
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          <Stack gap={4}>
            <Textarea
              label={
                <>
                  파트너 할인관련 안내 문구{' '}
                  <Text span size="sm" fw={500} c="dimmed">
                    (파트너에게 표시, 선택)
                  </Text>
                </>
              }
              minRows={3}
              autosize
              placeholder="예: 개업 축하 혜택으로 함께합니다 / 신규 상권 지원 등"
              maxLength={100}
              value={discountNote}
              onChange={(e) => setDiscountNote(e.target.value)}
            />
            <Text ta="right" size="xs" c="dimmed">
              {discountNote.length}/100
            </Text>
          </Stack>
          <Stack gap={6}>
            <TextInput
              label={
                <>
                  비즈콜 번호{' '}
                  <Text span size="sm" fw={500} c="dimmed">
                    (안심번호, 선택)
                  </Text>
                </>
              }
              placeholder="예: 0507-1234-5678"
              inputMode="numeric"
              value={bizCallNumber}
              onChange={(e) => setBizCallNumber(formatBizCallNumber(e.target.value))}
            />
            {bizCallDuplicateName ? (
              <Text size="xs" c="red">
                이미 다른 파트너({bizCallDuplicateName})가 사용 중인 번호입니다.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                입력하면 앱 광고 상세에서 이 번호가 노출됩니다. 비워두면 기존 대표번호(
                {selectedAd?.partner_users?.displayPhoneNumber || '미등록'})가 그대로 노출됩니다.
              </Text>
            )}
          </Stack>
          <Input.Wrapper
            label={
              <>
                영업 담당자{' '}
                <Text span size="sm" fw={500} c="dimmed">(선택)</Text>
              </>
            }
          >
            <SalesRepSelect value={salesRepId} onChange={setSalesRepId} />
          </Input.Wrapper>
          <Stack gap={4}>
            <Textarea
              label={
                <>
                  관리 메모{' '}
                  <Text span size="sm" fw={500} c="dimmed">
                    (내부용, 파트너 비공개)
                  </Text>
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
          <Button
            variant="default"
            onClick={() => setApproveDialog(false)}
            disabled={processing}
          >
            취소
          </Button>
          <Button
            color="blue"
            onClick={handleApprove}
            disabled={processing || !!bizCallDuplicateName}
          >
            {processing ? '처리 중...' : '승인'}
          </Button>
        </Group>
      </Modal>

      {/* 거절 다이얼로그 */}
      <Modal
        opened={rejectDialog}
        onClose={() => setRejectDialog(false)}
        title="광고 신청 거절"
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
    </>
  );
}
