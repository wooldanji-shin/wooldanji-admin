'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Image as ImageIcon,
  MoreVertical,
  Check,
  Trash2,
} from 'lucide-react';
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
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar } from '@/components/data-toolbar';
import { PageSkeleton, TableSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type User = Database['public']['Tables']['user']['Row'] & {
  user_roles?: Database['public']['Tables']['user_roles']['Row'][];
};

type Building = {
  id: string;
  buildingNumber: number;
};

type Line = {
  id: string;
  line: number[];
};

interface ApartmentDetails {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  buildings: Building[];
}

const ITEMS_PER_PAGE = 10;

export default function ApartmentUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [apartment, setApartment] = useState<ApartmentDetails | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // 통계
  const [buildingStats, setBuildingStats] = useState<Record<number, number>>({});
  const [unitStats, setUnitStats] = useState<Record<string, number>>({});
  const [totalOpenDoorCount, setTotalOpenDoorCount] = useState(0);

  const searchQuery = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');
  const selectedBuilding = searchParams.get('building') || '';
  const selectedLine = searchParams.get('line') || '';
  const selectedRole = searchParams.get('role') || '';

  useEffect(() => {
    setSearchInput(searchQuery);
  }, []);

  // 아파트 정보 및 동/라인 목록 로드
  const fetchApartmentInfo = useCallback(async () => {
    try {
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select(`
          id,
          name,
          address,
          createdAt,
          apartment_buildings (
            id,
            buildingNumber
          )
        `)
        .eq('id', resolvedParams.id)
        .single();

      if (apartmentError) throw apartmentError;

      const formattedApartment: ApartmentDetails = {
        id: (apartmentData as any).id,
        name: (apartmentData as any).name,
        address: (apartmentData as any).address,
        createdAt: (apartmentData as any).createdAt,
        buildings: ((apartmentData as any).apartment_buildings || []).map((b: any) => ({
          id: b.id,
          buildingNumber: b.buildingNumber,
        })),
      };

      setApartment(formattedApartment);

      // 선택된 동의 라인 목록 가져오기
      if (selectedBuilding) {
        const { data: linesData, error: linesError } = await supabase
          .from('apartment_lines')
          .select('id, line')
          .eq('buildingId', selectedBuilding)
          .order('line');

        if (linesError) throw linesError;
        setLines(linesData || []);
      } else {
        setLines([]);
      }
    } catch (err) {
      console.error('Failed to fetch apartment info:', err);
      toast.error('아파트 정보를 불러오는데 실패했습니다.');
    }
  }, [resolvedParams.id, selectedBuilding, supabase]);

  // 회원 목록 및 통계 로드
  const fetchUsers = useCallback(async () => {
    if (initialLoading) {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('user')
        .select(`
          *,
          user_roles(id, role, createdAt)
        `, { count: 'exact' })
        .eq('apartmentId', resolvedParams.id)
        .eq('registrationType', 'APARTMENT');

      // 검색 필터링
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%`);
      }

      // 동 필터링
      if (selectedBuilding) {
        const buildingNum = apartment?.buildings.find(b => b.id === selectedBuilding)?.buildingNumber;
        if (buildingNum) {
          query = query.eq('buildingNumber', buildingNum);
        }
      }

      // 라인 필터링 (호수의 끝자리로)
      // 클라이언트 사이드에서 필터링하기 위해 먼저 동 필터링까지만 적용
      // unit 필터링은 데이터 받은 후 처리

      // 페이지네이션
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error: fetchError } = await query
        .order('createdAt', { ascending: false });

      if (fetchError) throw fetchError;

      let filteredData = data || [];

      // 라인 필터링 (클라이언트 사이드)
      if (selectedLine) {
        const lineArray = lines.find(l => l.id === selectedLine)?.line;
        if (lineArray && lineArray.length > 0) {
          filteredData = filteredData.filter((user: any) => {
            if (!user.unit) return false;
            const unitMod = user.unit % 100;
            return lineArray.includes(unitMod);
          });
        }
      }

      // 회원유형(역할) 필터링 (클라이언트 사이드)
      if (selectedRole) {
        filteredData = filteredData.filter((user: any) =>
          user.user_roles?.some((r: any) => r.role === selectedRole)
        );
      }

      // 페이지네이션 적용
      const totalFiltered = filteredData.length;
      const paginatedData = filteredData.slice(from, to + 1);

      setUsers(paginatedData);
      setTotalCount(totalFiltered);

      // 통계 계산
      await fetchStats();
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('회원 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [searchQuery, currentPage, selectedBuilding, selectedLine, selectedRole, resolvedParams.id, apartment, lines, supabase, initialLoading]);

  // 통계 계산
  const fetchStats = async () => {
    try {
      // 동별 회원 수
      const { data: buildingData } = await supabase
        .from('user')
        .select('buildingNumber')
        .eq('apartmentId', resolvedParams.id)
        .eq('registrationType', 'APARTMENT');

      const buildingCounts: Record<number, number> = {};
      (buildingData || []).forEach((user: any) => {
        if (user.buildingNumber) {
          buildingCounts[user.buildingNumber] = (buildingCounts[user.buildingNumber] || 0) + 1;
        }
      });
      setBuildingStats(buildingCounts);

      // 호수별 회원 수
      const { data: unitData } = await supabase
        .from('user')
        .select('buildingNumber, unit')
        .eq('apartmentId', resolvedParams.id)
        .eq('registrationType', 'APARTMENT');

      const unitCounts: Record<string, number> = {};
      (unitData || []).forEach((user: any) => {
        if (user.buildingNumber && user.unit) {
          const key = `${user.buildingNumber}-${user.unit}`;
          unitCounts[key] = (unitCounts[key] || 0) + 1;
        }
      });
      setUnitStats(unitCounts);

      // 총 문 열기 횟수
      const { data: openDoorData } = await supabase
        .from('user')
        .select('openDoorCount')
        .eq('apartmentId', resolvedParams.id)
        .eq('registrationType', 'APARTMENT');

      const totalOpenCount = (openDoorData || []).reduce((sum: number, user: any) => {
        return sum + (user.openDoorCount || 0);
      }, 0);
      setTotalOpenDoorCount(totalOpenCount);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // 라인 배열을 문자열로 변환 (예: [1,2,3,4] -> "1~4")
  const formatLineDisplay = (lineArray: number[]): string => {
    if (!lineArray || lineArray.length === 0) return '';
    const sorted = [...lineArray].sort((a, b) => a - b);
    if (sorted.length === 1) return `${sorted[0]}`;
    return `${sorted[0]}~${sorted[sorted.length - 1]}`;
  };

  useEffect(() => {
    fetchApartmentInfo();
  }, [fetchApartmentInfo]);

  useEffect(() => {
    if (apartment) {
      fetchUsers();
    }
  }, [apartment, fetchUsers]);

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
    router.push(`/admin/apartments/${resolvedParams.id}/view${query}`);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      updateSearchParams({ search: value, page: '1' });
    }, 500);
  };

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

  const handleBuildingChange = (value: string) => {
    const buildingValue = value === 'all' ? '' : value;
    updateSearchParams({ building: buildingValue, line: '', page: '1' });
  };

  const handleLineChange = (value: string) => {
    const lineValue = value === 'all' ? '' : value;
    updateSearchParams({ line: lineValue, page: '1' });
  };

  const handleRoleChange = (value: string) => {
    const roleValue = value === 'all' ? '' : value;
    updateSearchParams({ role: roleValue, page: '1' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const getApprovalBadge = (status: string | null) => {
    switch (status) {
      case 'approve':
        return <Badge variant="light" color="green">승인</Badge>;
      case 'pending':
      default:
        return <Badge variant="light" color="gray">대기</Badge>;
    }
  };

  const getUserRole = (roles?: any[]) => {
    if (!roles || roles.length === 0) return '-';
    const roleMap: Record<string, string> = {
      'APP_USER': '앱 사용자',
      'APT_ADMIN': '아파트 관리자',
      'MANAGER': '매니저',
      'SUPER_ADMIN': '최고 관리자'
    };
    return roles.map(r => roleMap[r.role] || r.role).join(', ');
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

      fetchUsers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error(networkFailedMessage('승인 상태를 바꾸지 못했습니다.'));
    }
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    try {
      const { error } = await supabase
        .from('user')
        .delete()
        .eq('id', deletingUser.id);

      if (error) throw error;

      setDeleteDialog(false);
      setDeletingUser(null);
      toast.success('회원이 삭제되었습니다.');
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('회원 삭제에 실패했습니다.');
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (loading && initialLoading) {
    return <PageSkeleton stats={4} searchBar rows={8} columns={10} />;
  }

  if (!apartment) {
    return (
      <PageShell>
        <Paper withBorder radius="md" py={48} px="lg">
          <Text ta="center" c="dimmed">
            아파트 정보를 찾을 수 없습니다.
          </Text>
        </Paper>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderTitle title={apartment.name} onBack={() => router.push('/admin/apartments')} />

      {/* Apartment Info Card */}
      <Paper withBorder radius="md" p="lg">
        <Stack gap="lg">
          {/* 아파트 이름은 헤더에 있으니 여기서는 주소만 */}
          <Group gap={4} c="dimmed">
            <MapPin size={16} />
            <Text size="sm" c="dimmed">{apartment.address}</Text>
          </Group>
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md">
            <Paper bg="var(--app-bg-muted)" radius="md" p="sm">
              <Text size="sm" c="dimmed">총 동수</Text>
              <Text fz="1.5rem" fw={700}>{apartment.buildings.length}</Text>
            </Paper>
            <Paper bg="var(--app-bg-muted)" radius="md" p="sm">
              <Text size="sm" c="dimmed">전체 회원</Text>
              <Text fz="1.5rem" fw={700}>{totalCount}</Text>
            </Paper>
            <Paper bg="var(--app-bg-muted)" radius="md" p="sm">
              <Text size="sm" c="dimmed">선택된 동 회원</Text>
              <Text fz="1.5rem" fw={700}>
                {selectedBuilding && selectedBuilding !== 'all'
                  ? buildingStats[apartment.buildings.find(b => b.id === selectedBuilding)?.buildingNumber || 0] || 0
                  : totalCount}
              </Text>
            </Paper>
            <Paper bg="var(--app-bg-muted)" radius="md" p="sm">
              <Text size="sm" c="dimmed">최대 호수당 회원</Text>
              <Text fz="1.5rem" fw={700}>
                {Object.keys(unitStats).length > 0
                  ? Math.max(...Object.values(unitStats))
                  : 0}
              </Text>
            </Paper>
            <Paper
              bg="var(--mantine-color-blue-light)"
              radius="md"
              p="sm"
            >
              <Text size="sm" c="blue">총 문 연 횟수</Text>
              <Text fz="1.5rem" fw={700} c="blue">{totalOpenDoorCount}회</Text>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Paper>

      <DataTableShell
        toolbar={
          <DataToolbar>
            {/* Search and Filters */}
            <TextInput
              placeholder="이름, 이메일, 전화번호로 검색..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              leftSection={<Search size={16} />}
              style={{ flex: 1 }}
              miw={200}
            />
            <Group gap="xs">
              <Select
                w={150}
                placeholder="동 선택"
                value={selectedBuilding || 'all'}
                onChange={(v) => {
                  if (v === null) return;
                  handleBuildingChange(v);
                }}
                allowDeselect={false}
                data={[
                  { value: 'all', label: '전체 동' },
                  ...apartment.buildings.map((building) => ({
                    value: building.id,
                    label: `${building.buildingNumber}동`,
                  })),
                ]}
              />
              <Select
                w={150}
                placeholder="라인 선택"
                value={selectedLine || 'all'}
                onChange={(v) => {
                  if (v === null) return;
                  handleLineChange(v);
                }}
                allowDeselect={false}
                disabled={!selectedBuilding || selectedBuilding === 'all'}
                data={[
                  { value: 'all', label: '전체 라인' },
                  ...lines.map((line) => ({
                    value: line.id,
                    label: `${formatLineDisplay(line.line)}라인`,
                  })),
                ]}
              />
              <Select
                w={160}
                placeholder="회원유형"
                value={selectedRole || 'all'}
                onChange={(v) => {
                  if (v === null) return;
                  handleRoleChange(v);
                }}
                allowDeselect={false}
                data={[
                  { value: 'all', label: '전체 유형' },
                  { value: 'APP_USER', label: '앱 사용자' },
                  { value: 'APT_ADMIN', label: '아파트 관리자' },
                  { value: 'MANAGER', label: '매니저' },
                  { value: 'SUPER_ADMIN', label: '최고 관리자' },
                ]}
              />
            </Group>
          </DataToolbar>
        }
        pagination={
          totalPages > 1 ? (
            <Group
              justify="center"
              gap="xs"
              px="md"
              py="sm"
              style={{ borderTop: '1px solid var(--app-divider)' }}
            >
              <Button
                variant="default"
                size="xs"
                leftSection={<ChevronLeft size={16} />}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                이전
              </Button>
              <Group gap={4}>
                {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 10) {
                    pageNum = i + 1;
                  } else if (currentPage <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 4) {
                    pageNum = totalPages - 9 + i;
                  } else {
                    pageNum = currentPage - 4 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'filled' : 'default'}
                      size="xs"
                      onClick={() => handlePageChange(pageNum)}
                      w={36}
                      px={0}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </Group>
              <Button
                variant="default"
                size="xs"
                rightSection={<ChevronRight size={16} />}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                다음
              </Button>
            </Group>
          ) : undefined
        }
      >
        {/* Users Table */}
        {initialLoading && loading ? (
          <TableSkeleton rows={8} columns={10} />
        ) : (
        <Table.ScrollContainer minWidth={900} mih={400}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={48}>
                  사진
                </Table.Th>
                <Table.Th>
                  이름
                </Table.Th>
                <Table.Th>
                  이메일
                </Table.Th>
                <Table.Th>
                  전화번호
                </Table.Th>
                <Table.Th>
                  동/호
                </Table.Th>
                <Table.Th>
                  역할
                </Table.Th>
                <Table.Th>
                  승인상태
                </Table.Th>
                <Table.Th>
                  문 열기
                </Table.Th>
                <Table.Th>
                  가입일
                </Table.Th>
                <Table.Th ta="right">
                  작업
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} py={48} ta="center" c="dimmed">
                    {searchQuery ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                  </Table.Td>
                </Table.Tr>
              ) : (
                users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
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
                            color: 'var(--mantine-color-dimmed)',
                          }}
                        >
                          <img
                            src={user.confirmImageUrl}
                            alt={user.name || ''}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                            }}
                          />
                        </UnstyledButton>
                      ) : (
                        <ThemeIcon variant="light" color="gray" size={40} radius="xl">
                          <ImageIcon size={20} />
                        </ThemeIcon>
                      )}
                    </Table.Td>
                    <Table.Td fw={500}>
                      {user.name || '-'}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {user.email}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {user.phoneNumber || '-'}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      <Text span size="sm">
                        {user.buildingNumber ? `${user.buildingNumber}동` : ''}
                        {user.unit ? ` ${user.unit}호` : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {getUserRole(user.user_roles)}
                    </Table.Td>
                    <Table.Td>
                      {getApprovalBadge(user.approvalStatus)}
                    </Table.Td>
                    <Table.Td ta="center" c="dimmed">
                      {user.openDoorCount !== null && user.openDoorCount !== undefined ? (
                        <span>{user.openDoorCount}회</span>
                      ) : (
                        <span>-</span>
                      )}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {formatDate(user.createdAt)}
                    </Table.Td>
                    <Table.Td>
                      <Group justify="flex-end">
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label="작업">
                              <MoreVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {user.confirmImageUrl && (
                              <Menu.Item
                                leftSection={<Eye size={16} />}
                                onClick={() => setImagePreview(user.confirmImageUrl)}
                              >
                                인증 사진 보기
                              </Menu.Item>
                            )}
                            {user.approvalStatus !== 'approve' ? (
                              <Menu.Item
                                color="green"
                                leftSection={<Check size={16} />}
                                onClick={() => handleApprovalStatusChange(user.id, 'approve')}
                              >
                                승인하기
                              </Menu.Item>
                            ) : (
                              <Menu.Item
                                color="orange"
                                leftSection={<X size={16} />}
                                onClick={() => handleApprovalStatusChange(user.id, 'pending')}
                              >
                                승인 취소
                              </Menu.Item>
                            )}
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={16} />}
                              onClick={() => handleDeleteClick(user)}
                            >
                              삭제
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        )}
      </DataTableShell>

      {/* Image Preview Modal */}
      {imagePreview && (
        <Overlay
          fixed
          center
          zIndex={300}
          backgroundOpacity={0.8}
          p="xl"
          onClick={() => setImagePreview(null)}
        >
          <Box pos="relative" maw={896} mah="85vh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={imagePreview}
              alt="인증 사진"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              aria-label="닫기"
              pos="absolute"
              top={16}
              right={16}
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

      {/* Delete Confirmation Dialog */}
      <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title="회원 삭제">
        <Text size="sm" c="dimmed">
          정말로 <strong>{deletingUser?.name || deletingUser?.email}</strong>님을 삭제하시겠습니까?
          <br />
          이 작업은 되돌릴 수 없으며, 해당 회원의 모든 데이터가 삭제됩니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteDialog(false)}>
            취소
          </Button>
          <Button color="red" onClick={handleDeleteConfirm}>
            삭제
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
