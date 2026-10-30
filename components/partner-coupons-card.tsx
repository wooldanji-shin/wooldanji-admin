'use client';

import { Ticket } from 'lucide-react';
import { Badge, Center, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
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
    // 옆 카드(영업시간 등)와 높이를 맞추기 위해 부모 높이만큼 늘어난다
    <Paper withBorder radius="md" p="lg" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group gap="xs" mb="sm">
        <Ticket size={16} color="var(--mantine-color-dimmed)" />
        <Title order={5}>파트너 쿠폰</Title>
        {coupons.length > 0 && (
          <Text size="sm" c="dimmed">
            {coupons.length}건
          </Text>
        )}
      </Group>
      {loading ? (
        <Text size="sm" c="dimmed" py="xs">불러오는 중...</Text>
      ) : coupons.length === 0 ? (
        <Center style={{ flex: 1 }} py="md">
          <Stack gap="xs" align="center">
            <ThemeIcon variant="light" color="gray" radius="xl" size={44}>
              <Ticket size={20} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">발급한 쿠폰이 없습니다.</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap={0}>
          {coupons.map((coupon, idx) => {
            const isExpired = new Date(coupon.expiresAt) < new Date();
            return (
              <Group
                key={coupon.id}
                justify="space-between"
                align="flex-start"
                wrap="nowrap"
                py="sm"
                style={idx > 0 ? { borderTop: '1px solid var(--app-divider)' } : undefined}
              >
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate title={coupon.title}>
                    {coupon.title}
                  </Text>
                  {coupon.description && (
                    <Text size="xs" c="dimmed" truncate title={coupon.description}>
                      {coupon.description}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed" mt={4}>
                    {formatDiscount(coupon)}
                    {coupon.minAmount ? ` · ${coupon.minAmount.toLocaleString()}원 이상` : ''}
                    {` · ~${new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}`}
                    {` · 다운로드 ${coupon.downloadCount}/${coupon.maxDownloadCount ?? '무제한'}`}
                  </Text>
                </div>
                {!coupon.isActive ? (
                  <Badge variant="light" color="red">비활성</Badge>
                ) : isExpired ? (
                  <Badge variant="light" color="gray">만료</Badge>
                ) : (
                  <Badge variant="light" color="green">활성</Badge>
                )}
              </Group>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
