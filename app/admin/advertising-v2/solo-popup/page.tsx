'use client';

import Link from 'next/link';
import { DoorOpen, Plus, Search } from 'lucide-react';
import { PageContent, PageHeader, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { periodLabel } from '@/lib/ads/solo-popup';
import { cn } from '@/lib/utils';
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
        <Button asChild>
          <Link href="/admin/advertising-v2/solo-popup/new">
            <Plus className="mr-2 h-4 w-4" />
            단독 팝업 대리 등록
          </Link>
        </Button>
      </PageHeader>

      <PageContent>
        <div className="relative w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="업체명·광고 제목 검색"
            value={p.searchTerm}
            onChange={(e) => p.setSearchTerm(e.target.value)}
            className="h-11 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = p.statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => p.setStatusFilter(f.value)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {f.label}
                <Badge variant="secondary" className="h-6 min-w-6 justify-center px-2 text-xs tabular-nums">
                  {p.statusCounts[f.value]}
                </Badge>
              </button>
            );
          })}
        </div>

        <DataTableShell
          pagination={
            p.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3 py-3 text-sm">
                <Button variant="outline" size="sm" disabled={p.page <= 1} onClick={() => p.setPage(p.page - 1)}>이전</Button>
                <span className="tabular-nums">{p.page} / {p.totalPages}</span>
                <Button variant="outline" size="sm" disabled={p.page >= p.totalPages} onClick={() => p.setPage(p.page + 1)}>다음</Button>
              </div>
            ) : undefined
          }
        >
          {p.loading ? (
            <TableSkeleton rows={6} columns={8} />
          ) : p.pageRows.length === 0 ? (
            <EmptyState icon={DoorOpen} title="해당하는 단독 팝업 광고가 없습니다" description="필터를 변경해 보세요." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead>팝업 제목</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>시작일</TableHead>
                  <TableHead>종료일</TableHead>
                  <TableHead>영업 담당자</TableHead>
                  <TableHead className="text-center">문열림 노출</TableHead>
                  <TableHead className="text-center">문열림 클릭</TableHead>
                  <TableHead className="text-center">홈 노출</TableHead>
                  <TableHead className="text-center">홈 클릭</TableHead>
                  <TableHead className="text-center">자동승인</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.pageRows.map((ad) => {
                  const hasDiscount = (ad.approvedDiscountRate ?? 0) > 0;
                  const amount = hasDiscount ? (ad.discountedTotalAmount ?? ad.totalAmount) : ad.totalAmount;
                  return (
                    <TableRow key={ad.id} className="cursor-pointer" onClick={() => p.handleRowClick(ad.id)}>
                      <TableCell className="font-medium">{ad.partnerBusinessName}</TableCell>
                      <TableCell>{ad.title}</TableCell>
                      <TableCell className="text-sm">{periodLabel(ad.periodUnit, ad.periodCount)}</TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hasDiscount && (
                            <StatusBadge variant="error" withDot={false}>할인{ad.approvedDiscountRate}%</StatusBadge>
                          )}
                          <span className="text-sm font-medium">{amount.toLocaleString()}원</span>
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
                      <TableCell className="text-muted-foreground">{formatDate(ad.startedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(ad.endedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{ad.salesRepName ?? '-'}</TableCell>
                      <TableCell className="text-center tabular-nums">{ad.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-center tabular-nums">{ad.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-center tabular-nums">{ad.homeImpressions.toLocaleString()}</TableCell>
                      <TableCell className="text-center tabular-nums">{ad.homeClicks.toLocaleString()}</TableCell>
                      {/* 행 클릭이 상세로 넘어가므로 체크박스 조작은 여기서 막는다 */}
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {ad.status === 'running' ? (
                          <Checkbox
                            checked={ad.autoApproveModification}
                            aria-label="수정 심사 자동승인"
                            disabled={p.togglingId !== null}
                            onCheckedChange={(v) => p.handleToggleAutoApprove(ad, v === true)}
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
