'use client';

import { Inbox } from 'lucide-react';
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
import {
  useApplicationsPage,
  type ApartmentSummary,
  type StatusFilter,
} from './useApplicationsPage';

interface ApartmentTooltipProps {
  apartments: ApartmentSummary[];
  pricePerHousehold: number;
  children: React.ReactNode;
}

function ApartmentTooltip({
  apartments,
  pricePerHousehold,
  children,
}: ApartmentTooltipProps): React.ReactElement {
  if (apartments.length === 0) return <>{children}</>;

  const totalHouseholds = apartments.reduce((sum, a) => sum + a.totalHouseholds, 0);
  const totalAmount = totalHouseholds * pricePerHousehold;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs border border-border bg-popover p-0 text-popover-foreground shadow-popover"
      >
        <div className="space-y-1.5 p-3">
          {apartments.map((apt) => (
            <div
              key={apt.apartmentId}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="font-medium">{apt.apartmentName}</span>
              <span className="shrink-0 text-muted-foreground">
                {apt.totalHouseholds.toLocaleString()}세대 ·{' '}
                {(apt.totalHouseholds * pricePerHousehold).toLocaleString()}원
              </span>
            </div>
          ))}
          {apartments.length > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs font-semibold">
              <span>합계</span>
              <span>
                {totalHouseholds.toLocaleString()}세대 · {totalAmount.toLocaleString()}원
              </span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: '전체', value: 'all' },
  { label: '승인대기', value: 'pending' },
  { label: '승인됨', value: 'approved' },
  { label: '수정심사', value: 'modification' },
];

export default function AdApplicationsPage(): React.ReactElement {
  const {
    applications,
    loading,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    categories,
    pricePerHousehold,
    handleRowClick,
  } = useApplicationsPage();

  return (
    <TooltipProvider delayDuration={300}>
      <PageShell>
        <PageHeader>
          <PageHeaderTitle
            title="광고 신청 관리"
            description="광고 신청을 검토하고 승인 상태를 관리합니다."
          />
        </PageHeader>

        <PageContent>
          {/* 상태 탭 — 모던 segmented control */}
          <div className="inline-flex w-full max-w-md items-center gap-1 rounded-lg border border-border/70 bg-card p-1.5 shadow-card">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'h-9 flex-1 rounded-md px-4 text-sm font-medium transition-all',
                  statusFilter === tab.value
                    ? 'bg-primary text-primary-foreground shadow-card'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <DataTableShell
            toolbar={
              categories.length > 0 ? (
                <DataToolbar>
                  <DataToolbarFilters>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(null)}
                      className={cn(
                        'inline-flex h-11 items-center rounded-md border px-5 text-sm font-medium transition-colors',
                        categoryFilter === null
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                      )}
                    >
                      전체 카테고리
                    </button>
                    {categories.map((cat) => {
                      const isActive = categoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(isActive ? null : cat.id)}
                          className={cn(
                            'inline-flex h-11 items-center rounded-md border px-5 text-sm font-medium transition-colors',
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {cat.categoryName}
                        </button>
                      );
                    })}
                  </DataToolbarFilters>
                </DataToolbar>
              ) : undefined
            }
          >
            {loading ? (
              <TableSkeleton rows={6} columns={9} />
            ) : applications.length === 0 ? (
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
                    <TableHead>광고표시용번호</TableHead>
                    <TableHead>광고 내용</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-center">신청 아파트</TableHead>
                    <TableHead className="text-center">광고 상태</TableHead>
                    <TableHead className="text-center">결제 상태</TableHead>
                    <TableHead>신청일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
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
                      <TableCell className="text-muted-foreground">
                        {app.partner_users?.displayPhoneNumber ?? '-'}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        {app.content ? (
                          <div className="truncate text-sm">{app.content}</div>
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
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge.Ad status={app.adStatus} />
                          {app.modificationStatus && (
                            <StatusBadge.Modification status={app.modificationStatus} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge.Payment status={app.paymentStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.submittedAt
                          ? new Date(app.submittedAt).toLocaleString('ko-KR')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTableShell>
        </PageContent>
      </PageShell>
    </TooltipProvider>
  );
}
