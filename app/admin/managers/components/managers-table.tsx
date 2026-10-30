'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import {
  ActionIcon,
  Group,
  Menu,
  Table,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  MoreVertical,
  Check,
  X,
  Edit,
  Shield,
  Eye,
  Image as ImageIcon,
  Trash2,
  Ban
} from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { getApprovalBadge, getRegisterMethodBadge, getScopeDisplay } from './manager-display';
import type { ApprovalStatus, Manager } from '../types';

interface ManagersTableProps {
  loading: boolean;
  managers: Manager[];
  searchQuery: string;
  onDetailClick: (manager: Manager) => void;
  onImagePreview: (url: string | null) => void;
  onEditScope: (manager: Manager) => void;
  onApprovalStatusChange: (userId: string, status: ApprovalStatus) => Promise<void>;
  onSuspendClick: (manager: Manager) => void;
  onDeleteClick: (manager: Manager) => void;
  /** 승인 상태 변경 요청 중인 관리자 id */
  processingUserIds: string[];
}

/** 관리자 표 — props가 그대로면(다이얼로그 입력 중) 다시 그리지 않는다 */
export const ManagersTable = memo(function ManagersTable({
  loading,
  managers: filteredManagers,
  searchQuery,
  onDetailClick: handleDetailClick,
  onImagePreview: setImagePreview,
  onEditScope: openEditModal,
  onApprovalStatusChange: handleApprovalStatusChange,
  onSuspendClick: handleSuspendClick,
  onDeleteClick: handleDeleteClick,
  processingUserIds,
}: ManagersTableProps): ReactElement {
  return loading ? (
    <TableSkeleton rows={6} columns={9} showHeader={false} />
  ) : filteredManagers.length === 0 ? (
    <EmptyState
      icon={Shield}
      title={searchQuery ? '검색 결과가 없습니다' : '관리자가 없습니다'}
      description={searchQuery ? '다른 검색어로 다시 시도해 보세요.' : undefined}
      size="sm"
    />
  ) : (
    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={48}>사진</Table.Th>
          <Table.Th>이름</Table.Th>
          <Table.Th>이메일</Table.Th>
          <Table.Th>전화번호</Table.Th>
          <Table.Th>관리 범위</Table.Th>
          <Table.Th>문 연 횟수</Table.Th>
          <Table.Th>승인상태</Table.Th>
          <Table.Th>등록일</Table.Th>
          <Table.Th ta="right">작업</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {filteredManagers.map((manager) => (
          <Table.Tr
            key={manager.id}
            style={{ cursor: 'pointer' }}
            onClick={() => handleDetailClick(manager)}
          >
            <Table.Td onClick={(e) => e.stopPropagation()}>
              {manager.confirmImageUrl ? (
                <UnstyledButton
                  onClick={() => setImagePreview(manager.confirmImageUrl || null)}
                  w={40}
                  h={40}
                  bg="var(--app-bg-subtle)"
                  style={{
                    borderRadius: '50%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={manager.confirmImageUrl}
                    alt={manager.name || ''}
                    className='w-full h-full object-cover'
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = '<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                    }}
                  />
                </UnstyledButton>
              ) : (
                <ThemeIcon variant="light" color="gray" radius="xl" size={40}>
                  <ImageIcon size={20} />
                </ThemeIcon>
              )}
            </Table.Td>
            <Table.Td fw={500}>{manager.name || '-'}</Table.Td>
            <Table.Td c="dimmed">
              <Group gap="xs" wrap="nowrap">
                <span>{manager.email}</span>
                {getRegisterMethodBadge(manager.registerMethod)}
              </Group>
            </Table.Td>
            <Table.Td c="dimmed">{manager.phoneNumber || '-'}</Table.Td>
            <Table.Td>{getScopeDisplay(manager.admin_scopes)}</Table.Td>
            <Table.Td c="dimmed">{manager.openDoorCount || 0}</Table.Td>
            <Table.Td>{getApprovalBadge(manager.approvalStatus)}</Table.Td>
            <Table.Td c="dimmed">
              {new Date(manager.createdAt).toLocaleDateString('ko-KR')}
            </Table.Td>
            <Table.Td onClick={(e) => e.stopPropagation()}>
              <Group justify="flex-end" wrap="nowrap">
                <Menu position='bottom-end'>
                  <Menu.Target>
                    <ActionIcon
                      variant='subtle'
                      color='gray'
                      aria-label='더보기'
                      loading={processingUserIds.includes(manager.id)}
                    >
                      <MoreVertical size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {manager.confirmImageUrl && (
                      <Menu.Item
                        leftSection={<Eye size={16} />}
                        onClick={() => setImagePreview(manager.confirmImageUrl || null)}
                      >
                        인증 사진 보기
                      </Menu.Item>
                    )}
                    <Menu.Item
                      leftSection={<Edit size={16} />}
                      onClick={() => openEditModal(manager)}
                    >
                      관리 범위 설정
                    </Menu.Item>
                    {manager.approvalStatus !== 'approve' ? (
                      <Menu.Item
                        color='green'
                        leftSection={<Check size={16} />}
                        disabled={processingUserIds.includes(manager.id)}
                        onClick={() => handleApprovalStatusChange(manager.id, 'approve')}
                      >
                        승인하기
                      </Menu.Item>
                    ) : (
                      <Menu.Item
                        color='orange'
                        leftSection={<X size={16} />}
                        disabled={processingUserIds.includes(manager.id)}
                        onClick={() => handleApprovalStatusChange(manager.id, 'pending')}
                      >
                        승인 취소
                      </Menu.Item>
                    )}
                    {manager.approvalStatus !== 'suspended' && (
                      <Menu.Item
                        color='yellow'
                        leftSection={<Ban size={16} />}
                        onClick={() => handleSuspendClick(manager)}
                      >
                        승인 보류
                      </Menu.Item>
                    )}
                    <Menu.Item
                      color='red'
                      leftSection={<Trash2 size={16} />}
                      onClick={() => handleDeleteClick(manager)}
                    >
                      삭제
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
});
