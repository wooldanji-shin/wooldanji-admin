'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { PageContent, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { TableSkeleton } from '@/components/skeletons';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Input,
  Modal,
  MultiSelect,
  Paper,
  Pill,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
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
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
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

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingAd, setDeletingAd] = useState<Advertisement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  // 광고 삭제
  const handleDeleteClick = (ad: Advertisement) => {
    setDeletingAd(ad);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAd) return;

    setDeleting(true);
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
    } finally {
      setDeleting(false);
    }
  };

  // 광고 활성화/비활성화 토글
  const handleToggleActive = async (ad: Advertisement) => {
    setTogglingId(ad.id);
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
    } finally {
      setTogglingId(null);
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
      // 수정 모드에서는 기존에 저장된 광고 이미지도 uploadedImageUrl에 들어가므로, 그 이미지는 지우지 않는다
      if (uploadedImageUrl && uploadedImageUrl !== editingAd?.imageUrl) {
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
    <PageShell>
      <AdminHeader
        title='광고 관리'
        actions={
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            광고 추가
          </Button>
        }
      />

      <PageContent>
        {/* Statistics Dashboard */}
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing='sm'>
          <UnstyledButton onClick={() => setStatusFilter('all')}>
            <Paper
              withBorder
              radius='md'
              p='sm'
              style={statusFilter === 'all' ? { borderColor: 'var(--mantine-color-blue-6)', borderWidth: 2 } : undefined}
            >
              <Text size='xs' c='dimmed' mb={4}>전체</Text>
              <Text size='xl' fw={700}>{stats.total}</Text>
            </Paper>
          </UnstyledButton>

          <UnstyledButton onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}>
            <Paper
              withBorder
              radius='md'
              p='sm'
              style={statusFilter === 'active' ? { borderColor: 'var(--mantine-color-green-6)', borderWidth: 2 } : undefined}
            >
              <Text size='xs' c='dimmed' mb={4}>진행중</Text>
              <Text size='xl' fw={700} c='green'>{stats.active}</Text>
            </Paper>
          </UnstyledButton>

          <UnstyledButton onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}>
            <Paper
              withBorder
              radius='md'
              p='sm'
              style={statusFilter === 'pending' ? { borderColor: 'var(--mantine-color-yellow-6)', borderWidth: 2 } : undefined}
            >
              <Text size='xs' c='dimmed' mb={4}>대기중</Text>
              <Text size='xl' fw={700} c='yellow'>{stats.pending}</Text>
            </Paper>
          </UnstyledButton>

          <UnstyledButton onClick={() => setStatusFilter(statusFilter === 'scheduled' ? 'all' : 'scheduled')}>
            <Paper
              withBorder
              radius='md'
              p='sm'
              style={statusFilter === 'scheduled' ? { borderColor: 'var(--mantine-color-blue-6)', borderWidth: 2 } : undefined}
            >
              <Text size='xs' c='dimmed' mb={4}>예정</Text>
              <Text size='xl' fw={700} c='blue'>{stats.scheduled}</Text>
            </Paper>
          </UnstyledButton>

          <UnstyledButton onClick={() => setStatusFilter(statusFilter === 'ended' ? 'all' : 'ended')}>
            <Paper
              withBorder
              radius='md'
              p='sm'
              style={statusFilter === 'ended' ? { borderColor: 'var(--mantine-color-gray-6)', borderWidth: 2 } : undefined}
            >
              <Text size='xs' c='dimmed' mb={4}>종료됨</Text>
              <Text size='xl' fw={700} c='dimmed'>{stats.ended}</Text>
            </Paper>
          </UnstyledButton>
        </SimpleGrid>

        {error && (
          <Alert color='red' icon={<AlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        {/* Advertisements Table */}
        <DataTableShell
          toolbar={
            <Stack gap='md'>
              <Group gap='xs' align='center'>
                <TextInput
                  placeholder='광고 제목, 상호명으로 검색...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftSection={<Search size={16} />}
                  style={{ flex: 1 }}
                  miw={240}
                />
                <Select
                  w={180}
                  placeholder='상태'
                  data={[
                    { value: 'all', label: '전체 상태' },
                    { value: 'pending', label: '대기중' },
                    { value: 'active', label: '진행중' },
                    { value: 'scheduled', label: '예정' },
                    { value: 'ended', label: '종료됨' },
                  ]}
                  value={statusFilter}
                  onChange={(value) => {
                    if (value === null) return;
                    setStatusFilter(value as 'all' | AdStatus);
                  }}
                  allowDeselect={false}
                />

                <Select
                  w={180}
                  placeholder='광고 타입'
                  data={[
                    { value: 'all', label: '전체 타입' },
                    { value: 'NEIGHBORHOOD', label: '동네관리' },
                    { value: 'REGION', label: '지역관리' },
                  ]}
                  value={adTypeFilter}
                  onChange={(value) => {
                    if (value === null) return;
                    setAdTypeFilter(value as 'all' | 'NEIGHBORHOOD' | 'REGION');
                  }}
                  allowDeselect={false}
                />

                {apartments.length > 0 && (
                  <MultiSelect
                    w={250}
                    searchable
                    placeholder='아파트 선택...'
                    nothingFoundMessage='아파트를 찾을 수 없습니다.'
                    data={Array.from(new Set(apartments.map((apartment) => apartment.name)))}
                    value={selectedApartmentFilters}
                    onChange={setSelectedApartmentFilters}
                  />
                )}

                {selectedApartmentFilters.length > 0 && (
                  <Text size='sm' c='dimmed'>
                    {`${selectedApartmentFilters.length}개 아파트 선택됨`}
                  </Text>
                )}

                {selectedApartmentFilters.length > 0 && (
                  <Button
                    variant='subtle'
                    color='gray'
                    size='xs'
                    leftSection={<X size={16} />}
                    onClick={() => setSelectedApartmentFilters([])}
                  >
                    필터 초기화
                  </Button>
                )}

                {isSuperAdmin && managers.length > 0 && (
                  <Select
                    w={180}
                    placeholder='매니저 선택'
                    data={[
                      { value: 'all', label: '전체 매니저' },
                      ...managers.map((manager) => ({ value: manager.id, label: manager.name })),
                    ]}
                    value={selectedManager}
                    onChange={(value) => {
                      if (value === null) return;
                      setSelectedManager(value);
                    }}
                    allowDeselect={false}
                  />
                )}
              </Group>

              <Divider />

              <FilterRow label='카테고리'>
                <FilterChips
                  options={[
                    { value: 'all', label: '전체', count: advertisements.length },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.categoryName,
                      count: categoryCounts[category.id] || 0,
                    })),
                  ]}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                />
              </FilterRow>
            </Stack>
          }
        >
          <Table highlightOnHover verticalSpacing='sm' horizontalSpacing='md'>
            <Table.Thead>
              <Table.Tr>
                {selectedCategory !== 'all' && (
                  <Table.Th w={64}>순서</Table.Th>
                )}
                <Table.Th>상호명</Table.Th>
                <Table.Th>광고 제목</Table.Th>
                <Table.Th>카테고리</Table.Th>
                <Table.Th>타입</Table.Th>
                <Table.Th>타겟</Table.Th>
                <Table.Th>게시기간</Table.Th>
                <Table.Th>상태</Table.Th>
                <Table.Th>등록자</Table.Th>
                <Table.Th ta='right'>작업</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={selectedCategory !== 'all' ? 10 : 9} p={0}>
                    <TableSkeleton rows={8} columns={selectedCategory !== 'all' ? 10 : 9} showHeader={false} />
                  </Table.Td>
                </Table.Tr>
              ) : filteredAds.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={selectedCategory !== 'all' ? 10 : 9} ta='center' py={48} c='dimmed'>
                    {searchQuery ? '검색 결과가 없습니다.' : '광고가 없습니다.'}
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredAds.map((ad, index) => {
                  const adStatus = getAdStatus(ad);

                  return (
                    <Table.Tr key={ad.id}>
                      {selectedCategory !== 'all' && (
                        <Table.Td c='dimmed' ff='monospace'>{index + 1}</Table.Td>
                      )}
                      <Table.Td>{ad.advertisers?.businessName}</Table.Td>
                      <Table.Td fw={500}>{ad.title}</Table.Td>
                      <Table.Td>
                        {ad.ad_categories ? (
                          <Badge variant='light' color='gray' leftSection={<Tag size={12} />}>
                            {ad.ad_categories.categoryName}
                          </Badge>
                        ) : (
                          <Text component='span' size='sm' c='dimmed'>-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {ad.adType === 'NEIGHBORHOOD' ? (
                          <Badge variant='light' color='blue'>동네광고</Badge>
                        ) : (
                          <Badge variant='light' color='gray'>지역광고</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {ad.adType === 'NEIGHBORHOOD' ? (
                          <Group gap={4}>
                            {ad.advertisement_apartments?.slice(0, 1).map((aa: any, idx: number) => (
                              <Badge key={idx} variant='light' color='gray' size='sm' leftSection={<Building2 size={12} />}>
                                {aa.apartments?.name}
                              </Badge>
                            ))}
                            {(ad.advertisement_apartments?.length || 0) > 1 && (
                              <Badge variant='light' color='gray' size='sm'>
                                +{(ad.advertisement_apartments?.length || 0) - 1}
                              </Badge>
                            )}
                          </Group>
                        ) : (
                          <Group gap={4}>
                            {ad.advertisement_regions?.slice(0, 1).map((region: any, idx: number) => {
                              const regionText = [region.regionSido, region.regionSigungu, region.regionDong]
                                .filter(Boolean)
                                .join(' ');
                              return (
                                <Badge key={idx} variant='light' color='gray' size='sm' leftSection={<MapPin size={12} />}>
                                  {regionText}
                                </Badge>
                              );
                            })}
                            {(ad.advertisement_regions?.length || 0) > 1 && (
                              <Badge variant='light' color='gray' size='sm'>
                                +{(ad.advertisement_regions?.length || 0) - 1}
                              </Badge>
                            )}
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap='nowrap'>
                          <Calendar size={12} />
                          <Text size='sm' c='dimmed'>{new Date(ad.startDate).toLocaleDateString('ko-KR')}</Text>
                        </Group>
                        <Text size='sm' c='dimmed'>~ {new Date(ad.endDate).toLocaleDateString('ko-KR')}</Text>
                      </Table.Td>
                      <Table.Td>
                        {adStatus === 'pending' && (
                          <Badge variant='light' color='yellow'>대기중</Badge>
                        )}
                        {adStatus === 'active' && (
                          <Badge variant='light' color='green'>진행중</Badge>
                        )}
                        {adStatus === 'scheduled' && (
                          <Badge variant='light' color='blue'>예정</Badge>
                        )}
                        {adStatus === 'ended' && (
                          <Badge variant='light' color='gray'>종료됨</Badge>
                        )}
                      </Table.Td>
                      <Table.Td c='dimmed'>
                        {ad.user?.name || '알 수 없음'}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify='flex-end' wrap='nowrap'>
                          {/* 순서 조정 버튼 (전체 탭이 아니고, 카테고리가 있을 때만 표시) */}
                          {selectedCategory !== 'all' && ad.categoryId && (
                            <>
                              <ActionIcon
                                variant='subtle'
                                color='gray'
                                onClick={() => handleMoveOrder(ad, 'up')}
                                title='위로'
                                aria-label='위로'
                                disabled={
                                  filteredAds
                                    .filter(a => a.categoryId === ad.categoryId)
                                    .findIndex(a => a.id === ad.id) === 0
                                }
                              >
                                <ChevronUp size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant='subtle'
                                color='gray'
                                onClick={() => handleMoveOrder(ad, 'down')}
                                title='아래로'
                                aria-label='아래로'
                                disabled={
                                  filteredAds
                                    .filter(a => a.categoryId === ad.categoryId)
                                    .findIndex(a => a.id === ad.id) ===
                                  filteredAds.filter(a => a.categoryId === ad.categoryId).length - 1
                                }
                              >
                                <ChevronDown size={16} />
                              </ActionIcon>
                            </>
                          )}
                          <Switch
                            checked={ad.isActive}
                            onChange={() => handleToggleActive(ad)}
                            disabled={togglingId === ad.id}
                            aria-label='활성화'
                          />
                          <ActionIcon
                            variant='subtle'
                            color='gray'
                            aria-label='수정'
                            onClick={() => handleEditClick(ad)}
                          >
                            <Edit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant='subtle'
                            color='red'
                            aria-label='삭제'
                            onClick={() => handleDeleteClick(ad)}
                          >
                            <Trash2 size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </DataTableShell>
      </PageContent>

      {/* Create/Edit Dialog */}
      <Modal
        opened={isDialogOpen}
        onClose={() => handleDialogClose(false)}
        title={editingAd ? '광고 수정' : '광고 추가'}
        size={700}
        closeOnClickOutside={!saving}
        closeOnEscape={!saving}
      >
        <Text size='sm' c='dimmed'>
          광고 정보를 입력합니다.
        </Text>

        <Stack gap='md' mt='md'>
          <SimpleGrid cols={2} spacing='md'>
            <Select
              label='상호명 *'
              searchable
              placeholder='상호명 검색...'
              nothingFoundMessage='상호명을 찾을 수 없습니다.'
              data={advertisers.map((adv) => ({ value: adv.id, label: adv.businessName }))}
              value={form.advertiserId || null}
              onChange={(value) => {
                if (value === null) return;
                setForm({ ...form, advertiserId: value });
              }}
              allowDeselect={false}
              maxDropdownHeight={300}
            />

            <Select
              id='categoryId'
              label='카테고리'
              placeholder='카테고리 선택 (선택사항)'
              data={[
                { value: 'none', label: '선택 안함' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.categoryName })),
              ]}
              value={form.categoryId || 'none'}
              onChange={(value) => {
                if (value === null) return;
                setForm({ ...form, categoryId: value === 'none' ? '' : value });
              }}
              allowDeselect={false}
            />
          </SimpleGrid>

          <TextInput
            id='title'
            label='광고 제목 *'
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder='신규 회원 50% 할인 이벤트'
          />

          <TextInput
            id='linkUrl'
            label='링크 URL'
            value={form.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
            placeholder='https://example.com/promotion'
          />

          <Input.Wrapper label='광고 이미지 *'>
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
              previewSize='md'
            />
          </Input.Wrapper>

          <SimpleGrid cols={2} spacing='md'>
            <TextInput
              id='startDate'
              label='게시 시작일 *'
              type='date'
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <TextInput
              id='endDate'
              label='게시 종료일 *'
              type='date'
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </SimpleGrid>

          <Divider />

          <Stack gap='md'>
            <Title order={5}>광고 타입</Title>
            <Select
              data={[
                { value: 'NEIGHBORHOOD', label: '동네 광고 (특정 아파트)' },
                { value: 'REGION', label: '지역 광고 (시/도/구/동)' },
              ]}
              value={form.adType}
              onChange={(value) => {
                if (value === null) return;
                setForm({ ...form, adType: value as 'NEIGHBORHOOD' | 'REGION' });
              }}
              allowDeselect={false}
            />

            {form.adType === 'NEIGHBORHOOD' ? (
              <Stack gap='xs'>
                {/* Apartment combobox — 선택된 아파트는 입력창 안의 Pill로 표시/삭제 */}
                <MultiSelect
                  label='타겟 아파트 선택 *'
                  searchable
                  hidePickedOptions
                  placeholder='아파트 검색 및 추가...'
                  nothingFoundMessage='아파트를 찾을 수 없습니다.'
                  data={apartments.map((apt) => ({ value: apt.id, label: apt.name, address: apt.address }))}
                  value={form.selectedApartments}
                  // 목록에 없는 아파트(담당 이관 등)는 이전처럼 화면에 표시하지 않고 값만 유지한다
                  renderPill={({ option, onRemove, disabled }) =>
                    option ? (
                      <Pill withRemoveButton={!disabled} onRemove={onRemove}>
                        {option.label}
                      </Pill>
                    ) : null
                  }
                  onChange={(ids) => {
                    setForm({
                      ...form,
                      selectedApartments: ids
                    });
                  }}
                  filter={({ options, search }) => {
                    const query = search.toLowerCase().trim();
                    return (options as Array<{ value: string; label: string; address?: string }>).filter(
                      (option) =>
                        `${option.label} ${option.address ?? ''}`.toLowerCase().includes(query)
                    );
                  }}
                  renderOption={({ option }) => (
                    <Group gap='xs' wrap='nowrap'>
                      <Building2 size={16} />
                      <div>
                        <Text size='sm' fw={500}>{option.label}</Text>
                        <Text size='xs' c='dimmed'>
                          {apartments.find((apt) => apt.id === option.value)?.address}
                        </Text>
                      </div>
                    </Group>
                  )}
                  maxDropdownHeight={300}
                />

                <Text size='xs' c='dimmed'>
                  선택된 아파트: {form.selectedApartments.length}개
                </Text>
              </Stack>
            ) : (
              <Stack gap='md'>
                <Alert variant='light' color='gray' icon={<AlertCircle size={16} />}>
                  여러 지역을 추가할 수 있습니다. 시/도만 입력 시 해당 시/도 전체, 시/도 + 구 입력 시 해당 구 전체, 시/도 + 구 + 동 입력 시 해당 동에만 광고가 노출됩니다.
                </Alert>

                <Input.Wrapper label='타겟 지역 선택 *'>
                  {/* Selected regions badges */}
                  {form.selectedRegions.length > 0 && (
                    <Paper withBorder radius='md' p='xs' bg='var(--app-bg-muted)' mt={4}>
                      <Pill.Group>
                        {form.selectedRegions.map((region, index) => {
                          const regionText = [region.sido, region.sigungu, region.dong]
                            .filter(Boolean)
                            .join(' ');
                          return (
                            <Pill
                              key={index}
                              withRemoveButton
                              onRemove={() => {
                                setForm({
                                  ...form,
                                  selectedRegions: form.selectedRegions.filter((_, i) => i !== index)
                                });
                              }}
                            >
                              <Group gap={4} wrap='nowrap' component='span'>
                                <MapPin size={12} />
                                {regionText}
                              </Group>
                            </Pill>
                          );
                        })}
                      </Pill.Group>
                    </Paper>
                  )}
                </Input.Wrapper>

                {/* Region input form */}
                <Paper withBorder radius='md' p='md'>
                  <Stack gap='md'>
                    <SimpleGrid cols={3} spacing='md'>
                      <TextInput
                        id='regionSido'
                        label='시/도 *'
                        value={form.regionSido}
                        onChange={(e) => setForm({ ...form, regionSido: e.target.value })}
                        placeholder='예: 서울'
                      />
                      <TextInput
                        id='regionSigungu'
                        label='시/군/구'
                        value={form.regionSigungu}
                        onChange={(e) => setForm({ ...form, regionSigungu: e.target.value })}
                        placeholder='예: 관악구'
                      />
                      <TextInput
                        id='regionDong'
                        label='읍/면/동'
                        value={form.regionDong}
                        onChange={(e) => setForm({ ...form, regionDong: e.target.value })}
                        placeholder='예: 봉천동'
                      />
                    </SimpleGrid>

                    <Stack gap={4}>
                      <Text size='sm' c='dimmed'>또는 주소 검색으로 자동 입력</Text>
                      <Button
                        type='button'
                        variant='default'
                        fullWidth
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
                    </Stack>

                    <Button
                      type='button'
                      fullWidth
                      leftSection={<Plus size={16} />}
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
                      지역 추가
                    </Button>

                    <Text size='xs' c='dimmed'>
                      선택된 지역: {form.selectedRegions.length}개
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            )}
          </Stack>
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => handleDialogClose(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : editingAd ? '수정' : '생성'}
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title='광고 삭제' closeOnClickOutside={!deleting} closeOnEscape={!deleting}>
        <Text size='sm' c='dimmed'>
          정말로 <strong>{deletingAd?.title}</strong> 광고를 삭제하시겠습니까?
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDeleteDialog(false)} disabled={deleting}>
            취소
          </Button>
          <Button color='red' onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
