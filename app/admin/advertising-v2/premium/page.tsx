'use client';

import Link from 'next/link';
import { Check, Plus, Search, Sparkles, X } from 'lucide-react';
import {
  PageContent,
  PageHeader,
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
import { DataToolbar } from '@/components/data-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
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
        <Button asChild>
          <Link href="/admin/advertising-v2/premium/new">
            <Plus className="mr-2 h-4 w-4" />
            프리미엄 대리 등록
          </Link>
        </Button>
      </PageHeader>

      <PageContent>
        {/* 아파트 필터 + 검색 */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="업체명·광고 제목 검색"
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
          <SalesRepFilter value={salesRepFilter} onChange={setSalesRepFilter} />
        </div>

        {/* 상태 필터 — 카운트 배지 포함 */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.value;
            const count = statusCounts[f.value] ?? 0;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                )}
              >
                {f.label}
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-6 min-w-6 justify-center px-2 text-xs tabular-nums',
                    isActive && 'bg-primary-foreground/15 text-primary-foreground'
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
              <AdCategoryFilter
                categories={categories}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categoryCounts={categoryCounts}
                subCategories={subCategories}
                subCategoryFilter={subCategoryFilter}
                onSubCategoryChange={setSubCategoryFilter}
              />
            </DataToolbar>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead>광고 제목</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>광고 시작일</TableHead>
                  <TableHead>광고 종료일</TableHead>
                  <TableHead>영업 담당자</TableHead>
                  <TableHead className="text-center">노출수</TableHead>
                  <TableHead className="text-center">클릭수</TableHead>
                  <TableHead className="text-center">전화클릭수</TableHead>
                  <TableHead className="text-center">자동승인</TableHead>
                  <TableHead className="text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                    <TableRow
                      key={ad.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(ad.id)}
                    >
                      <TableCell className="font-medium">
                        {ad.partnerBusinessName ?? '-'}
                      </TableCell>
                      <TableCell>{ad.title ?? '(제목 없음)'}</TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          {ad.startedAt && ad.endedAt ? (
                            <span className="text-sm">
                              {new Date(ad.startedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                              {' ~ '}
                              {new Date(ad.endedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">날짜 미정</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {cumulativeWeeks}주
                            {extWeeks > 0 && ` (원 ${ad.weeks} + 연장 ${extWeeks})`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hasDiscount && (
                            <StatusBadge variant="error" withDot={false}>
                              할인{ad.approvedDiscountRate}%
                            </StatusBadge>
                          )}
                          {hasDiscount && baseAmount != null && (
                            <span className="text-xs text-muted-foreground line-through">{baseAmount.toLocaleString()}원</span>
                          )}
                          <span className="text-sm font-medium">{amount != null ? `${amount.toLocaleString()}원` : '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge.Premium status={ad.status} />
                          {ad.status === 'running' && ad.modificationStatus === 'pending' && (
                            <StatusBadge variant="primary">수정 심사</StatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ad.startedAt
                          ? new Date(ad.startedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ad.endedAt
                          ? new Date(ad.endedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ad.salesRepName ?? '-'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {ad.totalImpressions > 0 ? ad.totalImpressions.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {ad.totalClicks > 0 ? ad.totalClicks.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {ad.totalPhoneClicks > 0 ? ad.totalPhoneClicks.toLocaleString() : '-'}
                      </TableCell>
                      {/* 행 클릭이 상세로 넘어가므로 체크박스 조작은 여기서 막는다 */}
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ad.status === 'running' ? (
                          <Checkbox
                            checked={ad.autoApproveModification}
                            aria-label="수정 심사 자동승인"
                            onCheckedChange={(v) =>
                              handleToggleAutoApprove(ad, v === true)
                            }
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {ad.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => handleOpenApprove(ad)}
                            >
                              <Check className="h-3 w-3" />
                              승인
                            </Button>
                          )}
                          {ad.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleOpenReject(ad)}
                            >
                              <X className="h-3 w-3" />
                              거절
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableShell>

        {/* 결과 개수 안내 */}
        {!isLoading && filteredCount > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            총 {filteredCount.toLocaleString()}건 · {page}/{totalPages} 페이지
          </p>
        )}
      </PageContent>

      {/* 승인 다이얼로그 */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>프리미엄 광고 승인</DialogTitle>
            <DialogDescription>
              할인율을 입력하면 파트너에게 할인된 금액으로 결제 요청됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 광고 분석 열람 권한 부여 */}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={grantAnalytics}
                  disabled={selectedAd?.partnerAnalyticsEnabled}
                  onCheckedChange={(checked) => setGrantAnalytics(!!checked)}
                  className="border-blue-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className="text-sm font-semibold text-blue-900">광고 분석 열람 권한 부여</span>
              </label>
              {selectedAd?.partnerAnalyticsEnabled ? (
                <p className="text-sm text-blue-600 pl-6">이미 분석 열람 권한이 허용된 파트너입니다.</p>
              ) : (
                <p className="text-sm text-blue-700/70 pl-6">승인 시 파트너가 앱에서 광고 통계를 열람할 수 있습니다.</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">할인율 (%)</label>
              <Input
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
            </div>
            {selectedAd?.totalAmount != null && discountRate > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="text-muted-foreground">할인 후 결제금액: </span>
                <span className="font-semibold">
                  {(
                    Math.round(
                      (selectedAd.totalAmount * (100 - discountRate)) / 100 / 10
                    ) * 10
                  ).toLocaleString()}
                  원
                </span>
                <span className="ml-1 text-muted-foreground">
                  (정상가 {selectedAd.totalAmount.toLocaleString()}원)
                </span>
              </div>
            )}
          </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                관리 메모{' '}
                <span className="font-normal text-muted-foreground">(내부용, 파트너 비공개)</span>
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
            <Button variant="outline" onClick={() => setApproveDialog(false)}>
              취소
            </Button>
            <Button onClick={handleApproveConfirm} disabled={processing}>
              {processing ? '처리 중...' : '승인 확정'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거절 다이얼로그 */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>프리미엄 광고 거절</DialogTitle>
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
    </PageShell>
  );
}
