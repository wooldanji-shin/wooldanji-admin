'use client';

import { AlertCircle, Check, Inbox, Search, X } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar, DataToolbarFilters } from '@/components/data-toolbar';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { ApartmentCombobox } from '@/components/apartment-combobox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useApplicationsPage,
  type ApartmentSummary,
  type StatusFilter,
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
  const totalDiscounted = hasDiscount ? Math.round(totalBase * (1 - (discountRate ?? 0) / 100)) : totalBase;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs border border-border bg-popover p-0 text-popover-foreground shadow-popover"
      >
        <div className="space-y-1.5 p-3">
          {apartments.map((apt) => {
            const base = apt.totalHouseholds * pricePerHousehold;
            const discounted = hasDiscount ? Math.round(base * (1 - (discountRate ?? 0) / 100)) : base;
            return (
              <div
                key={apt.apartmentId}
                className="flex items-center justify-between gap-6 text-xs"
              >
                <span className="font-medium">{apt.apartmentName}</span>
                <span className="shrink-0 text-muted-foreground">
                  {apt.totalHouseholds.toLocaleString()}세대 ·{' '}
                  {hasDiscount && <span className="line-through opacity-50">{base.toLocaleString()}원 </span>}
                  {discounted.toLocaleString()}원
                </span>
              </div>
            );
          })}
          {apartments.length > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs font-semibold">
              <span>합계</span>
              <span>
                {totalHouseholds.toLocaleString()}세대 ·{' '}
                {hasDiscount && <span className="line-through font-normal opacity-50">{totalBase.toLocaleString()}원 </span>}
                {totalDiscounted.toLocaleString()}원
              </span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
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
    <div className="flex items-center justify-center gap-1 border-t border-border px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </Button>
      {getPageNumbers().map((n) => (
        <Button
          key={n}
          variant={n === page ? 'default' : 'ghost'}
          size="sm"
          className="w-9"
          onClick={() => onPageChange(n)}
        >
          {n}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </div>
  );
}

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '무료진행', value: 'free_running' },
  { label: '유료진행', value: 'paid_running' },
  { label: '승인대기', value: 'pending' },
  { label: '수정심사', value: 'modification' },
  { label: '종료', value: 'ended' },
  { label: '거절', value: 'rejected' },
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
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
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
    discountNote,
    setDiscountNote,
    adminMemo,
    setAdminMemo,
    rejectReason,
    setRejectReason,
    processing,
    handleOpenApprove,
    handleApprove,
    handleOpenReject,
    handleReject,
    grantAnalytics,
    setGrantAnalytics,
    allCategoriesWithSubs,
    approveCategory,
    handleApproveCategoryChange,
    approveSubCategoryIds,
    setApproveSubCategoryIds,
  } = useApplicationsPage();

  const selectedAdIsFirstAd = selectedAd
    ? selectedAd.isFirstAdApplication && !selectedAd.partner_users?.hasHadRunningAd
    : false;
  const selectedAdTotalHouseholds = selectedAd
    ? selectedAd.apartments.reduce((sum, a) => sum + a.totalHouseholds, 0)
    : 0;
  const selectedAdMonthlyAmount = selectedAdTotalHouseholds * pricePerHousehold;
  const approveCategoryData = allCategoriesWithSubs.find((c) => c.id === approveCategory);

  return (
    <TooltipProvider delayDuration={300}>
      <PageShell>
        <PageHeader>
          <PageHeaderTitle
            title="기본광고 관리"
            description="광고 신청을 검토하고 승인 상태를 관리합니다."
          />
        </PageHeader>

        <PageContent>
          {/* 아파트 필터 + 검색 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="상호명·광고 제목 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-[260px] pl-9"
              />
            </div>
            <ApartmentCombobox
              apartments={allApartments}
              value={apartmentFilter}
              onChange={setApartmentFilter}
              placeholder="아파트 필터"
            />
          </div>

          {/* 상태 탭 — 개수 배지 포함 */}
          <div className="inline-flex w-full max-w-4xl items-center gap-1 rounded-lg border border-border/70 bg-card p-1.5 shadow-card">
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
            toolbar={
              <DataToolbar className="flex-col sm:flex-col sm:items-stretch gap-2 py-3">
                {/* 카테고리 필터 */}
                {categories.length > 0 && (
                  <DataToolbarFilters>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(null)}
                      className={cn(
                        'inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
                        categoryFilter === null
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                      )}
                    >
                      전체 카테고리
                    </button>
                    {categories.map((cat) => {
                      const isActive = categoryFilter === cat.id;
                      const count = categoryCounts[cat.id] ?? 0;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(isActive ? null : cat.id)}
                          className={cn(
                            'inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {cat.categoryName}
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
                  </DataToolbarFilters>
                )}

                {/* 서브카테고리 필터 — 카테고리 선택 시 표시 */}
                {subCategories.length > 0 && (
                  <DataToolbarFilters>
                    <button
                      type="button"
                      onClick={() => setSubCategoryFilter(null)}
                      className={cn(
                        'inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors',
                        subCategoryFilter === null
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                      )}
                    >
                      전체
                    </button>
                    {subCategories.map((sub) => {
                      const isActive = subCategoryFilter === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSubCategoryFilter(isActive ? null : sub.id)}
                          className={cn(
                            'inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors',
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {sub.subCategoryName}
                        </button>
                      );
                    })}
                  </DataToolbarFilters>
                )}

              </DataToolbar>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상호명</TableHead>
                    <TableHead className="text-center">첫광고</TableHead>
                    <TableHead>광고 제목</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-center">신청 아파트</TableHead>
                    <TableHead className="text-center">광고 상태</TableHead>
                    <TableHead className="text-center">결제 상태</TableHead>
                    <TableHead className="text-right">금액(월)</TableHead>
                    <TableHead>광고 시작일</TableHead>
                    <TableHead className="text-center">노출수</TableHead>
                    <TableHead className="text-center">클릭수</TableHead>
                    <TableHead className="text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedApplications.map((app) => (
                    <TableRow
                      key={app.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(app.id)}
                    >
                      <TableCell className="font-medium">
                        {app.partner_users?.businessName ?? '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {app.isFirstAdApplication ? (
                          <StatusBadge variant="info" size="sm" withDot={false}>
                            첫광고
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        {app.title ? (
                          <div className="truncate text-sm">{app.title}</div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.ad_categories_v2?.categoryName ?? '-'}
                        {app.subCategoryNames.length > 0 && (
                          <>
                            <span className="mx-1">›</span>
                            {app.subCategoryNames.join(', ')}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <ApartmentTooltip
                          apartments={app.apartments}
                          pricePerHousehold={pricePerHousehold}
                          discountRate={app.approvedDiscountRate}
                        >
                          <span
                            className="cursor-default text-muted-foreground underline decoration-dashed underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {app.apartments.length}개
                          </span>
                        </ApartmentTooltip>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <StatusBadge.Ad status={app.adStatus} />
                          {app.adStatus === 'running' && app.freeMonths > 0 && (
                            <StatusBadge variant="success">
                              무료체험
                            </StatusBadge>
                          )}
                          {app.modificationStatus && (
                            <StatusBadge.Modification status={app.modificationStatus} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge.Payment status={app.paymentStatus} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(() => {
                          const totalHouseholds = app.apartments.reduce((s, a) => s + a.totalHouseholds, 0);
                          const base = app.approvedMonthlyAmount ?? (totalHouseholds * pricePerHousehold);
                          const hasDiscount = (app.approvedDiscountRate ?? 0) > 0;
                          const discounted = hasDiscount ? Math.round(base * (1 - (app.approvedDiscountRate ?? 0) / 100)) : base;
                          if (base === 0) return <span className="text-muted-foreground">-</span>;
                          return (
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {hasDiscount && (
                                  <span className="text-xs text-gray-500 line-through">{base.toLocaleString()}원</span>
                                )}
                                <span className="text-sm font-medium">{discounted.toLocaleString()}원</span>
                              </div>
                              {hasDiscount && (
                                <StatusBadge variant="error" withDot={false}>
                                  할인{app.approvedDiscountRate}%
                                </StatusBadge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.activatedAt
                          ? new Date(app.activatedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {app.totalImpressions > 0 ? app.totalImpressions.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {app.totalClicks > 0 ? app.totalClicks.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {app.adStatus === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => handleOpenApprove(app)}
                            >
                              <Check className="h-3 w-3" />
                              승인
                            </Button>
                          )}
                          {app.adStatus === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleOpenReject(app)}
                            >
                              <X className="h-3 w-3" />
                              거절
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTableShell>

          {/* 결과 개수 안내 */}
          {!loading && filteredCount > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              총 {filteredCount.toLocaleString()}건 · {page}/{totalPages} 페이지
            </p>
          )}
        </PageContent>
      </PageShell>

      {/* 승인 다이얼로그 */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>광고 신청 승인</DialogTitle>
            <DialogDescription>
              <strong className="text-foreground">
                {selectedAd?.partner_users?.businessName}
              </strong>
              의 광고 신청을 승인합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {!selectedAdIsFirstAd && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800">
                    이 파트너는 이미 광고를 운영한 이력이 있습니다.
                  </p>
                  <label className="mt-2 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={overrideEnabled}
                      onChange={(e) => setOverrideEnabled(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-amber-900">
                      예외 적용 (파트너 협의 완료)
                    </span>
                  </label>
                </div>
              </div>
            )}
            {/* 광고 분석 열람 권한 부여 */}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={grantAnalytics}
                  disabled={selectedAd?.partner_users?.analyticsEnabled}
                  onCheckedChange={(checked) => setGrantAnalytics(!!checked)}
                  className="border-blue-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className="text-base font-semibold text-blue-900">광고 분석 열람 권한 부여</span>
              </label>
              {selectedAd?.partner_users?.analyticsEnabled ? (
                <p className="text-sm text-blue-600 pl-6">이미 분석 열람 권한이 허용된 파트너입니다.</p>
              ) : (
                <p className="text-sm text-blue-700/70 pl-6">승인 시 파트너가 앱에서 광고 통계를 열람할 수 있습니다.</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="text-base font-medium">
                  카테고리{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    (변경 시에만 수정)
                  </span>
                </label>
                <Select
                  value={approveCategory ?? ''}
                  onValueChange={handleApproveCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategoriesWithSubs.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {approveCategoryData && approveCategoryData.subCategories.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    서브카테고리
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {approveCategoryData.subCategories.map((sub) => (
                      <label key={sub.id} className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          checked={approveSubCategoryIds.includes(sub.id)}
                          onCheckedChange={(checked) => {
                            setApproveSubCategoryIds(
                              checked
                                ? [...approveSubCategoryIds, sub.id]
                                : approveSubCategoryIds.filter((id) => id !== sub.id)
                            );
                          }}
                        />
                        <span className="text-sm">{sub.subCategoryName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-base font-medium">무료 개월 수</label>
              <Input
                type="number"
                min={0}
                max={24}
                placeholder="0"
                disabled={!selectedAdIsFirstAd && !overrideEnabled}
                value={freeMonths || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFreeMonths(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
                }}
              />
              {(selectedAdIsFirstAd || overrideEnabled) && (
                <p className="text-sm text-muted-foreground">
                  무료 기간: <strong>{freeMonths}개월</strong>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-base font-medium">
                {overrideEnabled ? '예외 결제 할인율 (%)' : '첫 결제 할인율 (%)'}
              </label>
              <Input
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
                <p className="text-sm text-muted-foreground">
                  적용 후 월 결제금액:{' '}
                  <strong>
                    {(
                      Math.round(
                        (selectedAdMonthlyAmount * (1 - discountRate / 100)) / 10
                      ) * 10
                    ).toLocaleString()}
                    원
                  </strong>
                </p>
              )}
            </div>
            {overrideEnabled && (
              <div className="space-y-1.5">
                <label className="text-base font-medium">
                  할인 사유{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    (파트너에게 표시, 선택)
                  </span>
                </label>
                <Textarea
                  className="min-h-[80px] resize-none"
                  placeholder="예: 신규 상권 지원 / 장기 계약 협의 완료 등"
                  maxLength={100}
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {discountNote.length}/100
                </p>
              </div>
            )}
          </div>
            <div className="space-y-1.5">
              <label className="text-base font-medium">
                관리 메모{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  (내부용, 파트너 비공개)
                </span>
              </label>
              <Textarea
                className="min-h-[80px] resize-none"
                placeholder="승인 관련 내부 메모를 남겨주세요..."
                maxLength={500}
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">{adminMemo.length}/500</p>
            </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialog(false)}
              disabled={processing}
            >
              취소
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {processing ? '처리 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거절 다이얼로그 */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>광고 신청 거절</DialogTitle>
            <DialogDescription>
              거절 사유를 입력해주세요. 파트너가 이 사유를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              className="min-h-[120px] resize-none"
              placeholder="거절 사유를 입력해주세요..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog(false)}
              disabled={processing}
            >
              취소
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? '처리 중...' : '거절'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
