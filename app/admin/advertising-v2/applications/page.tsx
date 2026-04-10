'use client';

import { AdminHeader } from '@/components/admin-header';
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
import { useApplicationsPage, type AdStatus, type ModificationStatus, type ApartmentSummary, type PaymentStatus, type StatusFilter } from './useApplicationsPage';

const AD_STATUS_CONFIG: Record<AdStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: '승인대기', color: '#CD6D00', bg: '#FFF4E5', border: '#FDDCAA' },
  approved: { label: '승인됨',   color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  rejected: { label: '거절됨',   color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  running:  { label: '진행중',   color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  ended:    { label: '종료',     color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  draft:    { label: '임시저장', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
};

function AdStatusBadge({ status }: { status: AdStatus }) {
  const { label, color, bg, border } = AD_STATUS_CONFIG[status] ?? { label: status, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  return (
    <span
      className='inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border'
      style={{ color, backgroundColor: bg, borderColor: border }}
    >
      {label}
    </span>
  );
}

function ModificationStatusBadge({ status }: { status: ModificationStatus }) {
  if (!status) return null;
  const config = {
    pending:  { label: '수정신청', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
    approved: { label: '수정승인', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
    rejected: { label: '수정거절', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  } as const;
  const { label, color, bg, border } = config[status];
  return (
    <span
      className='inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border'
      style={{ color, backgroundColor: bg, borderColor: border }}
    >
      {label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, color, bg, border } = status === 'paid'
    ? { label: '결제완료', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' }
    : { label: '미결제',   color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  return (
    <span
      className='inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border'
      style={{ color, backgroundColor: bg, borderColor: border }}
    >
      {label}
    </span>
  );
}

function ApartmentTooltip({
  apartments,
  pricePerHousehold,
  children,
}: {
  apartments: ApartmentSummary[];
  pricePerHousehold: number;
  children: React.ReactNode;
}) {
  if (apartments.length === 0) return <>{children}</>;

  const totalHouseholds = apartments.reduce((sum, a) => sum + a.totalHouseholds, 0);
  const totalAmount = totalHouseholds * pricePerHousehold;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side='bottom'
        className='bg-popover text-popover-foreground border border-border shadow-lg p-0 max-w-xs'
      >
        <div className='p-3 space-y-1.5'>
          {apartments.map((apt) => (
            <div key={apt.apartmentId} className='flex items-center justify-between gap-6 text-xs'>
              <span className='font-medium'>{apt.apartmentName}</span>
              <span className='text-muted-foreground shrink-0'>
                {apt.totalHouseholds.toLocaleString()}세대
                · {(apt.totalHouseholds * pricePerHousehold).toLocaleString()}원
              </span>
            </div>
          ))}
          {apartments.length > 1 && (
            <>
              <div className='border-t border-border pt-1.5 flex items-center justify-between text-xs font-semibold'>
                <span>합계</span>
                <span>{totalHouseholds.toLocaleString()}세대 · {totalAmount.toLocaleString()}원</span>
              </div>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default function AdApplicationsPage() {
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

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: '전체',     value: 'all' },
    { label: '승인대기', value: 'pending' },
    { label: '승인됨',   value: 'approved' },
    { label: '수정심사', value: 'modification' },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className='flex flex-col h-full'>
        <AdminHeader title='광고 신청 관리' />

        <div className='flex-1 overflow-auto'>
          <div className='p-6 space-y-4'>
            {/* 상태 필터 탭 */}
            <div className='flex items-center gap-0 border-b border-border'>
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                    statusFilter === tab.value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 카테고리 필터 */}
            {categories.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5'>
                <span className='text-xs text-muted-foreground'>카테고리</span>
                <div className='w-px h-3.5 bg-border mx-0.5' />
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    categoryFilter === null
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                  )}
                >
                  전체
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                      categoryFilter === cat.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                    )}
                  >
                    {cat.categoryName}
                  </button>
                ))}
              </div>
            )}

            {/* 테이블 */}
            {loading ? (
              <div className='flex items-center justify-center py-24'>
                <div className='flex flex-col items-center gap-3 text-muted-foreground'>
                  <div className='h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin' />
                  <span className='text-sm'>불러오는 중...</span>
                </div>
              </div>
            ) : applications.length === 0 ? (
              <div className='flex items-center justify-center py-24 text-muted-foreground'>
                <span className='text-sm'>신청 내역이 없습니다.</span>
              </div>
            ) : (
              <div className='rounded-lg border border-border overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow className='bg-muted/40 hover:bg-muted/40'>
                      <TableHead className='font-semibold text-foreground'>상호명</TableHead>
                      <TableHead className='font-semibold text-foreground'>광고표시용번호</TableHead>
                      <TableHead className='font-semibold text-foreground'>광고 내용</TableHead>
                      <TableHead className='font-semibold text-foreground'>카테고리</TableHead>
                      <TableHead className='text-center font-semibold text-foreground'>신청 아파트</TableHead>
                      <TableHead className='text-center font-semibold text-foreground'>광고 상태</TableHead>
                      <TableHead className='text-center font-semibold text-foreground'>결제 상태</TableHead>
                      <TableHead className='font-semibold text-foreground'>신청일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow
                        key={app.id}
                        className='cursor-pointer hover:bg-muted/40 transition-colors'
                        onClick={() => handleRowClick(app.id)}
                      >
                        <TableCell className='font-medium whitespace-nowrap'>
                          {app.partner_users?.businessName ?? '-'}
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground whitespace-nowrap'>
                          {app.partner_users?.displayPhoneNumber ?? '-'}
                        </TableCell>
                        <TableCell className='max-w-[240px]'>
                          <div className='font-medium text-sm truncate'>{app.title}</div>
                          {app.content && (
                            <div className='text-xs text-muted-foreground truncate mt-0.5'>{app.content}</div>
                          )}
                        </TableCell>
                        <TableCell className='whitespace-nowrap text-muted-foreground'>
                          {app.ad_categories_v2?.categoryName ?? '-'}
                          {app.subCategoryNames.length > 0 && (
                            <>
                              <span className='mx-1'>›</span>
                              {app.subCategoryNames.join(', ')}
                            </>
                          )}
                        </TableCell>
                        <TableCell className='text-center'>
                          <ApartmentTooltip apartments={app.apartments} pricePerHousehold={pricePerHousehold}>
                            <span
                              className='text-muted-foreground underline decoration-dashed underline-offset-2 cursor-default'
                              onClick={(e) => e.stopPropagation()}
                            >
                              {app.apartments.length}개
                            </span>
                          </ApartmentTooltip>
                        </TableCell>
                        <TableCell className='text-center'>
                          <div className='flex flex-col items-center gap-1'>
                            <AdStatusBadge status={app.adStatus} />
                            {app.modificationStatus && (
                              <ModificationStatusBadge status={app.modificationStatus} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className='text-center'>
                          <PaymentStatusBadge status={app.paymentStatus} />
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground whitespace-nowrap'>
                          {app.submittedAt
                            ? new Date(app.submittedAt).toLocaleString('ko-KR')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
