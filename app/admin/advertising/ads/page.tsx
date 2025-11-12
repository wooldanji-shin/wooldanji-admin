'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Filter,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Package,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/image-upload';

// 광고 상태 타입
type AdStatus = 'all' | 'active' | 'pending' | 'scheduled' | 'expired';

interface Advertisement {
  id: string;
  advertiserId: string;
  categoryId: string | null;
  adType: 'NEIGHBORHOOD' | 'REGION';
  title: string;
  imageUrl: string;
  description: string | null;
  linkUrl: string | null;
  startDate: string;
  endDate: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  advertisers: {
    id: string;
    businessName: string;
    representativeName: string;
    email: string | null;
    phoneNumber: string;
    landlineNumber: string | null;
    address: string;
    logo: string | null;
    representativeImage: string | null;
    businessRegistration: string | null;
    contractDocument: string | null;
    contractMemo: string | null;
  };
  ad_categories: {
    categoryName: string;
  } | null;
  advertisement_apartments?: {
    apartments: {
      id: string;
      name: string;
    };
  }[];
  advertisement_regions?: {
    regionSido: string;
    regionSigungu: string | null;
    regionDong: string | null;
  }[];
}

interface Advertiser {
  id: string;
  businessName: string;
}

interface Category {
  id: string;
  categoryName: string;
}

interface Apartment {
  id: string;
  name: string;
}

export default function AdsManagementPage() {
  const supabase = createClient();

  // 상태 관리
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [filteredAds, setFilteredAds] = useState<Advertisement[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);

  // 필터 상태
  const [activeTab, setActiveTab] = useState<AdStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAdType, setFilterAdType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAdvertiser, setFilterAdvertiser] = useState<string>('all');
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // UI 상태
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 광고 등록/수정 폼 상태 - 광고주 정보
  const [advertiserFormData, setAdvertiserFormData] = useState({
    businessName: '',
    representativeName: '',
    email: '',
    phoneNumber: '',
    landlineNumber: '',
    address: '',
    logo: '',
    representativeImage: '',
    businessRegistration: '',
    contractDocument: '',
    contractMemo: '',
  });

  // 광고 등록/수정 폼 상태 - 광고 정보
  const [adFormData, setAdFormData] = useState({
    categoryId: '',
    adType: 'NEIGHBORHOOD' as 'NEIGHBORHOOD' | 'REGION',
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: '',
    startDate: '',
    endDate: '',
    isActive: false,
    selectedApartments: [] as string[],
    selectedRegions: [] as {
      regionSido: string;
      regionSigungu: string;
      regionDong: string;
    }[],
  });

  // 지역 선택 상태
  const [regionSido, setRegionSido] = useState('');
  const [regionSigungu, setRegionSigungu] = useState('');
  const [regionDong, setRegionDong] = useState('');

  // 아파트 검색 상태
  const [apartmentSearchOpen, setApartmentSearchOpen] = useState(false);
  const [apartmentSearch, setApartmentSearch] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      const roles = await getUserRoles();
      setUserRoles(roles);
      await fetchData();
    };
    initializeData();
  }, []);

  // 필터링
  useEffect(() => {
    filterAdvertisements();
  }, [advertisements, activeTab, searchTerm, filterAdType, filterCategory, filterAdvertiser]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 광고 데이터 로드
      const { data: adsData, error: adsError } = await supabase
        .from('advertisements')
        .select(`
          *,
          advertisers (
            id,
            businessName,
            representativeName,
            email,
            phoneNumber,
            landlineNumber,
            address,
            logo,
            representativeImage,
            businessRegistration,
            contractDocument,
            contractMemo
          ),
          ad_categories (categoryName),
          advertisement_apartments (
            apartments (id, name)
          ),
          advertisement_regions (
            regionSido,
            regionSigungu,
            regionDong
          )
        `)
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;
      setAdvertisements(adsData || []);

      // 광고주 목록 로드
      const { data: advertisersData, error: advertisersError } = await supabase
        .from('advertisers')
        .select('id, businessName')
        .order('businessName');

      if (advertisersError) throw advertisersError;
      setAdvertisers(advertisersData || []);

      // 카테고리 로드
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('ad_categories')
        .select('id, categoryName')
        .eq('isActive', true)
        .order('orderIndex');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // 아파트 로드
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('id, name')
        .order('name');

      if (apartmentsError) throw apartmentsError;
      setApartments(apartmentsData || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // 광고 상태 계산
  const getAdStatus = (ad: Advertisement): AdStatus => {
    if (!ad.isActive) return 'pending';

    const now = new Date();
    const start = new Date(ad.startDate);
    const end = new Date(ad.endDate);

    if (now > end) return 'expired';
    if (now < start) return 'scheduled';
    return 'active';
  };

  // 필터링 로직
  const filterAdvertisements = () => {
    let filtered = [...advertisements];

    // 상태별 필터
    if (activeTab !== 'all') {
      filtered = filtered.filter(ad => getAdStatus(ad) === activeTab);
    }

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(ad =>
        ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ad.advertisers?.businessName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 광고 타입 필터
    if (filterAdType !== 'all') {
      filtered = filtered.filter(ad => ad.adType === filterAdType);
    }

    // 카테고리 필터
    if (filterCategory !== 'all') {
      filtered = filtered.filter(ad => ad.categoryId === filterCategory);
    }

    // 광고주 필터
    if (filterAdvertiser !== 'all') {
      filtered = filtered.filter(ad => ad.advertiserId === filterAdvertiser);
    }

    setFilteredAds(filtered);
  };

  // 광고 등록/수정 다이얼로그 열기
  const handleOpenDialog = (ad?: Advertisement) => {
    if (ad) {
      setSelectedAd(ad);

      // 광고주 정보 설정
      setAdvertiserFormData({
        businessName: ad.advertisers.businessName,
        representativeName: ad.advertisers.representativeName,
        email: ad.advertisers.email || '',
        phoneNumber: ad.advertisers.phoneNumber,
        landlineNumber: ad.advertisers.landlineNumber || '',
        address: ad.advertisers.address,
        logo: ad.advertisers.logo || '',
        representativeImage: ad.advertisers.representativeImage || '',
        businessRegistration: ad.advertisers.businessRegistration || '',
        contractDocument: ad.advertisers.contractDocument || '',
        contractMemo: ad.advertisers.contractMemo || '',
      });

      // 광고 정보 설정
      setAdFormData({
        categoryId: ad.categoryId || '',
        adType: ad.adType,
        title: ad.title,
        description: ad.description || '',
        imageUrl: ad.imageUrl,
        linkUrl: ad.linkUrl || '',
        startDate: ad.startDate.split('T')[0],
        endDate: ad.endDate.split('T')[0],
        isActive: ad.isActive,
        selectedApartments: ad.advertisement_apartments?.map(aa => aa.apartments.id) || [],
        selectedRegions: ad.advertisement_regions || [],
      });
    } else {
      setSelectedAd(null);
      setAdvertiserFormData({
        businessName: '',
        representativeName: '',
        email: '',
        phoneNumber: '',
        landlineNumber: '',
        address: '',
        logo: '',
        representativeImage: '',
        businessRegistration: '',
        contractDocument: '',
        contractMemo: '',
      });
      setAdFormData({
        categoryId: '',
        adType: 'NEIGHBORHOOD',
        title: '',
        description: '',
        imageUrl: '',
        linkUrl: '',
        startDate: '',
        endDate: '',
        isActive: false,
        selectedApartments: [],
        selectedRegions: [],
      });
    }
    setIsDialogOpen(true);
  };

  // 광고 저장
  const handleSaveAd = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      // 유효성 검사
      if (!advertiserFormData.businessName.trim()) {
        throw new Error('상호명을 입력해주세요');
      }
      if (!advertiserFormData.representativeName.trim()) {
        throw new Error('대표자명을 입력해주세요');
      }
      if (!advertiserFormData.phoneNumber.trim()) {
        throw new Error('핸드폰번호를 입력해주세요');
      }
      if (!advertiserFormData.address.trim()) {
        throw new Error('영업점 주소를 입력해주세요');
      }
      if (!adFormData.title.trim()) {
        throw new Error('광고 제목을 입력해주세요');
      }
      if (!adFormData.imageUrl.trim()) {
        throw new Error('광고 이미지를 업로드해주세요');
      }
      if (!adFormData.startDate || !adFormData.endDate) {
        throw new Error('게시 기간을 설정해주세요');
      }
      if (adFormData.adType === 'NEIGHBORHOOD' && adFormData.selectedApartments.length === 0) {
        throw new Error('동네 광고는 최소 1개 이상의 아파트를 선택해야 합니다');
      }
      if (adFormData.adType === 'REGION' && adFormData.selectedRegions.length === 0) {
        throw new Error('지역 광고는 최소 1개 이상의 지역을 선택해야 합니다');
      }

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      if (selectedAd) {
        // 수정 모드
        // 광고주 정보 업데이트
        const { error: advertiserError } = await supabase
          .from('advertisers')
          .update({
            businessName: advertiserFormData.businessName,
            representativeName: advertiserFormData.representativeName,
            email: advertiserFormData.email || null,
            phoneNumber: advertiserFormData.phoneNumber,
            landlineNumber: advertiserFormData.landlineNumber || null,
            address: advertiserFormData.address,
            logo: advertiserFormData.logo || null,
            representativeImage: advertiserFormData.representativeImage || null,
            businessRegistration: advertiserFormData.businessRegistration || null,
            contractDocument: advertiserFormData.contractDocument || null,
            contractMemo: advertiserFormData.contractMemo || null,
          })
          .eq('id', selectedAd.advertiserId);

        if (advertiserError) throw advertiserError;

        // 광고 정보 업데이트
        const { error: adError } = await supabase
          .from('advertisements')
          .update({
            categoryId: adFormData.categoryId || null,
            adType: adFormData.adType,
            title: adFormData.title,
            description: adFormData.description || null,
            imageUrl: adFormData.imageUrl,
            linkUrl: adFormData.linkUrl || null,
            startDate: adFormData.startDate,
            endDate: adFormData.endDate,
            isActive: adFormData.isActive,
          })
          .eq('id', selectedAd.id);

        if (adError) throw adError;

        // 아파트/지역 연결 업데이트
        await updateAdConnections(selectedAd.id);

        setSuccess('광고가 수정되었습니다');
      } else {
        // 등록 모드
        // 1. 광고주 등록
        const { data: advertiserData, error: advertiserError } = await supabase
          .from('advertisers')
          .insert({
            businessName: advertiserFormData.businessName,
            representativeName: advertiserFormData.representativeName,
            email: advertiserFormData.email || null,
            phoneNumber: advertiserFormData.phoneNumber,
            landlineNumber: advertiserFormData.landlineNumber || null,
            address: advertiserFormData.address,
            logo: advertiserFormData.logo || null,
            representativeImage: advertiserFormData.representativeImage || null,
            businessRegistration: advertiserFormData.businessRegistration || null,
            contractDocument: advertiserFormData.contractDocument || null,
            contractMemo: advertiserFormData.contractMemo || null,
            createdBy: currentUser.id,
          })
          .select()
          .single();

        if (advertiserError) throw advertiserError;

        // 2. 광고 등록
        const { data: adData, error: adError } = await supabase
          .from('advertisements')
          .insert({
            advertiserId: advertiserData.id,
            categoryId: adFormData.categoryId || null,
            adType: adFormData.adType,
            title: adFormData.title,
            description: adFormData.description || null,
            imageUrl: adFormData.imageUrl,
            linkUrl: adFormData.linkUrl || null,
            startDate: adFormData.startDate,
            endDate: adFormData.endDate,
            isActive: adFormData.isActive,
            createdBy: currentUser.id,
          })
          .select()
          .single();

        if (adError) throw adError;

        // 3. 아파트/지역 연결
        await updateAdConnections(adData.id);

        setSuccess('광고가 등록되었습니다');
      }

      await fetchData();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving ad:', error);
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 아파트/지역 연결 업데이트
  const updateAdConnections = async (adId: string) => {
    if (adFormData.adType === 'NEIGHBORHOOD') {
      // 기존 아파트 연결 삭제
      await supabase
        .from('advertisement_apartments')
        .delete()
        .eq('advertisementId', adId);

      // 새 아파트 연결
      if (adFormData.selectedApartments.length > 0) {
        const { error } = await supabase
          .from('advertisement_apartments')
          .insert(
            adFormData.selectedApartments.map(aptId => ({
              advertisementId: adId,
              apartmentId: aptId,
            }))
          );
        if (error) throw error;
      }
    } else {
      // 기존 지역 연결 삭제
      await supabase
        .from('advertisement_regions')
        .delete()
        .eq('advertisementId', adId);

      // 새 지역 연결
      if (adFormData.selectedRegions.length > 0) {
        const { error } = await supabase
          .from('advertisement_regions')
          .insert(
            adFormData.selectedRegions.map(region => ({
              advertisementId: adId,
              ...region,
            }))
          );
        if (error) throw error;
      }
    }
  };

  // 광고 삭제
  const handleDelete = async () => {
    if (!selectedAd) return;

    try {
      setError('');
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', selectedAd.id);

      if (error) throw error;

      setSuccess('광고가 삭제되었습니다');
      await fetchData();
      setIsDeleteDialogOpen(false);
      setSelectedAd(null);
    } catch (error: any) {
      console.error('Error deleting ad:', error);
      setError(error.message);
    }
  };

  // 지역 추가
  const handleAddRegion = () => {
    if (!regionSido.trim()) {
      setError('시/도를 입력해주세요');
      return;
    }

    const newRegion = {
      regionSido,
      regionSigungu: regionSigungu || '',
      regionDong: regionDong || '',
    };

    setAdFormData({
      ...adFormData,
      selectedRegions: [...adFormData.selectedRegions, newRegion],
    });

    setRegionSido('');
    setRegionSigungu('');
    setRegionDong('');
  };

  // 지역 제거
  const handleRemoveRegion = (index: number) => {
    setAdFormData({
      ...adFormData,
      selectedRegions: adFormData.selectedRegions.filter((_, i) => i !== index),
    });
  };

  // 상태별 개수
  const getStatusCount = (status: AdStatus) => {
    if (status === 'all') return advertisements.length;
    return advertisements.filter(ad => getAdStatus(ad) === status).length;
  };

  // 필터 적용 개수
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterAdType !== 'all') count++;
    if (filterCategory !== 'all') count++;
    if (filterAdvertiser !== 'all') count++;
    return count;
  };

  // 상태 배지 컴포넌트
  const StatusBadge = ({ ad }: { ad: Advertisement }) => {
    const status = getAdStatus(ad);

    const statusConfig = {
      active: {
        label: '진행중',
        className: 'bg-green-500 hover:bg-green-600',
        icon: CheckCircle
      },
      pending: {
        label: '대기중',
        className: 'bg-gray-500 hover:bg-gray-600',
        icon: Clock
      },
      scheduled: {
        label: '예정',
        className: 'bg-blue-500 hover:bg-blue-600',
        icon: Calendar
      },
      expired: {
        label: '만료',
        className: 'bg-red-500 hover:bg-red-600',
        icon: XCircle
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge className={cn('text-white font-medium', config.className)}>
        <Icon className='mr-1 h-3 w-3' />
        {config.label}
      </Badge>
    );
  };

  // 텍스트 자르기 유틸리티
  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='text-center space-y-4'>
          <Loader2 className='h-12 w-12 animate-spin mx-auto text-primary' />
          <div className='text-lg font-medium'>데이터를 불러오는 중...</div>
          <div className='text-sm text-muted-foreground'>잠시만 기다려주세요</div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className='flex h-full flex-col'>
        <AdminHeader
          title='광고 등록/수정'
          description='광고주 정보와 광고를 한 번에 관리합니다'
        />

        <div className='flex-1 space-y-4 p-4 md:p-6'>
          {/* 알림 메시지 */}
          {error && (
            <Alert variant='destructive' className='animate-in slide-in-from-top'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{error}</AlertDescription>
              <Button
                variant='ghost'
                size='sm'
                className='absolute right-2 top-2'
                onClick={() => setError('')}
              >
                <X className='h-4 w-4' />
              </Button>
            </Alert>
          )}
          {success && (
            <Alert className='border-green-500 bg-green-50 text-green-900 animate-in slide-in-from-top'>
              <CheckCircle className='h-4 w-4' />
              <AlertDescription>{success}</AlertDescription>
              <Button
                variant='ghost'
                size='sm'
                className='absolute right-2 top-2'
                onClick={() => setSuccess('')}
              >
                <X className='h-4 w-4' />
              </Button>
            </Alert>
          )}

          {/* 상태 탭 */}
          <Card>
            <CardContent className='pt-6'>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdStatus)}>
                <TabsList className='grid w-full grid-cols-5 h-auto'>
                  <TabsTrigger value='all' className='flex flex-col gap-1 py-3'>
                    <Package className='h-4 w-4' />
                    <div className='font-medium'>전체</div>
                    <div className='text-xs text-muted-foreground'>{getStatusCount('all')}개</div>
                  </TabsTrigger>
                  <TabsTrigger value='active' className='flex flex-col gap-1 py-3'>
                    <TrendingUp className='h-4 w-4' />
                    <div className='font-medium'>진행중</div>
                    <div className='text-xs text-muted-foreground'>{getStatusCount('active')}개</div>
                  </TabsTrigger>
                  <TabsTrigger value='pending' className='flex flex-col gap-1 py-3'>
                    <Clock className='h-4 w-4' />
                    <div className='font-medium'>대기중</div>
                    <div className='text-xs text-muted-foreground'>{getStatusCount('pending')}개</div>
                  </TabsTrigger>
                  <TabsTrigger value='scheduled' className='flex flex-col gap-1 py-3'>
                    <Calendar className='h-4 w-4' />
                    <div className='font-medium'>예정</div>
                    <div className='text-xs text-muted-foreground'>{getStatusCount('scheduled')}개</div>
                  </TabsTrigger>
                  <TabsTrigger value='expired' className='flex flex-col gap-1 py-3'>
                    <XCircle className='h-4 w-4' />
                    <div className='font-medium'>만료</div>
                    <div className='text-xs text-muted-foreground'>{getStatusCount('expired')}개</div>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* 검색 및 필터 */}
          <Card>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                {/* 검색 바 */}
                <div className='flex gap-3'>
                  <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground' />
                    <Input
                      placeholder='광고 제목, 광고주명으로 검색...'
                      className='pl-10 h-11 text-base'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button
                    variant='outline'
                    className='px-4'
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  >
                    <Filter className='mr-2 h-4 w-4' />
                    필터
                    {getActiveFilterCount() > 0 && (
                      <Badge className='ml-2' variant='secondary'>
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                    {isFilterExpanded ? (
                      <ChevronUp className='ml-2 h-4 w-4' />
                    ) : (
                      <ChevronDown className='ml-2 h-4 w-4' />
                    )}
                  </Button>
                  <Button onClick={() => handleOpenDialog()} size='lg' className='px-6'>
                    <Plus className='mr-2 h-5 w-5' />
                    광고 등록
                  </Button>
                </div>

                {/* 필터 영역 */}
                {isFilterExpanded && (
                  <div className='grid grid-cols-1 gap-3 md:grid-cols-4 p-4 bg-muted/30 rounded-lg animate-in slide-in-from-top'>
                    <Select value={filterAdType} onValueChange={setFilterAdType}>
                      <SelectTrigger>
                        <SelectValue placeholder='광고 타입' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>
                          <div className='flex items-center gap-2'>
                            <Package className='h-4 w-4' />
                            전체 타입
                          </div>
                        </SelectItem>
                        <SelectItem value='NEIGHBORHOOD'>
                          <div className='flex items-center gap-2'>
                            <Building2 className='h-4 w-4' />
                            동네 광고
                          </div>
                        </SelectItem>
                        <SelectItem value='REGION'>
                          <div className='flex items-center gap-2'>
                            <MapPin className='h-4 w-4' />
                            지역 광고
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder='카테고리' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>전체 카테고리</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.categoryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterAdvertiser} onValueChange={setFilterAdvertiser}>
                      <SelectTrigger>
                        <SelectValue placeholder='광고주' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>전체 광고주</SelectItem>
                        {advertisers.map((adv) => (
                          <SelectItem key={adv.id} value={adv.id}>
                            {adv.businessName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant='outline'
                      onClick={() => {
                        setSearchTerm('');
                        setFilterAdType('all');
                        setFilterCategory('all');
                        setFilterAdvertiser('all');
                      }}
                      className='w-full'
                    >
                      <X className='mr-2 h-4 w-4' />
                      초기화
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 광고 목록 */}
          <Card>
            <CardContent className='pt-6'>
              <div className='mb-4 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='text-lg font-semibold'>광고 목록</div>
                  <Badge variant='secondary' className='text-sm'>
                    {filteredAds.length}개
                  </Badge>
                </div>
              </div>

              {filteredAds.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-16 text-center'>
                  <Package className='h-16 w-16 text-muted-foreground mb-4' />
                  <h3 className='text-lg font-medium mb-2'>광고가 없습니다</h3>
                  <p className='text-sm text-muted-foreground mb-6'>
                    {searchTerm || getActiveFilterCount() > 0
                      ? '검색 조건에 맞는 광고가 없습니다. 다른 조건으로 시도해보세요.'
                      : '새로운 광고를 등록하여 시작하세요.'}
                  </p>
                  {!searchTerm && getActiveFilterCount() === 0 && (
                    <Button onClick={() => handleOpenDialog()} size='lg'>
                      <Plus className='mr-2 h-5 w-5' />
                      첫 광고 등록하기
                    </Button>
                  )}
                </div>
              ) : (
                <div className='rounded-lg border overflow-hidden'>
                  <Table>
                    <TableHeader>
                      <TableRow className='bg-muted/50'>
                        <TableHead className='w-[80px]'>이미지</TableHead>
                        <TableHead className='w-[100px]'>상태</TableHead>
                        <TableHead>광고 제목</TableHead>
                        <TableHead>광고주</TableHead>
                        <TableHead className='w-[120px]'>카테고리</TableHead>
                        <TableHead className='w-[100px]'>타입</TableHead>
                        <TableHead className='w-[180px]'>게시 기간</TableHead>
                        <TableHead className='text-right w-[120px]'>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAds.map((ad) => (
                        <TableRow key={ad.id} className='hover:bg-muted/50 transition-colors'>
                          <TableCell>
                            <div className='w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center'>
                              {ad.imageUrl ? (
                                <img
                                  src={ad.imageUrl}
                                  alt={ad.title}
                                  className='w-full h-full object-cover'
                                />
                              ) : (
                                <ImageIcon className='h-6 w-6 text-muted-foreground' />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge ad={ad} />
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className='font-medium cursor-default max-w-[200px]'>
                                  {truncateText(ad.title, 25)}
                                </div>
                              </TooltipTrigger>
                              {ad.title.length > 25 && (
                                <TooltipContent>
                                  <p>{ad.title}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                            {ad.linkUrl && (
                              <a
                                href={ad.linkUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1'
                              >
                                <ExternalLink className='h-3 w-3' />
                                링크
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className='cursor-default max-w-[150px]'>
                                  {truncateText(ad.advertisers?.businessName || '-', 20)}
                                </div>
                              </TooltipTrigger>
                              {ad.advertisers?.businessName && ad.advertisers.businessName.length > 20 && (
                                <TooltipContent>
                                  <p>{ad.advertisers.businessName}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {ad.ad_categories ? (
                              <Badge variant='outline' className='font-normal'>
                                <Tag className='mr-1 h-3 w-3' />
                                {ad.ad_categories.categoryName}
                              </Badge>
                            ) : (
                              <span className='text-sm text-muted-foreground'>미분류</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {ad.adType === 'NEIGHBORHOOD' ? (
                              <Badge variant='secondary' className='font-normal'>
                                <Building2 className='mr-1 h-3 w-3' />
                                동네
                              </Badge>
                            ) : (
                              <Badge variant='secondary' className='font-normal'>
                                <MapPin className='mr-1 h-3 w-3' />
                                지역
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className='space-y-1 text-sm'>
                              <div className='flex items-center gap-1 text-muted-foreground'>
                                <Calendar className='h-3 w-3' />
                                {new Date(ad.startDate).toLocaleDateString('ko-KR')}
                              </div>
                              <div className='flex items-center gap-1 text-muted-foreground'>
                                <Calendar className='h-3 w-3' />
                                {new Date(ad.endDate).toLocaleDateString('ko-KR')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex justify-end gap-2'>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => handleOpenDialog(ad)}
                                    className='h-8 w-8 p-0'
                                  >
                                    <Edit className='h-4 w-4' />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>수정</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => {
                                      setSelectedAd(ad);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                                  >
                                    <Trash2 className='h-4 w-4' />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>삭제</p>
                                </TooltipContent>
                              </Tooltip>
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

        {/* 광고 등록/수정 다이얼로그 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className='max-h-[90vh] w-[95vw] max-w-6xl sm:max-w-6xl overflow-y-auto'>
            <DialogHeader>
              <DialogTitle className='text-2xl'>
                {selectedAd ? '광고 수정' : '새 광고 등록'}
              </DialogTitle>
              <DialogDescription>
                광고주 정보와 광고 내용을 입력하세요. 모든 필수 항목(*)을 입력해야 합니다.
              </DialogDescription>
            </DialogHeader>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* 왼쪽: 광고주 정보 */}
              <div className='space-y-4'>
                <div className='sticky top-0 bg-background pb-3 border-b-2 border-primary'>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Building2 className='h-5 w-5' />
                    광고주 정보
                  </h3>
                  <p className='text-sm text-muted-foreground mt-1'>
                    광고주의 기본 정보와 연락처
                  </p>
                </div>

                <div className='space-y-4'>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='businessName' className='required'>
                        상호명 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='businessName'
                        value={advertiserFormData.businessName}
                        onChange={(e) =>
                          setAdvertiserFormData({ ...advertiserFormData, businessName: e.target.value })
                        }
                        placeholder='울단지 필라테스'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='representativeName'>
                        대표자명 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='representativeName'
                        value={advertiserFormData.representativeName}
                        onChange={(e) =>
                          setAdvertiserFormData({ ...advertiserFormData, representativeName: e.target.value })
                        }
                        placeholder='김대표'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='phoneNumber'>
                        핸드폰번호 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='phoneNumber'
                        value={advertiserFormData.phoneNumber}
                        onChange={(e) =>
                          setAdvertiserFormData({ ...advertiserFormData, phoneNumber: e.target.value })
                        }
                        placeholder='010-1234-5678'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='landlineNumber'>유선전화번호</Label>
                      <Input
                        id='landlineNumber'
                        value={advertiserFormData.landlineNumber}
                        onChange={(e) =>
                          setAdvertiserFormData({ ...advertiserFormData, landlineNumber: e.target.value })
                        }
                        placeholder='02-1234-5678'
                      />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='email'>이메일</Label>
                    <Input
                      id='email'
                      type='email'
                      value={advertiserFormData.email}
                      onChange={(e) =>
                        setAdvertiserFormData({ ...advertiserFormData, email: e.target.value })
                      }
                      placeholder='example@company.com'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='address'>
                      영업점 주소 <span className='text-destructive'>*</span>
                    </Label>
                    <Input
                      id='address'
                      value={advertiserFormData.address}
                      onChange={(e) =>
                        setAdvertiserFormData({ ...advertiserFormData, address: e.target.value })
                      }
                      placeholder='서울 관악구 신림동 123'
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label>로고 이미지</Label>
                      <ImageUpload
                        value={advertiserFormData.logo}
                        onChange={(url) =>
                          setAdvertiserFormData({ ...advertiserFormData, logo: url })
                        }
                        bucket='advertisements'
                        folder='advertisers/logos'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label>대표 이미지</Label>
                      <ImageUpload
                        value={advertiserFormData.representativeImage}
                        onChange={(url) =>
                          setAdvertiserFormData({ ...advertiserFormData, representativeImage: url })
                        }
                        bucket='advertisements'
                        folder='advertisers/representative-images'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label>사업자등록증</Label>
                      <ImageUpload
                        value={advertiserFormData.businessRegistration}
                        onChange={(url) =>
                          setAdvertiserFormData({ ...advertiserFormData, businessRegistration: url })
                        }
                        bucket='advertisements'
                        folder='advertisers/business-registrations'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label>계약서</Label>
                      <ImageUpload
                        value={advertiserFormData.contractDocument}
                        onChange={(url) =>
                          setAdvertiserFormData({ ...advertiserFormData, contractDocument: url })
                        }
                        bucket='advertisements'
                        folder='advertisers/contracts'
                      />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='contractMemo'>계약 메모</Label>
                    <Textarea
                      id='contractMemo'
                      value={advertiserFormData.contractMemo}
                      onChange={(e) =>
                        setAdvertiserFormData({ ...advertiserFormData, contractMemo: e.target.value })
                      }
                      placeholder='계약 관련 메모를 입력하세요'
                      rows={3}
                      className='resize-none'
                    />
                  </div>
                </div>
              </div>

              {/* 오른쪽: 광고 정보 */}
              <div className='space-y-4'>
                <div className='sticky top-0 bg-background pb-3 border-b-2 border-primary'>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Tag className='h-5 w-5' />
                    광고 정보
                  </h3>
                  <p className='text-sm text-muted-foreground mt-1'>
                    광고 콘텐츠와 노출 설정
                  </p>
                </div>

                <div className='space-y-4'>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='title'>
                        광고 제목 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='title'
                        value={adFormData.title}
                        onChange={(e) =>
                          setAdFormData({ ...adFormData, title: e.target.value })
                        }
                        placeholder='필라테스 신규 회원 모집'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='categoryId'>카테고리</Label>
                      <Select
                        value={adFormData.categoryId}
                        onValueChange={(value) =>
                          setAdFormData({ ...adFormData, categoryId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='선택하세요' />
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
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='description'>소개내용</Label>
                    <Textarea
                      id='description'
                      value={adFormData.description}
                      onChange={(e) =>
                        setAdFormData({ ...adFormData, description: e.target.value })
                      }
                      placeholder='광고 소개 내용을 입력하세요'
                      rows={3}
                      className='resize-none'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label>
                      광고 이미지 <span className='text-destructive'>*</span>
                    </Label>
                    <ImageUpload
                      value={adFormData.imageUrl}
                      onChange={(url) => setAdFormData({ ...adFormData, imageUrl: url })}
                      bucket='advertisements'
                      folder='ads'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='linkUrl'>링크 URL</Label>
                    <Input
                      id='linkUrl'
                      type='url'
                      value={adFormData.linkUrl}
                      onChange={(e) =>
                        setAdFormData({ ...adFormData, linkUrl: e.target.value })
                      }
                      placeholder='https://example.com'
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='startDate'>
                        게시 시작일 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='startDate'
                        type='date'
                        value={adFormData.startDate}
                        onChange={(e) =>
                          setAdFormData({ ...adFormData, startDate: e.target.value })
                        }
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='endDate'>
                        게시 종료일 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='endDate'
                        type='date'
                        value={adFormData.endDate}
                        onChange={(e) =>
                          setAdFormData({ ...adFormData, endDate: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label>
                      광고 타입 <span className='text-destructive'>*</span>
                    </Label>
                    <Select
                      value={adFormData.adType}
                      onValueChange={(value: 'NEIGHBORHOOD' | 'REGION') =>
                        setAdFormData({ ...adFormData, adType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='NEIGHBORHOOD'>
                          <div className='flex items-center gap-2'>
                            <Building2 className='h-4 w-4' />
                            동네 광고 (특정 아파트)
                          </div>
                        </SelectItem>
                        <SelectItem value='REGION'>
                          <div className='flex items-center gap-2'>
                            <MapPin className='h-4 w-4' />
                            지역 광고 (시/군/구)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 동네 광고 - 아파트 선택 */}
                  {adFormData.adType === 'NEIGHBORHOOD' && (
                    <div className='space-y-2'>
                      <Label>
                        노출 아파트 <span className='text-destructive'>*</span>
                      </Label>
                      <Popover open={apartmentSearchOpen} onOpenChange={setApartmentSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            role='combobox'
                            className='w-full justify-between h-auto min-h-[40px]'
                          >
                            <span className='truncate'>
                              {adFormData.selectedApartments.length > 0
                                ? `${adFormData.selectedApartments.length}개 아파트 선택됨`
                                : '아파트를 선택하세요'}
                            </span>
                            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-full p-0'>
                          <Command>
                            <CommandInput
                              placeholder='아파트 검색...'
                              value={apartmentSearch}
                              onValueChange={setApartmentSearch}
                            />
                            <CommandList>
                              <CommandEmpty>아파트를 찾을 수 없습니다.</CommandEmpty>
                              <CommandGroup>
                                {apartments
                                  .filter(apt =>
                                    apt.name.toLowerCase().includes(apartmentSearch.toLowerCase())
                                  )
                                  .map((apt) => (
                                    <CommandItem
                                      key={apt.id}
                                      onSelect={() => {
                                        const isSelected = adFormData.selectedApartments.includes(apt.id);
                                        setAdFormData({
                                          ...adFormData,
                                          selectedApartments: isSelected
                                            ? adFormData.selectedApartments.filter(id => id !== apt.id)
                                            : [...adFormData.selectedApartments, apt.id],
                                        });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          adFormData.selectedApartments.includes(apt.id)
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {apt.name}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {adFormData.selectedApartments.length > 0 && (
                        <div className='flex flex-wrap gap-2 pt-2'>
                          {adFormData.selectedApartments.map((aptId) => {
                            const apt = apartments.find(a => a.id === aptId);
                            return apt ? (
                              <Badge key={aptId} variant='secondary' className='font-normal'>
                                {apt.name}
                                <X
                                  className='ml-1 h-3 w-3 cursor-pointer'
                                  onClick={() =>
                                    setAdFormData({
                                      ...adFormData,
                                      selectedApartments: adFormData.selectedApartments.filter(
                                        id => id !== aptId
                                      ),
                                    })
                                  }
                                />
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 지역 광고 - 지역 선택 */}
                  {adFormData.adType === 'REGION' && (
                    <div className='space-y-2'>
                      <Label>
                        노출 지역 <span className='text-destructive'>*</span>
                      </Label>
                      <div className='space-y-3 rounded-lg border p-4 bg-muted/30'>
                        <div className='grid grid-cols-3 gap-2'>
                          <Input
                            placeholder='시/도 *'
                            value={regionSido}
                            onChange={(e) => setRegionSido(e.target.value)}
                          />
                          <Input
                            placeholder='시/군/구'
                            value={regionSigungu}
                            onChange={(e) => setRegionSigungu(e.target.value)}
                          />
                          <Input
                            placeholder='읍/면/동'
                            value={regionDong}
                            onChange={(e) => setRegionDong(e.target.value)}
                          />
                        </div>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={handleAddRegion}
                          className='w-full'
                        >
                          <Plus className='mr-2 h-4 w-4' />
                          지역 추가
                        </Button>
                        {adFormData.selectedRegions.length > 0 && (
                          <div className='space-y-2'>
                            <div className='text-sm font-medium'>선택된 지역 ({adFormData.selectedRegions.length}개):</div>
                            <div className='space-y-1.5'>
                              {adFormData.selectedRegions.map((region, index) => (
                                <div
                                  key={index}
                                  className='flex items-center justify-between rounded-md border bg-background p-2.5'
                                >
                                  <span className='text-sm font-medium'>
                                    {region.regionSido}
                                    {region.regionSigungu && ` > ${region.regionSigungu}`}
                                    {region.regionDong && ` > ${region.regionDong}`}
                                  </span>
                                  <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => handleRemoveRegion(index)}
                                    className='h-7 w-7 p-0'
                                  >
                                    <X className='h-4 w-4' />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className='flex items-center space-x-2 p-4 rounded-lg bg-muted/30 border'>
                    <input
                      type='checkbox'
                      id='isActive'
                      checked={adFormData.isActive}
                      onChange={(e) =>
                        setAdFormData({ ...adFormData, isActive: e.target.checked })
                      }
                      className='h-4 w-4 rounded border-gray-300'
                    />
                    <Label htmlFor='isActive' className='cursor-pointer font-medium'>
                      광고 즉시 활성화 (체크하면 설정한 게시 기간에 노출됩니다)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className='gap-2'>
              <Button
                variant='outline'
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button onClick={handleSaveAd} disabled={isSaving} className='min-w-[100px]'>
                {isSaving ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    저장 중...
                  </>
                ) : (
                  <>
                    {selectedAd ? '수정 완료' : '등록 완료'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 다이얼로그 */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <AlertCircle className='h-5 w-5 text-destructive' />
                광고 삭제
              </DialogTitle>
              <DialogDescription className='pt-2'>
                <span className='font-semibold'>{selectedAd?.title}</span> 광고를 정말 삭제하시겠습니까?
                <br />
                이 작업은 취소할 수 없으며, 광고주 정보는 유지됩니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant='outline' onClick={() => setIsDeleteDialogOpen(false)}>
                취소
              </Button>
              <Button variant='destructive' onClick={handleDelete}>
                <Trash2 className='mr-2 h-4 w-4' />
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
