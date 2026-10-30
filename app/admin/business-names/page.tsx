'use client';

import { Suspense } from 'react';
import { Search, ChevronLeft, ChevronRight, BookText, Pencil, Trash2 } from 'lucide-react';
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
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useBusinessNamesPage } from './useBusinessNamesPage';

function BusinessNamesContent(): React.ReactElement {
  const page = useBusinessNamesPage();
  const isDeleteTargetWithdrawn = page.deleteTarget?.partnerUserId === null;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="상호명 관리"
          description="가입/탈퇴한 파트너의 상호명 기록을 검색합니다. 사용중·탈퇴 상태와 무관하게 수정·삭제가 가능합니다."
        />
      </PageHeader>

      <PageContent>
        <Group justify="space-between" gap="md" wrap="nowrap">
          <TextInput
            placeholder="상호명 검색..."
            value={page.searchInput}
            onChange={(e) => page.handleSearch(e.target.value)}
            leftSection={<Search size={16} />}
            w="100%"
            maw={384}
          />
          <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
            전체 {page.totalCount.toLocaleString()}건
          </Text>
        </Group>

        <DataTableShell>
          {page.loading ? (
            <TableSkeleton rows={8} columns={4} />
          ) : page.rows.length === 0 ? (
            <EmptyState
              icon={BookText}
              title="상호명 기록이 없습니다"
              description="검색 조건을 변경해 보세요."
            />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>상호명</Table.Th>
                  <Table.Th>상태</Table.Th>
                  <Table.Th>등록일</Table.Th>
                  <Table.Th ta="right">작업</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {page.rows.map((row) => {
                  const isWithdrawn = row.partnerUserId === null;
                  const isEditing = page.editingId === row.id;

                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td fw={500}>
                        {isEditing ? (
                          <Group gap="xs" wrap="nowrap">
                            <TextInput
                              maw={320}
                              style={{ flex: 1 }}
                              value={page.editingName}
                              autoFocus
                              disabled={page.saving}
                              onChange={(e) => page.setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && page.saveEdit()}
                            />
                            <Button size="xs" onClick={page.saveEdit} disabled={page.saving}>
                              저장
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="gray"
                              onClick={page.cancelEdit}
                              disabled={page.saving}
                            >
                              취소
                            </Button>
                          </Group>
                        ) : (
                          row.businessName
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={isWithdrawn ? 'gray' : 'green'}>
                          {isWithdrawn ? '탈퇴' : '사용중'}
                        </Badge>
                      </Table.Td>
                      <Table.Td c="dimmed">
                        {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                      </Table.Td>
                      <Table.Td>
                        {isEditing ? null : (
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label="수정"
                              onClick={() => page.startEdit(row)}
                            >
                              <Pencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="삭제"
                              onClick={() => page.setDeleteTarget(row)}
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
                          </Group>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
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

      <Modal
        closeOnClickOutside={false}
        withCloseButton={false}
        opened={page.deleteTarget !== null}
        onClose={() => page.setDeleteTarget(null)}
        title={isDeleteTargetWithdrawn ? '상호명 삭제' : '사용중인 상호명 삭제'}
      >
        <Text size="sm" c="dimmed">
          {isDeleteTargetWithdrawn ? (
            <>
              &apos;{page.deleteTarget?.businessName}&apos; 상호명 기록을 삭제할까요? 삭제하면
              이 상호명을 다른 파트너가 다시 등록할 수 있게 됩니다. 되돌릴 수 없습니다.
            </>
          ) : (
            <>
              &apos;{page.deleteTarget?.businessName}&apos;은(는) 현재 영업 중인 파트너의
              상호명입니다. 삭제해도 해당 파트너의 상호명은 그대로 유지되지만, 레지스트리
              기록만 사라져 제3자가 같은 이름으로 가입할 수 있게 됩니다. 정말 삭제하시겠습니까?
              되돌릴 수 없습니다.
            </>
          )}
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button
            variant="default"
            disabled={page.deleting}
            onClick={() => page.setDeleteTarget(null)}
          >
            취소
          </Button>
          {/* AlertDialogAction과 동일하게 클릭 즉시 다이얼로그를 닫는다 */}
          <Button
            color="red"
            disabled={page.deleting}
            onClick={() => {
              page.confirmDelete();
              page.setDeleteTarget(null);
            }}
          >
            삭제
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}

export default function BusinessNamesPage(): React.ReactElement {
  return (
    <Suspense>
      <BusinessNamesContent />
    </Suspense>
  );
}
