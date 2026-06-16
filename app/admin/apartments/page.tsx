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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar, DataToolbarSearch, DataToolbarActions } from '@/components/data-toolbar';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
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

  const handleDeleteClick = (apartment: Apartment) => {
    setDeletingApartment(apartment);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingApartment) return;

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
      toast.error('아파트 삭제 중 오류가 발생했습니다.');
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              id="hide-open-door-column"
              checked={hideOpenDoorColumn}
              onCheckedChange={(checked) => handleHideOpenDoorColumnChange(checked === true)}
            />
            문 연 횟수 숨기기
          </label>
          <Button onClick={() => router.push('/admin/apartments/new')}>
            <Plus className="mr-2 h-4 w-4" />
            새 아파트 등록
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        {/* 전체 합계 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2 rounded-lg bg-blue-100">
                <Home className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 세대수</p>
                <p className="text-2xl font-bold">
                  {loading ? '-' : apartments.reduce((sum, apt) => sum + apt.totalUnits, 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2 rounded-lg bg-purple-100">
                <Cpu className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 기기수</p>
                <p className="text-2xl font-bold">
                  {loading ? '-' : apartments.reduce((sum, apt) => sum + apt.totalDevices, 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2 rounded-lg bg-green-100">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 회원수</p>
                <p className="text-2xl font-bold">
                  {loading ? '-' : apartments.reduce((sum, apt) => sum + apt.memberCount, 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2 rounded-lg bg-orange-100">
                <DoorOpen className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 문 연 횟수</p>
                <p className="text-2xl font-bold">
                  {loading ? '-' : apartments.reduce((sum, apt) => sum + apt.totalOpenDoorCount, 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      <DataTableShell
        toolbar={
          <DataToolbar>
            <DataToolbarSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="아파트명 또는 주소로 검색..."
            />
            <DataToolbarActions>
              <span className="text-xs text-muted-foreground tabular-nums">
                총 {filteredApartments.length.toLocaleString()}개
              </span>
            </DataToolbarActions>
          </DataToolbar>
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
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      아파트명
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground">주소</TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground text-center"
                    onClick={() => handleSort('buildingCount')}
                  >
                    <div className="flex items-center justify-center">
                      동수
                      {getSortIcon('buildingCount')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground text-center"
                    onClick={() => handleSort('totalUnits')}
                  >
                    <div className="flex items-center justify-center">
                      세대수
                      {getSortIcon('totalUnits')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground text-center"
                    onClick={() => handleSort('totalDevices')}
                  >
                    <div className="flex items-center justify-center">
                      기기수
                      {getSortIcon('totalDevices')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground text-center"
                    onClick={() => handleSort('memberCount')}
                  >
                    <div className="flex items-center justify-center">
                      회원수
                      {getSortIcon('memberCount')}
                    </div>
                  </TableHead>
                  {!hideOpenDoorColumn && (
                    <TableHead className="text-muted-foreground text-center">
                      문 연 횟수
                    </TableHead>
                  )}
                  <TableHead className="text-muted-foreground text-center">
                    기본광고
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center">
                    프리미엄
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center">
                    광고
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center">
                    매니저
                  </TableHead>
                  <TableHead
                    className="text-muted-foreground cursor-pointer hover:text-foreground text-center"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center justify-center">
                      등록일
                      {getSortIcon('createdAt')}
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={hideOpenDoorColumn ? 12 : 13} className="p-0">
                      <TableSkeleton rows={6} columns={hideOpenDoorColumn ? 11 : 12} showHeader={false} />
                    </TableCell>
                  </TableRow>
                ) : filteredApartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={hideOpenDoorColumn ? 12 : 13} className="p-0">
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
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedApartments.map((apartment) => (
                    <TableRow
                      key={apartment.id}
                      className="border-border hover:bg-secondary/50 cursor-pointer"
                      onClick={() => router.push(`/admin/apartments/${apartment.id}/view`)}
                    >
                      <TableCell className="font-medium">
                        {apartment.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {apartment.address}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-normal">
                          {apartment.buildingCount}동
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-normal">
                          {apartment.totalUnits}세대
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-normal">
                          {apartment.totalDevices}대
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-normal">
                          {apartment.memberCount}명
                        </Badge>
                      </TableCell>
                      {!hideOpenDoorColumn && (
                        <TableCell className="text-center text-muted-foreground">
                          {apartment.totalOpenDoorCount > 0 ? (
                            <span>{apartment.totalOpenDoorCount}회</span>
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center tabular-nums text-sm">
                        {apartment.basicAdCount > 0 ? apartment.basicAdCount : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {apartment.premiumAdCount > 0 ? apartment.premiumAdCount : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={apartment.isAdEnabled}
                          onCheckedChange={(checked) => handleToggleAdEnabled(apartment.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {apartment.createdByName ? (
                          <span className="font-medium">{apartment.createdByName}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {apartment.createdAt}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/apartments/${apartment.id}/view`)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            회원
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/apartments/${apartment.id}/devices`)}
                          >
                            <Cpu className="h-4 w-4 mr-1" />
                            장치
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/apartments/${apartment.id}/edit`)}
                              >
                                <Building2 className="h-4 w-4 mr-2" />
                                아파트 설정
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(apartment)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
      </DataTableShell>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>아파트 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingApartment?.name}</strong> 아파트를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 해당 아파트의 모든 데이터가 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="flex items-center justify-center gap-2 border-t border-border/60 px-4 py-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        이전
      </Button>
      <div className="flex gap-1">
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
              variant={page === pageNum ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="w-10"
            >
              {pageNum}
            </Button>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
      >
        다음
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}