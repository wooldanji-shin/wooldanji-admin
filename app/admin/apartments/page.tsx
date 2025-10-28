'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Building2, Home, Cpu, Settings, Users, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { createClient } from '@/lib/supabase/client';
import { formatLineRange } from '@/lib/utils/line';

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

export default function ApartmentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingApartment, setDeletingApartment] = useState<Apartment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    fetchApartments();
  }, []);

  const fetchApartments = async () => {
    try {
      // 아파트 목록과 관련 정보 조회
      const { data: apartmentsData, error: apartmentsError } = await supabase
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

  const filteredApartments = apartments.filter(
    (apt) =>
      apt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 아파트</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apartments.length}</div>
            <p className="text-xs text-muted-foreground">
              등록된 아파트 수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 동수</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apartments.reduce((acc, apt) => acc + apt.buildingCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              총 건물 동수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 세대수</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apartments.reduce((acc, apt) => acc + apt.totalUnits, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              총 세대 수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 기기</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apartments.reduce((acc, apt) => acc + apt.totalDevices, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              설치된 기기 수
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="아파트명 또는 주소로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Apartments List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="text-center py-8">
              데이터를 불러오는 중...
            </CardContent>
          </Card>
        ) : filteredApartments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              등록된 아파트가 없습니다.
            </CardContent>
          </Card>
        ) : (
          paginatedApartments.map((apartment) => (
            <Card key={apartment.id} className="overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold">{apartment.name}</h3>
                    </div>

                    <p className="text-muted-foreground mb-4">{apartment.address}</p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">동수</p>
                        <p className="text-lg font-semibold">{apartment.buildingCount}동</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">세대수</p>
                        <p className="text-lg font-semibold">{apartment.totalUnits}세대</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">설치 기기</p>
                        <p className="text-lg font-semibold">{apartment.totalDevices}대</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>등록일: {apartment.createdAt}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/apartments/${apartment.id}/view`)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      회원보기
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/apartments/${apartment.id}/devices`)}
                    >
                      <Cpu className="h-4 w-4 mr-2" />
                      기기관리
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/apartments/${apartment.id}/edit`)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      설정
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(apartment)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

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