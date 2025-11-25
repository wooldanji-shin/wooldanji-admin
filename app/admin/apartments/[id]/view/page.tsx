'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Image as ImageIcon,
  AlertCircle,
  MoreVertical,
  Check,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
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
  }, [searchQuery, currentPage, selectedBuilding, selectedLine, resolvedParams.id, apartment, lines, supabase, initialLoading]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const getApprovalBadge = (status: string | null) => {
    switch (status) {
      case 'approve':
        return <Badge className="bg-green-500 text-white">승인</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary">대기</Badge>;
    }
  };

  const getUserRole = (roles?: any[]) => {
    if (!roles || roles.length === 0) return '-';
    const roleMap: Record<string, string> = {
      'APP_USER': '앱 사용자',
      'APT_ADMIN': '아파트 관리자',
      'REGION_ADMIN': '지역 관리자',
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
        const error = await response.json();
        throw new Error(error.error || 'Failed to update approval status');
      }

      fetchUsers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error('승인 상태 변경에 실패했습니다.');
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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="text-center py-8">
            아파트 정보를 찾을 수 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/apartments')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
        </div>
      </div>

      {/* Apartment Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{apartment.name}</CardTitle>
              </div>
              <CardDescription className="mt-2">
                <MapPin className="inline-block h-4 w-4 mr-1" />
                {apartment.address}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">총 동수</p>
              <p className="text-2xl font-bold">{apartment.buildings.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">전체 회원</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">선택된 동 회원</p>
              <p className="text-2xl font-bold">
                {selectedBuilding && selectedBuilding !== 'all'
                  ? buildingStats[apartment.buildings.find(b => b.id === selectedBuilding)?.buildingNumber || 0] || 0
                  : totalCount}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">최대 호수당 회원</p>
              <p className="text-2xl font-bold">
                {Object.keys(unitStats).length > 0
                  ? Math.max(...Object.values(unitStats))
                  : 0}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-700">총 문 연 횟수</p>
              <p className="text-2xl font-bold text-blue-700">{totalOpenDoorCount}회</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름, 이메일, 전화번호로 검색..."
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedBuilding || 'all'} onValueChange={handleBuildingChange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="동 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 동</SelectItem>
                    {apartment.buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.buildingNumber}동
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedLine || 'all'}
                  onValueChange={handleLineChange}
                  disabled={!selectedBuilding || selectedBuilding === 'all'}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="라인 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 라인</SelectItem>
                    {lines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {formatLineDisplay(line.line)}라인
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto relative min-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground w-12">
                    사진
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    이름
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    이메일
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    전화번호
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    동/호
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    역할
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    승인상태
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    문 열기
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    가입일
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    작업
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLoading && loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      {searchQuery ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-border hover:bg-secondary/50"
                    >
                      <TableCell>
                        {user.confirmImageUrl ? (
                          <button
                            onClick={() => setImagePreview(user.confirmImageUrl)}
                            className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center hover:opacity-80 transition-opacity"
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
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-card-foreground">
                        {user.name || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.phoneNumber || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="text-sm">
                          {user.buildingNumber ? `${user.buildingNumber}동` : ''}
                          {user.unit ? ` ${user.unit}호` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {getUserRole(user.user_roles)}
                      </TableCell>
                      <TableCell>
                        {getApprovalBadge(user.approvalStatus)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {user.openDoorCount !== null && user.openDoorCount !== undefined ? (
                          <span>{user.openDoorCount}회</span>
                        ) : (
                          <span>-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary'
                            >
                              <MoreVertical className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            {user.confirmImageUrl && (
                              <DropdownMenuItem onClick={() => setImagePreview(user.confirmImageUrl)}>
                                <Eye className='mr-2 h-4 w-4' />
                                인증 사진 보기
                              </DropdownMenuItem>
                            )}
                            {user.approvalStatus !== 'approve' ? (
                              <DropdownMenuItem
                                onClick={() => handleApprovalStatusChange(user.id, 'approve')}
                                className='text-green-600'
                              >
                                <Check className='mr-2 h-4 w-4' />
                                승인하기
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleApprovalStatusChange(user.id, 'pending')}
                                className='text-orange-600'
                              >
                                <X className='mr-2 h-4 w-4' />
                                승인 취소
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(user)}
                              className='text-destructive'
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            {currentPage} / {totalPages} 페이지
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
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
                    onClick={() => handlePageChange(pageNum)}
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
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] flex items-center justify-center">
            <img
              src={imagePreview}
              alt="인증 사진"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4 rounded-full shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview(null);
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회원 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingUser?.name || deletingUser?.email}</strong>님을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 해당 회원의 모든 데이터가 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialog(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
