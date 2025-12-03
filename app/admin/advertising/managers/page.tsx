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
import { Label } from '@/components/ui/label';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  FileText,
  MapPin,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/image-upload';
import { toast } from 'sonner';

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

export default function AdvertisingManagersPage() {
  const supabase = createClient();

  const [managers, setManagers] = useState<Manager[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
  const [tempManagerId, setTempManagerId] = useState<string>('');
  const [uploadedCreateImage, setUploadedCreateImage] = useState<string>(''); // 업로드된 생성 이미지 추적
  const [showPassword, setShowPassword] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingManager, setDeletingManager] = useState<Manager | null>(null);

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

    try {
      const response = await fetch(`/api/advertising/managers/${deletingManager.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete manager');

      setDeleteDialog(false);
      setDeletingManager(null);
      toast.success('매니저가 삭제되었습니다.');
      fetchManagers();
    } catch (err) {
      console.error('Failed to delete manager:', err);
      toast.error('매니저 삭제에 실패했습니다.');
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
      <AdminHeader title='매니저 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Search & Actions */}
        <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between'>
          <div className='relative flex-1 w-full'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='이름, 이메일, 전화번호로 검색...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
          <Button onClick={() => {
            setTempManagerId(crypto.randomUUID());
            setIsCreateDialogOpen(true);
          }}>
            <Plus className='h-4 w-4 mr-2' />
            매니저 추가
          </Button>
        </div>

        {/* Managers Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground'>이름</TableHead>
                    <TableHead className='text-muted-foreground'>이메일</TableHead>
                    <TableHead className='text-muted-foreground'>전화번호</TableHead>
                    <TableHead className='text-muted-foreground'>관리 아파트</TableHead>
                    <TableHead className='text-muted-foreground'>등록일</TableHead>
                    <TableHead className='text-muted-foreground text-right'>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : filteredManagers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                        {searchQuery ? '검색 결과가 없습니다.' : '매니저가 없습니다.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredManagers.map((manager) => (
                      <TableRow key={manager.id} className='border-border hover:bg-secondary/50 cursor-pointer'>
                        <TableCell
                          className='font-medium'
                          onClick={() => {
                            setViewingManager(manager);
                            setDetailDialog(true);
                          }}
                        >
                          {manager.name || '-'}
                        </TableCell>
                        <TableCell
                          className='text-muted-foreground'
                          onClick={() => {
                            setViewingManager(manager);
                            setDetailDialog(true);
                          }}
                        >
                          {manager.email}
                        </TableCell>
                        <TableCell
                          className='text-muted-foreground'
                          onClick={() => {
                            setViewingManager(manager);
                            setDetailDialog(true);
                          }}
                        >
                          {manager.phoneNumber || '-'}
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setViewingManager(manager);
                            setDetailDialog(true);
                          }}
                        >
                          {manager.manager_apartments && manager.manager_apartments.length > 0 ? (
                            <Badge variant="outline">
                              <Building2 className='h-3 w-3 mr-1' />
                              {manager.manager_apartments.length}개 관리
                            </Badge>
                          ) : (
                            <span className='text-muted-foreground text-sm'>미지정</span>
                          )}
                        </TableCell>
                        <TableCell
                          className='text-muted-foreground'
                          onClick={() => {
                            setViewingManager(manager);
                            setDetailDialog(true);
                          }}
                        >
                          {new Date(manager.createdAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => {
                                setViewingManager(manager);
                                setDetailDialog(true);
                              }}
                            >
                              <Eye className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(manager);
                              }}
                              className='text-destructive hover:text-destructive'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
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
      </div>

      {/* Create Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={async (open) => {
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
        }}
      >
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>매니저 추가</DialogTitle>
            <DialogDescription>
              새로운 매니저 계정을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>이메일 *</Label>
              <Input
                id='email'
                type='email'
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder='manager@example.com'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='password'>비밀번호 *</Label>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder='최소 8자 이상, 특수문자 1개 포함'
                  className='pr-10'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                >
                  {showPassword ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </button>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='name'>이름 *</Label>
              <Input
                id='name'
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder='홍길동'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='phoneNumber'>전화번호</Label>
              <Input
                id='phoneNumber'
                value={createForm.phoneNumber}
                onChange={(e) => setCreateForm({ ...createForm, phoneNumber: formatPhoneNumber(e.target.value) })}
                placeholder='010-1234-5678'
                maxLength={13}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='address'>주소</Label>
              <Input
                id='address'
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder='서울시 강남구...'
              />
            </div>

            <div className='space-y-2'>
              <Label>사업자등록증 (선택)</Label>
              <ImageUpload
                bucket='managers'
                storagePath='business-registrations'
                fileName={tempManagerId}
                value={createForm.businessRegistration}
                onChange={(url) => {
                  setCreateForm({ ...createForm, businessRegistration: url });
                  setUploadedCreateImage(url);
                }}
                accept='image/*'
                maxSizeMB={5}
                previewSize='sm'
                description='이미지 파일, 최대 5MB'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='memo'>메모</Label>
              <Textarea
                id='memo'
                value={createForm.memo}
                onChange={(e) => setCreateForm({ ...createForm, memo: e.target.value })}
                placeholder='영업 담당 지역, 특이사항 등'
                rows={3}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='approvalStatus'>승인 상태</Label>
              <Select
                value={createForm.approvalStatus}
                onValueChange={(value: 'approve' | 'pending') =>
                  setCreateForm({ ...createForm, approvalStatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='approve'>
                    <div className='flex items-center gap-2'>
                      <div className='w-2 h-2 rounded-full bg-green-500' />
                      승인
                    </div>
                  </SelectItem>
                  <SelectItem value='pending'>
                    <div className='flex items-center gap-2'>
                      <div className='w-2 h-2 rounded-full bg-gray-500' />
                      대기
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateManager}>
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매니저 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingManager?.name || deletingManager?.email}</strong>님을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 해당 매니저의 모든 데이터가 삭제됩니다.
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

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={async (open) => {
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
        }}
      >
        <DialogContent className='sm:max-w-[500px] max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>매니저 수정</DialogTitle>
            <DialogDescription>
              매니저 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-name'>이름 *</Label>
              <Input
                id='edit-name'
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder='홍길동'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='edit-phoneNumber'>전화번호</Label>
              <Input
                id='edit-phoneNumber'
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({ ...editForm, phoneNumber: formatPhoneNumber(e.target.value) })}
                placeholder='010-1234-5678'
                maxLength={13}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='edit-address'>주소</Label>
              <Input
                id='edit-address'
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder='서울시 강남구...'
              />
            </div>

            <div className='space-y-2'>
              <Label>사업자등록증 (선택)</Label>
              <ImageUpload
                bucket='managers'
                storagePath='business-registrations'
                fileName={editingManagerId}
                value={editForm.businessRegistration}
                onChange={(url) => {
                  setEditForm({ ...editForm, businessRegistration: url });
                  setUploadedEditImage(url);
                }}
                accept='image/*'
                maxSizeMB={5}
                previewSize='sm'
                description='이미지 파일, 최대 5MB'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='edit-memo'>메모</Label>
              <Textarea
                id='edit-memo'
                value={editForm.memo}
                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                placeholder='영업 담당 지역, 특이사항 등'
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateManager}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className='sm:max-w-[700px] max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>매니저 상세 정보</DialogTitle>
            <DialogDescription>
              매니저의 상세 정보를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {viewingManager && (
            <div className='space-y-6 py-4'>
              {/* 기본 정보 */}
              <div className='space-y-4'>
                <h3 className='font-semibold text-lg border-b pb-2'>기본 정보</h3>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-muted-foreground'>이름</Label>
                    <p className='font-medium'>{viewingManager.name || '-'}</p>
                  </div>
                  <div>
                    <Label className='text-muted-foreground'>이메일</Label>
                    <p className='font-medium'>{viewingManager.email}</p>
                  </div>
                  <div>
                    <Label className='text-muted-foreground'>전화번호</Label>
                    <p className='font-medium'>{viewingManager.phoneNumber || '-'}</p>
                  </div>
                  <div>
                    <Label className='text-muted-foreground'>등록일</Label>
                    <p className='font-medium'>{new Date(viewingManager.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                </div>

                <div>
                  <Label className='text-muted-foreground flex items-center gap-1'>
                    <MapPin className='h-4 w-4' />
                    주소
                  </Label>
                  <p className='font-medium mt-1'>{viewingManager.manager_profiles?.address || '-'}</p>
                </div>

                <div>
                  <Label className='text-muted-foreground flex items-center gap-1'>
                    <FileText className='h-4 w-4' />
                    메모
                  </Label>
                  <p className='mt-1 text-sm bg-muted p-3 rounded-md whitespace-pre-wrap'>
                    {viewingManager.manager_profiles?.memo || '-'}
                  </p>
                </div>
              </div>

              {/* 사업자등록증 */}
              {viewingManager.manager_profiles?.businessRegistration && (
                <div className='space-y-2'>
                  <h3 className='font-semibold text-lg border-b pb-2'>사업자등록증</h3>
                  <div className='border rounded-lg overflow-hidden bg-muted'>
                    <img
                      src={viewingManager.manager_profiles.businessRegistration}
                      alt='사업자등록증'
                      className='w-full h-auto'
                    />
                  </div>
                </div>
              )}

              {/* 관리 아파트 */}
              <div className='space-y-2'>
                <h3 className='font-semibold text-lg border-b pb-2'>관리 아파트</h3>
                {viewingManager.manager_apartments && viewingManager.manager_apartments.length > 0 ? (
                  <div className='grid gap-2'>
                    {viewingManager.manager_apartments.map((ma: any) => (
                      <div key={ma.id} className='flex items-center gap-2 p-3 bg-muted rounded-lg'>
                        <Building2 className='h-5 w-5 text-primary' />
                        <div>
                          <p className='font-medium'>{ma.apartments?.name}</p>
                          <p className='text-sm text-muted-foreground'>{ma.apartments?.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted-foreground text-sm'>관리 중인 아파트가 없습니다.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setDetailDialog(false)}>
              닫기
            </Button>
            <Button onClick={() => viewingManager && handleEditClick(viewingManager)}>
              <Edit className='h-4 w-4 mr-2' />
              수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
