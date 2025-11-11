'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Building2,
  Home,
  Cpu,
  Users,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
  lineRanges: { id: string; line: number[] }[];
  createdAt: string;
  status: 'active' | 'pending' | 'inactive';
}

type SortField = 'name' | 'buildingCount' | 'totalUnits' | 'totalDevices' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function ApartmentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingApartment, setDeletingApartment] = useState<Apartment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const ITEMS_PER_PAGE = 15;

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

        return {
          id: apt.id,
          name: apt.name,
          address: apt.address,
          buildingCount,
          totalUnits,
          totalDevices,
          lineRanges,
          createdAt: new Date(apt.createdAt).toLocaleDateString('ko-KR'),
          status: 'active' as const,
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
    } catch (error) {
      console.error('Failed to delete apartment:', error);
      alert('아파트 삭제 중 오류가 발생했습니다.');
    }
  };


  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">아파트 관리</h1>
          <p className="text-muted-foreground mt-2">
            등록된 아파트 정보를 관리합니다
          </p>
        </div>
        <Button onClick={() => router.push('/admin/apartments/new')}>
          <Plus className="mr-2 h-4 w-4" />
          새 아파트 등록
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="아파트명 또는 주소로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Apartments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                        데이터를 불러오는 중...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredApartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {searchTerm ? '검색 결과가 없습니다.' : '등록된 아파트가 없습니다.'}
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
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && filteredApartments.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            {currentPage} / {totalPages} 페이지
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
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
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
    </div>
  );
}