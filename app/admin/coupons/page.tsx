'use client';

import { Suspense } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
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
import { useCouponsPage } from './useCouponsPage';

function CouponsContent(): React.ReactElement {
  const { coupons, loading, deleteCoupon } = useCouponsPage();

  if (loading) return <TableSkeleton />;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="쿠폰 관리"
          description="파트너가 발급한 쿠폰 목록을 조회하고 문제 쿠폰을 비활성화합니다."
        />
      </PageHeader>

      <PageContent>
        {coupons.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="쿠폰 없음"
            description="발급된 쿠폰이 없습니다."
          />
        ) : (
          <DataTableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>쿠폰 제목</TableHead>
                  <TableHead>파트너</TableHead>
                  <TableHead>할인 내용</TableHead>
                  <TableHead>최소금액</TableHead>
                  <TableHead>유효기간</TableHead>
                  <TableHead className="text-center">다운로드</TableHead>
                  <TableHead className="text-center">사용</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const isExpired = new Date(coupon.expiresAt) < new Date();
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="font-medium">{coupon.title}</div>
                        {coupon.description && (
                          <div className="text-xs text-muted-foreground">{coupon.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{coupon.partnerBusinessName}</TableCell>
                      <TableCell>
                        {coupon.discountType === 'percent'
                          ? `${coupon.discountValue}% 할인`
                          : `${coupon.discountValue.toLocaleString()}원 할인`}
                      </TableCell>
                      <TableCell>
                        {coupon.minAmount
                          ? `${coupon.minAmount.toLocaleString()}원 이상`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-center">{coupon.downloadCount}</TableCell>
                      <TableCell className="text-center">{coupon.usageCount}</TableCell>
                      <TableCell>
                        {!coupon.isActive ? (
                          <Badge variant="destructive">비활성</Badge>
                        ) : isExpired ? (
                          <Badge variant="secondary">만료</Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500">활성</Badge>
                        )}
                      </TableCell>
                      <TableCell>
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
