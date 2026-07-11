'use client';

import { Download, ExternalLink, Inbox, Receipt, Search, TrendingUp, XCircle } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar, DataToolbarFilters, DataToolbarSearch } from '@/components/data-toolbar';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { PartnerCombobox } from '@/components/partner-combobox';
import { DateInput } from '@/components/date-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn } from '@/lib/utils';
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
];

const PAYMENT_TYPE_LABEL: Record<SettlementPaymentType, string> = {
  basic: '기본광고',
  premium: '프리미엄 최초',
  extension: '프리미엄 연장',
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

export default function SettlementPage(): React.ReactElement {
  const {
    loading,
    dateFromDraft,
    dateToDraft,
    setDateFromDraft,
    setDateToDraft,
    applyDateRange,
    monthOptions,
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
    <TooltipProvider delayDuration={300}>
      <PageShell>
        <PageHeader>
          <PageHeaderTitle
            title="정산 관리"
            description="파트너 광고비 결제 내역을 조회하고 매출을 집계합니다."
          />
          <PageHeaderActions>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV 내보내기
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <PageContent>
          {/* KPI 요약 카드 */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              label="프리미엄 매출 비중"
              value={`${summary.premiumRevenueRatioPct.toFixed(1)}%`}
              icon={Receipt}
              accent="info"
              loading={loading}
            />
          </div>

          {/* 기간 + 파트너 + 검색 */}
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={applyMonth}>
              <SelectTrigger className="h-11 w-[130px]">
                <SelectValue placeholder="월 선택" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateInput
              value={dateFromDraft}
              onChange={setDateFromDraft}
              onKeyDown={(e) => e.key === 'Enter' && applyDateRange()}
              className="h-11 w-[130px]"
            />
            <span className="text-muted-foreground">~</span>
            <DateInput
              value={dateToDraft}
              onChange={setDateToDraft}
              onKeyDown={(e) => e.key === 'Enter' && applyDateRange()}
              className="h-11 w-[130px]"
            />
            <Button variant="outline" size="sm" className="h-11" onClick={applyDateRange}>
              <Search className="mr-1.5 h-4 w-4" />
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
          </div>

          {/* 상태 탭 */}
          <div className="inline-flex w-full max-w-2xl items-center gap-1 rounded-lg border border-border/70 bg-card p-1.5 shadow-card">
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    'inline-flex h-9 flex-1 items-center justify-center rounded-md px-2 text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-card'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <DataTableShell
            toolbar={
              <DataToolbar>
                <DataToolbarFilters>
                  {TYPE_TABS.map((tab) => {
                    const isActive = typeFilter === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setTypeFilter(tab.value)}
                        className={cn(
                          'inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </DataToolbarFilters>
              </DataToolbar>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>파트너명</TableHead>
                    <TableHead>대표자명</TableHead>
                    <TableHead>결제유형</TableHead>
                    <TableHead>광고명</TableHead>
                    <TableHead className="text-right">공급가액</TableHead>
                    <TableHead className="text-right">부가세</TableHead>
                    <TableHead className="text-right">합계금액</TableHead>
                    <TableHead>결제일</TableHead>
                    <TableHead>청구기간</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="text-center">영수증</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.partnerBusinessName ?? '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.representativeName ?? '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {PAYMENT_TYPE_LABEL[payment.paymentType]}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {payment.adTitle ? (
                          <div className="truncate text-sm">{payment.adTitle}</div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {payment.supplyAmount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {payment.vatAmount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {payment.amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(payment.paymentDate).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.billingPeriodStart && payment.billingPeriodEnd
                          ? `${new Date(payment.billingPeriodStart).toLocaleDateString('ko-KR')} ~ ${new Date(payment.billingPeriodEnd).toLocaleDateString('ko-KR')}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {payment.status === 'failed' && payment.failReason ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                <StatusBadge.Settlement status={payment.status} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs border border-border bg-popover text-popover-foreground shadow-popover"
                            >
                              {payment.failReason}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <StatusBadge.Settlement status={payment.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {payment.receiptUrl ? (
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label="영수증 새 탭에서 열기"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTableShell>

          {!loading && filteredCount > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              총 {filteredCount.toLocaleString()}건 · {page}/{totalPages} 페이지
            </p>
          )}
        </PageContent>
      </PageShell>
    </TooltipProvider>
  );
}
