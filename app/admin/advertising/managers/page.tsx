'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { PageContent, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { TableSkeleton } from '@/components/skeletons';
import { DataToolbar, DataToolbarActions } from '@/components/data-toolbar';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Input,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Building2,
  Eye,
  FileText,
  MapPin,
  ArrowRightLeft,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';

interface Manager {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
  manager_profiles?: ManagerProfile;
  manager_apartments?: ManagerApartment[];
}

interface ManagerProfile {
  id: string;
  businessRegistration: string | null;
  address: string | null;
  memo: string | null;
}

interface ManagerApartment {
  id: string;
  apartmentId: string;
  apartments: {
    id: string;
    name: string;
    address: string;
  };
}

interface Apartment {
  id: string;
  name: string;
  address: string;
}

interface RunningAdCounts {
  basic: number;
  premium: number;
}

export default function AdvertisingManagersPage() {
  const supabase = createClient();

  const [managers, setManagers] = useState<Manager[]>([]);
  const [, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [runningAdCounts, setRunningAdCounts] = useState<Record<string, RunningAdCounts>>({});

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    phoneNumber: '',
    address: '',
    businessRegistration: '',
    memo: '',
    approvalStatus: 'approve' as 'approve' | 'pending',
  });
  const [, setTempManagerId] = useState<string>('');
  const [uploadedCreateImage, setUploadedCreateImage] = useState<string>(''); // 업로드된 생성 이미지 추적
  const [showPassword, setShowPassword] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingManager, setDeletingManager] = useState<Manager | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail dialog
  const [detailDialog, setDetailDialog] = useState(false);
  const [viewingManager, setViewingManager] = useState<Manager | null>(null);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingManagerId, setEditingManagerId] = useState<string>('');
  const [uploadedEditImage, setUploadedEditImage] = useState<string>(''); // 업로드된 편집 이미지 추적
  const [editForm, setEditForm] = useState({
    name: '',
    phoneNumber: '',
    address: '',
    businessRegistration: '',
    memo: '',
  });

  // 아파트 이전 관련 상태
  const [transferPopoverOpen, setTransferPopoverOpen] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // 매니저 목록 조회
  const fetchManagers = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('user')
        .select(`
          *,
          user_roles!inner(role),
          manager_profiles(*),
          manager_apartments(
            id,
            apartmentId,
            apartments:apartmentId(id, name, address)
          )
        `)
        .eq('user_roles.role', 'MANAGER')
        .order('createdAt', { ascending: false });

      if (fetchError) throw fetchError;

      setManagers(data || []);
      fetchRunningAdCounts(data || []);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
      toast.error('매니저 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // 아파트 목록 조회
  const fetchApartments = async () => {
    const { data } = await supabase
      .from('apartments')
      .select('*')
      .order('name');
    setApartments(data || []);
  };

  // 매니저별 관리 아파트에서 진행중(running)인 일반/프리미엄 광고 개수 집계
  // — /admin/apartments와 동일하게 get_apartment_running_ad_counts RPC 결과를 아파트 기준으로 합산
  const fetchRunningAdCounts = async (managersData: Manager[]) => {
    const { data: adCounts } = await supabase.rpc('get_apartment_running_ad_counts');

    const adCountMap = new Map<string, { basic: number; premium: number }>(
      (adCounts || []).map((r: { apartment_id: string; basic_running_count: number; premium_running_count: number }) => [
        r.apartment_id,
        { basic: r.basic_running_count, premium: r.premium_running_count },
      ])
    );

    const counts: Record<string, RunningAdCounts> = {};
    managersData.forEach((m) => {
      counts[m.id] = (m.manager_apartments ?? []).reduce(
        (acc, ma) => {
          const c = adCountMap.get(ma.apartmentId);
          return { basic: acc.basic + (c?.basic ?? 0), premium: acc.premium + (c?.premium ?? 0) };
        },
        { basic: 0, premium: 0 }
      );
    });

    setRunningAdCounts(counts);
  };

  useEffect(() => {
    fetchManagers();
    fetchApartments();
  }, [fetchManagers]);

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');

    // 길이에 따라 포맷팅
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    } else {
      // 11자리 초과 시 11자리까지만
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  // 매니저 생성
  const handleCreateManager = async () => {
    if (!createForm.email || !createForm.password || !createForm.name) {
      toast.error('필수 항목을 입력해주세요.');
      return;
    }

    // 비밀번호 검증: 8글자 이상, 특수문자 1개 이상
    const passwordRegex = /^(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
    if (!passwordRegex.test(createForm.password)) {
      toast.error('비밀번호는 8글자 이상이며 특수문자를 1개 이상 포함해야 합니다.');
      return;
    }

    try {
      // 1. Supabase Auth로 사용자 생성
      const response = await fetch('/api/advertising/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '매니저 생성에 실패했습니다.');
      }

      setIsCreateDialogOpen(false);
      setCreateForm({
        email: '',
        password: '',
        name: '',
        phoneNumber: '',
        address: '',
        businessRegistration: '',
        memo: '',
        approvalStatus: 'approve',
      });
      setShowPassword(false);
      setUploadedCreateImage(''); // Reset tracking on successful save
      toast.success('매니저가 생성되었습니다.');
      fetchManagers();
    } catch (err: any) {
      console.error('Failed to create manager:', err);
      toast.error(err.message || '매니저 생성에 실패했습니다.');
    }
  };

  // 매니저 수정 시작
  const handleEditClick = (manager: Manager) => {
    setEditingManagerId(manager.id);
    setEditForm({
      name: manager.name || '',
      phoneNumber: manager.phoneNumber || '',
      address: manager.manager_profiles?.address || '',
      businessRegistration: manager.manager_profiles?.businessRegistration || '',
      memo: manager.manager_profiles?.memo || '',
    });
    setDetailDialog(false);
    setIsEditDialogOpen(true);
  };

  // 매니저 수정 저장
  const handleUpdateManager = async () => {
    if (!editForm.name) {
      toast.error('이름은 필수 항목입니다.');
      return;
    }

    try {
      // 1. user 테이블 업데이트
      const { error: userError } = await supabase
        .from('user')
        .update({
          name: editForm.name,
          phoneNumber: formatPhoneNumber(editForm.phoneNumber),
        } as any)
        .eq('id', editingManagerId);

      if (userError) throw userError;

      // 2. manager_profiles 테이블 업데이트
      const { error: profileError } = await supabase
        .from('manager_profiles')
        .update({
          address: editForm.address || null,
          businessRegistration: editForm.businessRegistration || null,
          memo: editForm.memo || null,
        } as any)
        .eq('userId', editingManagerId);

      if (profileError) throw profileError;

      setIsEditDialogOpen(false);
      setUploadedEditImage(''); // Reset tracking on successful save
      toast.success('매니저 정보가 수정되었습니다.');
      fetchManagers();
    } catch (err: any) {
      console.error('Failed to update manager:', err);
      toast.error('매니저 수정에 실패했습니다.');
    }
  };

  // 매니저 삭제
  const handleDeleteClick = (manager: Manager) => {
    setDeletingManager(manager);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingManager) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/advertising/managers/${deletingManager.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '매니저 삭제 처리 중 문제가 생겼습니다. 목록을 새로고침해 삭제 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      setDeleteDialog(false);
      setDeletingManager(null);
      toast.success('매니저가 삭제되었습니다.');
      fetchManagers();
    } catch (err) {
      console.error('Failed to delete manager:', err);
      toast.error(networkFailedMessage('매니저를 삭제하지 못했습니다.'));
    } finally {
      setDeleting(false);
    }
  };

  // 아파트 담당 매니저 변경 (완전 이전: 관련 데이터의 createdBy도 함께 변경)
  const handleTransferApartment = async (
    managerApartmentId: string,
    apartmentId: string,
    newManagerId: string,
    newManagerName: string
  ) => {
    if (!viewingManager) return;

    setTransferLoading(true);
    try {
      // 1. manager_apartments 테이블에서 managerId 업데이트
      const { error: maError } = await supabase
        .from('manager_apartments')
        .update({ managerId: newManagerId } as any)
        .eq('id', managerApartmentId);

      if (maError) throw maError;

      // 2. apartments 테이블의 createdBy 업데이트 (현재 매니저가 만든 경우만)
      await supabase
        .from('apartments')
        .update({ createdBy: newManagerId } as any)
        .eq('id', apartmentId)
        .eq('createdBy', viewingManager.id);

      // 3. 해당 아파트에 연결된 배너들의 createdBy 업데이트
      const { data: bannerApartments } = await supabase
        .from('home_banner_apartments')
        .select('bannerId')
        .eq('apartmentId', apartmentId);

      if (bannerApartments && bannerApartments.length > 0) {
        const bannerIds = (bannerApartments as any[]).map(ba => ba.bannerId);
        await supabase
          .from('home_banners')
          .update({ createdBy: newManagerId } as any)
          .in('id', bannerIds)
          .eq('createdBy', viewingManager.id);
      }

      // 4. 해당 아파트에 연결된 광고들의 createdBy 업데이트
      const { data: adApartments } = await supabase
        .from('advertisement_apartments')
        .select('advertisementId')
        .eq('apartmentId', apartmentId);

      if (adApartments && adApartments.length > 0) {
        const adIds = (adApartments as any[]).map(aa => aa.advertisementId);
        await supabase
          .from('advertisements')
          .update({ createdBy: newManagerId } as any)
          .in('id', adIds)
          .eq('createdBy', viewingManager.id);
      }

      toast.success(`아파트가 ${newManagerName}님에게 완전 이전되었습니다.`);

      // 현재 보고 있는 매니저의 아파트 목록 업데이트
      setViewingManager({
        ...viewingManager,
        manager_apartments: viewingManager.manager_apartments?.filter(
          ma => ma.id !== managerApartmentId
        ),
      });

      // 전체 매니저 목록 새로고침
      fetchManagers();
      setTransferPopoverOpen(null);
    } catch (err) {
      console.error('Failed to transfer apartment:', err);
      toast.error('아파트 이전에 실패했습니다.');
    } finally {
      setTransferLoading(false);
    }
  };

  // 현재 매니저를 제외한 다른 매니저 목록
  const otherManagers = managers.filter(m => m.id !== viewingManager?.id);

  const filteredManagers = managers.filter(
    (manager) =>
      manager.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.phoneNumber?.includes(searchQuery)
  );

  const handleCreateDialogClose = (): void => {
    // Radix Dialog의 onOpenChange(false)와 동일한 정리 로직을 그대로 실행
    void (async (open: boolean) => {
    if (!open && uploadedCreateImage) {
      try {
        const bucket = 'managers';
        const path = uploadedCreateImage.split('/').slice(-3).join('/');
        await supabase.storage.from(bucket).remove([path]);
        console.log('Deleted unused uploaded image:', path);
      } catch (err) {
        console.error('Failed to delete uploaded image:', err);
      }
      setUploadedCreateImage('');
    }
    setIsCreateDialogOpen(open);
    if (!open) {
      setCreateForm({
        email: '',
        password: '',
        name: '',
        phoneNumber: '',
        address: '',
        businessRegistration: '',
        memo: '',
        approvalStatus: 'approve',
      });
      setShowPassword(false);
      setTempManagerId('');
    }
    })(false);
  };

  const handleEditDialogClose = (): void => {
    // Radix Dialog의 onOpenChange(false)와 동일한 정리 로직을 그대로 실행
    void (async (open: boolean) => {
    if (!open && uploadedEditImage) {
      try {
        const bucket = 'managers';
        const path = uploadedEditImage.split('/').slice(-3).join('/');
        await supabase.storage.from(bucket).remove([path]);
        console.log('Deleted unused uploaded image:', path);
      } catch (err) {
        console.error('Failed to delete uploaded image:', err);
      }
      setUploadedEditImage('');
    }
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingManagerId('');
      setEditForm({
        name: '',
        phoneNumber: '',
        address: '',
        businessRegistration: '',
        memo: '',
      });
    }
    })(false);
  };

  return (
    <PageShell>
      <AdminHeader title='매니저 관리' />

      <PageContent>
        {/* Managers Table */}
        <DataTableShell
          toolbar={
            <DataToolbar>
              {/* Search & Actions */}
              <TextInput
                placeholder='이름, 이메일, 전화번호로 검색...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<Search size={16} />}
                style={{ flex: 1 }}
                miw={240}
              />
              <DataToolbarActions>
                <Button
                  leftSection={<Plus size={16} />}
                  onClick={() => {
                    setTempManagerId(crypto.randomUUID());
                    setIsCreateDialogOpen(true);
                  }}
                >
                  매니저 추가
                </Button>
              </DataToolbarActions>
            </DataToolbar>
          }
        >
          <Table highlightOnHover verticalSpacing='sm' horizontalSpacing='md'>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>이름</Table.Th>
                <Table.Th>이메일</Table.Th>
                <Table.Th>전화번호</Table.Th>
                <Table.Th>관리 아파트</Table.Th>
                <Table.Th>일반/프리미엄</Table.Th>
                <Table.Th>등록일</Table.Th>
                <Table.Th ta='right'>작업</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={7} p={0}>
                    <TableSkeleton rows={8} columns={7} showHeader={false} />
                  </Table.Td>
                </Table.Tr>
              ) : filteredManagers.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} ta='center' py={48} c='dimmed'>
                    {searchQuery ? '검색 결과가 없습니다.' : '매니저가 없습니다.'}
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredManagers.map((manager) => (
                  <Table.Tr key={manager.id} style={{ cursor: 'pointer' }}>
                    <Table.Td
                      fw={500}
                      onClick={() => {
                        setViewingManager(manager);
                        setDetailDialog(true);
                      }}
                    >
                      {manager.name || '-'}
                    </Table.Td>
                    <Table.Td
                      c='dimmed'
                      onClick={() => {
                        setViewingManager(manager);
                        setDetailDialog(true);
                      }}
                    >
                      {manager.email}
                    </Table.Td>
                    <Table.Td
                      c='dimmed'
                      onClick={() => {
                        setViewingManager(manager);
                        setDetailDialog(true);
                      }}
                    >
                      {manager.phoneNumber || '-'}
                    </Table.Td>
                    <Table.Td
                      onClick={() => {
                        setViewingManager(manager);
                        setDetailDialog(true);
                      }}
                    >
                      {manager.manager_apartments && manager.manager_apartments.length > 0 ? (
                        <Badge variant='light' color='gray' leftSection={<Building2 size={12} />}>
                          {manager.manager_apartments.length}개 관리
                        </Badge>
                      ) : (
                        <Text component='span' size='sm' c='dimmed'>미지정</Text>
                      )}
                    </Table.Td>
                    <Table.Td
                      c='dimmed'
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                      onClick={() => {
                        setViewingManager(manager);
                        setDetailDialog(true);
                      }}
                    >
                      {(runningAdCounts[manager.id]?.basic ?? 0)}/{(runningAdCounts[manager.id]?.premium ?? 0)}
                    </Table.Td>
                    <Table.Td
                      c='dimmed'
                      onClick={() => {
                        setViewingManager(manager);
                        setDetailDialog(true);
                      }}
                    >
                      {new Date(manager.createdAt).toLocaleDateString('ko-KR')}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify='flex-end' wrap='nowrap'>
                        <ActionIcon
                          variant='subtle'
                          color='gray'
                          aria-label='상세 보기'
                          onClick={() => {
                            setViewingManager(manager);
                            setDetailDialog(true);
                          }}
                        >
                          <Eye size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant='subtle'
                          color='red'
                          aria-label='삭제'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(manager);
                          }}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </DataTableShell>
      </PageContent>

      {/* Create Dialog */}
      <Modal
        opened={isCreateDialogOpen}
        onClose={handleCreateDialogClose}
        title='매니저 추가'
        size={500}
      >
        <Text size='sm' c='dimmed'>
          새로운 매니저 계정을 생성합니다.
        </Text>

        <Stack gap='md' mt='md'>
          <TextInput
            id='email'
            label='이메일 *'
            type='email'
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            placeholder='manager@example.com'
          />

          <PasswordInput
            id='password'
            label='비밀번호 *'
            visible={showPassword}
            onVisibilityChange={() => setShowPassword(!showPassword)}
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            placeholder='최소 8자 이상, 특수문자 1개 포함'
          />

          <TextInput
            id='name'
            label='이름 *'
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder='홍길동'
          />

          <TextInput
            id='phoneNumber'
            label='전화번호'
            value={createForm.phoneNumber}
            onChange={(e) => setCreateForm({ ...createForm, phoneNumber: formatPhoneNumber(e.target.value) })}
            placeholder='010-1234-5678'
            maxLength={13}
          />

          <TextInput
            id='address'
            label='주소'
            value={createForm.address}
            onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
            placeholder='서울시 강남구...'
          />

          <Input.Wrapper label='사업자등록증 (선택)'>
            <ImageUpload
              bucket='managers'
              storagePath='business-registrations'
              value={createForm.businessRegistration}
              onChange={(url) => {
                setCreateForm({ ...createForm, businessRegistration: url });
                setUploadedCreateImage(url);
              }}
              accept='image/*'
              maxSizeMB={5}
              description='이미지 파일, 최대 5MB'
            />
          </Input.Wrapper>

          <Textarea
            id='memo'
            label='메모'
            value={createForm.memo}
            onChange={(e) => setCreateForm({ ...createForm, memo: e.target.value })}
            placeholder='영업 담당 지역, 특이사항 등'
            rows={3}
          />
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={handleCreateDialogClose}>
            취소
          </Button>
          <Button onClick={handleCreateManager}>
            생성
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title='매니저 삭제' closeOnClickOutside={!deleting} closeOnEscape={!deleting}>
        <Text size='sm' c='dimmed'>
          정말로 <strong>{deletingManager?.name || deletingManager?.email}</strong>님을 삭제하시겠습니까?
          <br />
          이 작업은 되돌릴 수 없으며, 해당 매니저의 모든 데이터가 삭제됩니다.
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDeleteDialog(false)} disabled={deleting}>
            취소
          </Button>
          <Button color='red' onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </Group>
      </Modal>

      {/* Edit Dialog */}
      <Modal
        opened={isEditDialogOpen}
        onClose={handleEditDialogClose}
        title='매니저 수정'
        size={500}
      >
        <Text size='sm' c='dimmed'>
          매니저 정보를 수정합니다.
        </Text>

        <Stack gap='md' mt='md'>
          <TextInput
            id='edit-name'
            label='이름 *'
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder='홍길동'
          />

          <TextInput
            id='edit-phoneNumber'
            label='전화번호'
            value={editForm.phoneNumber}
            onChange={(e) => setEditForm({ ...editForm, phoneNumber: formatPhoneNumber(e.target.value) })}
            placeholder='010-1234-5678'
            maxLength={13}
          />

          <TextInput
            id='edit-address'
            label='주소'
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            placeholder='서울시 강남구...'
          />

          <Input.Wrapper label='사업자등록증 (선택)'>
            <ImageUpload
              bucket='managers'
              storagePath='business-registrations'
              value={editForm.businessRegistration}
              onChange={(url) => {
                setEditForm({ ...editForm, businessRegistration: url });
                setUploadedEditImage(url);
              }}
              accept='image/*'
              maxSizeMB={5}
              description='이미지 파일, 최대 5MB'
            />
          </Input.Wrapper>

          <Textarea
            id='edit-memo'
            label='메모'
            value={editForm.memo}
            onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
            placeholder='영업 담당 지역, 특이사항 등'
            rows={3}
          />
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={handleEditDialogClose}>
            취소
          </Button>
          <Button onClick={handleUpdateManager}>
            저장
          </Button>
        </Group>
      </Modal>

      {/* Detail Dialog */}
      <Modal
        // 담당 변경 팝오버가 열려 있으면 ESC는 팝오버만 닫는다 (Radix와 동일)
        closeOnEscape={transferPopoverOpen === null}
        opened={detailDialog}
        onClose={() => setDetailDialog(false)}
        title='매니저 상세 정보'
        size={700}
      >
        <Text size='sm' c='dimmed'>
          매니저의 상세 정보를 확인할 수 있습니다.
        </Text>

        {viewingManager && (
          <Stack gap='xl' mt='md'>
            {/* 기본 정보 */}
            <Stack gap='md'>
              <Box pb='xs' style={{ borderBottom: '1px solid var(--app-divider)' }}>
                <Title order={4}>기본 정보</Title>
              </Box>
              <SimpleGrid cols={2} spacing='md'>
                <div>
                  <Text size='sm' c='dimmed'>이름</Text>
                  <Text fw={500}>{viewingManager.name || '-'}</Text>
                </div>
                <div>
                  <Text size='sm' c='dimmed'>이메일</Text>
                  <Text fw={500}>{viewingManager.email}</Text>
                </div>
                <div>
                  <Text size='sm' c='dimmed'>전화번호</Text>
                  <Text fw={500}>{viewingManager.phoneNumber || '-'}</Text>
                </div>
                <div>
                  <Text size='sm' c='dimmed'>등록일</Text>
                  <Text fw={500}>{new Date(viewingManager.createdAt).toLocaleDateString('ko-KR')}</Text>
                </div>
              </SimpleGrid>

              <div>
                <Group gap={4} c='dimmed'>
                  <MapPin size={16} />
                  <Text size='sm' c='dimmed'>주소</Text>
                </Group>
                <Text fw={500} mt={4}>{viewingManager.manager_profiles?.address || '-'}</Text>
              </div>

              <div>
                <Group gap={4} c='dimmed'>
                  <FileText size={16} />
                  <Text size='sm' c='dimmed'>메모</Text>
                </Group>
                <Paper bg='var(--app-bg-muted)' p='sm' radius='md' mt={4}>
                  <Text size='sm' style={{ whiteSpace: 'pre-wrap' }}>
                    {viewingManager.manager_profiles?.memo || '-'}
                  </Text>
                </Paper>
              </div>
            </Stack>

            {/* 사업자등록증 */}
            {viewingManager.manager_profiles?.businessRegistration && (
              <Stack gap='xs'>
                <Box pb='xs' style={{ borderBottom: '1px solid var(--app-divider)' }}>
                  <Title order={4}>사업자등록증</Title>
                </Box>
                {viewingManager.manager_profiles.businessRegistration.toLowerCase().endsWith('.pdf') ? (
                  <Paper withBorder radius='md' p='md' bg='var(--app-bg-muted)'>
                    <Group justify='space-between'>
                      <Group gap='xs'>
                        <Text c='blue' component='span' style={{ display: 'flex' }}>
                          <FileText size={20} />
                        </Text>
                        <Text component='span'>사업자등록증.pdf</Text>
                      </Group>
                      <Group gap='xs'>
                        <Button
                          variant='default'
                          size='xs'
                          onClick={() => window.open(viewingManager.manager_profiles?.businessRegistration, '_blank')}
                        >
                          열기
                        </Button>
                        <Button
                          variant='default'
                          size='xs'
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = viewingManager.manager_profiles?.businessRegistration || '';
                            link.download = '사업자등록증.pdf';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          다운로드
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ) : (
                  <Paper withBorder radius='md' bg='var(--app-bg-muted)' style={{ overflow: 'hidden' }}>
                    <img
                      src={viewingManager.manager_profiles.businessRegistration}
                      alt='사업자등록증'
                      className='w-full h-auto'
                    />
                  </Paper>
                )}
              </Stack>
            )}

            {/* 관리 아파트 */}
            <Stack gap='sm'>
              <Group
                justify='space-between'
                pb='xs'
                style={{ borderBottom: '1px solid var(--app-divider)' }}
              >
                <Title order={4}>관리 아파트</Title>
                {viewingManager.manager_apartments && viewingManager.manager_apartments.length > 0 && (
                  <Text size='sm' c='dimmed'>
                    총 {viewingManager.manager_apartments.length}개
                  </Text>
                )}
              </Group>
              {viewingManager.manager_apartments && viewingManager.manager_apartments.length > 0 ? (
                <Stack gap='xs'>
                  {viewingManager.manager_apartments.map((ma: any) => (
                    <Paper key={ma.id} bg='var(--app-bg-muted)' p='sm' radius='md'>
                      <Group justify='space-between' wrap='nowrap'>
                        <Group gap='sm' wrap='nowrap'>
                          <ThemeIcon variant='light' color='blue' size='lg' radius='md'>
                            <Building2 size={20} />
                          </ThemeIcon>
                          <div>
                            <Text fw={500}>{ma.apartments?.name}</Text>
                            <Text size='sm' c='dimmed'>{ma.apartments?.address}</Text>
                          </div>
                        </Group>

                        {/* 담당자 변경 버튼 */}
                        <Popover
                          opened={transferPopoverOpen === ma.id}
                          onChange={(open) => setTransferPopoverOpen(open ? ma.id : null)}
                          position='bottom-end'
                          width={320}
                          shadow='md'
                        >
                          <Popover.Target>
                            <Button
                              variant='default'
                              size='xs'
                              leftSection={<ArrowRightLeft size={16} />}
                              onClick={() => setTransferPopoverOpen(transferPopoverOpen === ma.id ? null : ma.id)}
                            >
                              담당 변경
                            </Button>
                          </Popover.Target>
                          <Popover.Dropdown p={0}>
                            <Box
                              p='sm'
                              bg='var(--app-bg-muted)'
                              style={{ borderBottom: '1px solid var(--app-divider)' }}
                            >
                              <Text size='sm' fw={500}>담당 매니저 변경</Text>
                              <Text size='xs' c='dimmed' mt={4}>
                                <Text span inherit fw={500}>{ma.apartments?.name}</Text>을(를) 다른 매니저에게 이전합니다.
                              </Text>
                            </Box>
                            <Box p='sm'>
                              <Select
                                searchable
                                autoFocus
                                placeholder='매니저 검색...'
                                nothingFoundMessage='매니저를 찾을 수 없습니다.'
                                leftSection={<Search size={16} />}
                                data={otherManagers.map((manager) => ({
                                  value: manager.id,
                                  label: manager.name || manager.email,
                                  disabled: transferLoading,
                                }))}
                                value={null}
                                onChange={(v) => {
                                  if (v === null) return;
                                  const manager = otherManagers.find((m) => m.id === v);
                                  if (!manager) return;
                                  handleTransferApartment(
                                    ma.id,
                                    ma.apartmentId,
                                    manager.id,
                                    manager.name || manager.email
                                  );
                                }}
                                allowDeselect={false}
                                maxDropdownHeight={200}
                                comboboxProps={{ withinPortal: false }}
                                renderOption={({ option }) => {
                                  const manager = otherManagers.find((m) => m.id === option.value);
                                  if (!manager) return option.label;
                                  return (
                                    <Group gap='sm' wrap='nowrap' w='100%'>
                                      <div style={{ flex: 1 }}>
                                        <Text size='sm' fw={500}>{manager.name || '-'}</Text>
                                        <Text size='xs' c='dimmed'>{manager.email}</Text>
                                      </div>
                                      {manager.manager_apartments && manager.manager_apartments.length > 0 && (
                                        <Badge variant='light' color='gray' size='sm'>
                                          {manager.manager_apartments.length}개 관리중
                                        </Badge>
                                      )}
                                    </Group>
                                  );
                                }}
                              />
                            </Box>
                            {transferLoading && (
                              <Group
                                p='sm'
                                gap='xs'
                                justify='center'
                                style={{ borderTop: '1px solid var(--app-divider)' }}
                              >
                                <Loader size={16} />
                                <Text size='sm' c='dimmed'>이전 중...</Text>
                              </Group>
                            )}
                          </Popover.Dropdown>
                        </Popover>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Stack align='center' gap='sm' py='xl' c='dimmed'>
                  <Building2 size={48} style={{ opacity: 0.2 }} />
                  <Text size='sm' c='dimmed'>관리 중인 아파트가 없습니다.</Text>
                </Stack>
              )}
            </Stack>
          </Stack>
        )}

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDetailDialog(false)}>
            닫기
          </Button>
          <Button
            leftSection={<Edit size={16} />}
            onClick={() => viewingManager && handleEditClick(viewingManager)}
          >
            수정
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
