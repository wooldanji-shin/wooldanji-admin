'use client';

import { Suspense } from 'react';
import { format } from 'date-fns';
import { Tag, Trash2 } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar } from '@/components/data-toolbar';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCouponsPage } from './useCouponsPage';

function CouponsContent(): React.ReactElement {
  const {
    coupons,
    loading,
    initialLoading,
    page,
    pageSize,
    totalCount,
    setPage,
    deleteCoupon,
  } = useCouponsPage();

  if (initialLoading) return <TableSkeleton />;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="쿠폰 관리"
          description="파트너가 발급한 쿠폰 목록을 조회하고 문제 쿠폰을 비활성화합니다."
        />
      </PageHeader>

      <PageContent>
        {totalCount === 0 ? (
          <EmptyState
            icon={Tag}
            title="쿠폰 없음"
            description="발급된 쿠폰이 없습니다."
          />
        ) : (
          <>
            <DataTableShell
              toolbar={
                <DataToolbar>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    전체 {totalCount}건
                  </span>
                </DataToolbar>
              }
            >
              {/* 페이지 이동 중에는 테이블을 유지한 채 흐리게 표시해 깜빡임을 줄임 */}
              <Table className={cn('transition-opacity', loading && 'opacity-50')}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 min-w-[220px]">쿠폰 제목</TableHead>
                    <TableHead className="px-4">파트너</TableHead>
                    <TableHead className="px-4">할인 내용</TableHead>
                    <TableHead className="px-4 text-right">최소금액</TableHead>
                    <TableHead className="px-4">유효기간</TableHead>
                    <TableHead className="px-4 text-center">다운로드</TableHead>
                    <TableHead className="px-4 text-center">사용</TableHead>
                    <TableHead className="px-4">만료 사유</TableHead>
                    <TableHead className="px-4">수정 사유</TableHead>
                    <TableHead className="px-4">파트너 만료 시각</TableHead>
                    <TableHead className="px-4">상태</TableHead>
                    <TableHead className="w-16 px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => {
                    const isExpired = new Date(coupon.expiresAt) < new Date();
                    return (
                      <TableRow key={coupon.id} className="h-14">
                        <TableCell className="px-4">
                          <div className="max-w-[280px] truncate font-medium" title={coupon.title}>
                            {coupon.title}
                          </div>
                          {coupon.description && (
                            <div
                              className="max-w-[280px] truncate text-xs text-muted-foreground"
                              title={coupon.description}
                            >
                              {coupon.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4">
                          {/* 파트너 탈퇴 시 partnerUserId가 SET NULL 처리되어 상호를 알 수 없음 */}
                          {coupon.isPartnerWithdrawn ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              탈퇴한 파트너
                            </Badge>
                          ) : (
                            coupon.partnerBusinessName
                          )}
                        </TableCell>
                        <TableCell className="px-4">
                          {coupon.discountType === 'gift'
                            ? '증정 이벤트'
                            : coupon.discountType === 'percent'
                            ? `${coupon.discountValue}% 할인`
                            : `${coupon.discountValue?.toLocaleString()}원 할인`}
                        </TableCell>
                        <TableCell className="px-4 text-right tabular-nums">
                          {coupon.minAmount
                            ? `${coupon.minAmount.toLocaleString()}원 이상`
                            : '-'}
                        </TableCell>
                        <TableCell className="px-4 tabular-nums">
                          {new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell className="px-4 text-center tabular-nums">
                          {coupon.downloadCount}
                        </TableCell>
                        <TableCell className="px-4 text-center tabular-nums">
                          {coupon.usageCount}
                        </TableCell>
                        {/* 파트너가 직접 입력한 만료 사유 */}
                        <TableCell className="px-4">
                          <div
                            className="max-w-[160px] truncate text-muted-foreground"
                            title={coupon.expiredReason ?? undefined}
                          >
                            {coupon.expiredReason ?? '-'}
                          </div>
                        </TableCell>
                        {/* 파트너가 쿠폰 수정 시 입력한 사유 */}
                        <TableCell className="px-4">
                          <div
                            className="max-w-[160px] truncate text-muted-foreground"
                            title={coupon.updateReason ?? undefined}
                          >
                            {coupon.updateReason ?? '-'}
                          </div>
                        </TableCell>
                        {/* 파트너가 직접 만료시킨 시각 (YYYY.MM.DD HH:mm 형식) */}
                        <TableCell className="px-4 tabular-nums">
                          {coupon.expiredAt
                            ? format(new Date(coupon.expiredAt), 'yyyy.MM.dd HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell className="px-4">
                          {!coupon.isActive ? (
                            <Badge variant="destructive">비활성</Badge>
                          ) : isExpired ? (
                            <Badge variant="secondary">만료</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500">활성</Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-4">
                          {coupon.isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCoupon(coupon.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTableShell>

            <DataPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </PageContent>
    </PageShell>
  );
}

export default function CouponsPage(): React.ReactElement {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CouponsContent />
    </Suspense>
  );
}
