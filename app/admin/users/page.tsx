'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar } from '@/components/data-toolbar';
import { READONLY_INPUT_STYLES } from '@/components/readonly-input-styles';
import { DataPagination } from '@/components/data-pagination';
import { TableSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Modal,
  Overlay,
  Select,
  SimpleGrid,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { Search, MoreVertical, Check, X, Eye, Image as ImageIcon, Ban, Download, Edit, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserFullDetails } from '@/lib/supabase/types';
import { getUserRoles } from '@/lib/auth';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';

const ITEMS_PER_PAGE = 15;

type Apartment = {
  id: string;
  name: string;
};

type Building = {
  id: string;
  buildingNumber: number;
};

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [users, setUsers] = useState<UserFullDetails[]>([]);
  const [partnerUserIds, setPartnerUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout>(null);

  // ESC 키로 이미지 미리보기 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && imagePreview) {
        e.preventDefault();
        e.stopPropagation();
        setImagePreview(null);
      }
    };

    if (imagePreview) {
      document.addEventListener('keydown', handleEscape, true); // capture phase에서 처리
      return () => document.removeEventListener('keydown', handleEscape, true);
    }
  }, [imagePreview]);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserFullDetails | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [, setHideOpenDoorColumn] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 전체보기/수정 다이얼로그
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailUser, setDetailUser] = useState<UserFullDetails | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // localStorage에서 문 연 횟수 컬럼 숨김 설정 불러오기
  useEffect(() => {
    const stored = localStorage.getItem('hideOpenDoorColumn');
    if (stored !== null) {
      setHideOpenDoorColumn(stored === 'true');
    }

    // storage 이벤트 리스너로 다른 페이지에서 변경 시 동기화
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hideOpenDoorColumn') {
        setHideOpenDoorColumn(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const searchQuery = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');
  const selectedApartment = searchParams.get('apartment') || '';
  const selectedBuilding = searchParams.get('building') || '';
  const selectedRegistrationType = searchParams.get('type') || '';

  // 초기 로드시 URL의 검색어를 input에 설정
  useEffect(() => {
    setSearchInput(searchQuery);
  }, []);

  // 아파트 목록 로드
  const fetchApartments = useCallback(async () => {
    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isManager = roles.includes('MANAGER');

      let query = supabase
        .from('apartments')
        .select('id, name')
        .order('name');

      // 매니저인 경우 자신이 관리하는 아파트만 필터링
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            const apartmentIds = managerApartments.map(ma => ma.apartmentId);
            query = query.in('id', apartmentIds);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setApartments([]);
            return;
          }
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setApartments(data || []);
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
    }
  }, [supabase]);

  // 선택된 아파트의 동 목록 로드
  const fetchBuildings = useCallback(async () => {
    if (!selectedApartment) {
      setBuildings([]);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('apartment_buildings')
        .select('id, buildingNumber')
        .eq('apartmentId', selectedApartment)
        .order('buildingNumber');

      if (fetchError) throw fetchError;
      setBuildings(data || []);
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
      setBuildings([]);
    }
  }, [selectedApartment, supabase]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  const fetchUsers = useCallback(async () => {
    // 초기 로딩이 아닌 경우 로딩 표시 안 함 (검색이나 페이지네이션)
    if (initialLoading) {
      setLoading(true);
    }

    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isManager = roles.includes('MANAGER');

      // 파트너 userId 목록 조회 (user ↔ partner_users 간 FK 없어서 별도 조회)
      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('userId');
      const partnerIds = (partnerData || []).map((p: any) => p.userId);
      setPartnerUserIds(new Set(partnerIds));

      let query = supabase
        .from('user')
        .select(`
          *,
          user_roles!inner(id, role, createdAt),
          apartments:apartmentId(id, name, address)
        `, { count: 'exact' })
        .eq('user_roles.role', 'APP_USER'); // APP_USER만 필터링

      // 매니저인 경우 자신이 관리하는 아파트의 회원만 필터링
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            const apartmentIds = managerApartments.map(ma => ma.apartmentId);
            query = query.in('apartmentId', apartmentIds);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setUsers([]);
            setTotalCount(0);
            setLoading(false);
            return;
          }
        }
      }

      // 검색 필터링
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%`);
      }

      // 아파트 필터링
      if (selectedApartment) {
        query = query.eq('apartmentId', selectedApartment);
      }

      // 동 필터링
      if (selectedBuilding) {
        const buildingNum = buildings.find(b => b.id === selectedBuilding)?.buildingNumber;
        if (buildingNum) {
          query = query.eq('buildingNumber', buildingNum);
        }
      }

      // 회원유형 필터링
      if (selectedRegistrationType === 'PARTNER') {
        if (partnerIds.length > 0) {
          query = query.in('id', partnerIds);
        } else {
          setUsers([]);
          setTotalCount(0);
          setLoading(false);
          setInitialLoading(false);
          return;
        }
      } else if (selectedRegistrationType) {
        query = query.eq('registrationType', selectedRegistrationType);
      }

      // 페이지네이션
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error: fetchError, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('회원 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [searchQuery, currentPage, selectedApartment, selectedBuilding, selectedRegistrationType, buildings, supabase, initialLoading]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // CSV 내보내기 함수
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const roles = await getUserRoles();
      const isManager = roles.includes('MANAGER');

      // 매니저인 경우 아파트 ID 목록 먼저 가져오기
      let apartmentIds: string[] = [];
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            apartmentIds = managerApartments.map((ma: any) => ma.apartmentId);
          } else {
            toast.error('관리하는 아파트가 없습니다.');
            setExporting(false);
            return;
          }
        }
      }

      // 페이지네이션으로 모든 데이터 가져오기
      const allData: any[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        let query = supabase
          .from('user')
          .select(`
            *,
            user_roles!inner(id, role, createdAt),
            apartments:apartmentId(id, name, address)
          `)
          .eq('user_roles.role', 'APP_USER')
          .order('createdAt', { ascending: false })
          .range(from, from + pageSize - 1);

        if (isManager && apartmentIds.length > 0) {
          query = query.in('apartmentId', apartmentIds);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData.push(...data);
        if (data.length < pageSize) break; // 마지막 페이지
        from += pageSize;
      }

      if (allData.length === 0) {
        toast.error('내보낼 회원 데이터가 없습니다.');
        setExporting(false);
        return;
      }

      const data = allData;

      // CSV 헤더
      const headers = [
        '이름',
        '이메일',
        '전화번호',
        '회원유형',
        '아파트',
        '동',
        '호',
        '승인상태',
        '문 연 횟수',
        '가입일',
      ];

      // CSV 데이터 생성
      const csvRows = data.map((user: any) => {
        const apartment = user.apartments as any;
        const registrationType = user.registrationType === 'APARTMENT' ? '아파트' : '일반';
        const approvalStatus = user.approvalStatus === 'approve' ? '승인' :
                               user.approvalStatus === 'pending' ? '대기' :
                               user.approvalStatus === 'rejected' ? '거절' : user.approvalStatus;
        const createdAt = new Date(user.createdAt).toLocaleDateString('ko-KR');

        return [
          user.name || '',
          user.email || '',
          user.phoneNumber || '',
          registrationType,
          apartment?.name || '',
          user.buildingNumber || '',
          user.unit || '',
          approvalStatus,
          user.openDoorCount || 0,
          createdAt,
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });

      // CSV 파일 생성
      const BOM = '\uFEFF';
      const csvContent = BOM + [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // 다운로드
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      link.download = `회원목록_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${data.length}명의 회원 데이터를 내보냈습니다.`);
    } catch (err) {
      console.error('CSV export failed:', err);
      toast.error('CSV 내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const updateSearchParams = (params: Record<string, string>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });

    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`/admin/users${query}`);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);

    // 이전 타이머 취소
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 디바운스 적용 (500ms)
    debounceTimer.current = setTimeout(() => {
      updateSearchParams({ search: value, page: '1' });
    }, 500);
  };

  // 컴포넌트 언마운트시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: newPage.toString() });
  };

  const handleApartmentChange = (value: string) => {
    const apartmentValue = value === 'all' ? '' : value;
    updateSearchParams({ apartment: apartmentValue, building: '', page: '1' });
  };

  const handleBuildingChange = (value: string) => {
    const buildingValue = value === 'all' ? '' : value;
    updateSearchParams({ building: buildingValue, page: '1' });
  };

  const handleRegistrationTypeChange = (value: string) => {
    const typeValue = value === 'all' ? '' : value;
    updateSearchParams({ type: typeValue, page: '1' });
  };

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
      // 목록 갱신
      fetchUsers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error(networkFailedMessage('승인 상태를 바꾸지 못했습니다.'));
    }
  };

  const handleSuspendClick = (user: UserFullDetails) => {
    setSuspendingUser(user);
    setSuspensionReason('');
    setSuspendDialog(true);
  };

  const handleSuspendConfirm = async () => {
    if (!suspendingUser) return;

    if (!suspensionReason.trim()) {
      toast.error('보류 사유를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/users/${suspendingUser.id}/suspend`, {
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

      toast.success('회원이 승인 보류 처리되었습니다.');
      setSuspendDialog(false);
      setSuspendingUser(null);
      setSuspensionReason('');
      fetchUsers();
    } catch (err) {
      console.error('Failed to suspend user:', err);
      toast.error(networkFailedMessage('승인 보류 처리를 하지 못했습니다.'));
    }
  };

  // 전체보기 다이얼로그 열기
  const handleDetailClick = (user: UserFullDetails) => {
    setDetailUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      detailAddress: user.detailAddress || '',
      birthDay: user.birthDay || '',
      buildingNumber: user.buildingNumber || '',
      unit: user.unit || '',
      approvalStatus: user.approvalStatus || 'pending',
      registrationType: user.registrationType || '',
      premium: user.premium || false,
      premiumExpiryDate: user.premiumExpiryDate ? user.premiumExpiryDate.split('T')[0] : '',
      openDoorCount: user.openDoorCount || 0,
      shareUserCount: user.shareUserCount || 0,
      rssLevel: user.rssLevel || 0,
      suspensionReason: user.suspensionReason || '',
      regionSido: user.regionSido || '',
      regionSigungu: user.regionSigungu || '',
      regionDong: user.regionDong || '',
    });
    setDetailDialog(true);
  };

  // 호수에서 라인 추출 (끝 2자리)
  const getLineFromUnit = (unit: number): number => {
    return unit % 100;
  };

  // 전체보기 저장
  const handleDetailSave = async () => {
    if (!detailUser) return;

    setSaving(true);
    try {
      const newUnit = editForm.unit ? parseInt(editForm.unit) : null;
      const newBuildingNumber = editForm.buildingNumber ? parseInt(editForm.buildingNumber) : null;

      // 호수가 변경되었고, 아파트 회원인 경우 라인 검증
      if (newUnit && detailUser.apartmentId && newBuildingNumber) {
        const lineFromUnit = getLineFromUnit(newUnit);

        // 해당 아파트의 동 정보 조회
        const { data: buildingData } = await supabase
          .from('apartment_buildings')
          .select('id')
          .eq('apartmentId', detailUser.apartmentId)
          .eq('buildingNumber', newBuildingNumber)
          .single();

        if (buildingData) {
          // 해당 동의 라인 정보 조회
          const { data: linesData } = await supabase
            .from('apartment_lines')
            .select('line')
            .eq('buildingId', buildingData.id);

          if (linesData && linesData.length > 0) {
            // 모든 라인 배열에서 해당 라인이 있는지 확인
            const allLines = linesData.flatMap((l: { line: number[] }) => l.line);
            if (!allLines.includes(lineFromUnit)) {
              toast.error('해당 호수는 등록할 수 없습니다.');
              setSaving(false);
              return;
            }
          }
        }
      }

      const updateData: Record<string, any> = {
        name: editForm.name || null,
        phoneNumber: editForm.phoneNumber || null,
        birthDay: editForm.birthDay || null,
        buildingNumber: newBuildingNumber,
        unit: newUnit,
        openDoorCount: parseInt(editForm.openDoorCount) || 0,
        rssLevel: parseInt(editForm.rssLevel) || 0,
      };

      const { error } = await supabase
        .from('user')
        .update(updateData)
        .eq('id', detailUser.id);

      if (error) throw error;

      toast.success('회원 정보가 수정되었습니다.');
      setDetailDialog(false);
      setDetailUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error('회원 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
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

  const getRegistrationTypeBadge = (type: string | null) => {
    switch (type) {
      case 'APARTMENT':
        return <Badge variant="light" color="blue">아파트</Badge>;
      case 'GENERAL':
        return <Badge variant="light" color="gray">일반</Badge>;
      default:
        return <Badge variant="light" color="gray">-</Badge>;
    }
  };


  const getRegisterMethodBadge = (method: string | null) => {
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="회원 관리"
          description="등록된 회원 정보를 검색하고 관리합니다."
        />
        <PageHeaderActions>
          <Button
            variant='default'
            onClick={handleExportCSV}
            disabled={exporting || totalCount === 0}
            leftSection={<Download size={16} />}
          >
            {exporting ? '내보내는 중...' : 'CSV 내보내기'}
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <DataToolbar>
              <TextInput
                placeholder='이름, 이메일, 전화번호로 검색...'
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                leftSection={<Search size={16} />}
                w={{ base: '100%', lg: 300 }}
              />

              <Select
                placeholder='아파트 선택'
                data={[
                  { value: 'all', label: '전체 아파트' },
                  ...apartments.map((apartment) => ({ value: apartment.id, label: apartment.name })),
                ]}
                value={selectedApartment || 'all'}
                onChange={(v) => {
                  if (v === null) return;
                  handleApartmentChange(v);
                }}
                allowDeselect={false}
                w={{ base: '100%', lg: 200 }}
              />

              <Select
                placeholder='동 선택'
                data={[
                  { value: 'all', label: '전체 동' },
                  ...buildings.map((building) => ({ value: building.id, label: `${building.buildingNumber}동` })),
                ]}
                value={selectedBuilding || 'all'}
                onChange={(v) => {
                  if (v === null) return;
                  handleBuildingChange(v);
                }}
                allowDeselect={false}
                disabled={!selectedApartment || selectedApartment === 'all'}
                w={{ base: '100%', lg: 150 }}
              />

              <Select
                placeholder='회원유형'
                data={[
                  { value: 'all', label: '전체 유형' },
                  { value: 'APARTMENT', label: '아파트' },
                  { value: 'GENERAL', label: '일반' },
                  { value: 'PARTNER', label: '파트너' },
                ]}
                value={selectedRegistrationType || 'all'}
                onChange={(v) => {
                  if (v === null) return;
                  handleRegistrationTypeChange(v);
                }}
                allowDeselect={false}
                w={{ base: '100%', lg: 150 }}
              />

            </DataToolbar>
          }
          summary={
            <Text size="sm" c="dimmed">
              전체 <Text span fw={700} c="var(--mantine-color-text)">{totalCount}</Text>명
            </Text>
          }
        >
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
                    onClick={() => handleDetailClick(user)}
                  >
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      {user.confirmImageUrl ? (
                        <UnstyledButton
                          onClick={() => setImagePreview(user.confirmImageUrl)}
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
                              onClick={() => handleApprovalStatusChange(user.id, 'approve')}
                            >
                              승인
                            </Button>
                            <Button
                              variant='subtle'
                              color='yellow'
                              size='compact-sm'
                              leftSection={<Ban size={12} />}
                              onClick={() => handleSuspendClick(user)}
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
                              onClick={() => handleDetailClick(user)}
                            >
                              전체보기
                            </Menu.Item>
                            {user.confirmImageUrl && (
                              <Menu.Item
                                leftSection={<Eye size={16} />}
                                onClick={() => setImagePreview(user.confirmImageUrl)}
                              >
                                인증 사진 보기
                              </Menu.Item>
                            )}
                            {user.registrationType === 'APARTMENT' && user.approvalStatus === 'approve' && (
                              <Menu.Item
                                color='orange'
                                leftSection={<X size={16} />}
                                onClick={() => handleApprovalStatusChange(user.id, 'pending')}
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
        </DataTableShell>

        {/* Pagination */}
        {totalPages > 1 && (
          <DataPagination
            page={currentPage}
            pageSize={ITEMS_PER_PAGE}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        )}
      </PageContent>

      {/* Image Preview Modal */}
      {imagePreview && (
        <Overlay
          fixed
          center
          zIndex={9999}
          backgroundOpacity={0.8}
          p="xl"
          onClick={(e) => {
            e.stopPropagation();
            setImagePreview(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Box
            pos='relative'
            maw={896}
            mah='85vh'
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imagePreview}
              alt='인증 사진'
              className='object-contain'
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()}
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
                e.preventDefault();
                e.stopPropagation();
                setImagePreview(null);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
          <strong>{suspendingUser?.name || suspendingUser?.email}</strong>님의 승인을 보류하시겠습니까?
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

      {/* 전체보기/수정 다이얼로그 */}
      <Modal
        opened={detailDialog}
        onClose={() => setDetailDialog(false)}
        title='회원 전체보기'
        size='xl'
      >
        <Text size='sm' c='dimmed'>
          회원 정보를 확인하고 수정할 수 있습니다.
        </Text>

        <SimpleGrid cols={2} spacing='md' mt='md'>
          {/* 기본 정보 */}
          <TextInput
            id='detail-name'
            label='이름'
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <TextInput
            id='detail-email'
            label='이메일'
            value={editForm.email}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            id='detail-phone'
            label='전화번호'
            value={editForm.phoneNumber}
            onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
          />
          <TextInput
            id='detail-birthday'
            label='생년월일'
            value={editForm.birthDay}
            onChange={(e) => setEditForm({ ...editForm, birthDay: e.target.value })}
            placeholder='YYYY-MM-DD'
          />

          {/* 아파트 정보 */}
          <TextInput
            id='detail-apartment'
            label='아파트'
            value={detailUser?.apartments?.name || '-'}
            disabled
            styles={READONLY_INPUT_STYLES}
            style={{ gridColumn: 'span 2' }}
          />
          <TextInput
            id='detail-building'
            label='동'
            type='text'
            inputMode='numeric'
            value={editForm.buildingNumber}
            onChange={(e) => setEditForm({ ...editForm, buildingNumber: e.target.value })}
          />
          <TextInput
            id='detail-unit'
            label='호'
            type='text'
            inputMode='numeric'
            value={editForm.unit}
            onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
          />

          {/* 지역 정보  */}
          <TextInput
            id='detail-address'
            label='주소'
            value={editForm.address}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            id='detail-sido'
            label='시/도'
            value={editForm.regionSido}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            id='detail-sigungu'
            label='시/군/구'
            value={editForm.regionSigungu}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <TextInput
            id='detail-dong'
            label='읍/면/동'
            value={editForm.regionDong}
            disabled
            styles={READONLY_INPUT_STYLES}
          />

          {/* 상태 정보  */}
          <Select
            id='detail-registrationType'
            label='회원유형'
            data={[
              { value: 'APARTMENT', label: '아파트' },
              { value: 'GENERAL', label: '일반' },
            ]}
            value={editForm.registrationType || null}
            allowDeselect={false}
            disabled
            styles={READONLY_INPUT_STYLES}
          />
          <Select
            id='detail-approvalStatus'
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

          {/* 카운트 정보 */}
          <TextInput
            id='detail-openDoorCount'
            label='문 연 횟수'
            type='text'
            inputMode='numeric'
            value={editForm.openDoorCount}
            onChange={(e) => setEditForm({ ...editForm, openDoorCount: e.target.value })}
          />
          <TextInput
            id='detail-rssLevel'
            label='RSS 레벨'
            type='text'
            inputMode='numeric'
            value={editForm.rssLevel}
            onChange={(e) => setEditForm({ ...editForm, rssLevel: e.target.value })}
          />
        </SimpleGrid>

        {/* 읽기 전용 정보 */}
        <Divider my='md' />
        <Text size='sm' c='dimmed' mb='xs'>읽기 전용 정보</Text>
        <SimpleGrid cols={2} spacing='md'>
          <Text size='sm'>
            <Text span c='dimmed' inherit>가입일: </Text>
            {detailUser?.createdAt ? formatDate(detailUser.createdAt) : '-'}
          </Text>
          <Text size='sm'>
            <Text span c='dimmed' inherit>플랫폼: </Text>
            {detailUser?.platform || '-'}
          </Text>
        </SimpleGrid>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDetailDialog(false)} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={handleDetailSave}
            disabled={saving}
            leftSection={saving ? <Loader2 size={16} className='animate-spin' /> : undefined}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
