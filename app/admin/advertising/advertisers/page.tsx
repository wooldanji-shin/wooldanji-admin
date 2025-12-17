'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Building2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { ImageUpload } from '@/components/image-upload';
import { deleteFileFromStorage } from '@/lib/utils/storage';

const BUCKET_NAME = 'advertisements';
const STORAGE_PATH = 'advertisers';

interface Advertiser {
  id: string;
  businessName: string;
  representativeName: string;
  contactPhoneNumber: string;
  displayPhoneNumber: string | null;
  email: string | null;
  address: string;
  businessRegistration: string | null;
  contractDocument: string | null;
  contractMemo: string | null;
  searchTags: string[];
  createdBy: string | null;
  createdAt: string;
  // 조인 데이터
  bannerCount?: number;
  adCount?: number;
}

interface AdvertiserForm {
  businessName: string;
  representativeName: string;
  contactPhoneNumber: string;
  displayPhoneNumber: string;
  email: string;
  address: string;
  businessRegistration: string;
  contractDocument: string;
  contractMemo: string;
}

const initialFormState: AdvertiserForm = {
  businessName: '',
  representativeName: '',
  contactPhoneNumber: '',
  displayPhoneNumber: '',
  email: '',
  address: '',
  businessRegistration: '',
  contractDocument: '',
  contractMemo: '',
};

export default function AdvertisersPage() {
  const supabase = createClient();

  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdvertiser, setEditingAdvertiser] = useState<Advertiser | null>(null);
  const [form, setForm] = useState<AdvertiserForm>(initialFormState);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [advertiserToDelete, setAdvertiserToDelete] = useState<Advertiser | null>(null);

  // 계약메모 인라인 편집
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoValue, setEditingMemoValue] = useState('');

  // 유저 정보 로드
  useEffect(() => {
    const loadUserInfo = async () => {
      const user = await getCurrentUser();
      const roles = await getUserRoles();
      setCurrentUserId(user?.id || null);
      setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
    };
    loadUserInfo();
  }, []);

  // 광고주 목록 로드
  const loadAdvertisers = useCallback(async () => {
    try {
      setLoading(true);

      // 광고주 기본 정보 조회
      let query = supabase
        .from('advertisers')
        .select('*')
        .order('createdAt', { ascending: false });

      // 매니저는 자신이 등록한 것만
      if (!isSuperAdmin && currentUserId) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data: advertisersData, error } = await query;

      if (error) throw error;

      // 배너/광고 카운트 조회
      const advertiserIds = (advertisersData || []).map((a) => a.id);

      if (advertiserIds.length > 0) {
        // 배너 카운트
        const { data: bannerCounts } = await supabase
          .from('home_banners')
          .select('advertiserId')
          .in('advertiserId', advertiserIds);

        // 광고 카운트
        const { data: adCounts } = await supabase
          .from('advertisements')
          .select('advertiserId')
          .in('advertiserId', advertiserIds);

        // 카운트 매핑
        const bannerCountMap: Record<string, number> = {};
        const adCountMap: Record<string, number> = {};

        (bannerCounts || []).forEach((b) => {
          bannerCountMap[b.advertiserId] = (bannerCountMap[b.advertiserId] || 0) + 1;
        });

        (adCounts || []).forEach((a) => {
          adCountMap[a.advertiserId] = (adCountMap[a.advertiserId] || 0) + 1;
        });

        const advertisersWithCounts = (advertisersData || []).map((advertiser) => ({
          ...advertiser,
          bannerCount: bannerCountMap[advertiser.id] || 0,
          adCount: adCountMap[advertiser.id] || 0,
        }));

        setAdvertisers(advertisersWithCounts);
      } else {
        setAdvertisers([]);
      }
    } catch (err) {
      console.error('Error loading advertisers:', err);
      toast.error('광고주 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUserId, isSuperAdmin]);

  useEffect(() => {
    if (currentUserId !== null) {
      loadAdvertisers();
    }
  }, [currentUserId, loadAdvertisers]);

  // 검색 필터
  const filteredAdvertisers = advertisers.filter(
    (a) =>
      a.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.representativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 유형 뱃지 렌더링
  const renderTypeBadge = (advertiser: Advertiser) => {
    const hasBanner = (advertiser.bannerCount || 0) > 0;
    const hasAd = (advertiser.adCount || 0) > 0;

    if (hasBanner && hasAd) {
      return (
        <div className='flex gap-1'>
          <Badge className='bg-blue-500 hover:bg-blue-600 text-white'>
            배너
          </Badge>
          <Badge className='bg-purple-500 hover:bg-purple-600 text-white'>
            광고
          </Badge>
        </div>
      );
    } else if (hasBanner) {
      return (
        <Badge className='bg-blue-500 hover:bg-blue-600 text-white'>
          배너
        </Badge>
      );
    } else if (hasAd) {
      return (
        <Badge className='bg-purple-500 hover:bg-purple-600 text-white'>
          광고
        </Badge>
      );
    } else {
      return <span className='text-muted-foreground text-sm'>-</span>;
    }
  };

  // 다이얼로그 열기 (추가)
  const handleAdd = () => {
    setEditingAdvertiser(null);
    setForm(initialFormState);
    setDialogOpen(true);
  };

  // 다이얼로그 열기 (수정)
  const handleEdit = (advertiser: Advertiser) => {
    setEditingAdvertiser(advertiser);
    setForm({
      businessName: advertiser.businessName,
      representativeName: advertiser.representativeName,
      contactPhoneNumber: advertiser.contactPhoneNumber,
      displayPhoneNumber: advertiser.displayPhoneNumber || '',
      email: advertiser.email || '',
      address: advertiser.address,
      businessRegistration: advertiser.businessRegistration || '',
      contractDocument: advertiser.contractDocument || '',
      contractMemo: advertiser.contractMemo || '',
    });
    setDialogOpen(true);
  };

  // 저장
  const handleSave = async () => {
    try {
      setSaving(true);

      if (!form.businessName.trim()) {
        toast.error('상호명을 입력해주세요.');
        return;
      }
      if (!form.representativeName.trim()) {
        toast.error('대표자명을 입력해주세요.');
        return;
      }
      if (!form.contactPhoneNumber.trim()) {
        toast.error('연락처를 입력해주세요.');
        return;
      }
      if (!form.address.trim()) {
        toast.error('주소를 입력해주세요.');
        return;
      }

      const data = {
        businessName: form.businessName.trim(),
        representativeName: form.representativeName.trim(),
        contactPhoneNumber: form.contactPhoneNumber.trim(),
        displayPhoneNumber: form.displayPhoneNumber.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim(),
        businessRegistration: form.businessRegistration || null,
        contractDocument: form.contractDocument || null,
        contractMemo: form.contractMemo.trim() || null,
      };

      if (editingAdvertiser) {
        const { error } = await supabase
          .from('advertisers')
          .update(data)
          .eq('id', editingAdvertiser.id);

        if (error) throw error;
        toast.success('광고주가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('advertisers').insert({
          ...data,
          createdBy: currentUserId,
        });

        if (error) throw error;
        toast.success('광고주가 등록되었습니다.');
      }

      setDialogOpen(false);
      setForm(initialFormState);
      setEditingAdvertiser(null);
      await loadAdvertisers();
    } catch (err) {
      console.error('Error saving advertiser:', err);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제 확인
  const handleDeleteClick = (advertiser: Advertiser) => {
    setAdvertiserToDelete(advertiser);
    setDeleteDialogOpen(true);
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!advertiserToDelete) return;

    try {
      // 파일 삭제
      if (advertiserToDelete.businessRegistration) {
        await deleteFileFromStorage(advertiserToDelete.businessRegistration);
      }
      if (advertiserToDelete.contractDocument) {
        await deleteFileFromStorage(advertiserToDelete.contractDocument);
      }

      // 광고주 삭제
      const { error } = await supabase
        .from('advertisers')
        .delete()
        .eq('id', advertiserToDelete.id);

      if (error) throw error;

      toast.success('광고주가 삭제되었습니다.');
      setDeleteDialogOpen(false);
      setAdvertiserToDelete(null);
      await loadAdvertisers();
    } catch (err) {
      console.error('Error deleting advertiser:', err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  // 계약메모 저장
  const handleSaveMemo = async (advertiserId: string) => {
    try {
      const { error } = await supabase
        .from('advertisers')
        .update({ contractMemo: editingMemoValue.trim() || null })
        .eq('id', advertiserId);

      if (error) throw error;

      setAdvertisers((prev) =>
        prev.map((a) =>
          a.id === advertiserId ? { ...a, contractMemo: editingMemoValue.trim() || null } : a
        )
      );
      setEditingMemoId(null);
      setEditingMemoValue('');
      toast.success('계약메모가 저장되었습니다.');
    } catch (err) {
      console.error('Error saving memo:', err);
      toast.error('계약메모 저장에 실패했습니다.');
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='광고주 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='광고주 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='space-y-6'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
              <CardTitle className='flex items-center gap-2'>
                <Building2 className='h-5 w-5' />
                광고주 목록
              </CardTitle>
              <Button onClick={handleAdd}>
                <Plus className='h-4 w-4 mr-2' />
                광고주 등록
              </Button>
            </CardHeader>
            <CardContent>
              {/* 검색 */}
              <div className='mb-4'>
                <div className='relative max-w-sm'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='상호명, 대표자명, 주소 검색...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-9'
                  />
                </div>
              </div>

              {/* 테이블 */}
              {filteredAdvertisers.length === 0 ? (
                <div className='text-center py-12 text-muted-foreground'>
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 광고주가 없습니다.'}
                </div>
              ) : (
                <div className='overflow-x-auto'>
                <Table className='w-full'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-[180px]'>상호명</TableHead>
                      <TableHead className='w-[120px]'>대표자명</TableHead>
                      <TableHead className='w-[140px]'>연락처</TableHead>
                      <TableHead className='w-[140px]'>표시 연락처</TableHead>
                      <TableHead>주소</TableHead>
                      <TableHead className='w-[100px]'>유형</TableHead>
                      <TableHead className='w-[200px]'>계약메모</TableHead>
                      <TableHead className='w-[100px]'>등록일</TableHead>
                      <TableHead className='w-[100px]'>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdvertisers.map((advertiser) => (
                      <TableRow key={advertiser.id}>
                        <TableCell className='font-medium'>
                          {advertiser.businessName}
                        </TableCell>
                        <TableCell>{advertiser.representativeName}</TableCell>
                        <TableCell>{advertiser.contactPhoneNumber}</TableCell>
                        <TableCell>{advertiser.displayPhoneNumber || '-'}</TableCell>
                        <TableCell className='max-w-[200px] truncate'>
                          {advertiser.address}
                        </TableCell>
                        <TableCell>{renderTypeBadge(advertiser)}</TableCell>
                        <TableCell>
                          {editingMemoId === advertiser.id ? (
                            <div className='space-y-2'>
                              <Textarea
                                value={editingMemoValue}
                                onChange={(e) => setEditingMemoValue(e.target.value)}
                                placeholder='계약메모 입력...'
                                rows={3}
                                className='text-sm'
                                autoFocus
                              />
                              <div className='flex gap-1'>
                                <Button
                                  size='sm'
                                  onClick={() => handleSaveMemo(advertiser.id)}
                                >
                                  저장
                                </Button>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  onClick={() => {
                                    setEditingMemoId(null);
                                    setEditingMemoValue('');
                                  }}
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className='cursor-pointer hover:bg-muted/50 p-1 rounded min-h-[32px] text-sm'
                              onClick={() => {
                                setEditingMemoId(advertiser.id);
                                setEditingMemoValue(advertiser.contractMemo || '');
                              }}
                            >
                              {advertiser.contractMemo ? (
                                <span className='whitespace-pre-wrap line-clamp-2'>{advertiser.contractMemo}</span>
                              ) : (
                                <span className='text-muted-foreground'>클릭하여 입력</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {formatDate(advertiser.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-1'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleEdit(advertiser)}
                            >
                              <Edit className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDeleteClick(advertiser)}
                              disabled={
                                (advertiser.bannerCount || 0) > 0 ||
                                (advertiser.adCount || 0) > 0
                              }
                            >
                              <Trash2 className='h-4 w-4 text-destructive' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingAdvertiser ? '광고주 수정' : '광고주 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='businessName'>
                  상호명 <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='businessName'
                  value={form.businessName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, businessName: e.target.value }))
                  }
                  placeholder='상호명 입력'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='representativeName'>
                  대표자명 <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='representativeName'
                  value={form.representativeName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, representativeName: e.target.value }))
                  }
                  placeholder='대표자명 입력'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='contactPhoneNumber'>
                  연락처 <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='contactPhoneNumber'
                  value={form.contactPhoneNumber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, contactPhoneNumber: e.target.value }))
                  }
                  placeholder='010-0000-0000'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='displayPhoneNumber'>표시 연락처</Label>
                <Input
                  id='displayPhoneNumber'
                  value={form.displayPhoneNumber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, displayPhoneNumber: e.target.value }))
                  }
                  placeholder='앱에 표시될 연락처'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='email'>이메일</Label>
                <Input
                  id='email'
                  type='email'
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder='email@example.com'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='address'>
                  주소 <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='address'
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder='주소 입력'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>사업자등록증</Label>
                <ImageUpload
                  value={form.businessRegistration}
                  onChange={(url) =>
                    setForm((prev) => ({ ...prev, businessRegistration: url }))
                  }
                  bucket={BUCKET_NAME}
                  storagePath={`${STORAGE_PATH}/business-reg`}
                  accept='image/*,application/pdf'
                  maxSizeMB={10}
                />
              </div>
              <div className='space-y-2'>
                <Label>계약서</Label>
                <ImageUpload
                  value={form.contractDocument}
                  onChange={(url) =>
                    setForm((prev) => ({ ...prev, contractDocument: url }))
                  }
                  bucket={BUCKET_NAME}
                  storagePath={`${STORAGE_PATH}/contract-doc`}
                  accept='image/*,application/pdf'
                  maxSizeMB={10}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='contractMemo'>계약 메모</Label>
              <Textarea
                id='contractMemo'
                value={form.contractMemo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contractMemo: e.target.value }))
                }
                placeholder='계약 관련 메모'
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>광고주 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className='font-semibold'>{advertiserToDelete?.businessName}</span>
              을(를) 삭제하시겠습니까?
              <br />
              이 작업은 취소할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
