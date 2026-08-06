'use client';

import { Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PartnerCoupon } from '@/lib/types/partner';

interface PartnerCouponsCardProps {
  coupons: PartnerCoupon[];
  loading?: boolean;
}

/** 할인 내용을 사람이 읽는 문장으로 변환 */
function formatDiscount(coupon: PartnerCoupon): string {
  if (coupon.discountType === 'gift') return '증정 이벤트';
  if (coupon.discountType === 'percent') return `${coupon.discountValue}% 할인`;
  return `${coupon.discountValue?.toLocaleString() ?? '-'}원 할인`;
}

export function PartnerCouponsCard({
  coupons,
  loading = false,
}: PartnerCouponsCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          파트너 쿠폰
          {coupons.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {coupons.length}건
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-0 pb-4">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">불러오는 중...</p>
        ) : coupons.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">발급한 쿠폰이 없습니다.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {coupons.map((coupon) => {
              const isExpired = new Date(coupon.expiresAt) < new Date();
              return (
                <div key={coupon.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={coupon.title}>
                      {coupon.title}
                    </p>
                    {coupon.description && (
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={coupon.description}
                      >
                        {coupon.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDiscount(coupon)}
                      {coupon.minAmount ? ` · ${coupon.minAmount.toLocaleString()}원 이상` : ''}
                      {` · ~${new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}`}
                      {` · 다운로드 ${coupon.downloadCount}`}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {!coupon.isActive ? (
                      <Badge variant="destructive">비활성</Badge>
                    ) : isExpired ? (
                      <Badge variant="secondary">만료</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">
                        활성
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
