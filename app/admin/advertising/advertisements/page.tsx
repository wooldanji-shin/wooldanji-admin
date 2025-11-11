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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  MapPin,
  Building2,
  Calendar,
  Tag,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Check,
  ChevronsUpDown,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/image-upload';

interface Advertisement {
  id: string;
  advertiserId: string;
  categoryId: string | null;
  adType: 'NEIGHBORHOOD' | 'REGION';
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  startDate: string;
  endDate: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  advertisers: {
    businessName: string;
    contractEndDate: string;
    isActive: boolean;
  };
  ad_categories: {
    categoryName: string;
  } | null;
  advertisement_apartments?: {
    apartments: {
      name: string;
    };
  }[];
  advertisement_regions?: {
    regionSido: string;
    regionSigungu: string | null;
    regionDong: string | null;
  }[];
  user?: {
    name: string;
  };
}

interface Advertiser {
  id: string;
  businessName: string;
  isActive: boolean;
}

interface AdCategory {
  id: string;
  categoryName: string;
  isActive: boolean;
}

interface Apartment {
  id: string;
  name: string;
  address: string;
}

type AdStatus = 'pending' | 'scheduled' | 'active' | 'ended';

export default function AdvertisementsPage() {
  const supabase = createClient();

  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<AdCategory[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AdStatus>('all');
  const [adTypeFilter, setAdTypeFilter] = useState<'all' | 'NEIGHBORHOOD' | 'REGION'>('all');
  const [selectedApartmentFilters, setSelectedApartmentFilters] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>('all');

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [currentAdId, setCurrentAdId] = useState<string>(''); // 현재 편집 중인 광고 ID (신규는 UUID)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>(''); // 업로드된 이미지 추적
  const [form, setForm] = useState({
    advertiserId: '',
    categoryId: '',
    adType: 'NEIGHBORHOOD' as 'NEIGHBORHOOD' | 'REGION',
    title: '',
    imageUrl: '',
    linkUrl: '',
    startDate: '',
    endDate: '',
    selectedApartments: [] as string[],
    selectedRegions: [] as Array<{ sido: string; sigungu: string; dong: string }>,
    // 임시 입력 필드 (지역 추가 전)
    regionSido: '',
    regionSigungu: '',
    regionDong: '',
    isActive: true,
  });

  // Combobox states
  const [advertiserComboOpen, setAdvertiserComboOpen] = useState(false);
  const [apartmentComboOpen, setApartmentComboOpen] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingAd, setDeletingAd] = useState<Advertisement | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      // SUPER_ADMIN 권한 확인
      const roles = await getUserRoles();
      setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
    };
    fetchUser();
  }, []);

  // 광고 목록 조회
  const fetchAdvertisements = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isSuperAdmin = roles.includes('SUPER_ADMIN');

      let query = supabase
        .from('advertisements')
        .select(`
          *,
          advertisers(businessName, contractEndDate, isActive),
          ad_categories(categoryName),
          advertisement_apartments(
            apartments:apartmentId(name)
          ),
          advertisement_regions(
            regionSido,
            regionSigungu,
            regionDong
          ),
          user:createdBy(name)
        `)
        .order('categoryId', { ascending: true })
        .order('orderIndex', { ascending: true });

      // SUPER_ADMIN이 아니면 자신이 등록한 광고만 조회
      if (!isSuperAdmin) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setAdvertisements(data || []);
    } catch (err) {
      console.error('Failed to fetch advertisements:', err);
      setError('광고 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUserId]);

  // 상호명 목록 조회 (자신이 등록한 광고주만)
  const fetchAdvertisers = useCallback(async () => {
    if (!currentUserId) return;

    const { data } = await supabase
      .from('advertisers')
      .select('id, businessName, isActive')
      .eq('createdBy', currentUserId)  // Only show own advertisers
      .eq('isActive', true)
      .order('businessName');
    setAdvertisers(data || []);
  }, [supabase, currentUserId]);

  // 카테고리 목록 조회
  const fetchCategories = async () => {
    const { data } = await supabase
      .from('ad_categories')
      .select('id, categoryName, isActive')
      .eq('isActive', true)
      .order('orderIndex');
    setCategories(data || []);
  };

  // 아파트 목록 조회 (매니저는 자신이 등록한 아파트만)
  const fetchApartments = useCallback(async () => {
    if (!currentUserId) return;

    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isSuperAdmin = roles.includes('SUPER_ADMIN');

      if (isSuperAdmin) {
        // SUPER_ADMIN은 모든 아파트 조회
        const { data } = await supabase
          .from('apartments')
          .select('id, name, address')
          .order('name');
        setApartments(data || []);
      } else {
        // 매니저는 자신이 등록한 아파트만 조회
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId, apartments:apartmentId(id, name, address)')
          .eq('managerId', currentUserId);

        if (managerApartments) {
          const apartments = managerApartments
            .filter((ma: any) => ma.apartments)
            .map((ma: any) => ma.apartments)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
          setApartments(apartments);
        } else {
          setApartments([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
      setApartments([]);
    }
  }, [supabase, currentUserId]);

  // 매니저 목록 조회 (SUPER_ADMIN만)
  const fetchManagers = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('userId, user:userId(id, name)')
        .in('role', ['MANAGER', 'SUPER_ADMIN']);

      if (error) throw error;

      // 중복 제거 및 매니저 목록 생성
      const uniqueManagers = data
        ?.filter((item: any) => item.user)
        .map((item: any) => ({
          id: item.user.id,
          name: item.user.name,
        }))
        .filter((manager, index, self) =>
          index === self.findIndex((m) => m.id === manager.id)
        ) || [];

      setManagers(uniqueManagers);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
    }
  }, [supabase, isSuperAdmin]);

  useEffect(() => {
    fetchAdvertisements();
    fetchAdvertisers();
    fetchCategories();
    fetchApartments();
    if (isSuperAdmin) {
      fetchManagers();
    }
  }, [fetchAdvertisements, fetchAdvertisers, fetchApartments, fetchManagers, isSuperAdmin]);

  // 광고 상태 계산 (수동 활성화 + 상호명 활성화 + 광고 날짜 + 계약기간 모두 고려)
  const getAdStatus = (ad: Advertisement): AdStatus => {
    // 광고 자체가 비활성화되어 있으면 대기중 (수동 활성화 필요)
    if (!ad.isActive) return 'pending';

    // 상호명(광고주)이 비활성화되어 있으면 무조건 종료
    if (!ad.advertisers.isActive) return 'ended';

    const now = new Date();
    const start = new Date(ad.startDate);
    const adEnd = new Date(ad.endDate);
    const contractEnd = new Date(ad.advertisers.contractEndDate);

    // 실제 종료일은 광고 종료일과 계약 종료일 중 더 빠른 것
    const actualEnd = adEnd < contractEnd ? adEnd : contractEnd;

    // endDate는 해당 날짜의 23:59:59까지 포함
    const endOfActualEndDay = new Date(actualEnd);
    endOfActualEndDay.setHours(23, 59, 59, 999);

    if (now < start) return 'scheduled';  // 예정 (활성화되었지만 아직 시작 전)
    if (now > endOfActualEndDay) return 'ended';  // 종료됨 (계약/기간 종료)
    return 'active';  // 진행중
  };

  // 통계 계산
  const stats = {
    total: advertisements.length,
    pending: advertisements.filter((ad) => getAdStatus(ad) === 'pending').length,
    active: advertisements.filter((ad) => getAdStatus(ad) === 'active').length,
    scheduled: advertisements.filter((ad) => getAdStatus(ad) === 'scheduled').length,
    ended: advertisements.filter((ad) => getAdStatus(ad) === 'ended').length,
  };

  // 카테고리별 카운트
  const categoryCounts = categories.reduce(
    (acc, category) => {
      acc[category.id] = advertisements.filter((ad) => ad.categoryId === category.id).length;
      return acc;
    },
    {} as Record<string, number>
  );

  // 지역 목록 추출 (중복 제거)
  const regions = Array.from(
    new Set(
      advertisements
        .filter((ad) => ad.adType === 'REGION' && ad.regionSido)
        .map((ad) => ad.regionSido!)
    )
  ).sort();

  // 필터링된 광고 목록
  const filteredAds = advertisements.filter((ad) => {
    // 검색
    const matchesSearch =
      ad.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.advertisers?.businessName?.toLowerCase().includes(searchQuery.toLowerCase());

    // 카테고리
    const matchesCategory =
      selectedCategory === 'all' || ad.categoryId === selectedCategory;

    // 상태 (날짜 기준)
    const adStatus = getAdStatus(ad);
    const matchesStatus = statusFilter === 'all' || adStatus === statusFilter;

    // 광고 타입 필터
    const matchesAdType =
      adTypeFilter === 'all' || ad.adType === adTypeFilter;

    // 아파트 필터 (동네관리 선택 시)
    const matchesApartment =
      selectedApartmentFilters.length === 0 ||
      (ad.adType === 'NEIGHBORHOOD' &&
        ad.advertisement_apartments?.some((aa) =>
          selectedApartmentFilters.includes(aa.apartments.name)
        ));

    // 매니저 필터 (SUPER_ADMIN만)
    const matchesManager =
      selectedManager === 'all' || ad.createdBy === selectedManager;

    return matchesSearch && matchesCategory && matchesStatus && matchesAdType && matchesApartment && matchesManager;
  });

  // 광고 생성/수정
  const handleSave = async () => {
    if (!form.advertiserId || !form.title || !form.startDate || !form.endDate) {
      setError('필수 항목을 입력해주세요.');
      return;
    }

    if (form.adType === 'NEIGHBORHOOD' && form.selectedApartments.length === 0) {
      setError('동네 광고는 최소 하나의 아파트를 선택해야 합니다.');
      return;
    }

    if (form.adType === 'REGION' && form.selectedRegions.length === 0) {
      setError('지역 광고는 최소 하나의 지역을 선택해야 합니다.');
      return;
    }

    try {
      let adData: any = {
        advertiserId: form.advertiserId,
        categoryId: form.categoryId || null,
        adType: form.adType,
        title: form.title,
        imageUrl: form.imageUrl || '',
        linkUrl: form.linkUrl || null,
        startDate: new Date(form.startDate + 'T00:00:00+09:00').toISOString(),
        endDate: new Date(form.endDate + 'T23:59:59+09:00').toISOString(),
        createdBy: currentUserId,
        isActive: form.isActive,
      };

      // 새 광고 추가 시 orderIndex 자동 설정 (같은 카테고리 내 마지막 순서)
      if (!editingAd && form.categoryId) {
        const { data: sameCategoryAds } = await supabase
          .from('advertisements')
          .select('orderIndex')
          .eq('categoryId', form.categoryId)
          .order('orderIndex', { ascending: false })
          .limit(1);

        const maxOrder = sameCategoryAds && sameCategoryAds.length > 0
          ? sameCategoryAds[0].orderIndex
          : -1;
        adData.orderIndex = maxOrder + 1;
      }

      if (editingAd) {
        // 수정
        const { error: updateError } = await supabase
          .from('advertisements')
          .update(adData)
          .eq('id', editingAd.id);

        if (updateError) throw updateError;

        // 동네 광고인 경우 아파트 연결 업데이트
        if (form.adType === 'NEIGHBORHOOD') {
          // 기존 연결 삭제
          await supabase
            .from('advertisement_apartments')
            .delete()
            .eq('advertisementId', editingAd.id);

          // 새 연결 추가
          if (form.selectedApartments.length > 0) {
            await supabase
              .from('advertisement_apartments')
              .insert(
                form.selectedApartments.map(aptId => ({
                  advertisementId: editingAd.id,
                  apartmentId: aptId,
                }))
              );
          }
        }

        // 지역 광고인 경우 지역 연결 업데이트
        if (form.adType === 'REGION') {
          // 기존 연결 삭제
          await supabase
            .from('advertisement_regions')
            .delete()
            .eq('advertisementId', editingAd.id);

          // 새 연결 추가
          if (form.selectedRegions.length > 0) {
            await supabase
              .from('advertisement_regions')
              .insert(
                form.selectedRegions.map(region => ({
                  advertisementId: editingAd.id,
                  regionSido: region.sido,
                  regionSigungu: region.sigungu || null,
                  regionDong: region.dong || null,
                }))
              );
          }
        }
      } else {
        // 생성
        const { data: newAd, error: insertError } = await supabase
          .from('advertisements')
          .insert(adData)
          .select()
          .single();

        if (insertError) throw insertError;

        // 동네 광고인 경우 아파트 연결
        if (form.adType === 'NEIGHBORHOOD' && newAd && form.selectedApartments.length > 0) {
          await supabase
            .from('advertisement_apartments')
            .insert(
              form.selectedApartments.map(aptId => ({
                advertisementId: newAd.id,
                apartmentId: aptId,
              }))
            );
        }

        // 지역 광고인 경우 지역 연결
        if (form.adType === 'REGION' && newAd && form.selectedRegions.length > 0) {
          await supabase
            .from('advertisement_regions')
            .insert(
              form.selectedRegions.map(region => ({
                advertisementId: newAd.id,
                regionSido: region.sido,
                regionSigungu: region.sigungu || null,
                regionDong: region.dong || null,
              }))
            );
        }
      }

      // 저장 성공 시 uploadedImageUrl 초기화 (다이얼로그 닫힐 때 삭제 방지)
      setUploadedImageUrl('');
      setIsDialogOpen(false);
      resetForm();
      fetchAdvertisements();
    } catch (err: any) {
      console.error('Failed to save advertisement:', err);
      setError(err.message || '광고 저장에 실패했습니다.');
    }
  };

  // 광고 삭제
  const handleDeleteClick = (ad: Advertisement) => {
    setDeletingAd(ad);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAd) return;

    try {
      // 1. Storage에서 광고 이미지 삭제
      if (deletingAd.imageUrl) {
        try {
          const bucket = 'advertisements';
          // URL에서 경로 추출: ads/{category}/{ad-id}.jpg
          const urlParts = deletingAd.imageUrl.split('/');
          const storagePathIndex = urlParts.indexOf('advertisements');
          if (storagePathIndex !== -1) {
            const path = urlParts.slice(storagePathIndex + 1).join('/');
            await supabase.storage.from(bucket).remove([path]);
            console.log('Deleted advertisement image:', path);
          }
        } catch (storageError) {
          console.error('Failed to delete advertisement image from storage:', storageError);
          // Storage 삭제 실패해도 계속 진행
        }
      }

      // 2. DB에서 광고 삭제
      const { error: deleteError } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', deletingAd.id);

      if (deleteError) throw deleteError;

      setDeleteDialog(false);
      setDeletingAd(null);
      fetchAdvertisements();
    } catch (err) {
      console.error('Failed to delete advertisement:', err);
      setError('광고 삭제에 실패했습니다.');
    }
  };

  // 광고 활성화/비활성화 토글
  const handleToggleActive = async (ad: Advertisement) => {
    try {
      const { error: updateError } = await supabase
        .from('advertisements')
        .update({ isActive: !ad.isActive })
        .eq('id', ad.id);

      if (updateError) throw updateError;

      fetchAdvertisements();
    } catch (err) {
      console.error('Failed to toggle advertisement:', err);
      setError('광고 상태 변경에 실패했습니다.');
    }
  };

  // 광고 순서 변경 (같은 카테고리 내에서만)
  const handleMoveOrder = async (ad: Advertisement, direction: 'up' | 'down') => {
    try {
      // 같은 카테고리의 광고들만 필터링
      const sameCategory = filteredAds.filter(a => a.categoryId === ad.categoryId);
      const currentIndex = sameCategory.findIndex(a => a.id === ad.id);

      if (direction === 'up' && currentIndex === 0) return; // 첫 번째는 위로 못 감
      if (direction === 'down' && currentIndex === sameCategory.length - 1) return; // 마지막은 아래로 못 감

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetAd = sameCategory[targetIndex];

      // 두 광고의 orderIndex를 서로 바꿈
      await supabase
        .from('advertisements')
        .update({ orderIndex: targetAd.orderIndex })
        .eq('id', ad.id);

      await supabase
        .from('advertisements')
        .update({ orderIndex: ad.orderIndex })
        .eq('id', targetAd.id);

      fetchAdvertisements();
    } catch (err) {
      console.error('Failed to change order:', err);
      setError('순서 변경에 실패했습니다.');
    }
  };

  // 편집 시작
  const handleEditClick = async (ad: Advertisement) => {
    setEditingAd(ad);
    setCurrentAdId(ad.id);
    setUploadedImageUrl(ad.imageUrl || '');

    // 동네 광고인 경우 연결된 아파트 조회
    let selectedApts: string[] = [];
    if (ad.adType === 'NEIGHBORHOOD') {
      const { data } = await supabase
        .from('advertisement_apartments')
        .select('apartmentId')
        .eq('advertisementId', ad.id);
      selectedApts = data?.map(a => a.apartmentId) || [];
    }

    // 지역 광고인 경우 연결된 지역 조회
    let selectedRegs: Array<{ sido: string; sigungu: string; dong: string }> = [];
    if (ad.adType === 'REGION' && ad.advertisement_regions && ad.advertisement_regions.length > 0) {
      selectedRegs = ad.advertisement_regions.map(r => ({
        sido: r.regionSido,
        sigungu: r.regionSigungu || '',
        dong: r.regionDong || '',
      }));
    }

    setForm({
      advertiserId: ad.advertiserId,
      categoryId: ad.categoryId || '',
      adType: ad.adType,
      title: ad.title,
      imageUrl: ad.imageUrl || '',
      linkUrl: ad.linkUrl || '',
      startDate: ad.startDate?.split('T')[0] || '',
      endDate: ad.endDate?.split('T')[0] || '',
      selectedApartments: selectedApts,
      selectedRegions: selectedRegs,
      regionSido: '',
      regionSigungu: '',
      regionDong: '',
      isActive: ad.isActive,
    });
    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingAd(null);
    // 새 광고를 위한 고유 ID 생성
    const newId = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCurrentAdId(newId);
    setUploadedImageUrl('');
    setForm({
      advertiserId: '',
      categoryId: '',
      adType: 'NEIGHBORHOOD',
      regionSido: '',
      regionSigungu: '',
      regionDong: '',
      title: '',
      imageUrl: '',
      linkUrl: '',
      startDate: '',
      endDate: '',
      selectedApartments: [],
      selectedRegions: [],
      isActive: false, // 새 광고는 기본적으로 비활성화 상태 (수동으로 활성화 필요)
    });
  };

  // 다이얼로그 닫기 처리 (취소 시 업로드된 이미지 삭제)
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      // 다이얼로그가 닫힐 때
      // 이미지가 업로드되었으나 저장되지 않았다면 삭제
      // (저장 성공 시 uploadedImageUrl이 리셋되므로, 값이 있다면 저장하지 않고 닫은 것)
      if (uploadedImageUrl) {
        try {
          const bucket = 'advertisements';
          const path = uploadedImageUrl.split('/').slice(-3).join('/'); // bucket 이후 경로 추출
          await supabase.storage.from(bucket).remove([path]);
          console.log('Deleted unused uploaded image:', path);
        } catch (err) {
          console.error('Failed to delete uploaded image:', err);
        }
      }
      setUploadedImageUrl('');
    }
    setIsDialogOpen(open);
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='광고 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Statistics Dashboard */}
        <div className='grid grid-cols-5 gap-3'>
          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              statusFilter === 'all' && 'ring-2 ring-primary'
            )}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className='p-3'>
              <p className='text-xs text-muted-foreground mb-1'>전체</p>
              <p className='text-xl font-bold'>{stats.total}</p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              statusFilter === 'active' && 'ring-2 ring-green-600'
            )}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          >
            <CardContent className='p-3'>
              <p className='text-xs text-muted-foreground mb-1'>진행중</p>
              <p className='text-xl font-bold text-green-600'>{stats.active}</p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              statusFilter === 'pending' && 'ring-2 ring-yellow-600'
            )}
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            <CardContent className='p-3'>
              <p className='text-xs text-muted-foreground mb-1'>대기중</p>
              <p className='text-xl font-bold text-yellow-600'>{stats.pending}</p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              statusFilter === 'scheduled' && 'ring-2 ring-blue-600'
            )}
            onClick={() => setStatusFilter(statusFilter === 'scheduled' ? 'all' : 'scheduled')}
          >
            <CardContent className='p-3'>
              <p className='text-xs text-muted-foreground mb-1'>예정</p>
              <p className='text-xl font-bold text-blue-600'>{stats.scheduled}</p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              statusFilter === 'ended' && 'ring-2 ring-gray-600'
            )}
            onClick={() => setStatusFilter(statusFilter === 'ended' ? 'all' : 'ended')}
          >
            <CardContent className='p-3'>
              <p className='text-xs text-muted-foreground mb-1'>종료됨</p>
              <p className='text-xl font-bold text-gray-600'>{stats.ended}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions */}
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between'>
            <div className='relative flex-1 w-full'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='광고 제목, 상호명으로 검색...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-10'
              />
            </div>
            <Button onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className='h-4 w-4 mr-2' />
              광고 추가
            </Button>
          </div>

          {/* Filter Controls */}
          <div className='flex flex-wrap gap-4'>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | AdStatus)}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='상태' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>전체 상태</SelectItem>
                <SelectItem value='pending'>대기중</SelectItem>
                <SelectItem value='active'>진행중</SelectItem>
                <SelectItem value='scheduled'>예정</SelectItem>
                <SelectItem value='ended'>종료됨</SelectItem>
              </SelectContent>
            </Select>

            <Select value={adTypeFilter} onValueChange={(value) => {
              setAdTypeFilter(value as 'all' | 'NEIGHBORHOOD' | 'REGION');
            }}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='광고 타입' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>전체 타입</SelectItem>
                <SelectItem value='NEIGHBORHOOD'>동네관리</SelectItem>
                <SelectItem value='REGION'>지역관리</SelectItem>
              </SelectContent>
            </Select>

            {apartments.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    className='w-[250px] justify-between'
                  >
                    {selectedApartmentFilters.length === 0
                      ? '아파트 선택...'
                      : `${selectedApartmentFilters.length}개 아파트 선택됨`}
                    <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-[250px] p-0'>
                  <Command>
                    <CommandInput placeholder='아파트 검색...' />
                    <CommandList>
                      <CommandEmpty>아파트를 찾을 수 없습니다.</CommandEmpty>
                      <CommandGroup>
                        {apartments.map((apartment) => (
                          <CommandItem
                            key={apartment.id}
                            onSelect={() => {
                              setSelectedApartmentFilters((prev) =>
                                prev.includes(apartment.name)
                                  ? prev.filter((name) => name !== apartment.name)
                                  : [...prev, apartment.name]
                              );
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedApartmentFilters.includes(apartment.name)
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              }`}
                            />
                            {apartment.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {selectedApartmentFilters.length > 0 && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSelectedApartmentFilters([])}
              >
                <X className='h-4 w-4 mr-1' />
                필터 초기화
              </Button>
            )}

            {isSuperAdmin && managers.length > 0 && (
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue placeholder='매니저 선택' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>전체 매니저</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected Apartment Filters Display */}
          {selectedApartmentFilters.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {selectedApartmentFilters.map((apartmentName) => (
                <Badge key={apartmentName} variant='secondary' className='text-xs'>
                  {apartmentName}
                  <button
                    onClick={() => {
                      setSelectedApartmentFilters((prev) =>
                        prev.filter((name) => name !== apartmentName)
                      );
                    }}
                    className='ml-1 hover:text-destructive'
                  >
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Category Tabs */}
        <div className='flex gap-2 flex-wrap'>
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setSelectedCategory('all')}
          >
            전체 <Badge variant='secondary' className='ml-2'>{advertisements.length}</Badge>
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size='sm'
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.categoryName} <Badge variant='secondary' className='ml-2'>{categoryCounts[category.id] || 0}</Badge>
            </Button>
          ))}
        </div>

        {/* Advertisements Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    {selectedCategory !== 'all' && (
                      <TableHead className='text-muted-foreground w-16'>순서</TableHead>
                    )}
                    <TableHead className='text-muted-foreground'>상호명</TableHead>
                    <TableHead className='text-muted-foreground'>광고 제목</TableHead>
                    <TableHead className='text-muted-foreground'>카테고리</TableHead>
                    <TableHead className='text-muted-foreground'>타입</TableHead>
                    <TableHead className='text-muted-foreground'>타겟</TableHead>
                    <TableHead className='text-muted-foreground'>게시기간</TableHead>
                    <TableHead className='text-muted-foreground'>상태</TableHead>
                    <TableHead className='text-muted-foreground'>등록자</TableHead>
                    <TableHead className='text-muted-foreground text-right'>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={selectedCategory !== 'all' ? 10 : 9} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : filteredAds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedCategory !== 'all' ? 10 : 9} className='text-center py-12 text-muted-foreground'>
                        {searchQuery ? '검색 결과가 없습니다.' : '광고가 없습니다.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAds.map((ad, index) => {
                      const adStatus = getAdStatus(ad);

                      return (
                        <TableRow key={ad.id} className='border-border hover:bg-secondary/50'>
                          {selectedCategory !== 'all' && (
                            <TableCell className='text-muted-foreground font-mono'>{index + 1}</TableCell>
                          )}
                          <TableCell>{ad.advertisers?.businessName}</TableCell>
                          <TableCell className='font-medium'>{ad.title}</TableCell>
                          <TableCell>
                            {ad.ad_categories ? (
                              <Badge variant='outline'>
                                <Tag className='h-3 w-3 mr-1' />
                                {ad.ad_categories.categoryName}
                              </Badge>
                            ) : (
                              <span className='text-muted-foreground text-sm'>-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {ad.adType === 'NEIGHBORHOOD' ? (
                              <Badge variant='default'>동네광고</Badge>
                            ) : (
                              <Badge variant='secondary'>지역광고</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {ad.adType === 'NEIGHBORHOOD' ? (
                              <div className='flex flex-wrap gap-1'>
                                {ad.advertisement_apartments?.slice(0, 1).map((aa: any, idx: number) => (
                                  <Badge key={idx} variant='outline' className='text-xs'>
                                    <Building2 className='h-3 w-3 mr-1' />
                                    {aa.apartments?.name}
                                  </Badge>
                                ))}
                                {(ad.advertisement_apartments?.length || 0) > 1 && (
                                  <Badge variant='outline' className='text-xs'>
                                    +{(ad.advertisement_apartments?.length || 0) - 1}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className='flex flex-wrap gap-1'>
                                {ad.advertisement_regions?.slice(0, 1).map((region: any, idx: number) => {
                                  const regionText = [region.regionSido, region.regionSigungu, region.regionDong]
                                    .filter(Boolean)
                                    .join(' ');
                                  return (
                                    <Badge key={idx} variant='outline' className='text-xs'>
                                      <MapPin className='h-3 w-3 mr-1' />
                                      {regionText}
                                    </Badge>
                                  );
                                })}
                                {(ad.advertisement_regions?.length || 0) > 1 && (
                                  <Badge variant='outline' className='text-xs'>
                                    +{(ad.advertisement_regions?.length || 0) - 1}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className='text-muted-foreground text-sm'>
                            <div className='flex items-center gap-1'>
                              <Calendar className='h-3 w-3' />
                              {new Date(ad.startDate).toLocaleDateString('ko-KR')}
                            </div>
                            <div>~ {new Date(ad.endDate).toLocaleDateString('ko-KR')}</div>
                          </TableCell>
                          <TableCell>
                            {adStatus === 'pending' && (
                              <Badge className='bg-yellow-500'>대기중</Badge>
                            )}
                            {adStatus === 'active' && (
                              <Badge className='bg-green-500'>진행중</Badge>
                            )}
                            {adStatus === 'scheduled' && (
                              <Badge className='bg-blue-500'>예정</Badge>
                            )}
                            {adStatus === 'ended' && (
                              <Badge variant='secondary'>종료됨</Badge>
                            )}
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {ad.user?.name || '알 수 없음'}
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex justify-end gap-1'>
                              {/* 순서 조정 버튼 (전체 탭이 아니고, 카테고리가 있을 때만 표시) */}
                              {selectedCategory !== 'all' && ad.categoryId && (
                                <>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => handleMoveOrder(ad, 'up')}
                                    title='위로'
                                    disabled={
                                      filteredAds
                                        .filter(a => a.categoryId === ad.categoryId)
                                        .findIndex(a => a.id === ad.id) === 0
                                    }
                                  >
                                    <ChevronUp className='h-4 w-4' />
                                  </Button>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => handleMoveOrder(ad, 'down')}
                                    title='아래로'
                                    disabled={
                                      filteredAds
                                        .filter(a => a.categoryId === ad.categoryId)
                                        .findIndex(a => a.id === ad.id) ===
                                      filteredAds.filter(a => a.categoryId === ad.categoryId).length - 1
                                    }
                                  >
                                    <ChevronDown className='h-4 w-4' />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleToggleActive(ad)}
                                title={ad.isActive ? '비활성화' : '활성화'}
                              >
                                {ad.isActive ? (
                                  <span className='text-green-600'>✓</span>
                                ) : (
                                  <span className='text-gray-400'>○</span>
                                )}
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleEditClick(ad)}
                              >
                                <Edit className='h-4 w-4' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => handleDeleteClick(ad)}
                                className='text-destructive hover:text-destructive'
                              >
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[700px]'>
          <DialogHeader>
            <DialogTitle>{editingAd ? '광고 수정' : '광고 추가'}</DialogTitle>
            <DialogDescription>
              광고 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4 max-h-[70vh] overflow-y-auto'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>상호명 *</Label>
                <Popover open={advertiserComboOpen} onOpenChange={setAdvertiserComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      role='combobox'
                      aria-expanded={advertiserComboOpen}
                      className='w-full justify-between'
                    >
                      {form.advertiserId
                        ? advertisers.find((adv) => adv.id === form.advertiserId)?.businessName
                        : '상호명 검색...'}
                      <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-[300px] p-0' align='start'>
                    <Command>
                      <CommandInput placeholder='상호명 검색...' />
                      <CommandList className='max-h-[300px]'>
                        <CommandEmpty>상호명을 찾을 수 없습니다.</CommandEmpty>
                        <CommandGroup>
                          {advertisers.map((adv) => (
                            <CommandItem
                              key={adv.id}
                              value={adv.businessName}
                              onSelect={() => {
                                setForm({ ...form, advertiserId: adv.id });
                                setAdvertiserComboOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  form.advertiserId === adv.id ? 'opacity-100' : 'opacity-0'
                                }`}
                              />
                              {adv.businessName}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='categoryId'>카테고리</Label>
                <Select value={form.categoryId || 'none'} onValueChange={(value) => setForm({ ...form, categoryId: value === 'none' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder='카테고리 선택 (선택사항)' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>선택 안함</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='title'>광고 제목 *</Label>
              <Input
                id='title'
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder='신규 회원 50% 할인 이벤트'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='linkUrl'>링크 URL</Label>
              <Input
                id='linkUrl'
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder='https://example.com/promotion'
              />
            </div>

            <div className='space-y-2'>
              <Label>광고 이미지 *</Label>
              <ImageUpload
                bucket='advertisements'
                storagePath={`ads/${form.categoryId || 'uncategorized'}`}
                fileName={currentAdId}
                value={form.imageUrl}
                onChange={(url) => {
                  setForm({ ...form, imageUrl: url });
                  setUploadedImageUrl(url);
                }}
                accept='image/*'
                maxSizeMB={5}
                previewSize='md'
                description='최대 5MB'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='startDate'>게시 시작일 *</Label>
                <Input
                  id='startDate'
                  type='date'
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='endDate'>게시 종료일 *</Label>
                <Input
                  id='endDate'
                  type='date'
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className='border-t pt-4'>
              <h4 className='font-medium mb-4'>광고 타입</h4>
              <div className='space-y-2'>
                <Select value={form.adType} onValueChange={(value: 'NEIGHBORHOOD' | 'REGION') => setForm({ ...form, adType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='NEIGHBORHOOD'>동네 광고 (특정 아파트)</SelectItem>
                    <SelectItem value='REGION'>지역 광고 (시/도/구/동)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.adType === 'NEIGHBORHOOD' ? (
                <div className='mt-4 space-y-2'>
                  <Label>타겟 아파트 선택 *</Label>

                  {/* Selected apartments badges */}
                  {form.selectedApartments.length > 0 && (
                    <div className='flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50'>
                      {form.selectedApartments.map((aptId) => {
                        const apt = apartments.find(a => a.id === aptId);
                        if (!apt) return null;
                        return (
                          <Badge key={aptId} variant='secondary' className='pl-2 pr-1'>
                            {apt.name}
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-4 w-4 p-0 ml-1 hover:bg-transparent'
                              onClick={() => {
                                setForm({
                                  ...form,
                                  selectedApartments: form.selectedApartments.filter(id => id !== aptId)
                                });
                              }}
                            >
                              <X className='h-3 w-3' />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Apartment combobox */}
                  <Popover open={apartmentComboOpen} onOpenChange={setApartmentComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant='outline'
                        role='combobox'
                        aria-expanded={apartmentComboOpen}
                        className='w-full justify-between'
                      >
                        아파트 검색 및 추가...
                        <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-[500px] p-0' align='start'>
                      <Command>
                        <CommandInput placeholder='아파트 검색...' />
                        <CommandList className='max-h-[300px]'>
                          <CommandEmpty>아파트를 찾을 수 없습니다.</CommandEmpty>
                          <CommandGroup>
                            {apartments
                              .filter(apt => !form.selectedApartments.includes(apt.id))
                              .map((apt) => (
                                <CommandItem
                                  key={apt.id}
                                  value={`${apt.name} ${apt.address}`}
                                  onSelect={() => {
                                    setForm({
                                      ...form,
                                      selectedApartments: [...form.selectedApartments, apt.id]
                                    });
                                    setApartmentComboOpen(false);
                                  }}
                                >
                                  <Building2 className='mr-2 h-4 w-4' />
                                  <div className='flex flex-col'>
                                    <span className='font-medium'>{apt.name}</span>
                                    <span className='text-xs text-muted-foreground'>{apt.address}</span>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <p className='text-xs text-muted-foreground'>
                    선택된 아파트: {form.selectedApartments.length}개
                  </p>
                </div>
              ) : (
                <div className='mt-4 space-y-4'>
                  <Alert className='bg-muted/50 border-muted'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>
                      여러 지역을 추가할 수 있습니다. 시/도만 입력 시 해당 시/도 전체, 시/도 + 구 입력 시 해당 구 전체, 시/도 + 구 + 동 입력 시 해당 동에만 광고가 노출됩니다.
                    </AlertDescription>
                  </Alert>

                  <Label>타겟 지역 선택 *</Label>

                  {/* Selected regions badges */}
                  {form.selectedRegions.length > 0 && (
                    <div className='flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50'>
                      {form.selectedRegions.map((region, index) => {
                        const regionText = [region.sido, region.sigungu, region.dong]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <Badge key={index} variant='secondary' className='pl-2 pr-1'>
                            <MapPin className='h-3 w-3 mr-1' />
                            {regionText}
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-4 w-4 p-0 ml-1 hover:bg-transparent'
                              onClick={() => {
                                setForm({
                                  ...form,
                                  selectedRegions: form.selectedRegions.filter((_, i) => i !== index)
                                });
                              }}
                            >
                              <X className='h-3 w-3' />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Region input form */}
                  <div className='border rounded-md p-4 space-y-4'>
                    <div className='grid grid-cols-3 gap-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='regionSido'>시/도 *</Label>
                        <Input
                          id='regionSido'
                          value={form.regionSido}
                          onChange={(e) => setForm({ ...form, regionSido: e.target.value })}
                          placeholder='예: 서울'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='regionSigungu'>시/군/구</Label>
                        <Input
                          id='regionSigungu'
                          value={form.regionSigungu}
                          onChange={(e) => setForm({ ...form, regionSigungu: e.target.value })}
                          placeholder='예: 관악구'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='regionDong'>읍/면/동</Label>
                        <Input
                          id='regionDong'
                          value={form.regionDong}
                          onChange={(e) => setForm({ ...form, regionDong: e.target.value })}
                          placeholder='예: 봉천동'
                        />
                      </div>
                    </div>

                  <div className='space-y-2'>
                    <Label className='text-sm text-muted-foreground'>또는 주소 검색으로 자동 입력</Label>
                    <Button
                      type='button'
                      variant='outline'
                      className='w-full'
                      onClick={() => {
                        new (window as any).daum.Postcode({
                          oncomplete: function(data: any) {
                            setForm({
                              ...form,
                              regionSido: data.sido || '',
                              regionSigungu: data.sigungu || '',
                              regionDong: data.bname || '',
                            });
                          }
                        }).open();
                      }}
                    >
                      주소 검색으로 자동 입력
                    </Button>
                  </div>

                  <Button
                    type='button'
                    variant='default'
                    className='w-full'
                    onClick={() => {
                      if (!form.regionSido.trim()) {
                        setError('시/도를 입력해주세요.');
                        return;
                      }

                      // 중복 체크
                      const isDuplicate = form.selectedRegions.some(r =>
                        r.sido === form.regionSido &&
                        r.sigungu === form.regionSigungu &&
                        r.dong === form.regionDong
                      );

                      if (isDuplicate) {
                        setError('이미 추가된 지역입니다.');
                        return;
                      }

                      // 지역 추가
                      setForm({
                        ...form,
                        selectedRegions: [
                          ...form.selectedRegions,
                          {
                            sido: form.regionSido.trim(),
                            sigungu: form.regionSigungu.trim(),
                            dong: form.regionDong.trim(),
                          }
                        ],
                        // 입력 필드 초기화
                        regionSido: '',
                        regionSigungu: '',
                        regionDong: '',
                      });
                      setError(null);
                    }}
                  >
                    <Plus className='h-4 w-4 mr-2' />
                    지역 추가
                  </Button>

                  <p className='text-xs text-muted-foreground'>
                    선택된 지역: {form.selectedRegions.length}개
                  </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>
              {editingAd ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>광고 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingAd?.title}</strong> 광고를 삭제하시겠습니까?
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
