'use client';

import { READONLY_INPUT_STYLES } from '@/components/readonly-input-styles';

import { useState, useEffect, useCallback } from 'react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { TableSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar } from '@/components/data-toolbar';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Overlay,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  Search,
  MoreVertical,
  Check,
  X,
  Edit,
  Building2,
  Home,
  Layers,
  Shield,
  Eye,
  Image as ImageIcon,
  Trash2,
  Ban
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatLineRange } from '@/lib/utils/line';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import { getUserRoles } from '@/lib/auth';

interface Manager {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  approvalStatus: 'pending' | 'approve' | null;
  createdAt: string;
  confirmImageUrl?: string;
  registerMethod?: string | null;
  openDoorCount?: number;
  birthDay?: string;
  address?: string;
  regionSido?: string;
  regionSigungu?: string;
  regionDong?: string;
  user_roles?: { role: string }[];
  admin_scopes?: AdminScope[];
}

interface AdminScope {
  id: string;
  scopeLevel: 'APARTMENT' | 'BUILDING' | 'LINE';
  apartmentId: string | null;
  buildingId: string | null;
  lineId: string | null;
  apartments?: { id: string; name: string; address: string };
  apartment_buildings?: { id: string; buildingNumber: number };
  apartment_lines?: { id: string; line: number[] };
}

interface Apartment {
  id: string;
  name: string;
  address: string;
}

interface Building {
  id: string;
  buildingNumber: number;
  apartmentId: string;
}

interface Line {
  id: string;
  line: number[];
  buildingId: string;
}

export default function ManagersPage() {
  const supabase = createClient();

  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingManager, setDeletingManager] = useState<Manager | null>(null);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendingManager, setSuspendingManager] = useState<Manager | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');

  // 권한 편집용 상태
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<string>('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [scopeLevel, setScopeLevel] = useState<'APARTMENT' | 'BUILDING' | 'LINE'>('APARTMENT');

  // 필터용 상태
  const [filterApartment, setFilterApartment] = useState<string>('all');

  // 상세보기 다이얼로그
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailManager, setDetailManager] = useState<Manager | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // 관리자 목록 조회
  const fetchManagers = useCallback(async () => {
    setLoading(true);

    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isManager = roles.includes('MANAGER');

      let managerApartmentIds: string[] = [];

      // MANAGER인 경우 자신이 관리하는 아파트 ID 가져오기
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            managerApartmentIds = managerApartments.map((ma: any) => ma.apartmentId);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setManagers([]);
            setLoading(false);
            return;
          }
        }
      }

      let query = supabase
        .from('user')
        .select(`
          *,
          user_roles!inner(role),
          admin_scopes(
            id,
            scopeLevel,
            apartmentId,
            buildingId,
            lineId,
            apartments:apartmentId(id, name, address),
            apartment_buildings:buildingId(id, buildingNumber),
            apartment_lines:lineId(id, line)
          )
        `)
        .eq('user_roles.role', 'APT_ADMIN')
        .order('createdAt', { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // MANAGER인 경우 자신이 관리하는 아파트의 관리자들만 필터링
      let filteredData = data || [];
      if (isManager && managerApartmentIds.length > 0) {
        filteredData = filteredData.filter(manager => {
          // admin_scopes 중 하나라도 관리하는 아파트에 속하면 포함
          return manager.admin_scopes?.some(scope =>
            scope.apartmentId && managerApartmentIds.includes(scope.apartmentId)
          );
        });
      }

      setManagers(filteredData);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
      toast.error('관리자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, supabase]);

  // 아파트 목록 조회
  const fetchApartments = async () => {
    try {
      const roles = await getUserRoles();
      const isManager = roles.includes('MANAGER');

      let query = supabase
        .from('apartments')
        .select('*')
        .order('name');

      // MANAGER인 경우 자신이 관리하는 아파트만 조회
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            const apartmentIds = managerApartments.map((ma: any) => ma.apartmentId);
            query = query.in('id', apartmentIds);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setApartments([]);
            return;
          }
        }
      }

      const { data } = await query;
      setApartments(data || []);
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
      setApartments([]);
    }
  };

  // 동 목록 조회
  const fetchBuildings = async (apartmentId: string) => {
    if (!apartmentId) {
      setBuildings([]);
      return;
    }
    const { data } = await supabase
      .from('apartment_buildings')
      .select('*')
      .eq('apartmentId', apartmentId)
      .order('buildingNumber');
    setBuildings(data || []);
  };

  // 라인 목록 조회
  const fetchLines = async (buildingId: string) => {
    if (!buildingId) {
      setLines([]);
      return;
    }
    const { data } = await supabase
      .from('apartment_lines')
      .select('*')
      .eq('buildingId', buildingId);
    setLines(data || []);
  };

  useEffect(() => {
    fetchManagers();
    fetchApartments();
  }, [fetchManagers]);

  useEffect(() => {
    if (selectedApartment) {
      fetchBuildings(selectedApartment);
    }
  }, [selectedApartment]);

  useEffect(() => {
    if (selectedBuilding) {
      fetchLines(selectedBuilding);
    }
  }, [selectedBuilding]);

  // 승인 상태 변경
  const handleApprovalStatusChange = async (userId: string, status: 'approve' | 'pending') => {
    try {
      const response = await fetch(`/api/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '승인 상태 변경 처리 중 문제가 생겼습니다. 목록을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('승인 상태가 변경되었습니다.');
      fetchManagers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error(networkFailedMessage('승인 상태를 바꾸지 못했습니다.'));
    }
  };

  const handleSuspendClick = (manager: Manager) => {
    setSuspendingManager(manager);
    setSuspensionReason('');
    setSuspendDialog(true);
  };

  const handleSuspendConfirm = async () => {
    if (!suspendingManager) return;

    if (!suspensionReason.trim()) {
      toast.error('보류 사유를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/users/${suspendingManager.id}/suspend`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspensionReason: suspensionReason.trim() }),
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '승인 보류 처리 중 문제가 생겼습니다. 목록을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('관리자가 승인 보류 처리되었습니다.');
      setSuspendDialog(false);
      setSuspendingManager(null);
      setSuspensionReason('');
      fetchManagers();
    } catch (err) {
      console.error('Failed to suspend manager:', err);
      toast.error(networkFailedMessage('승인 보류 처리를 하지 못했습니다.'));
    }
  };

  // 권한 편집 모달 열기
  const openEditModal = (manager: Manager) => {
    setSelectedManager(manager);
    setIsEditModalOpen(true);

    // 기존 권한 정보 로드
    if (manager.admin_scopes && manager.admin_scopes.length > 0) {
      const scope = manager.admin_scopes[0];
      setScopeLevel(scope.scopeLevel);
      if (scope.apartmentId) setSelectedApartment(scope.apartmentId);
      if (scope.buildingId) setSelectedBuilding(scope.buildingId);
      if (scope.lineId) setSelectedLine(scope.lineId);
    } else {
      // 초기화
      setScopeLevel('APARTMENT');
      setSelectedApartment('');
      setSelectedBuilding('');
      setSelectedLine('');
    }
  };

  // 권한 저장
  const handleSaveScope = async () => {
    if (!selectedManager) return;

    try {
      // 기존 권한 삭제
      await supabase
        .from('admin_scopes')
        .delete()
        .eq('userId', selectedManager.id);

      // 새 권한 추가
      const scopeData: any = {
        userId: selectedManager.id,
        scopeLevel: scopeLevel,
        apartmentId: selectedApartment || null,
        buildingId: null,
        lineId: null,
      };

      if (scopeLevel === 'BUILDING' && selectedBuilding) {
        scopeData.buildingId = selectedBuilding;
      } else if (scopeLevel === 'LINE' && selectedLine) {
        scopeData.lineId = selectedLine;
        scopeData.buildingId = selectedBuilding;
      }

      const { error } = await supabase
        .from('admin_scopes')
        .insert(scopeData);

      if (error) throw error;

      toast.success('권한이 저장되었습니다.');
      setIsEditModalOpen(false);
      fetchManagers();
    } catch (err) {
      console.error('Failed to save scope:', err);
      toast.error('권한 저장에 실패했습니다.');
    }
  };

  const handleDeleteClick = (manager: Manager) => {
    setDeletingManager(manager);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingManager) return;

    try {
      const response = await fetch(`/api/users/${deletingManager.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '관리자 삭제 처리 중 문제가 생겼습니다. 목록을 새로고침해 삭제 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('관리자가 삭제되었습니다.');
      setDeleteDialog(false);
      setDeletingManager(null);
      fetchManagers();
    } catch (err) {
      console.error('Failed to delete manager:', err);
      toast.error(networkFailedMessage('관리자를 삭제하지 못했습니다.'));
    }
  };

  // 관리 범위 표시
  const getScopeDisplay = (scopes?: AdminScope[]) => {
    if (!scopes || scopes.length === 0) {
      return <Badge variant="light" color="gray">미지정</Badge>;
    }

    const scope = scopes[0];
    const apartment = scope.apartments;
    const building = scope.apartment_buildings;
    const line = scope.apartment_lines;

    if (scope.scopeLevel === 'APARTMENT' && apartment) {
      return (
        <Group gap="xs" wrap="nowrap">
          <Building2 size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{apartment.name} 전체</Text>
        </Group>
      );
    } else if (scope.scopeLevel === 'BUILDING' && apartment && building) {
      return (
        <Group gap="xs" wrap="nowrap">
          <Home size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{apartment.name} {building.buildingNumber}동</Text>
        </Group>
      );
    } else if (scope.scopeLevel === 'LINE' && apartment && building && line) {
      return (
        <Group gap="xs" wrap="nowrap">
          <Layers size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{apartment.name} {building.buildingNumber}동 {formatLineRange(line.line)}라인</Text>
        </Group>
      );
    }

    return <Badge variant="light" color="gray">미지정</Badge>;
  };

  const getApprovalBadge = (status: string | null) => {
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

  const getRegisterMethodBadge = (method: string | null | undefined) => {
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

  // 상세보기 클릭
  const handleDetailClick = (manager: Manager) => {
    setDetailManager(manager);
    setEditForm({
      name: manager.name || '',
      email: manager.email || '',
      phoneNumber: manager.phoneNumber || '',
      birthDay: manager.birthDay || '',
      openDoorCount: manager.openDoorCount || 0,
      address: manager.address || '',
      regionSido: manager.regionSido || '',
      regionSigungu: manager.regionSigungu || '',
      regionDong: manager.regionDong || '',
      approvalStatus: manager.approvalStatus || 'pending',
    });
    setDetailDialog(true);
  };

  // 상세정보 저장
  const handleDetailSave = async () => {
    if (!detailManager) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user')
        .update({
          name: editForm.name,
          phoneNumber: editForm.phoneNumber,
          birthDay: editForm.birthDay || null,
          openDoorCount: parseInt(editForm.openDoorCount) || 0,
        })
        .eq('id', detailManager.id);

      if (error) throw error;

      toast.success('관리자 정보가 수정되었습니다.');
      setDetailDialog(false);
      fetchManagers();
    } catch (err) {
      console.error('Failed to update manager:', err);
      toast.error('관리자 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const filteredManagers = managers.filter((manager) => {
    // 검색 필터
    const matchesSearch =
      manager.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.phoneNumber?.includes(searchQuery);

    // 아파트 필터
    const matchesApartment =
      filterApartment === 'all' ||
      manager.admin_scopes?.some(scope => scope.apartmentId === filterApartment);

    return matchesSearch && matchesApartment;
  });

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="관리자 관리"
          description="관리자 권한 범위와 승인 상태를 관리합니다."
        />
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <DataToolbar>
              <TextInput
                placeholder='이름, 이메일, 전화번호로 검색...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<Search size={16} />}
                w={{ base: '100%', sm: 320 }}
              />
              <Select
                placeholder='아파트 선택'
                data={[
                  { value: 'all', label: '전체 아파트' },
                  ...apartments.map((apt) => ({ value: apt.id, label: apt.name })),
                ]}
                value={filterApartment}
                onChange={(v) => {
                  if (v === null) return;
                  setFilterApartment(v);
                }}
                allowDeselect={false}
                w={{ base: '100%', sm: 180 }}
              />
            </DataToolbar>
          }
          summary={
            <Text size="sm" c="dimmed">
              전체 <Text span fw={700} c="var(--mantine-color-text)">{filteredManagers.length}</Text>명
            </Text>
          }
        >
          {loading ? (
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
                            <ActionIcon variant='subtle' color='gray' aria-label='더보기'>
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
                                onClick={() => handleApprovalStatusChange(manager.id, 'approve')}
                              >
                                승인하기
                              </Menu.Item>
                            ) : (
                              <Menu.Item
                                color='orange'
                                leftSection={<X size={16} />}
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
          )}
        </DataTableShell>
      </PageContent>

      {/* Image Preview Modal */}
      {imagePreview && (
        <Overlay
          fixed
          center
          zIndex={200}
          backgroundOpacity={0.8}
          p="xl"
          onClick={() => setImagePreview(null)}
        >
          <Box
            pos='relative'
            maw={896}
            mah='85vh'
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <img
              src={imagePreview}
              alt='인증 사진'
              className='object-contain'
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }}
            />
            <ActionIcon
              variant='default'
              radius='xl'
              size='lg'
              pos='absolute'
              top={16}
              right={16}
              aria-label='닫기'
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview(null);
              }}
            >
              <X size={20} />
            </ActionIcon>
          </Box>
        </Overlay>
      )}

      {/* Suspend Confirmation Dialog */}
      <Modal opened={suspendDialog} onClose={() => setSuspendDialog(false)} title='승인 보류'>
        <Text size='sm' c='dimmed'>
          <strong>{suspendingManager?.name || suspendingManager?.email}</strong>님의 승인을 보류하시겠습니까?
          <br />
          보류 사유를 입력해주세요. 사용자는 이 사유를 확인할 수 있습니다.
        </Text>
        <Textarea
          mt='md'
          minRows={4}
          autosize
          placeholder='보류 사유를 입력해주세요...'
          value={suspensionReason}
          onChange={(e) => setSuspensionReason(e.target.value)}
        />
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setSuspendDialog(false)}>
            취소
          </Button>
          <Button color='yellow' onClick={handleSuspendConfirm}>
            승인 보류
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title='관리자 삭제'>
        <Text size='sm' c='dimmed'>
          정말로 <strong>{deletingManager?.name || deletingManager?.email}</strong>님을 삭제하시겠습니까?
          <br />
          이 작업은 되돌릴 수 없으며, 해당 관리자의 모든 데이터가 삭제됩니다.
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDeleteDialog(false)}>
            취소
          </Button>
          <Button color='red' onClick={handleDeleteConfirm}>
            삭제
          </Button>
        </Group>
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title='관리 범위 설정'
        size={500}
      >
        <Text size='sm' c='dimmed'>
          {selectedManager?.name || selectedManager?.email}님의 관리 권한 범위를 설정합니다.
        </Text>

        <Stack gap='md' mt='md'>
          {/* 관리 레벨 선택 */}
          <Select
            label='관리 레벨'
            data={[
              { value: 'APARTMENT', label: '아파트 전체' },
              { value: 'BUILDING', label: '특정 동' },
              { value: 'LINE', label: '특정 라인' },
            ]}
            value={scopeLevel}
            onChange={(value) => {
              if (value === null) return;
              setScopeLevel(value as any);
            }}
            allowDeselect={false}
          />

          {/* 아파트 선택 */}
          <Select
            label='아파트'
            placeholder='아파트를 선택하세요'
            data={apartments.map((apt) => ({ value: apt.id, label: apt.name }))}
            value={selectedApartment || null}
            onChange={(v) => {
              if (v === null) return;
              setSelectedApartment(v);
            }}
            allowDeselect={false}
          />

          {/* 동 선택 (BUILDING 또는 LINE 레벨일 때) */}
          {(scopeLevel === 'BUILDING' || scopeLevel === 'LINE') && (
            <Select
              label='동'
              placeholder='동을 선택하세요'
              data={buildings.map((building) => ({ value: building.id, label: `${building.buildingNumber}동` }))}
              value={selectedBuilding || null}
              onChange={(v) => {
                if (v === null) return;
                setSelectedBuilding(v);
              }}
              allowDeselect={false}
              disabled={!selectedApartment}
            />
          )}

          {/* 라인 선택 (LINE 레벨일 때) */}
          {scopeLevel === 'LINE' && (
            <Select
              label='라인'
              placeholder='라인을 선택하세요'
              data={lines.map((line) => ({ value: line.id, label: `${formatLineRange(line.line)}라인` }))}
              value={selectedLine || null}
              onChange={(v) => {
                if (v === null) return;
                setSelectedLine(v);
              }}
              allowDeselect={false}
              disabled={!selectedBuilding}
            />
          )}
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setIsEditModalOpen(false)}>
            취소
          </Button>
          <Button
            onClick={handleSaveScope}
            disabled={
              !selectedApartment ||
              (scopeLevel === 'BUILDING' && !selectedBuilding) ||
              (scopeLevel === 'LINE' && (!selectedBuilding || !selectedLine))
            }
          >
            저장
          </Button>
        </Group>
      </Modal>

      {/* Detail Dialog */}
      <Modal
        opened={detailDialog}
        onClose={() => setDetailDialog(false)}
        title='관리자 상세 정보'
        size={600}
      >
        <Text size='sm' c='dimmed'>
          관리자 정보를 확인하고 수정할 수 있습니다.
        </Text>

        <SimpleGrid cols={2} spacing='md' mt='md'>
          <TextInput
            label='이름'
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <TextInput
            label='이메일'
            value={editForm.email}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            label='전화번호'
            value={editForm.phoneNumber}
            onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
          />
          <TextInput
            label='생년월일'
            value={editForm.birthDay}
            onChange={(e) => setEditForm({ ...editForm, birthDay: e.target.value })}
            placeholder='YYYY-MM-DD'
          />

          {/* 관리 범위 */}
          <Stack gap={4} style={{ gridColumn: 'span 2' }}>
            <Text size='sm' fw={500}>관리 범위</Text>
            <Paper bg='var(--app-bg-muted)' p='sm' radius='sm'>
              {detailManager && getScopeDisplay(detailManager.admin_scopes)}
            </Paper>
          </Stack>

          {/* 지역 정보 */}
          <TextInput
            label='주소'
            value={editForm.address}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            label='시/도'
            value={editForm.regionSido}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            label='시/군/구'
            value={editForm.regionSigungu}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            label='읍/면/동'
            value={editForm.regionDong}
            disabled
            styles={READONLY_INPUT_STYLES}
          />

          {/* 상태 정보 */}
          <Select
            label='승인상태'
            data={[
              { value: 'pending', label: '대기' },
              { value: 'approve', label: '승인' },
              { value: 'suspended', label: '보류' },
              { value: 'inactive', label: '비활성' },
            ]}
            value={editForm.approvalStatus || null}
            allowDeselect={false}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            label='문 연 횟수'
            type='number'
            value={editForm.openDoorCount}
            onChange={(e) => setEditForm({ ...editForm, openDoorCount: e.target.value })}
          />
        </SimpleGrid>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDetailDialog(false)}>
            취소
          </Button>
          <Button onClick={handleDetailSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
