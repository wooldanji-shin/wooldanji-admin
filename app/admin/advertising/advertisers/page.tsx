'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  formatPhoneNumber,
  formatLandlineNumber,
  formatBusinessRegistrationNumber,
} from '@/lib/utils/format';

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
  businessRegistrationNumber: string | null;
  businessRegistration: string | null;
  contractDocument: string | null;
  contractMemo: string | null;
  searchTags: string[];
  createdBy: string | null;
  createdAt: string;
  // 조인 데이터
  bannerCount?: number;
  adCount?: number;
  // 광고 카테고리 (1:1 매칭)
  categoryId?: string | null;
  categoryName?: string | null;
  // 등록자 정보
  creatorName?: string | null;
}

interface Category {
  id: string;
  categoryName: string;
}

interface AdvertiserForm {
  businessName: string;
  representativeName: string;
  contactPhoneNumber: string;
  displayPhoneNumber: string;
  email: string;
  address: string;
  categoryId: string;
  businessRegistrationNumber: string;
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
  categoryId: '',
  businessRegistrationNumber: '',
  businessRegistration: '',
  contractDocument: '',
  contractMemo: '',
};

export default function AdvertisersPage() {
  const supabase = createClient();

  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCreator, setFilterCreator] = useState<string>('all');

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

      // 카테고리 목록 로드 (비활성화된 카테고리도 포함)
      const { data: categoriesData } = await supabase
        .from('ad_categories')
        .select('id, categoryName')
        .order('categoryName');

      setCategories(categoriesData || []);

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

      // 배너/광고 카운트, 카테고리, 등록자 정보 조회
      const advertiserIds = (advertisersData || []).map((a) => a.id);
      const creatorIds = [...new Set((advertisersData || []).map((a) => a.createdBy).filter(Boolean))] as string[];

      if (advertiserIds.length > 0) {
        // 배너 카운트
        const { data: bannerCounts } = await supabase
          .from('home_banners')
          .select('advertiserId')
          .in('advertiserId', advertiserIds);

        // 광고 정보 (카테고리 포함)
        const { data: adsData } = await supabase
          .from('advertisements')
          .select('advertiserId, categoryId, ad_categories(categoryName)')
          .in('advertiserId', advertiserIds);

        // 등록자 정보
        const creatorMap: Record<string, string> = {};
        if (creatorIds.length > 0) {
          const { data: usersData } = await supabase
            .from('user')
            .select('id, name')
            .in('id', creatorIds);

          (usersData || []).forEach((u: { id: string; name: string }) => {
            creatorMap[u.id] = u.name;
          });
        }

        // 카운트 매핑
        const bannerCountMap: Record<string, number> = {};
        const adCountMap: Record<string, number> = {};

        (bannerCounts || []).forEach((b) => {
          bannerCountMap[b.advertiserId] = (bannerCountMap[b.advertiserId] || 0) + 1;
        });

        (adsData || []).forEach((a: { advertiserId: string; categoryId: string | null; ad_categories: { categoryName: string } | null }) => {
          adCountMap[a.advertiserId] = (adCountMap[a.advertiserId] || 0) + 1;
        });

        // 카테고리 이름 매핑
        const categoryNameMap: Record<string, string> = {};
        (categoriesData || []).forEach((cat) => {
          categoryNameMap[cat.id] = cat.categoryName;
        });

        const advertisersWithCounts = (advertisersData || []).map((advertiser) => ({
          ...advertiser,
          bannerCount: bannerCountMap[advertiser.id] || 0,
          adCount: adCountMap[advertiser.id] || 0,
          categoryName: advertiser.categoryId ? categoryNameMap[advertiser.categoryId] || null : null,
          creatorName: advertiser.createdBy ? creatorMap[advertiser.createdBy] || null : null,
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

  // 등록자 목록 (필터용)
  const creators = useMemo(() => {
    const creatorMap = new Map<string, string>();
    advertisers.forEach((a) => {
      if (a.createdBy && a.creatorName) {
        creatorMap.set(a.createdBy, a.creatorName);
      }
    });
    return Array.from(creatorMap, ([id, name]) => ({ id, name }));
  }, [advertisers]);

  // 검색 및 필터
  const filteredAdvertisers = advertisers.filter((a) => {
    // 검색어 필터
    const matchesSearch =
      a.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.representativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.address.toLowerCase().includes(searchQuery.toLowerCase());

    // 카테고리 필터
    const matchesCategory =
      filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !a.categoryId) ||
      a.categoryId === filterCategory;

    // 유형 필터 (배너/광고)
    const hasBanner = (a.bannerCount || 0) > 0;
    const hasAd = (a.adCount || 0) > 0;
    const matchesType =
      filterType === 'all' ||
      (filterType === 'banner' && hasBanner) ||
      (filterType === 'ad' && hasAd) ||
      (filterType === 'none' && !hasBanner && !hasAd);

    // 등록자 필터
    const matchesCreator =
      filterCreator === 'all' || a.createdBy === filterCreator;

    return matchesSearch && matchesCategory && matchesType && matchesCreator;
  });

  // 카테고리별로 광고주 그룹화
  const groupedAdvertisersByCategory = useMemo(() => {
    const grouped: Record<string, { categoryName: string; advertisers: Advertiser[] }> = {};

    filteredAdvertisers.forEach((advertiser) => {
      const categoryKey = advertiser.categoryId || 'uncategorized';
      const categoryName = advertiser.categoryName || '미분류';

      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          categoryName,
          advertisers: [],
        };
      }
      grouped[categoryKey].advertisers.push(advertiser);
    });

    return grouped;
  }, [filteredAdvertisers]);

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
      categoryId: advertiser.categoryId || '',
      businessRegistrationNumber: advertiser.businessRegistrationNumber || '',
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
        categoryId: form.categoryId || null,
        businessRegistrationNumber: form.businessRegistrationNumber.trim() || null,
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
        <div className='space-y-4'>
          {/* 헤더 카드 */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3'>
              <CardTitle className='flex items-center gap-2'>
                <Building2 className='h-5 w-5' />
                광고주 목록
              </CardTitle>
              <Button onClick={handleAdd}>
                <Plus className='h-4 w-4 mr-2' />
                광고주 등록
              </Button>
            </CardHeader>
            <CardContent className='space-y-3'>
              {/* 검색 */}
              <div className='relative w-full'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='상호명, 대표자명, 주소 검색...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-9 w-full'
                />
              </div>
              {/* 필터 */}
              <div className='flex flex-wrap gap-2'>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className='w-[150px]'>
                    <SelectValue placeholder='카테고리' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>전체 카테고리</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                    <SelectItem value='uncategorized'>미분류</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className='w-[130px]'>
                    <SelectValue placeholder='유형' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>전체 유형</SelectItem>
                    <SelectItem value='banner'>배너</SelectItem>
                    <SelectItem value='ad'>광고</SelectItem>
                    <SelectItem value='none'>없음</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCreator} onValueChange={setFilterCreator}>
                  <SelectTrigger className='w-[130px]'>
                    <SelectValue placeholder='등록자' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>전체 등록자</SelectItem>
                    {creators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 광고주 목록 - 카테고리별로 분리 */}
          {Object.keys(groupedAdvertisersByCategory).length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <div className='flex flex-col items-center justify-center py-16 text-center'>
                  <Building2 className='h-16 w-16 text-muted-foreground mb-4' />
                  <h3 className='text-lg font-medium mb-2'>광고주가 없습니다</h3>
                  <p className='text-sm text-muted-foreground mb-6'>
                    {searchQuery
                      ? '검색 조건에 맞는 광고주가 없습니다. 다른 조건으로 시도해보세요.'
                      : '새로운 광고주를 등록하여 시작하세요.'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={handleAdd} size='lg'>
                      <Plus className='mr-2 h-5 w-5' />첫 광고주 등록하기
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedAdvertisersByCategory).map(([categoryId, { categoryName, advertisers: categoryAdvertisers }]) => (
              <Card key={categoryId}>
                <CardContent className='pt-6'>
                  <div className='mb-4 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div className='text-lg font-semibold'>{categoryName}</div>
                      <Badge variant='secondary' className='text-sm'>
                        {categoryAdvertisers.length}개
                      </Badge>
                    </div>
                  </div>
                  <div className='rounded-lg border overflow-hidden'>
                    <div className='overflow-x-auto'>
                      <Table className='w-full'>
                        <TableHeader>
                          <TableRow className='bg-muted/50'>
                            <TableHead className='w-[180px]'>상호명</TableHead>
                            <TableHead className='w-[120px]'>대표자명</TableHead>
                            <TableHead className='w-[140px]'>연락처</TableHead>
                            <TableHead className='w-[140px]'>표시 연락처</TableHead>
                            <TableHead>주소</TableHead>
                            <TableHead className='w-[100px]'>유형</TableHead>
                            <TableHead className='w-[200px]'>계약메모</TableHead>
                            <TableHead className='w-[80px]'>등록자</TableHead>
                            <TableHead className='w-[100px]'>등록일</TableHead>
                            <TableHead className='w-[100px]'>작업</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryAdvertisers.map((advertiser) => (
                            <TableRow key={advertiser.id} className='hover:bg-muted/50 transition-colors'>
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
                              <TableCell className='text-sm'>
                                {advertiser.creatorName || '-'}
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
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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
            {/* Row 1: 상호명, 대표자명 */}
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

            {/* Row 2: 카테고리, 사업자등록번호 */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='categoryId'>카테고리</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, categoryId: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='카테고리를 선택하세요' />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='businessRegistrationNumber'>사업자등록번호</Label>
                <Input
                  id='businessRegistrationNumber'
                  value={form.businessRegistrationNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      businessRegistrationNumber: formatBusinessRegistrationNumber(e.target.value),
                    }))
                  }
                  placeholder='000-00-000000'
                  maxLength={13}
                />
              </div>
            </div>

            {/* Row 3: 연락처, 표시 연락처 */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='contactPhoneNumber'>
                  연락처 <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='contactPhoneNumber'
                  value={form.contactPhoneNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      contactPhoneNumber: formatPhoneNumber(e.target.value),
                    }))
                  }
                  placeholder='010-0000-0000'
                  maxLength={13}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='displayPhoneNumber'>표시 연락처</Label>
                <Input
                  id='displayPhoneNumber'
                  value={form.displayPhoneNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      displayPhoneNumber: formatLandlineNumber(e.target.value),
                    }))
                  }
                  placeholder='02-123-1234 / 031-123-1234'
                  maxLength={13}
                />
              </div>
            </div>

            {/* Row 4: 이메일, 주소 */}
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

            {/* Row 5: 사업자등록증, 계약서 */}
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

            {/* Row 6: 계약 메모 (전체 너비) */}
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
