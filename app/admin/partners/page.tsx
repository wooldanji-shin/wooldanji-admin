'use client';

import { Suspense } from 'react';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Pagination,
  Select,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { usePartnersPage } from './usePartnersPage';

function PartnersContent(): React.ReactElement {
  const page = usePartnersPage();
  const { handleToggleAnalytics } = page;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="파트너 회원 관리"
          description="등록된 파트너 회원 정보를 검색하고 관리합니다."
        />
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <Group gap="xs" wrap="nowrap" w="100%" maw={672}>
              <TextInput
                placeholder="상호명, 대표자명, 전화번호, 사업자번호 검색..."
                value={page.searchInput}
                onChange={(e) => page.handleSearch(e.target.value)}
                leftSection={<Search size={16} />}
                w="100%"
                maw={384}
              />
              <Select
                placeholder="카테고리"
                w={140}
                style={{ flexShrink: 0 }}
                data={[
                  { value: 'all', label: '전체 카테고리' },
                  ...page.categories.map((category) => ({
                    value: category.id,
                    label: category.categoryName,
                  })),
                ]}
                value={page.categoryFilter ?? 'all'}
                onChange={(value) => {
                  if (value === null) return;
                  page.handleCategoryFilterChange(value === 'all' ? null : value);
                }}
                allowDeselect={false}
              />
              {page.categoryFilter && page.subCategories.length > 0 && (
                <Select
                  placeholder="서브카테고리"
                  w={140}
                  style={{ flexShrink: 0 }}
                  data={[
                    { value: 'all', label: '전체 서브카테고리' },
                    ...page.subCategories.map((sub) => ({
                      value: sub.id,
                      label: sub.subCategoryName,
                    })),
                  ]}
                  value={page.subCategoryFilter ?? 'all'}
                  onChange={(value) => {
                    if (value === null) return;
                    page.handleSubCategoryFilterChange(value === 'all' ? null : value);
                  }}
                  allowDeselect={false}
                />
              )}
            </Group>
          }
          summary={
            <Text size="sm" c="dimmed">
              전체 {page.totalCount.toLocaleString()}명
            </Text>
          }
        >
          {page.loading ? (
            <TableSkeleton rows={8} columns={10} />
          ) : page.partners.length === 0 ? (
            <EmptyState
              icon={Users}
              title="파트너 회원이 없습니다"
              description="검색 조건을 변경하거나 새 파트너가 가입할 때까지 기다려 주세요."
            />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>상호명</Table.Th>
                  <Table.Th>대표자명</Table.Th>
                  <Table.Th>카테고리</Table.Th>
                  <Table.Th>주소</Table.Th>
                  <Table.Th>연락처</Table.Th>
                  <Table.Th>비즈콜</Table.Th>
                  <Table.Th>노출수/클릭수</Table.Th>
                  <Table.Th>광고 이력</Table.Th>
                  <Table.Th>분석 권한</Table.Th>
                  <Table.Th>가입일</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {page.partners.map((partner) => (
                  <Table.Tr
                    key={partner.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => page.handleRowClick(partner.id)}
                  >
                    <Table.Td fw={500}>{partner.businessName}</Table.Td>
                    <Table.Td>{partner.representativeName}</Table.Td>
                    <Table.Td c="dimmed">
                      {partner.categoryNames.length > 0 ? (
                        <Group gap={4}>
                          {partner.categoryNames.map((name, i) => (
                            <Badge key={`${name}-${i}`} variant="light" color="gray">
                              {name}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      <Text size="sm" c="dimmed" maw={160} truncate>
                        {partner.businessAddress ?? '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td c="dimmed">{partner.phoneNumber ?? '-'}</Table.Td>
                    <Table.Td c="dimmed">{partner.bizCallNumber ?? '-'}</Table.Td>
                    <Table.Td c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {partner.totalImpressionCount.toLocaleString()} / {partner.totalClickCount.toLocaleString()}
                    </Table.Td>
                    <Table.Td>
                      {partner.hasHadRunningAd ? (
                        <Badge variant="light" color="blue">광고 이력 있음</Badge>
                      ) : (
                        <Text size="sm" c="dimmed">없음</Text>
                      )}
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={partner.analyticsEnabled}
                        onChange={() =>
                          handleToggleAnalytics(partner.id, partner.analyticsEnabled)
                        }
                        aria-label="분석 권한"
                      />
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {new Date(partner.createdAt).toLocaleDateString('ko-KR')}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </DataTableShell>

        {page.totalPages > 1 && (
          <Group justify="center" gap="xs">
            <Button
              variant="default"
              size="xs"
              leftSection={<ChevronLeft size={16} />}
              onClick={() => page.handlePageChange(page.currentPage - 1)}
              disabled={page.currentPage === 1}
            >
              이전
            </Button>
            <Pagination
              total={page.totalPages}
              value={page.currentPage}
              onChange={page.handlePageChange}
              withControls={false}
            />
            <Button
              variant="default"
              size="xs"
              rightSection={<ChevronRight size={16} />}
              onClick={() => page.handlePageChange(page.currentPage + 1)}
              disabled={page.currentPage === page.totalPages}
            >
              다음
            </Button>
          </Group>
        )}
      </PageContent>
    </PageShell>
  );
}

export default function PartnersPage(): React.ReactElement {
  return (
    <Suspense>
      <PartnersContent />
    </Suspense>
  );
}
