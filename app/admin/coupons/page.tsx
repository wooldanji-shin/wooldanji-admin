'use client';

import { Suspense } from 'react';
import { format } from 'date-fns';
import { Search, Tag, Trash2 } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataPagination } from '@/components/data-pagination';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { ApartmentCombobox } from '@/components/apartment-combobox';
import { EmptyState } from '@/components/empty-state';
import { PageSkeleton, TableSkeleton } from '@/components/skeletons';
import { ActionIcon, Badge, Divider, Group, Stack, Table, Text, TextInput } from '@mantine/core';
import { useCouponsPage, type CouponStatusFilter } from './useCouponsPage';

const STATUS_FILTERS: { value: CouponStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'expired', label: '만료' },
  { value: 'inactive', label: '비활성' },
];

function CouponsContent(): React.ReactElement {
  const {
    coupons,
    loading,
    initialLoading,
    page,
    pageSize,
    totalCount,
    allCount,
    setPage,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    allApartments,
    statusFilter,
    setStatusFilter,
    statusCounts,
    deleteCoupon,
  } = useCouponsPage();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="쿠폰 관리"
          description="파트너가 발급한 쿠폰 목록을 조회하고 문제 쿠폰을 비활성화합니다."
        />
      </PageHeader>

      <PageContent>
        {initialLoading ? (
          <DataTableShell>
            <TableSkeleton rows={8} columns={12} />
          </DataTableShell>
        ) : allCount === 0 ? (
          <EmptyState
            icon={Tag}
            title="쿠폰 없음"
            description="발급된 쿠폰이 없습니다."
          />
        ) : (
          <>
            <DataTableShell
              toolbar={
                <Stack gap="md">
                  <Group gap="xs">
                    <TextInput
                      w={260}
                      placeholder="상호명·광고·쿠폰 제목 검색"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      leftSection={<Search size={16} />}
                    />
                    {/* 쿠폰은 파트너 단위라, 그 파트너가 광고한 적 있는 아파트(종료 포함) 기준 */}
                    <ApartmentCombobox
                      apartments={allApartments}
                      value={apartmentFilter}
                      onChange={setApartmentFilter}
                      placeholder="아파트 필터"
                    />
                  </Group>

                  <Divider />

                  <FilterRow label="상태">
                    <FilterChips
                      options={STATUS_FILTERS.map((f) => ({
                        value: f.value,
                        label: f.label,
                        count: statusCounts[f.value],
                      }))}
                      value={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </FilterRow>
                </Stack>
              }
              summary={
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  전체 {totalCount}건
                </Text>
              }
            >
              {totalCount === 0 ? (
                <EmptyState icon={Tag} title="해당하는 쿠폰이 없습니다" description="필터를 변경해 보세요." />
              ) : (
              /* 재조회 중에는 테이블을 유지한 채 흐리게 표시해 깜빡임을 줄임 */
              <Table
                style={{ transition: 'opacity 150ms', opacity: loading ? 0.5 : 1 }}
                highlightOnHover
                verticalSpacing="sm"
                horizontalSpacing="md"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th miw={220}>쿠폰 제목</Table.Th>
                    <Table.Th>파트너</Table.Th>
                    <Table.Th>할인 내용</Table.Th>
                    <Table.Th ta="right">최소금액</Table.Th>
                    <Table.Th>유효기간</Table.Th>
                    <Table.Th ta="center">다운로드</Table.Th>
                    <Table.Th ta="center">사용</Table.Th>
                    <Table.Th>만료 사유</Table.Th>
                    <Table.Th>수정 사유</Table.Th>
                    <Table.Th>파트너 만료 시각</Table.Th>
                    <Table.Th>상태</Table.Th>
                    <Table.Th w={64} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {coupons.map((coupon) => {
                    const isExpired = new Date(coupon.expiresAt) < new Date();
                    return (
                      <Table.Tr key={coupon.id}>
                        <Table.Td>
                          <Text size="sm" fw={500} maw={280} truncate title={coupon.title}>
                            {coupon.title}
                          </Text>
                          {coupon.description && (
                            <Text size="xs" c="dimmed" maw={280} truncate title={coupon.description}>
                              {coupon.description}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {/* 파트너 탈퇴 시 partnerUserId가 SET NULL 처리되어 상호를 알 수 없음 */}
                          {coupon.isPartnerWithdrawn ? (
                            <Badge variant="light" color="gray">
                              탈퇴한 파트너
                            </Badge>
                          ) : (
                            coupon.partnerBusinessName
                          )}
                        </Table.Td>
                        <Table.Td>
                          {coupon.discountType === 'gift'
                            ? '증정 이벤트'
                            : coupon.discountType === 'percent'
                            ? `${coupon.discountValue}% 할인`
                            : `${coupon.discountValue?.toLocaleString()}원 할인`}
                        </Table.Td>
                        <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {coupon.minAmount
                            ? `${coupon.minAmount.toLocaleString()}원 이상`
                            : '-'}
                        </Table.Td>
                        <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}
                        </Table.Td>
                        <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {coupon.downloadCount} / {coupon.maxDownloadCount ?? '무제한'}
                        </Table.Td>
                        <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {coupon.usageCount}
                        </Table.Td>
                        {/* 파트너가 직접 입력한 만료 사유 */}
                        <Table.Td>
                          <Text size="sm" c="dimmed" maw={160} truncate title={coupon.expiredReason ?? undefined}>
                            {coupon.expiredReason ?? '-'}
                          </Text>
                        </Table.Td>
                        {/* 파트너가 쿠폰 수정 시 입력한 사유 */}
                        <Table.Td>
                          <Text size="sm" c="dimmed" maw={160} truncate title={coupon.updateReason ?? undefined}>
                            {coupon.updateReason ?? '-'}
                          </Text>
                        </Table.Td>
                        {/* 파트너가 직접 만료시킨 시각 (YYYY.MM.DD HH:mm 형식) */}
                        <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {coupon.expiredAt
                            ? format(new Date(coupon.expiredAt), 'yyyy.MM.dd HH:mm')
                            : '-'}
                        </Table.Td>
                        <Table.Td>
                          {!coupon.isActive ? (
                            <Badge variant="light" color="red">비활성</Badge>
                          ) : isExpired ? (
                            <Badge variant="light" color="gray">만료</Badge>
                          ) : (
                            <Badge variant="light" color="green">활성</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {coupon.isActive && (
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => deleteCoupon(coupon.id)}
                              aria-label="쿠폰 비활성화"
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              )}
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
    <Suspense fallback={<PageSkeleton searchBar={false} rows={8} columns={12} />}>
      <CouponsContent />
    </Suspense>
  );
}
