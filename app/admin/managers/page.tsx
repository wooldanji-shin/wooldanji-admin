'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MoreVertical,
  Check,
  X,
  Edit,
  Building2,
  Home,
  Layers,
  Plus,
  Shield,
  Eye,
  Image as ImageIcon,
  Trash2,
  Ban
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatLineRange } from '@/lib/utils/line';
import { toast } from 'sonner';
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

      if (!response.ok) throw new Error('Failed to update approval status');

      toast.success('승인 상태가 변경되었습니다.');
      fetchManagers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error('승인 상태 변경에 실패했습니다.');
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
        const error = await response.json();
        throw new Error(error.error || 'Failed to suspend manager');
      }

      toast.success('관리자가 승인 보류 처리되었습니다.');
      setSuspendDialog(false);
      setSuspendingManager(null);
      setSuspensionReason('');
      fetchManagers();
    } catch (err) {
      console.error('Failed to suspend manager:', err);
      toast.error('승인 보류 처리에 실패했습니다.');
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
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete manager');
      }

      toast.success('관리자가 삭제되었습니다.');
      setDeleteDialog(false);
      setDeletingManager(null);
      fetchManagers();
    } catch (err) {
      console.error('Failed to delete manager:', err);
      toast.error('관리자 삭제에 실패했습니다.');
    }
  };

  // 관리 범위 표시
  const getScopeDisplay = (scopes?: AdminScope[]) => {
    if (!scopes || scopes.length === 0) {
      return <Badge variant="outline">미지정</Badge>;
    }

    const scope = scopes[0];
    const apartment = scope.apartments;
    const building = scope.apartment_buildings;
    const line = scope.apartment_lines;

    if (scope.scopeLevel === 'APARTMENT' && apartment) {
      return (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{apartment.name} 전체</span>
        </div>
      );
    } else if (scope.scopeLevel === 'BUILDING' && apartment && building) {
      return (
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{apartment.name} {building.buildingNumber}동</span>
        </div>
      );
    } else if (scope.scopeLevel === 'LINE' && apartment && building && line) {
      return (
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{apartment.name} {building.buildingNumber}동 {formatLineRange(line.line)}라인</span>
        </div>
      );
    }

    return <Badge variant="outline">미지정</Badge>;
  };

  const getApprovalBadge = (status: string | null) => {
    switch (status) {
      case 'approve':
        return <Badge className="bg-green-500 text-white">승인</Badge>;
      case 'pending':
        return <Badge variant="secondary">대기</Badge>;
      case 'suspended':
        return <Badge className="bg-yellow-500 text-white">보류</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500 text-white">비활성</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const getRegisterMethodBadge = (method: string | null | undefined) => {
    switch (method?.toLowerCase()) {
      case 'google':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Google</Badge>;
      case 'kakao':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Kakao</Badge>;
      case 'local':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Email</Badge>;
      default:
        return null;
    }
  };

  const filteredManagers = managers.filter(
    (manager) =>
      manager.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.phoneNumber?.includes(searchQuery)
  );

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='관리자 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Search */}
        <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6'>
          <div className='relative flex-1 w-full'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='이름, 이메일, 전화번호로 검색...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
          <div className='flex items-center gap-2 whitespace-nowrap'>
            <Shield className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm text-muted-foreground'>
              전체 {filteredManagers.length}명
            </span>
          </div>
        </div>

        {/* Managers Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground w-12'>사진</TableHead>
                    <TableHead className='text-muted-foreground'>이름</TableHead>
                    <TableHead className='text-muted-foreground'>이메일</TableHead>
                    <TableHead className='text-muted-foreground'>전화번호</TableHead>
                    <TableHead className='text-muted-foreground'>관리 범위</TableHead>
                    <TableHead className='text-muted-foreground'>승인상태</TableHead>
                    <TableHead className='text-muted-foreground'>등록일</TableHead>
                    <TableHead className='text-muted-foreground text-right'>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : filteredManagers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className='text-center py-12 text-muted-foreground'>
                        {searchQuery ? '검색 결과가 없습니다.' : '관리자가 없습니다.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredManagers.map((manager) => (
                      <TableRow key={manager.id} className='border-border hover:bg-secondary/50'>
                        <TableCell>
                          {manager.confirmImageUrl ? (
                            <button
                              onClick={() => setImagePreview(manager.confirmImageUrl || null)}
                              className='w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center hover:opacity-80 transition-opacity'
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
                            </button>
                          ) : (
                            <div className='w-10 h-10 rounded-full bg-secondary flex items-center justify-center'>
                              <ImageIcon className='w-5 h-5 text-muted-foreground' />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='font-medium'>{manager.name || '-'}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          <div className='flex items-center gap-2'>
                            <span>{manager.email}</span>
                            {getRegisterMethodBadge(manager.registerMethod)}
                          </div>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>{manager.phoneNumber || '-'}</TableCell>
                        <TableCell>{getScopeDisplay(manager.admin_scopes)}</TableCell>
                        <TableCell>{getApprovalBadge(manager.approvalStatus)}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          {new Date(manager.createdAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                                <MoreVertical className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              {manager.confirmImageUrl && (
                                <DropdownMenuItem onClick={() => setImagePreview(manager.confirmImageUrl || null)}>
                                  <Eye className='mr-2 h-4 w-4' />
                                  인증 사진 보기
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openEditModal(manager)}>
                                <Edit className='mr-2 h-4 w-4' />
                                관리 범위 설정
                              </DropdownMenuItem>
                              {manager.approvalStatus !== 'approve' ? (
                                <DropdownMenuItem
                                  onClick={() => handleApprovalStatusChange(manager.id, 'approve')}
                                  className='text-green-600'
                                >
                                  <Check className='mr-2 h-4 w-4' />
                                  승인하기
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleApprovalStatusChange(manager.id, 'pending')}
                                  className='text-orange-600'
                                >
                                  <X className='mr-2 h-4 w-4' />
                                  승인 취소
                                </DropdownMenuItem>
                              )}
                              {manager.approvalStatus !== 'suspended' && (
                                <DropdownMenuItem
                                  onClick={() => handleSuspendClick(manager)}
                                  className='text-yellow-600'
                                >
                                  <Ban className='mr-2 h-4 w-4' />
                                  승인 보류
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(manager)}
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
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className='fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8'
          onClick={() => setImagePreview(null)}
        >
          <div className='relative max-w-4xl max-h-[85vh] flex items-center justify-center'>
            <img
              src={imagePreview}
              alt='인증 사진'
              className='max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl'
            />
            <Button
              variant='secondary'
              size='icon'
              className='absolute top-4 right-4 rounded-full shadow-lg'
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview(null);
              }}
            >
              <X className='h-5 w-5' />
            </Button>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Dialog */}
      <Dialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>승인 보류</DialogTitle>
            <DialogDescription>
              <strong>{suspendingManager?.name || suspendingManager?.email}</strong>님의 승인을 보류하시겠습니까?
              <br />
              보류 사유를 입력해주세요. 사용자는 이 사유를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className='py-4'>
            <textarea
              className='w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary'
              placeholder='보류 사유를 입력해주세요...'
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setSuspendDialog(false)}>
              취소
            </Button>
            <Button variant='default' onClick={handleSuspendConfirm} className='bg-yellow-600 hover:bg-yellow-700'>
              승인 보류
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingManager?.name || deletingManager?.email}</strong>님을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 해당 관리자의 모든 데이터가 삭제됩니다.
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

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>관리 범위 설정</DialogTitle>
            <DialogDescription>
              {selectedManager?.name || selectedManager?.email}님의 관리 권한 범위를 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            {/* 관리 레벨 선택 */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>관리 레벨</label>
              <Select value={scopeLevel} onValueChange={(value: any) => setScopeLevel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='APARTMENT'>아파트 전체</SelectItem>
                  <SelectItem value='BUILDING'>특정 동</SelectItem>
                  <SelectItem value='LINE'>특정 라인</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 아파트 선택 */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>아파트</label>
              <Select value={selectedApartment} onValueChange={setSelectedApartment}>
                <SelectTrigger>
                  <SelectValue placeholder='아파트를 선택하세요' />
                </SelectTrigger>
                <SelectContent>
                  {apartments.map((apt) => (
                    <SelectItem key={apt.id} value={apt.id}>
                      {apt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 동 선택 (BUILDING 또는 LINE 레벨일 때) */}
            {(scopeLevel === 'BUILDING' || scopeLevel === 'LINE') && (
              <div className='space-y-2'>
                <label className='text-sm font-medium'>동</label>
                <Select
                  value={selectedBuilding}
                  onValueChange={setSelectedBuilding}
                  disabled={!selectedApartment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='동을 선택하세요' />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.buildingNumber}동
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 라인 선택 (LINE 레벨일 때) */}
            {scopeLevel === 'LINE' && (
              <div className='space-y-2'>
                <label className='text-sm font-medium'>라인</label>
                <Select
                  value={selectedLine}
                  onValueChange={setSelectedLine}
                  disabled={!selectedBuilding}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='라인을 선택하세요' />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {formatLineRange(line.line)}라인
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsEditModalOpen(false)}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}