'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Building2,
  Cpu,
  Users,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Home,
  DoorOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbarSearch } from '@/components/data-toolbar';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { StatCard } from '@/components/stat-card';
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles } from '@/lib/auth';

interface Apartment {
  id: string;
  name: string;
  address: string;
  buildingCount: number;
  totalUnits: number;
  totalDevices: number;
  memberCount: number;
  totalOpenDoorCount: number;
  basicAdCount: number;
  premiumAdCount: number;
  lineRanges: { id: string; line: number[] }[];
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByPhone: string | null;
  status: 'active' | 'pending' | 'inactive';
  isAdEnabled: boolean;
}

type SortField = 'name' | 'buildingCount' | 'totalUnits' | 'totalDevices' | 'memberCount' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function ApartmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingApartment, setDeletingApartment] = useState<Apartment | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const currentPage = parseInt(searchParams.get('page') || '1');
  const setCurrentPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(p));
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [hideOpenDoorColumn, setHideOpenDoorColumn] = useState(false);
  const ITEMS_PER_PAGE = 15;

  // localStorage에서 문 연 횟수 컬럼 숨김 설정 불러오기
  useEffect(() => {
    const stored = localStorage.getItem('hideOpenDoorColumn');
    if (stored !== null) {
      setHideOpenDoorColumn(stored === 'true');
    }
  }, []);

  // 체크박스 변경 시 localStorage에 저장
  const handleHideOpenDoorColumnChange = (checked: boolean) => {
    setHideOpenDoorColumn(checked);
    localStorage.setItem('hideOpenDoorColumn', String(checked));
  };

  useEffect(() => {
    fetchApartments();
  }, []);

  const fetchApartments = async () => {
    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isManager = roles.includes('MANAGER');

      let query = supabase
        .from('apartments')
        .select(`
          id,
          name,
          address,
          createdAt,
          createdBy,
          isAdEnabled,
          user:createdBy (
            name,
            phoneNumber
          ),
          apartment_buildings (
            id,
            buildingNumber,
            householdsCount,
            apartment_lines (
              id,
              line,
              apartment_line_places (
                id,
                devices (
                  id
                )
              )
            )
          )
        `);

      // 아파트별 문 열기 횟수 합계 (RPC로 DB 집계 → 행 제한 없음)
      const { data: openDoorCounts } = await supabase
        .rpc('get_apartment_open_door_counts');

      const openDoorCountMap = new Map<string, number>(
        (openDoorCounts || []).map((r: { apartment_id: string; total_open_door_count: number }) => [
          r.apartment_id,
          r.total_open_door_count,
        ])
      );

      // 아파트별 회원수 (RPC로 DB 집계 → 행 제한 없음)
      const { data: memberCounts } = await supabase
        .rpc('get_apartment_member_counts');

      const memberCountMap = new Map<string, number>(
        (memberCounts || []).map((r: { apartment_id: string; member_count: number }) => [
          r.apartment_id,
          r.member_count,
        ])
      );

      // 아파트별 running 광고 수 (RPC로 DB 집계)
      const { data: adCounts } = await supabase
        .rpc('get_apartment_running_ad_counts');

      const adCountMap = new Map<string, { basic: number; premium: number }>(
        (adCounts || []).map((r: { apartment_id: string; basic_running_count: number; premium_running_count: number }) => [
          r.apartment_id,
          { basic: r.basic_running_count, premium: r.premium_running_count },
        ])
      );

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
            // 관리하는 아파트가 없으면 빈 결과 반환
            setApartments([]);
            setLoading(false);
            return;
          }
        }
      }

      const { data: apartmentsData, error: apartmentsError } = await query;

      if (apartmentsError) throw apartmentsError;

      // 데이터 변환
      const formattedApartments = apartmentsData?.map(apt => {
        const buildings = apt.apartment_buildings || [];
        const buildingCount = buildings.length;
        const totalUnits = buildings.reduce((sum: number, b: any) => sum + b.householdsCount, 0);

        // 모든 라인 범위 수집 (line은 이제 number[] 배열)
        const lineRanges: { id: string; line: number[] }[] = [];
        buildings.forEach((b: any) => {
          b.apartment_lines?.forEach((l: any) => {
            if (l.line && Array.isArray(l.line)) {
              lineRanges.push({ id: l.id, line: l.line });
            }
          });
        });

        // 기기 수 계산
        let totalDevices = 0;
        buildings.forEach((b: any) => {
          b.apartment_lines?.forEach((l: any) => {
            l.apartment_line_places?.forEach((p: any) => {
              totalDevices += (p.devices?.length || 0);
            });
          });
        });

        // 회원 수 계산 (RPC 집계 결과에서 조회)
        const memberCount = memberCountMap.get(apt.id) ?? 0;

        // 총 문 열기 횟수 (RPC 집계 결과에서 조회)
        const totalOpenDoorCount = openDoorCountMap.get(apt.id) ?? 0;

        // 광고 수 (RPC 집계 결과에서 조회)
        const adCount = adCountMap.get(apt.id) ?? { basic: 0, premium: 0 };

        return {
          id: apt.id,
          name: apt.name,
          address: apt.address,
          buildingCount,
          totalUnits,
          totalDevices,
          memberCount,
          totalOpenDoorCount,
          basicAdCount: adCount.basic,
          premiumAdCount: adCount.premium,
          lineRanges,
          createdAt: new Date(apt.createdAt).toLocaleDateString('ko-KR'),
          createdBy: (apt as any).createdBy || null,
          createdByName: (apt as any).user?.name || null,
          createdByPhone: (apt as any).user?.phoneNumber || null,
          status: 'active' as const,
          isAdEnabled: (apt as any).isAdEnabled ?? true,
        };
      }) || [];

      setApartments(formattedApartments);
    } catch (error) {
      console.error('Failed to fetch apartments:', error);
    } finally {
      setLoading(false);
    }
  };

  // 정렬 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 정렬 아이콘 렌더링
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={16} style={{ marginLeft: 4 }} />;
    return sortDirection === 'asc'
      ? <ArrowUp size={16} style={{ marginLeft: 4 }} />
      : <ArrowDown size={16} style={{ marginLeft: 4 }} />;
  };

  // 필터링 및 정렬
  const filteredApartments = apartments
    .filter(
      (apt) =>
        apt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // 날짜 정렬을 위해 변환
      if (sortField === 'createdAt') {
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredApartments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedApartments = filteredApartments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 검색 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // 회원이 소속된 아파트는 DB FK 제약(user.apartmentId)으로 삭제가 거부된다
  const hasMembers = (deletingApartment?.memberCount ?? 0) > 0;

  const handleDeleteClick = (apartment: Apartment) => {
    setDeletingApartment(apartment);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingApartment) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('id', deletingApartment.id);

      if (error) throw error;

      setApartments(apartments.filter(apt => apt.id !== deletingApartment.id));
      setDeleteDialog(false);
      setDeletingApartment(null);
      toast.success('아파트가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete apartment:', error);
      // 23503 = FK 위반. 회원·파트너 신청 등이 아직 이 아파트를 참조하는 경우다.
      const isReferenced = (error as { code?: string })?.code === '23503';
      toast.error(
        isReferenced
          ? '이 아파트를 참조하는 데이터가 남아 있어 삭제할 수 없습니다. 소속 회원을 먼저 다른 아파트로 이동시켜 주세요.'
          : '아파트 삭제 중 오류가 발생했습니다.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleAdEnabled = async (id: string, isAdEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ isAdEnabled })
        .eq('id', id);

      if (error) throw error;

      setApartments(prev => prev.map(a => a.id === id ? { ...a, isAdEnabled } : a));
      toast.success(isAdEnabled ? '광고가 활성화되었습니다.' : '광고가 비활성화되었습니다.');
    } catch (error) {
      console.error('Failed to toggle ad enabled:', error);
      toast.error('광고 활성화 상태 변경 중 오류가 발생했습니다.');
    }
  };

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="아파트 관리"
          description="등록된 아파트 정보를 관리합니다."
        />
        <PageHeaderActions>
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => router.push('/admin/apartments/new')}
          >
            새 아파트 등록
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        {/* 전체 합계 통계 카드 */}
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <StatCard
            label="총 세대수"
            icon={Home}
            accent="primary"
            value={loading ? '-' : apartments.reduce((sum, apt) => sum + apt.totalUnits, 0).toLocaleString()}
          />
          <StatCard
            label="총 기기수"
            icon={Cpu}
            accent="info"
            value={loading ? '-' : apartments.reduce((sum, apt) => sum + apt.totalDevices, 0).toLocaleString()}
          />
          <StatCard
            label="총 회원수"
            icon={Users}
            accent="success"
            value={loading ? '-' : apartments.reduce((sum, apt) => sum + apt.memberCount, 0).toLocaleString()}
          />
          <StatCard
            label="총 문 연 횟수"
            icon={DoorOpen}
            accent="warning"
            value={loading ? '-' : apartments.reduce((sum, apt) => sum + apt.totalOpenDoorCount, 0).toLocaleString()}
          />
        </SimpleGrid>

        <DataTableShell
          toolbar={
            <Group gap="xs" justify="space-between">
              <DataToolbarSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="아파트명 또는 주소로 검색..."
              />
              <Checkbox
                id="hide-open-door-column"
                label="문 연 횟수 숨기기"
                checked={hideOpenDoorColumn}
                onChange={(e) => handleHideOpenDoorColumnChange(e.currentTarget.checked)}
                styles={{ label: { color: 'var(--mantine-color-dimmed)' } }}
              />
            </Group>
          }
          summary={
            <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
              총 <Text span fw={700} c="var(--mantine-color-text)">{filteredApartments.length.toLocaleString()}</Text>개
            </Text>
          }
          pagination={
            !loading && totalPages > 1 ? (
              <ApartmentsPagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            ) : undefined
          }
        >
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  <Group gap={0} wrap="nowrap">
                    아파트명
                    {getSortIcon('name')}
                  </Group>
                </Table.Th>
                <Table.Th>주소</Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('buildingCount')}>
                  <Group gap={0} justify="center" wrap="nowrap">
                    동수
                    {getSortIcon('buildingCount')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalUnits')}>
                  <Group gap={0} justify="center" wrap="nowrap">
                    세대수
                    {getSortIcon('totalUnits')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalDevices')}>
                  <Group gap={0} justify="center" wrap="nowrap">
                    기기수
                    {getSortIcon('totalDevices')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('memberCount')}>
                  <Group gap={0} justify="center" wrap="nowrap">
                    회원수
                    {getSortIcon('memberCount')}
                  </Group>
                </Table.Th>
                {!hideOpenDoorColumn && (
                  <Table.Th ta="center">
                    문 연 횟수
                  </Table.Th>
                )}
                <Table.Th ta="center">
                  기본광고
                </Table.Th>
                <Table.Th ta="center">
                  프리미엄
                </Table.Th>
                <Table.Th ta="center">
                  광고
                </Table.Th>
                <Table.Th ta="center">
                  매니저
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>
                  <Group gap={0} justify="center" wrap="nowrap">
                    등록일
                    {getSortIcon('createdAt')}
                  </Group>
                </Table.Th>
                <Table.Th ta="right">관리</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={hideOpenDoorColumn ? 12 : 13} p={0}>
                    <TableSkeleton rows={6} columns={hideOpenDoorColumn ? 11 : 12} showHeader={false} />
                  </Table.Td>
                </Table.Tr>
              ) : filteredApartments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={hideOpenDoorColumn ? 12 : 13} p={0}>
                    <EmptyState
                      icon={Building2}
                      title={searchTerm ? '검색 결과가 없습니다' : '등록된 아파트가 없습니다'}
                      description={
                        searchTerm
                          ? '다른 검색어로 다시 시도해보세요.'
                          : '새 아파트를 등록하여 관리할 수 있습니다.'
                      }
                      size="sm"
                    />
                  </Table.Td>
                </Table.Tr>
              ) : (
                paginatedApartments.map((apartment) => (
                  <Table.Tr
                    key={apartment.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/admin/apartments/${apartment.id}/view`)}
                  >
                    <Table.Td fw={500}>
                      {apartment.name}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" maw={320} truncate title={apartment.address}>
                        {apartment.address}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge variant="light" color="gray">
                        {apartment.buildingCount}동
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge variant="light" color="gray">
                        {apartment.totalUnits}세대
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge variant="light" color="gray">
                        {apartment.totalDevices}대
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge variant="light" color="gray">
                        {apartment.memberCount}명
                      </Badge>
                    </Table.Td>
                    {!hideOpenDoorColumn && (
                      <Table.Td ta="center" c="dimmed">
                        {apartment.totalOpenDoorCount > 0 ? (
                          <span>{apartment.totalOpenDoorCount}회</span>
                        ) : (
                          <span>-</span>
                        )}
                      </Table.Td>
                    )}
                    <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {apartment.basicAdCount > 0 ? apartment.basicAdCount : (
                        <Text span size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {apartment.premiumAdCount > 0 ? apartment.premiumAdCount : (
                        <Text span size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group justify="center">
                        <Switch
                          checked={apartment.isAdEnabled}
                          onChange={(e) => handleToggleAdEnabled(apartment.id, e.currentTarget.checked)}
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td ta="center">
                      {apartment.createdByName ? (
                        <Text span size="sm" fw={500}>{apartment.createdByName}</Text>
                      ) : (
                        <Text span size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="center" c="dimmed">
                      {apartment.createdAt}
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <Button
                          variant="default"
                          size="xs"
                          leftSection={<Users size={16} />}
                          onClick={() => router.push(`/admin/apartments/${apartment.id}/view`)}
                        >
                          회원
                        </Button>
                        <Button
                          variant="default"
                          size="xs"
                          leftSection={<Cpu size={16} />}
                          onClick={() => router.push(`/admin/apartments/${apartment.id}/devices`)}
                        >
                          장치
                        </Button>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label="더보기">
                              <MoreVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<Building2 size={16} />}
                              onClick={() => router.push(`/admin/apartments/${apartment.id}/edit`)}
                            >
                              아파트 설정
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={16} />}
                              onClick={() => handleDeleteClick(apartment)}
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
        </DataTableShell>

        {/* Delete Confirmation Dialog */}
        <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title="아파트 삭제" closeOnClickOutside={!deleting} closeOnEscape={!deleting}>
          <Text size="sm" c="dimmed">
            {hasMembers ? (
              <>
                <strong>{deletingApartment?.name}</strong> 아파트에 회원{' '}
                {deletingApartment?.memberCount.toLocaleString()}명이 소속되어 있어 삭제할 수 없습니다.
                <br />
                소속 회원을 다른 아파트로 이동시킨 뒤 다시 시도해 주세요.
              </>
            ) : (
              <>
                정말로 <strong>{deletingApartment?.name}</strong> 아파트를 삭제하시겠습니까?
                <br />
                이 작업은 되돌릴 수 없으며, 해당 아파트의 모든 데이터가 삭제됩니다.
              </>
            )}
          </Text>
          <Group justify="flex-end" mt="lg">
            <Button variant="default" onClick={() => setDeleteDialog(false)} disabled={deleting}>
              {hasMembers ? '확인' : '취소'}
            </Button>
            {!hasMembers && (
              <Button color="red" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? '삭제 중...' : '삭제'}
              </Button>
            )}
          </Group>
        </Modal>
      </PageContent>
    </PageShell>
  );
}

function ApartmentsPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}): React.ReactElement {
  return (
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
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        이전
      </Button>
      <Group gap={4}>
        {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 10) {
            pageNum = i + 1;
          } else if (page <= 5) {
            pageNum = i + 1;
          } else if (page >= totalPages - 4) {
            pageNum = totalPages - 9 + i;
          } else {
            pageNum = page - 4 + i;
          }
          return (
            <Button
              key={pageNum}
              variant={page === pageNum ? 'filled' : 'default'}
              size="xs"
              onClick={() => onPageChange(pageNum)}
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
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
      >
        다음
      </Button>
    </Group>
  );
}
