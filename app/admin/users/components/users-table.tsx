'use client';

import { memo } from 'react';
import { ActionIcon, Badge, Button, Group, Menu, Table, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { MoreVertical, Check, X, Eye, Image as ImageIcon, Ban, Edit } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';
import type { UserFullDetails } from '@/lib/supabase/types';
import type { ApprovalStatusAction } from '../types';
import { formatDate } from '../utils';

interface UsersTableProps {
  users: UserFullDetails[];
  partnerUserIds: Set<string>;
  loading: boolean;
  initialLoading: boolean;
  searchQuery: string;
  onDetailClick: (user: UserFullDetails) => void;
  onPreviewImage: (url: string | null) => void;
  onApprovalStatusChange: (userId: string, status: ApprovalStatusAction) => Promise<void>;
  // 승인/승인 취소 요청 중인 회원 id — 해당 행의 승인·보류·승인 취소를 막는다
  processingUserIds: ReadonlySet<string>;
  onSuspendClick: (user: UserFullDetails) => void;
}

const getApprovalBadge = (status: string | null): React.ReactElement => {
  switch (status) {
    case 'approve':
      return <Badge variant="light" color="green">승인</Badge>;
    case 'pending':
      return <Badge variant="light" color="yellow">대기</Badge>;
    case 'suspended':
      return <Badge variant="light" color="orange">보류</Badge>;
    case 'inactive':
      return <Badge variant="light" color="gray">비활성</Badge>;
    default:
      return <Badge variant="light" color="gray">-</Badge>;
  }
};

const getRegistrationTypeBadge = (type: string | null): React.ReactElement => {
  switch (type) {
    case 'APARTMENT':
      return <Badge variant="light" color="blue">아파트</Badge>;
    case 'GENERAL':
      return <Badge variant="light" color="gray">일반</Badge>;
    default:
      return <Badge variant="light" color="gray">-</Badge>;
  }
};


const getRegisterMethodBadge = (method: string | null): React.ReactElement | null => {
  switch (method?.toLowerCase()) {
    case 'google':
      return <Badge variant="light" color="red" size="sm">Google</Badge>;
    case 'kakao':
      return <Badge variant="light" color="yellow" size="sm">Kakao</Badge>;
    case 'local':
      return <Badge variant="light" color="blue" size="sm">Email</Badge>;
    default:
      return null;
  }
};

/**
 * 회원 목록 표. 핸들러는 모두 참조가 고정돼 있어서
 * 검색어 입력·다이얼로그 입력·이미지 미리보기 등 목록과 무관한 상태 변경에는 다시 그리지 않는다.
 */
export const UsersTable = memo(function UsersTable({
  users,
  partnerUserIds,
  loading,
  initialLoading,
  searchQuery,
  onDetailClick,
  onPreviewImage,
  onApprovalStatusChange,
  processingUserIds,
  onSuspendClick,
}: UsersTableProps): React.ReactElement {
  return (
    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={48}>사진</Table.Th>
          <Table.Th>이름</Table.Th>
          <Table.Th>전화번호</Table.Th>
          <Table.Th>회원유형</Table.Th>
          <Table.Th>아파트/동/호</Table.Th>
          <Table.Th>출생년도</Table.Th>
          <Table.Th>승인상태</Table.Th>
          <Table.Th>가입일</Table.Th>
          <Table.Th ta="center">문 연 횟수</Table.Th>
          <Table.Th ta="right">작업</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {initialLoading && loading ? (
          <Table.Tr>
            <Table.Td colSpan={10} p={0}>
              <TableSkeleton rows={8} columns={10} showHeader={false} />
            </Table.Td>
          </Table.Tr>
        ) : users.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={10} ta="center" py={48} c="dimmed">
              {searchQuery ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
            </Table.Td>
          </Table.Tr>
        ) : (
          users.map((user) => (
            <Table.Tr
              key={user.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onDetailClick(user)}
            >
              <Table.Td onClick={(e) => e.stopPropagation()}>
                {user.confirmImageUrl ? (
                  <UnstyledButton
                    onClick={() => onPreviewImage(user.confirmImageUrl)}
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
                      src={user.confirmImageUrl}
                      alt={user.name || ''}
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
              <Table.Td fw={500}>
                <Group gap={6} wrap="nowrap">
                  {user.name || '-'}
                  {getRegisterMethodBadge(user.registerMethod)}
                </Group>
              </Table.Td>
              <Table.Td c="dimmed">
                {user.phoneNumber || '-'}
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {getRegistrationTypeBadge(user.registrationType)}
                  {partnerUserIds.has(user.id) && (
                    <Badge variant="light" color="grape">파트너</Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td c="dimmed">
                {user.registrationType === 'APARTMENT' && user.apartments ? (
                  <Text size="sm" c="dimmed">
                    {user.apartments.name}<br/>
                    {user.buildingNumber ? `${user.buildingNumber}동` : ''}
                    {user.unit ? `${user.unit}호` : ''}
                  </Text>
                ) : (
                  '-'
                )}
              </Table.Td>
              <Table.Td c="dimmed" fz="sm">
                {(user as any).birthDay ? (
                  <>
                    {(user as any).birthDay.substring(0, 4)}
                    <Text span size="xs" ml={4}>
                      (만 {new Date().getFullYear() - parseInt((user as any).birthDay.substring(0, 4))}세)
                    </Text>
                  </>
                ) : '-'}
              </Table.Td>
              <Table.Td>
                {getApprovalBadge(user.approvalStatus)}
              </Table.Td>
              <Table.Td c="dimmed">
                {formatDate(user.createdAt)}
              </Table.Td>
              <Table.Td ta="center" c="dimmed">
                {(user as any).openDoorCount > 0 ? (
                  <span>{(user as any).openDoorCount}회</span>
                ) : (
                  <span>-</span>
                )}
              </Table.Td>
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Group gap={4} justify="flex-end" wrap="nowrap">
                  {user.registrationType === 'APARTMENT' && user.approvalStatus === 'pending' && (
                    <>
                      <Button
                        variant='subtle'
                        color='green'
                        size='compact-sm'
                        leftSection={<Check size={12} />}
                        loading={processingUserIds.has(user.id)}
                        onClick={() => onApprovalStatusChange(user.id, 'approve')}
                      >
                        승인
                      </Button>
                      <Button
                        variant='subtle'
                        color='yellow'
                        size='compact-sm'
                        leftSection={<Ban size={12} />}
                        disabled={processingUserIds.has(user.id)}
                        onClick={() => onSuspendClick(user)}
                      >
                        보류
                      </Button>
                    </>
                  )}
                  <Menu position='bottom-end' withinPortal>
                    <Menu.Target>
                      <ActionIcon variant='subtle' color='gray' aria-label='더보기'>
                        <MoreVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<Edit size={16} />}
                        onClick={() => onDetailClick(user)}
                      >
                        전체보기
                      </Menu.Item>
                      {user.confirmImageUrl && (
                        <Menu.Item
                          leftSection={<Eye size={16} />}
                          onClick={() => onPreviewImage(user.confirmImageUrl)}
                        >
                          인증 사진 보기
                        </Menu.Item>
                      )}
                      {user.registrationType === 'APARTMENT' && user.approvalStatus === 'approve' && (
                        <Menu.Item
                          color='orange'
                          leftSection={<X size={16} />}
                          disabled={processingUserIds.has(user.id)}
                          onClick={() => onApprovalStatusChange(user.id, 'pending')}
                        >
                          승인 취소
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
});
