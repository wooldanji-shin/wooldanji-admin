'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Package,
  Download,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/image-upload';
import { deleteFolderFromStorage } from '@/lib/utils/storage';
import { format, parseISO } from 'date-fns';

// 날짜를 시작 시간(00:00:00)으로 변환 (로컬 → UTC)
const formatDateToStartOfDay = (date: string): string => {
  if (!date) return '';
  const localDate = parseISO(date + 'T00:00:00');
  return localDate.toISOString();
};

// 날짜를 종료 시간(23:59:59)으로 변환 (로컬 → UTC)
const formatDateToEndOfDay = (date: string): string => {
  if (!date) return '';
  const localDate = parseISO(date + 'T23:59:59.999');
  return localDate.toISOString();
};

// UTC 날짜를 한국 시간으로 표시 (예: 2024년 11월 27일)
const formatDisplayDate = (dateString: string): string => {
  if (!dateString) return '';
  return format(parseISO(dateString), 'yyyy년 M월 d일');
};

// UTC 날짜를 input[type="date"] 형식으로 변환 (예: 2024-11-27)
const formatDateForInput = (dateString: string): string => {
  if (!dateString) return '';
  return format(parseISO(dateString), 'yyyy-MM-dd');
};

// 검색 태그 자동 생성 함수
const generateSearchTags = (
  businessName: string,
  adType: 'NEIGHBORHOOD' | 'REGION',
  regions?: { regionSido: string; regionSigungu: string | null; regionDong: string | null }[],
  apartments?: { id: string; name: string; address: string }[]
): string[] => {
  const tags = new Set<string>();

  // 1. 전체 상호명
  tags.add(businessName);
  tags.add(businessName.replace(/\s/g, ''));

  // 2. 상호명을 단어로 분해
  const keywords = businessName.split(/\s+/).filter(k => k.length > 0);
  keywords.forEach(keyword => {
    tags.add(keyword);
  });

  // 3-A. REGION 광고: 지역 정보 기반
  if (adType === 'REGION' && regions) {
    regions.forEach(region => {
      if (region.regionSido) {
        tags.add(`${region.regionSido}_${businessName}`);
        tags.add(`${region.regionSido}_${businessName.replace(/\s/g, '')}`);
        keywords.forEach(keyword => {
          tags.add(`${region.regionSido}_${keyword}`);
        });
      }

      if (region.regionSigungu) {
        tags.add(`${region.regionSigungu}_${businessName}`);
        tags.add(`${region.regionSigungu}_${businessName.replace(/\s/g, '')}`);
        keywords.forEach(keyword => {
          tags.add(`${region.regionSigungu}_${keyword}`);
        });
      }

      if (region.regionDong) {
        tags.add(`${region.regionDong}_${businessName}`);
        keywords.forEach(keyword => {
          tags.add(`${region.regionDong}_${keyword}`);
        });
      }
    });
  }

  // 3-B. NEIGHBORHOOD 광고: 아파트 이름 + 지역 정보
  if (adType === 'NEIGHBORHOOD' && apartments) {
    apartments.forEach(apt => {
      // 아파트 이름으로 태그 생성
      const aptName = apt.name.replace(/\s/g, '');

      // 아파트 + 전체 상호명
      tags.add(`${aptName}_${businessName}`);
      tags.add(`${aptName}_${businessName.replace(/\s/g, '')}`);

      // 아파트 + 개별 키워드
      keywords.forEach(keyword => {
        tags.add(`${aptName}_${keyword}`);
      });

      // 아파트 주소에서 지역 정보 추출
      const addressParts = apt.address.split(' ').filter(p => p.length > 0);

      // 시/도
      if (addressParts[0]) {
        tags.add(`${addressParts[0]}_${businessName}`);
        tags.add(`${addressParts[0]}_${businessName.replace(/\s/g, '')}`);
        keywords.forEach(keyword => {
          tags.add(`${addressParts[0]}_${keyword}`);
        });
      }

      // 시/군/구
      if (addressParts[1]) {
        tags.add(`${addressParts[1]}_${businessName}`);
        tags.add(`${addressParts[1]}_${businessName.replace(/\s/g, '')}`);
        keywords.forEach(keyword => {
          tags.add(`${addressParts[1]}_${keyword}`);
        });
      }

      // 읍/면/동
      if (addressParts[2]) {
        tags.add(`${addressParts[2]}_${businessName}`);
        keywords.forEach(keyword => {
          tags.add(`${addressParts[2]}_${keyword}`);
        });
      }
    });
  }

  return Array.from(tags);
};

// 광고 상태 타입
type AdStatus = 'all' | 'active' | 'pending' | 'scheduled' | 'expiring' | 'expired';

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
  isEvent: boolean;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventDescription: string | null;
  clickCount: number;
  adClickCount: number;
  createdAt: string;
  advertisers: {
    id: string;
    businessName: string;
    representativeName: string;
    email: string | null;
    contactPhoneNumber: string;
    displayPhoneNumber: string | null;
    address: string;
    businessRegistration: string | null;
    contractDocument: string | null;
    contractMemo: string | null;
    searchTags: string[];
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
  user?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  } | null;
}

interface Advertiser {
  id: string;
  businessName: string;
  representativeName: string;
  categoryId: string | null;
}

interface Category {
  id: string;
  categoryName: string;
}

interface Apartment {
  id: string;
  name: string;
  address: string;
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
  const [filterCreator, setFilterCreator] = useState<string>('all');
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // UI 상태
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetClickDialogOpen, setIsResetClickDialogOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 선택된 광고주 ID
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>('');
  const [advertiserPopoverOpen, setAdvertiserPopoverOpen] = useState(false);

  // 이미 광고가 있는 광고주 제외 (1:1 매칭)
  const availableAdvertisers = useMemo(() => {
    const usedAdvertiserIds = new Set(
      advertisements.map(ad => ad.advertiserId).filter(Boolean)
    );

    return advertisers.filter(adv => {
      // 수정 모드에서는 현재 광고의 광고주는 선택 가능
      if (selectedAd && selectedAd.advertiserId === adv.id) {
        return true;
      }
      // 이미 광고가 있는 광고주는 제외
      return !usedAdvertiserIds.has(adv.id);
    });
  }, [advertisers, advertisements, selectedAd]);

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
    isEvent: false,
    eventStartDate: '',
    eventEndDate: '',
    eventDescription: '',
    selectedApartments: [] as string[],
    selectedRegions: [] as {
      regionSido: string;
      regionSigungu: string;
      regionDong: string;
    }[],
  });

  // 이미지 업로드용 고유 폴더 ID
  const [imageUploadFolderId, setImageUploadFolderId] = useState('');

  // 업로드된 이미지 URL 추적 (취소 시 삭제용)
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);

  // 지역 선택 상태
  const [regionSido, setRegionSido] = useState('');
  const [regionSigungu, setRegionSigungu] = useState('');
  const [regionDong, setRegionDong] = useState('');

  // 아파트 검색 상태
  const [apartmentSearch, setApartmentSearch] = useState('');

  // 계약메모 인라인 수정 상태
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoValue, setEditingMemoValue] = useState('');

  // 클릭수 컬럼 숨김 상태 (localStorage와 동기화)
  const [hideClickColumn, setHideClickColumn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hideClickColumn') === 'true';
    }
    return false;
  });

  // hideClickColumn 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('hideClickColumn', String(hideClickColumn));
  }, [hideClickColumn]);

  // 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      const roles = await getUserRoles();
      setUserRoles(roles);
      await fetchData(roles);
    };
    initializeData();
  }, []);

  const fetchData = useCallback(async (roles?: string[]) => {
    try {
      setLoading(true);

      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();

      // roles가 전달되지 않으면 userRoles 상태 사용
      const currentRoles = roles || userRoles;
      const isManager = currentRoles.includes('MANAGER');

      // 광고 데이터 로드
      let query = supabase
        .from('advertisements')
        .select(`
          *,
          advertisers (
            id,
            businessName,
            representativeName,
            email,
            contactPhoneNumber,
            displayPhoneNumber,
            address,
            businessRegistration,
            contractDocument,
            contractMemo,
            searchTags
          ),
          ad_categories (categoryName),
          advertisement_apartments (
            apartments (id, name)
          ),
          advertisement_regions (
            regionSido,
            regionSigungu,
            regionDong
          ),
          user:createdBy (
            id,
            name,
            phoneNumber
          )
        `);

      // MANAGER인 경우 자신이 등록한 광고만 필터링
      if (isManager && user) {
        query = query.eq('createdBy', user.id);
      }

      const { data: adsData, error: adsError } = await query
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;
      setAdvertisements(adsData || []);

      // 광고주 목록 로드 (MANAGER인 경우 자신이 등록한 광고주만)
      let advertisersQuery = supabase
        .from('advertisers')
        .select('id, businessName, representativeName, categoryId');

      if (isManager && user) {
        advertisersQuery = advertisersQuery.eq('createdBy', user.id);
      }

      const { data: advertisersData, error: advertisersError } = await advertisersQuery
        .order('businessName');

      if (advertisersError) throw advertisersError;
      setAdvertisers(advertisersData || []);

      // 카테고리 로드
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('ad_categories')
        .select('id, categoryName')
        .eq('isActive', true)
        .order('createdAt', { ascending: false });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // 아파트 로드 (MANAGER인 경우 자신이 관리하는 아파트만)
      let apartmentsQuery = supabase
        .from('apartments')
        .select('id, name, address');

      if (isManager && user) {
        // MANAGER가 관리하는 아파트 ID 목록 가져오기
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', user.id);

        if (managerApartments && managerApartments.length > 0) {
          const apartmentIds = managerApartments.map(ma => ma.apartmentId);
          apartmentsQuery = apartmentsQuery.in('id', apartmentIds);
        } else {
          // 관리하는 아파트가 없으면 빈 배열
          setApartments([]);
          return;
        }
      }

      const { data: apartmentsData, error: apartmentsError } = await apartmentsQuery
        .order('name');

      if (apartmentsError) throw apartmentsError;
      setApartments(apartmentsData || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('데이터 로드 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, userRoles]);

  // 광고 상태 계산
  const getAdStatus = (ad: Advertisement): AdStatus => {
    if (!ad.isActive) return 'pending';

    const now = new Date();
    const start = new Date(ad.startDate);
    const end = new Date(ad.endDate);

    if (now > end) return 'expired';
    if (now < start) return 'scheduled';

    // 만료 30일 전 체크
    const thirtyDaysBeforeEnd = new Date(end);
    thirtyDaysBeforeEnd.setDate(thirtyDaysBeforeEnd.getDate() - 30);

    if (now >= thirtyDaysBeforeEnd) return 'expiring';
    return 'active';
  };

  // 게시자 목록 추출 (중복 제거) - SUPER_ADMIN만 사용
  const creators = useMemo(() => {
    // SUPER_ADMIN이 아니면 빈 배열 반환
    if (!userRoles.includes('SUPER_ADMIN')) {
      return [];
    }

    const uniqueCreators = new Map<string, { id: string; name: string }>();
    advertisements.forEach(ad => {
      if (ad.user && ad.user.id) {
        uniqueCreators.set(ad.user.id, {
          id: ad.user.id,
          name: ad.user.name || '알 수 없음'
        });
      }
    });
    return Array.from(uniqueCreators.values());
  }, [advertisements, userRoles]);

  // 필터링 로직
  const filterAdvertisements = useCallback(() => {
    let filtered = [...advertisements];

    // 상태별 필터
    if (activeTab !== 'all') {
      filtered = filtered.filter(ad => getAdStatus(ad) === activeTab);
    }

    // 검색어 필터 (제목, 상호명, 검색 태그)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().replace(/\s/g, '');
      filtered = filtered.filter(ad => {
        const titleMatch = ad.title.toLowerCase().includes(searchTerm.toLowerCase());
        const businessNameMatch = ad.advertisers?.businessName.toLowerCase().includes(searchTerm.toLowerCase());

        // 검색 태그 매칭 (정확한 매칭 또는 부분 매칭)
        const tagMatch = ad.advertisers?.searchTags?.some(tag => {
          const tagLower = tag.toLowerCase();
          // 정확한 매칭
          if (tagLower === searchLower) return true;
          // 부분 매칭 (언더스코어 포함)
          if (tagLower.includes(searchLower)) return true;
          // 원본 검색어로도 매칭 (공백 포함)
          if (tagLower.includes(searchTerm.toLowerCase())) return true;
          return false;
        });

        return titleMatch || businessNameMatch || tagMatch;
      });
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

    // 게시자 필터 (SUPER_ADMIN만 적용)
    if (filterCreator !== 'all' && userRoles.includes('SUPER_ADMIN')) {
      filtered = filtered.filter(ad => ad.createdBy === filterCreator);
    }

    setFilteredAds(filtered);
  }, [advertisements, activeTab, searchTerm, filterAdType, filterCategory, filterAdvertiser, filterCreator, userRoles]);

  // 필터링 useEffect
  useEffect(() => {
    filterAdvertisements();
  }, [filterAdvertisements]);

  // 카테고리별로 광고 그룹화
  const groupedAdsByCategory = useMemo(() => {
    const grouped: Record<string, { categoryName: string; ads: Advertisement[] }> = {};

    filteredAds.forEach(ad => {
      if (!ad.categoryId || !ad.ad_categories) return; // 카테고리 없는 광고는 제외

      if (!grouped[ad.categoryId]) {
        grouped[ad.categoryId] = {
          categoryName: ad.ad_categories.categoryName,
          ads: []
        };
      }
      grouped[ad.categoryId].ads.push(ad);
    });

    return grouped;
  }, [filteredAds]);

  // 계약메모 인라인 수정
  const handleMemoEdit = (advertiserId: string, currentMemo: string | null) => {
    setEditingMemoId(advertiserId);
    setEditingMemoValue(currentMemo || '');
  };

  const handleMemoSave = async (advertiserId: string) => {
    try {
      const { error } = await supabase
        .from('advertisers')
        .update({ contractMemo: editingMemoValue || null })
        .eq('id', advertiserId);

      if (error) throw error;

      // 로컬 상태 업데이트
      setAdvertisements(prev =>
        prev.map(ad =>
          ad.advertiserId === advertiserId
            ? { ...ad, advertisers: { ...ad.advertisers, contractMemo: editingMemoValue || null } }
            : ad
        )
      );

      setEditingMemoId(null);
      setEditingMemoValue('');
    } catch (error: any) {
      console.error('Error updating memo:', error);
      toast.error('메모 저장 실패: ' + error.message);
    }
  };

  const handleMemoCancel = () => {
    setEditingMemoId(null);
    setEditingMemoValue('');
  };

  // UUID 생성 함수
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // 다이얼로그 닫기 (취소 시 업로드된 이미지 정리)
  const handleCloseDialog = async () => {
    // 신규 등록 모드이고, 업로드된 이미지가 있는 경우
    if (!selectedAd && imageUploadFolderId) {
      try {
        // Storage에서 해당 폴더의 모든 파일 삭제
        const folderPath = `ads/${imageUploadFolderId}`;

        // 알려진 하위 폴더들
        const subFolders = ['images', 'business-registrations', 'contracts'];
        const allFilesToDelete: string[] = [];

        // 각 하위 폴더의 파일들 조회
        for (const subFolder of subFolders) {
          const { data: files, error: listError } = await supabase.storage
            .from('advertisements')
            .list(`${folderPath}/${subFolder}`, {
              limit: 1000,
              offset: 0,
            });

          if (!listError && files && files.length > 0) {
            files.forEach(file => {
              allFilesToDelete.push(`${folderPath}/${subFolder}/${file.name}`);
            });
          }
        }

        // 모든 파일 삭제
        if (allFilesToDelete.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('advertisements')
            .remove(allFilesToDelete);

          if (deleteError) {
            console.error('🔴 파일 삭제 실패:', deleteError);
          } else {
            console.log('🟢 업로드된 파일 정리 완료:', allFilesToDelete.length, '개');
          }
        }
      } catch (error) {
        console.error('🔴 파일 정리 중 오류:', error);
      }
    }

    // 상태 초기화
    setIsDialogOpen(false);
    setUploadedImageUrls([]);
  };

  // 광고 등록/수정 다이얼로그 열기
  const handleOpenDialog = (ad?: Advertisement) => {
    setApartmentSearch('');
    if (ad) {
      setSelectedAd(ad);

      // 수정 모드: 기존 광고 ID를 폴더명으로 사용
      setImageUploadFolderId(ad.id);

      // 광고주 ID 설정
      setSelectedAdvertiserId(ad.advertiserId);

      // 광고 정보 설정
      setAdFormData({
        categoryId: ad.categoryId || '',
        adType: ad.adType,
        title: ad.title,
        description: ad.description || '',
        imageUrl: ad.imageUrl,
        linkUrl: ad.linkUrl || '',
        startDate: formatDateForInput(ad.startDate),
        endDate: formatDateForInput(ad.endDate),
        isActive: ad.isActive,
        isEvent: ad.isEvent || false,
        eventStartDate: ad.eventStartDate ? formatDateForInput(ad.eventStartDate) : '',
        eventEndDate: ad.eventEndDate ? formatDateForInput(ad.eventEndDate) : '',
        eventDescription: ad.eventDescription || '',
        selectedApartments: ad.advertisement_apartments?.map(aa => aa.apartments.id) || [],
        selectedRegions: ad.advertisement_regions || [],
      });
    } else {
      setSelectedAd(null);

      // 등록 모드: 새로운 UUID 생성
      setImageUploadFolderId(generateUUID());

      setSelectedAdvertiserId('');
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
        isEvent: false,
        eventStartDate: '',
        eventEndDate: '',
        eventDescription: '',
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

      // 유효성 검사
      if (!selectedAdvertiserId) {
        throw new Error('광고주를 선택해주세요');
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
        // 광고 정보 업데이트 (광고주 변경 가능)
        const { error: adError } = await supabase
          .from('advertisements')
          .update({
            advertiserId: selectedAdvertiserId,
            categoryId: adFormData.categoryId || null,
            adType: adFormData.adType,
            title: adFormData.title,
            description: adFormData.description || null,
            imageUrl: adFormData.imageUrl,
            linkUrl: adFormData.linkUrl || null,
            startDate: formatDateToStartOfDay(adFormData.startDate),
            endDate: formatDateToEndOfDay(adFormData.endDate),
            isActive: adFormData.isActive,
            isEvent: adFormData.isEvent,
            eventStartDate: adFormData.isEvent ? formatDateToStartOfDay(adFormData.eventStartDate) : null,
            eventEndDate: adFormData.isEvent ? formatDateToEndOfDay(adFormData.eventEndDate) : null,
            eventDescription: adFormData.isEvent ? (adFormData.eventDescription || null) : null,
          })
          .eq('id', selectedAd.id);

        if (adError) throw adError;

        // 아파트/지역 연결 업데이트
        await updateAdConnections(selectedAd.id);

        // 검색 태그 생성 및 업데이트
        await updateAdvertiserSearchTags(selectedAdvertiserId, adFormData.adType);

        toast.success('광고가 수정되었습니다');
      } else {
        // 등록 모드 - 선택된 광고주 ID 사용
        const { data: adData, error: adError } = await supabase
          .from('advertisements')
          .insert({
            advertiserId: selectedAdvertiserId,
            categoryId: adFormData.categoryId || null,
            adType: adFormData.adType,
            title: adFormData.title,
            description: adFormData.description || null,
            imageUrl: adFormData.imageUrl,
            linkUrl: adFormData.linkUrl || null,
            startDate: formatDateToStartOfDay(adFormData.startDate),
            endDate: formatDateToEndOfDay(adFormData.endDate),
            isActive: adFormData.isActive,
            isEvent: adFormData.isEvent,
            eventStartDate: adFormData.isEvent ? formatDateToStartOfDay(adFormData.eventStartDate) : null,
            eventEndDate: adFormData.isEvent ? formatDateToEndOfDay(adFormData.eventEndDate) : null,
            eventDescription: adFormData.isEvent ? (adFormData.eventDescription || null) : null,
            createdBy: currentUser.id,
          })
          .select()
          .single();

        if (adError) throw adError;

        // 아파트/지역 연결
        await updateAdConnections(adData.id);

        // 검색 태그 생성 및 업데이트
        await updateAdvertiserSearchTags(selectedAdvertiserId, adFormData.adType);

        toast.success('광고가 등록되었습니다');
      }

      await fetchData();

      // 저장 성공 시 정리하지 않고 닫기
      setIsDialogOpen(false);
      setUploadedImageUrls([]);
    } catch (error: any) {
      console.error('Error saving ad:', error);
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 아파트/지역 연결 업데이트
  const updateAdConnections = async (adId: string) => {
    // 광고 타입 변경 가능성을 고려하여 양쪽 테이블 모두 삭제
    await supabase
      .from('advertisement_apartments')
      .delete()
      .eq('advertisementId', adId);

    await supabase
      .from('advertisement_regions')
      .delete()
      .eq('advertisementId', adId);

    // 현재 타입에 맞는 연결 추가
    if (adFormData.adType === 'NEIGHBORHOOD') {
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

  // 광고주 검색 태그 업데이트
  const updateAdvertiserSearchTags = async (
    advertiserId: string,
    adType: 'NEIGHBORHOOD' | 'REGION'
  ) => {
    try {
      // 광고주 정보 가져오기
      const { data: advertiser } = await supabase
        .from('advertisers')
        .select('businessName')
        .eq('id', advertiserId)
        .single();

      if (!advertiser) return;

      let searchTags: string[] = [];

      if (adType === 'NEIGHBORHOOD') {
        // 아파트 정보 가져오기
        const { data: adApartments } = await supabase
          .from('advertisement_apartments')
          .select(`
            apartments (
              id,
              name,
              address
            )
          `)
          .eq('advertisementId', (await supabase
            .from('advertisements')
            .select('id')
            .eq('advertiserId', advertiserId)
            .single()).data?.id || '');

        const apartments = adApartments?.map((aa: any) => aa.apartments).filter(Boolean) || [];
        searchTags = generateSearchTags(advertiser.businessName, 'NEIGHBORHOOD', undefined, apartments);
      } else {
        // 지역 정보 가져오기
        const { data: regions } = await supabase
          .from('advertisement_regions')
          .select('regionSido, regionSigungu, regionDong')
          .eq('advertisementId', (await supabase
            .from('advertisements')
            .select('id')
            .eq('advertiserId', advertiserId)
            .single()).data?.id || '');

        searchTags = generateSearchTags(advertiser.businessName, 'REGION', regions || [], undefined);
      }

      // 검색 태그 업데이트
      await supabase
        .from('advertisers')
        .update({ searchTags })
        .eq('id', advertiserId);
    } catch (error) {
      console.error('Error updating search tags:', error);
    }
  };

  // 광고 삭제
  const handleDelete = async () => {
    if (!selectedAd) return;

    try {
      // Storage에서 광고 폴더 전체 삭제
      // URL에서 폴더 경로 추출 (예: ads/uuid)
      if (selectedAd.imageUrl) {
        try {
          const url = new URL(selectedAd.imageUrl);
          const pathParts = url.pathname.split('/').filter(Boolean);
          const publicIndex = pathParts.findIndex(part => part === 'public');
          if (publicIndex !== -1 && pathParts.length > publicIndex + 1) {
            const bucketAndPath = pathParts.slice(publicIndex + 1);
            const bucket = bucketAndPath[0]; // 'advertisements'
            // ads/uuid 경로 추출
            if (bucketAndPath.length > 2) {
              const folderPath = bucketAndPath.slice(1, 3).join('/'); // 'ads/uuid'
              await deleteFolderFromStorage(bucket, folderPath);
            }
          }
        } catch (err) {
          console.error('Failed to delete folder:', err);
        }
      }

      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', selectedAd.id);

      if (error) throw error;

      toast.success('광고가 삭제되었습니다');
      await fetchData();
      setIsDeleteDialogOpen(false);
      setSelectedAd(null);
    } catch (error: any) {
      console.error('Error deleting ad:', error);
      toast.error(error.message);
    }
  };

  // 클릭수 초기화
  const handleResetClickCount = async () => {
    if (!selectedAd) return;

    try {
      const { error } = await supabase
        .from('advertisements')
        .update({
          adClickCount: 0,
          clickCount: 0,
        })
        .eq('id', selectedAd.id);

      if (error) throw error;

      toast.success('클릭수가 초기화되었습니다.');
      await fetchData();

      // selectedAd 업데이트
      setSelectedAd({
        ...selectedAd,
        adClickCount: 0,
        clickCount: 0,
      });
      setIsResetClickDialogOpen(false);
    } catch (error: any) {
      console.error('Error resetting click counts:', error);
      toast.error('클릭수 초기화에 실패했습니다.');
    }
  };

  // 다음 주소 API로 지역 검색 및 추가
  const handleRegionAddressSearch = () => {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        // 다음 주소 API에서 표준화된 지역 정보 추출
        const newRegion = {
          regionSido: data.sido || '',           // 시/도 (예: "서울")
          regionSigungu: data.sigungu || '',     // 시/군/구 (예: "관악구")
          regionDong: data.bname || '',          // 법정동 (예: "신림동")
        };

        // 중복 체크
        const isDuplicate = adFormData.selectedRegions.some(
          region =>
            region.regionSido === newRegion.regionSido &&
            region.regionSigungu === newRegion.regionSigungu &&
            region.regionDong === newRegion.regionDong
        );

        if (isDuplicate) {
          toast.error('이미 추가된 지역입니다');
          return;
        }

        // 지역 추가
        setAdFormData({
          ...adFormData,
          selectedRegions: [...adFormData.selectedRegions, newRegion],
        });

        // 입력 필드 초기화
        setRegionSido('');
        setRegionSigungu('');
        setRegionDong('');
      }
    }).open();
  };

  // 수동으로 지역 추가
  const handleAddRegion = () => {
    if (!regionSido.trim()) {
      toast.error('시/도를 입력해주세요');
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

  // 필수 입력 항목 검증
  const isFormValid = () => {
    // 광고주 선택 필수
    if (!selectedAdvertiserId) return false;

    // 광고 정보 필수 항목
    if (!adFormData.title.trim()) return false;
    if (!adFormData.categoryId) return false;
    if (!adFormData.description.trim()) return false;
    if (!adFormData.imageUrl.trim()) return false;
    if (!adFormData.startDate) return false;
    if (!adFormData.endDate) return false;

    // 이벤트 필수 항목
    if (adFormData.isEvent) {
      if (!adFormData.eventStartDate) return false;
      if (!adFormData.eventEndDate) return false;
    }

    // 광고 타입별 필수 항목
    if (adFormData.adType === 'NEIGHBORHOOD' && adFormData.selectedApartments.length === 0) {
      return false;
    }
    if (adFormData.adType === 'REGION' && adFormData.selectedRegions.length === 0) {
      return false;
    }

    return true;
  };

  // 필터 적용 개수
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterAdType !== 'all') count++;
    if (filterCategory !== 'all') count++;
    if (filterAdvertiser !== 'all') count++;
    // 게시자 필터는 SUPER_ADMIN만 카운트
    if (filterCreator !== 'all' && userRoles.includes('SUPER_ADMIN')) count++;
    return count;
  };

  // 상태 배지 컴포넌트
  const StatusBadge = ({ ad }: { ad: Advertisement }) => {
    const status = getAdStatus(ad);

    const statusConfig = {
      scheduled: {
        label: '예정',
        className: 'bg-blue-500 hover:bg-blue-600',
        icon: Calendar
      },
      pending: {
        label: '대기중',
        className: 'bg-gray-500 hover:bg-gray-600',
        icon: Clock
      },
      active: {
        label: '진행중',
        className: 'bg-green-500 hover:bg-green-600',
        icon: CheckCircle
      },
      expiring: {
        label: '만료예정',
        className: 'bg-orange-500 hover:bg-orange-600',
        icon: AlertCircle
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

  // CSV 내보내기 함수
  const handleExportCSV = () => {
    // 현재 필터링된 광고 목록 사용
    const dataToExport = filteredAds;

    if (dataToExport.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = [
      '광고 제목',
      '광고주',
      '광고주 연락처',
      '광고주 표시용 연락처',
      '광고주 주소',
      '카테고리',
      '광고 타입',
      '범위',
      '게시 시작일',
      '게시 종료일',
      '활성화 상태',
      '이벤트 여부',
      '이벤트 시작일',
      '이벤트 종료일',
      '광고 클릭수',
      '클릭 수',
      '게시자',
      '게시자 연락처',
      '등록일',
      '계약 메모',
    ];

    // CSV 데이터 생성
    const csvData = dataToExport.map(ad => {
      // 범위 정보 생성
      let scope = '';
      if (ad.adType === 'NEIGHBORHOOD') {
        if (ad.advertisement_apartments && ad.advertisement_apartments.length > 0) {
          scope = ad.advertisement_apartments
            .map(aa => aa.apartments.name)
            .join('; ');
        }
      } else {
        if (ad.advertisement_regions && ad.advertisement_regions.length > 0) {
          scope = ad.advertisement_regions
            .map(region => {
              let parts = [region.regionSido];
              if (region.regionSigungu) parts.push(region.regionSigungu);
              if (region.regionDong) parts.push(region.regionDong);
              return parts.join(' ');
            })
            .join('; ');
        }
      }

      return [
        ad.title,
        ad.advertisers?.businessName || '',
        ad.advertisers?.contactPhoneNumber || '',
        ad.advertisers?.displayPhoneNumber || '',
        ad.advertisers?.address || '',
        ad.ad_categories?.categoryName || '',
        ad.adType === 'NEIGHBORHOOD' ? '동네 광고' : '지역 광고',
        scope,
        formatDisplayDate(ad.startDate),
        formatDisplayDate(ad.endDate),
        ad.isActive ? '활성' : '비활성',
        ad.isEvent ? '이벤트' : '일반',
        ad.eventStartDate ? formatDisplayDate(ad.eventStartDate) : '',
        ad.eventEndDate ? formatDisplayDate(ad.eventEndDate) : '',
        ad.adClickCount?.toString() || '0',
        ad.clickCount?.toString() || '0',
        ad.user?.name || '',
        ad.user?.phoneNumber || '',
        formatDisplayDate(ad.createdAt),
        ad.advertisers?.contractMemo || '',
      ];
    });

    // CSV 문자열 생성
    const csvContent = [
      headers.join(','),
      ...csvData.map(row =>
        row.map(cell => {
          // 쉼표, 줄바꿈, 따옴표가 포함된 경우 따옴표로 감싸기
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    // BOM 추가 (Excel에서 한글 깨짐 방지)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 파일 다운로드
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `광고목록_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${dataToExport.length}개의 광고를 CSV로 내보냈습니다.`);
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
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader
          title='광고 등록/수정'
        />

        <div className="flex flex-col gap-4">
          {/* 상태 탭 */}
          <Card>
            <CardContent className='pt-6'>
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as AdStatus)}
              >
                <TabsList className='grid w-full grid-cols-6 h-auto'>
                  <TabsTrigger
                    value='all'
                    className='flex flex-col gap-1 py-3'
                  >
                    <Package className='h-4 w-4' />
                    <div className='font-medium'>전체</div>
                    <div className='text-xs text-muted-foreground'>
                      {getStatusCount('all')}개
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value='pending'
                    className='flex flex-col gap-1 py-3'
                  >
                    <Clock className='h-4 w-4' />
                    <div className='font-medium'>대기중</div>
                    <div className='text-xs text-muted-foreground'>
                      {getStatusCount('pending')}개
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value='scheduled'
                    className='flex flex-col gap-1 py-3'
                  >
                    <Calendar className='h-4 w-4' />
                    <div className='font-medium'>예정</div>
                    <div className='text-xs text-muted-foreground'>
                      {getStatusCount('scheduled')}개
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value='active'
                    className='flex flex-col gap-1 py-3'
                  >
                    <TrendingUp className='h-4 w-4' />
                    <div className='font-medium'>진행중</div>
                    <div className='text-xs text-muted-foreground'>
                      {getStatusCount('active')}개
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value='expiring'
                    className='flex flex-col gap-1 py-3'
                  >
                    <AlertCircle className='h-4 w-4' />
                    <div className='font-medium'>만료예정</div>
                    <div className='text-xs text-muted-foreground'>
                      {getStatusCount('expiring')}개
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value='expired'
                    className='flex flex-col gap-1 py-3'
                  >
                    <XCircle className='h-4 w-4' />
                    <div className='font-medium'>만료</div>
                    <div className='text-xs text-muted-foreground'>
                      {getStatusCount('expired')}개
                    </div>
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
                    size='lg'
                    className='px-4'
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  >
                    <Filter className='mr-2 h-4 w-4' />
                    필터
                    {getActiveFilterCount() > 0 && (
                      <Badge
                        className='ml-2'
                        variant='secondary'
                      >
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                    {isFilterExpanded ? (
                      <ChevronUp className='ml-2 h-4 w-4' />
                    ) : (
                      <ChevronDown className='ml-2 h-4 w-4' />
                    )}
                  </Button>
                  <Button
                    variant='outline'
                    size='lg'
                    className='px-4'
                    onClick={handleExportCSV}
                    disabled={filteredAds.length === 0}
                  >
                    <Download className='mr-2 h-4 w-4' />
                    CSV 내보내기
                  </Button>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='hide-click-column'
                      checked={hideClickColumn}
                      onCheckedChange={(checked) => setHideClickColumn(checked === true)}
                    />
                  </div>
                  <Button
                    onClick={() => handleOpenDialog()}
                    size='lg'
                    className='px-6'
                  >
                    <Plus className='mr-2 h-5 w-5' />
                    광고 등록
                  </Button>
                </div>

                {/* 필터 영역 */}
                {isFilterExpanded && (
                  <div className='flex flex-wrap gap-3 justify-start p-4 bg-muted/30 rounded-lg animate-in slide-in-from-top'>
                    <Select
                      value={filterAdType}
                      onValueChange={setFilterAdType}
                    >
                      <SelectTrigger className='w-[200px]'>
                        <SelectValue placeholder='광고 타입' />
                      </SelectTrigger>
                      <SelectContent align='start'>
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

                    <Select
                      value={filterCategory}
                      onValueChange={setFilterCategory}
                    >
                      <SelectTrigger className='w-[200px]'>
                        <SelectValue placeholder='카테고리' />
                      </SelectTrigger>
                      <SelectContent align='start'>
                        <SelectItem value='all'>전체 카테고리</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem
                            key={cat.id}
                            value={cat.id}
                          >
                            {cat.categoryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filterAdvertiser}
                      onValueChange={setFilterAdvertiser}
                    >
                      <SelectTrigger className='w-[200px]'>
                        <SelectValue placeholder='광고주' />
                      </SelectTrigger>
                      <SelectContent align='start'>
                        <SelectItem value='all'>전체 광고주</SelectItem>
                        {advertisers.map((adv) => (
                          <SelectItem
                            key={adv.id}
                            value={adv.id}
                          >
                            {adv.businessName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 게시자 필터 (SUPER_ADMIN만 표시) */}
                    {userRoles.includes('SUPER_ADMIN') && (
                      <Select
                        value={filterCreator}
                        onValueChange={setFilterCreator}
                      >
                        <SelectTrigger className='w-[200px]'>
                          <SelectValue placeholder='게시자' />
                        </SelectTrigger>
                        <SelectContent align='start'>
                          <SelectItem value='all'>전체 등록자</SelectItem>
                          {creators.map((creator) => (
                            <SelectItem
                              key={creator.id}
                              value={creator.id}
                            >
                              {creator.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant='outline'
                      onClick={() => {
                        setSearchTerm('');
                        setFilterAdType('all');
                        setFilterCategory('all');
                        setFilterAdvertiser('all');
                        setFilterCreator('all');
                      }}
                      className='w-[120px]'
                    >
                      <X className='mr-2 h-4 w-4' />
                      초기화
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 광고 목록 - 카테고리별로 분리 */}
          <div className='space-y-6'>
            {Object.keys(groupedAdsByCategory).length === 0 ? (
              <Card>
                <CardContent className='pt-6'>
                  <div className='flex flex-col items-center justify-center py-16 text-center'>
                    <Package className='h-16 w-16 text-muted-foreground mb-4' />
                    <h3 className='text-lg font-medium mb-2'>광고가 없습니다</h3>
                    <p className='text-sm text-muted-foreground mb-6'>
                      {searchTerm || getActiveFilterCount() > 0
                        ? '검색 조건에 맞는 광고가 없습니다. 다른 조건으로 시도해보세요.'
                        : '새로운 광고를 등록하여 시작하세요.'}
                    </p>
                    {!searchTerm && getActiveFilterCount() === 0 && (
                      <Button
                        onClick={() => handleOpenDialog()}
                        size='lg'
                      >
                        <Plus className='mr-2 h-5 w-5' />첫 광고 등록하기
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedAdsByCategory).map(([categoryId, { categoryName, ads }]) => (
                <Card key={categoryId}>
                  <CardContent className='pt-6'>
                    <div className='mb-4 flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <div className='text-lg font-semibold'>{categoryName}</div>
                        <Badge variant='secondary' className='text-sm'>
                          {ads.length}개
                        </Badge>
                      </div>
                    </div>
                    <div className='rounded-lg border overflow-hidden'>
                      <Table>
                    <TableHeader>
                      <TableRow className='bg-muted/50'>
                        <TableHead className='w-[80px]'>이미지</TableHead>
                        <TableHead className='w-[100px]'>상태</TableHead>
                        <TableHead className='w-[200px]'>광고 제목</TableHead>
                        <TableHead className='w-[150px]'>광고주</TableHead>
                        <TableHead className='w-[140px]'>연락처</TableHead>
                        <TableHead className='w-[120px]'>카테고리</TableHead>
                        <TableHead className='w-[100px]'>타입</TableHead>
                        <TableHead className='w-[180px]'>범위</TableHead>
                        <TableHead className='w-[180px]'>게시 기간</TableHead>
                        <TableHead className='w-[150px]'>등록자</TableHead>
                        <TableHead className='w-[200px]'>계약메모</TableHead>
                        {!hideClickColumn && (
                          <>
                            <TableHead className='w-[100px] text-center'>광고 클릭수</TableHead>
                            <TableHead className='w-[100px] text-center'>클릭 수</TableHead>
                          </>
                        )}
                        <TableHead className='text-right w-[120px]'>
                          작업
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ads.map((ad) => (
                        <TableRow
                          key={ad.id}
                          className='hover:bg-muted/50 transition-colors'
                        >
                          <TableCell>
                            <div
                              className='w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary transition-all'
                              onClick={() =>
                                ad.imageUrl &&
                                window.open(ad.imageUrl, '_blank')
                              }
                              title={
                                ad.imageUrl ? '이미지 크게 보기' : '이미지 없음'
                              }
                            >
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
                            <div className='space-y-2 flex flex-col'>
                              <StatusBadge ad={ad} />
                              {ad.isEvent && (
                                <Badge className='bg-purple-500 hover:bg-purple-600 text-white font-medium'>
                                  <Tag className='mr-1 h-3 w-3' />
                                  이벤트
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className='max-w-[200px]'>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className='font-medium cursor-default truncate'>
                                  {ad.title}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{ad.title}</p>
                              </TooltipContent>
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
                          <TableCell className='max-w-[150px]'>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className='cursor-default truncate'>
                                  {ad.advertisers?.businessName || '-'}
                                </div>
                              </TooltipTrigger>
                              {ad.advertisers?.businessName && (
                                <TooltipContent>
                                  <p>{ad.advertisers.businessName}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className='space-y-1 text-sm'>
                              {ad.advertisers?.displayPhoneNumber && (
                                <div className='font-medium truncate'>
                                  <span className='text-xs text-muted-foreground'>표시용: </span>
                                  {ad.advertisers.displayPhoneNumber}
                                </div>
                              )}
                              <div className='text-xs text-muted-foreground truncate'>
                                <span>연락처: </span>
                                {ad.advertisers?.contactPhoneNumber || '-'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {ad.ad_categories ? (
                              <Badge
                                variant='outline'
                                className='font-normal max-w-full'
                              >
                                <Tag className='mr-1 h-3 w-3 flex-shrink-0' />
                                <span className='truncate'>{ad.ad_categories.categoryName}</span>
                              </Badge>
                            ) : (
                              <span className='text-sm text-muted-foreground'>
                                미분류
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {ad.adType === 'NEIGHBORHOOD' ? (
                              <Badge
                                variant='secondary'
                                className='font-normal'
                              >
                                <Building2 className='mr-1 h-3 w-3' />
                                동네
                              </Badge>
                            ) : (
                              <Badge
                                variant='secondary'
                                className='font-normal'
                              >
                                <MapPin className='mr-1 h-3 w-3' />
                                지역
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {ad.adType === 'NEIGHBORHOOD' ? (
                              ad.advertisement_apartments && ad.advertisement_apartments.length > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className='text-sm cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors'>
                                      <div className='flex items-center gap-1'>
                                        <Building2 className='h-3 w-3 text-muted-foreground' />
                                        <span className='truncate max-w-[120px]'>
                                          {ad.advertisement_apartments[0].apartments.name}
                                        </span>
                                        {ad.advertisement_apartments.length > 1 && (
                                          <Badge variant='secondary' className='text-xs'>
                                            +{ad.advertisement_apartments.length - 1}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className='max-w-xs max-h-64 overflow-y-auto bg-white text-black border border-gray-200 shadow-lg'>
                                    <div className='space-y-1'>
                                      {ad.advertisement_apartments.map((aa, idx) => (
                                        <div key={idx} className='text-sm py-1'>
                                          <div className='font-medium'>{aa.apartments.name}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className='text-sm text-muted-foreground'>-</span>
                              )
                            ) : (
                              ad.advertisement_regions && ad.advertisement_regions.length > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className='text-sm cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors'>
                                      <div className='flex items-center gap-1'>
                                        <MapPin className='h-3 w-3 text-muted-foreground' />
                                        <span className='truncate max-w-[120px]'>
                                          {ad.advertisement_regions[0].regionSido}
                                          {ad.advertisement_regions[0].regionSigungu && ` ${ad.advertisement_regions[0].regionSigungu}`}
                                          {ad.advertisement_regions[0].regionDong && ` ${ad.advertisement_regions[0].regionDong}`}
                                        </span>
                                        {ad.advertisement_regions.length > 1 && (
                                          <Badge variant='secondary' className='text-xs'>
                                            +{ad.advertisement_regions.length - 1}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className='max-w-xs max-h-64 overflow-y-auto bg-white text-black border border-gray-200 shadow-lg'>
                                    <div className='space-y-1'>
                                      {ad.advertisement_regions.map((region, idx) => (
                                        <div key={idx} className='text-sm py-1'>
                                          {region.regionSido}
                                          {region.regionSigungu && ` > ${region.regionSigungu}`}
                                          {region.regionDong && ` > ${region.regionDong}`}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className='text-sm text-muted-foreground'>-</span>
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            <div className='space-y-2'>
                              <div className='space-y-1 text-sm'>
                                <div className='flex items-center gap-1 text-muted-foreground'>
                                  <Calendar className='h-3 w-3' />
                                  {formatDisplayDate(ad.startDate)}
                                </div>
                                <div className='flex items-center gap-1 text-muted-foreground'>
                                  <Calendar className='h-3 w-3' />
                                  {formatDisplayDate(ad.endDate)}
                                </div>
                              </div>
                              {ad.isEvent && ad.eventStartDate && ad.eventEndDate && (
                                <div className='space-y-1 text-xs pt-1 border-t'>
                                  <div className='text-purple-600 font-medium'>
                                    이벤트 기간:
                                  </div>
                                  <div className='flex items-center gap-1 text-purple-600'>
                                    <Calendar className='h-3 w-3' />
                                    {formatDisplayDate(ad.eventStartDate)}
                                  </div>
                                  <div className='flex items-center gap-1 text-purple-600'>
                                    <Calendar className='h-3 w-3' />
                                    {formatDisplayDate(ad.eventEndDate)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm'>
                              <div className='font-medium truncate'>
                                {ad.user?.name || '-'}
                              </div>
                              {ad.user?.phoneNumber && (
                                <div className='text-xs text-muted-foreground truncate'>
                                  {ad.user.phoneNumber}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {editingMemoId === ad.advertiserId ? (
                              <div className='space-y-2'>
                                <Textarea
                                  value={editingMemoValue}
                                  onChange={(e) =>
                                    setEditingMemoValue(e.target.value)
                                  }
                                  className='min-h-[60px] text-sm'
                                  placeholder='계약 메모를 입력하세요'
                                />
                                <div className='flex gap-1'>
                                  <Button
                                    size='sm'
                                    onClick={() =>
                                      handleMemoSave(ad.advertiserId)
                                    }
                                    className='h-7 px-2'
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={handleMemoCancel}
                                    className='h-7 px-2'
                                  >
                                    취소
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className='text-sm cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors'
                                onClick={() =>
                                  handleMemoEdit(
                                    ad.advertiserId,
                                    ad.advertisers?.contractMemo
                                  )
                                }
                                title='클릭하여 수정'
                              >
                                {ad.advertisers?.contractMemo ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className='truncate'>
                                        {ad.advertisers.contractMemo}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className='max-w-xs whitespace-pre-wrap'>
                                        {ad.advertisers.contractMemo}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className='text-muted-foreground italic'>
                                    메모 없음
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          {!hideClickColumn && (
                            <>
                              <TableCell className='text-center'>
                                <span>
                                  {ad.adClickCount?.toLocaleString() || '0'}
                                </span>
                              </TableCell>
                              <TableCell className='text-center'>
                                <span>
                                  {ad.clickCount?.toLocaleString() || '0'}
                                </span>
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <div className='flex justify-end gap-2 items-center'>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='icon-sm'
                                    onClick={() => handleOpenDialog(ad)}
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
                                    size='icon-sm'
                                    onClick={() => {
                                      setSelectedAd(ad);
                                      setIsResetClickDialogOpen(true);
                                    }}
                                  >
                                    <RotateCcw className='h-4 w-4' />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>클릭수 초기화</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='icon-sm'
                                    onClick={() => {
                                      setSelectedAd(ad);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className='text-destructive hover:text-destructive'
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
        </div>

        {/* 광고 등록/수정 다이얼로그 */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseDialog();
            }
          }}
        >
          <DialogContent className='max-h-[90vh] w-[95vw] max-w-3xl sm:max-w-3xl overflow-y-auto'>
            <DialogHeader>
              <DialogTitle className='text-2xl'>
                {selectedAd ? '광고 수정' : '새 광고 등록'}
              </DialogTitle>
              <DialogDescription>
                광고주를 선택하고 광고 내용을 입력하세요. 모든 필수 항목(*)을
                입력해야 합니다.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-6'>
              {/* 광고주 선택 */}
              <div className='space-y-2'>
                <Label className='text-sm font-medium flex items-center gap-2'>
                  <Building2 className='h-4 w-4' />
                  광고주 선택 <span className='text-destructive'>*</span>
                </Label>
                <Popover open={advertiserPopoverOpen} onOpenChange={setAdvertiserPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      role='combobox'
                      aria-expanded={advertiserPopoverOpen}
                      className='w-full justify-between font-normal'
                    >
                      {selectedAdvertiserId
                        ? availableAdvertisers.find((adv) => adv.id === selectedAdvertiserId)
                          ? `${availableAdvertisers.find((adv) => adv.id === selectedAdvertiserId)?.businessName} (${availableAdvertisers.find((adv) => adv.id === selectedAdvertiserId)?.representativeName})`
                          : '광고주를 선택하세요'
                        : '광고주를 선택하세요'}
                      <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-[400px] p-0' align='start'>
                    <Command>
                      <CommandInput placeholder='광고주 검색...' />
                      <CommandList>
                        <CommandEmpty>선택 가능한 광고주가 없습니다.</CommandEmpty>
                        <CommandGroup>
                          {availableAdvertisers.map((adv) => (
                            <CommandItem
                              key={adv.id}
                              value={`${adv.businessName} ${adv.representativeName}`}
                              onSelect={() => {
                                setSelectedAdvertiserId(adv.id);
                                // 광고주의 카테고리 자동 적용
                                if (adv.categoryId) {
                                  setAdFormData(prev => ({
                                    ...prev,
                                    categoryId: adv.categoryId || '',
                                  }));
                                }
                                setAdvertiserPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedAdvertiserId === adv.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {adv.businessName} ({adv.representativeName})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className='text-xs text-muted-foreground'>
                  이미 광고가 등록된 광고주는 선택할 수 없습니다.
                </p>
              </div>

              {/* 광고 정보 */}
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
                          setAdFormData({
                            ...adFormData,
                            title: e.target.value,
                          })
                        }
                        placeholder='광고 제목을 입력해주세요'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='categoryId'>
                        카테고리
                      </Label>
                      <Input
                        id='categoryId'
                        value={categories.find(c => c.id === adFormData.categoryId)?.categoryName || ''}
                        disabled
                        placeholder='광고주 선택 시 자동 설정'
                        className='bg-muted'
                      />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='description'>
                      소개내용<span className='text-destructive'>*</span>
                    </Label>
                    <Textarea
                      id='description'
                      value={adFormData.description}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          description: e.target.value,
                        })
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
                      onChange={(url) =>
                        setAdFormData({ ...adFormData, imageUrl: url })
                      }
                      bucket='advertisements'
                      storagePath={`ads/${imageUploadFolderId}/ad-image`}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='linkUrl'>링크 URL</Label>
                    <Input
                      id='linkUrl'
                      type='url'
                      value={adFormData.linkUrl}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          linkUrl: e.target.value,
                        })
                      }
                      placeholder='https://example.com'
                    />
                  </div>

                  <div className='space-y-2'>
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
                            setAdFormData({
                              ...adFormData,
                              startDate: e.target.value,
                            })
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
                            setAdFormData({
                              ...adFormData,
                              endDate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      {[
                        { days: 14, label: '14일' },
                        { days: 30, label: '1개월' },
                        { days: 180, label: '6개월' },
                        { days: 365, label: '12개월' },
                      ].map(({ days, label }) => (
                        <Button
                          key={days}
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            const today = new Date();
                            const endDate = new Date();
                            endDate.setDate(today.getDate() + days);
                            setAdFormData({
                              ...adFormData,
                              startDate: today.toISOString().split('T')[0],
                              endDate: endDate.toISOString().split('T')[0],
                            });
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* 이벤트 설정 */}
                  <div className='space-y-3 p-4 border rounded-lg bg-muted/30'>
                    <div className='flex items-center space-x-2'>
                      <input
                        type='checkbox'
                        id='isEvent'
                        checked={adFormData.isEvent}
                        onChange={(e) =>
                          setAdFormData({
                            ...adFormData,
                            isEvent: e.target.checked,
                          })
                        }
                        className='h-4 w-4 rounded border-gray-300'
                      />
                      <Label htmlFor='isEvent' className='font-medium cursor-pointer'>
                        이벤트로 등록
                      </Label>
                    </div>

                    {adFormData.isEvent && (
                      <>
                        <p className='text-sm text-muted-foreground'>
                          이벤트 기간 동안만 이벤트 섹션에 표시됩니다
                        </p>
                        <div className='space-y-2'>
                          <div className='grid grid-cols-2 gap-3'>
                            <div className='space-y-2'>
                              <Label htmlFor='eventStartDate'>
                                이벤트 시작일 <span className='text-destructive'>*</span>
                              </Label>
                              <Input
                                id='eventStartDate'
                                type='date'
                                value={adFormData.eventStartDate}
                                onChange={(e) =>
                                  setAdFormData({
                                    ...adFormData,
                                    eventStartDate: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className='space-y-2'>
                              <Label htmlFor='eventEndDate'>
                                이벤트 종료일 <span className='text-destructive'>*</span>
                              </Label>
                              <Input
                                id='eventEndDate'
                                type='date'
                                value={adFormData.eventEndDate}
                                onChange={(e) =>
                                  setAdFormData({
                                    ...adFormData,
                                    eventEndDate: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className='flex gap-2'>
                            {[
                              { days: 14, label: '14일' },
                              { days: 30, label: '1개월' },
                              { days: 180, label: '6개월' },
                              { days: 365, label: '12개월' },
                            ].map(({ days, label }) => (
                              <Button
                                key={days}
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                  const today = new Date();
                                  const endDate = new Date();
                                  endDate.setDate(today.getDate() + days);
                                  setAdFormData({
                                    ...adFormData,
                                    eventStartDate: today.toISOString().split('T')[0],
                                    eventEndDate: endDate.toISOString().split('T')[0],
                                  });
                                }}
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='eventDescription'>
                            이벤트 소개글
                          </Label>
                          <Textarea
                            id='eventDescription'
                            value={adFormData.eventDescription}
                            onChange={(e) =>
                              setAdFormData({
                                ...adFormData,
                                eventDescription: e.target.value,
                              })
                            }
                            placeholder='이벤트에 대한 소개글을 입력하세요'
                            className='min-h-[100px]'
                          />
                        </div>
                      </>
                    )}
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
                      <div className='text-sm text-muted-foreground'>
                        {adFormData.selectedApartments.length > 0
                          ? `${adFormData.selectedApartments.length}개 아파트 선택됨`
                          : '아파트를 선택하세요'}
                      </div>
                      <div className='flex gap-2'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            const filteredApts = apartments.filter(apt =>
                              apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                              apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                            );
                            setAdFormData({
                              ...adFormData,
                              selectedApartments: filteredApts.map(apt => apt.id),
                            });
                          }}
                        >
                          전체 선택
                        </Button>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            setAdFormData({
                              ...adFormData,
                              selectedApartments: [],
                            });
                          }}
                        >
                          전체 해제
                        </Button>
                      </div>
                      <div className='border rounded-md'>
                        <div className='p-2 border-b'>
                          <div className='relative'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                            <Input
                              placeholder='아파트명 또는 주소 검색...'
                              value={apartmentSearch}
                              onChange={(e) => setApartmentSearch(e.target.value)}
                              className='pl-9'
                            />
                          </div>
                        </div>
                        <div className='h-[200px] overflow-y-auto'>
                          {apartments
                            .filter(apt =>
                              apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                              apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                            )
                            .map((apt) => (
                              <label
                                key={apt.id}
                                className='flex items-start gap-2 px-3 py-2 hover:bg-muted cursor-pointer'
                              >
                                <Checkbox
                                  checked={adFormData.selectedApartments.includes(apt.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setAdFormData({
                                        ...adFormData,
                                        selectedApartments: [...adFormData.selectedApartments, apt.id],
                                      });
                                    } else {
                                      setAdFormData({
                                        ...adFormData,
                                        selectedApartments: adFormData.selectedApartments.filter(id => id !== apt.id),
                                      });
                                    }
                                  }}
                                  className='mt-0.5'
                                />
                                <div className='flex flex-col'>
                                  <span className='text-sm font-medium'>{apt.name}</span>
                                  <span className='text-xs text-muted-foreground'>{apt.address}</span>
                                </div>
                              </label>
                            ))}
                          {apartments.filter(apt =>
                            apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                            apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                          ).length === 0 && (
                            <div className='px-3 py-4 text-sm text-muted-foreground text-center'>
                              검색 결과가 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 선택된 아파트 뱃지 */}
                      {adFormData.selectedApartments.length > 0 && (
                        <div className='flex flex-wrap gap-2 pt-2'>
                          {adFormData.selectedApartments.map((aptId) => {
                            const apt = apartments.find((a) => a.id === aptId);
                            return apt ? (
                              <Badge
                                key={aptId}
                                variant='secondary'
                                className='font-normal gap-1'
                              >
                                {apt.name}
                                <button
                                  type='button'
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAdFormData({
                                      ...adFormData,
                                      selectedApartments: adFormData.selectedApartments.filter(
                                        (id) => id !== aptId
                                      ),
                                    });
                                  }}
                                  className='ml-1 rounded-full hover:bg-muted-foreground/20'
                                >
                                  <X className='h-3 w-3' />
                                </button>
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
                        {/* 주소 검색으로 추가 */}
                        <div className='space-y-2'>
                          <Button
                            type='button'
                            variant='default'
                            size='sm'
                            onClick={handleRegionAddressSearch}
                            className='w-full'
                          >
                            <MapPin className='mr-2 h-4 w-4' />
                            주소 검색으로 지역 추가 (권장)
                          </Button>
                          <p className='text-xs text-muted-foreground text-center'>
                            표준화된 지역명으로 정확하게 매칭됩니다
                          </p>
                        </div>

                        {/* 구분선 */}
                        <div className='relative'>
                          <div className='absolute inset-0 flex items-center'>
                            <span className='w-full border-t' />
                          </div>
                          <div className='relative flex justify-center text-xs uppercase'>
                            <span className='bg-muted/30 px-2 text-muted-foreground'>
                              또는 직접 입력
                            </span>
                          </div>
                        </div>

                        {/* 수동 입력 */}
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
                          수동으로 지역 추가
                        </Button>
                        {adFormData.selectedRegions.length > 0 && (
                          <div className='space-y-2'>
                            <div className='text-sm font-medium'>
                              선택된 지역 ({adFormData.selectedRegions.length}
                              개):
                            </div>
                            <div className='space-y-1.5'>
                              {adFormData.selectedRegions.map(
                                (region, index) => (
                                  <div
                                    key={index}
                                    className='flex items-center justify-between rounded-md border bg-background p-2.5'
                                  >
                                    <span className='text-sm font-medium'>
                                      {region.regionSido}
                                      {region.regionSigungu &&
                                        ` > ${region.regionSigungu}`}
                                      {region.regionDong &&
                                        ` > ${region.regionDong}`}
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
                                )
                              )}
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
                        setAdFormData({
                          ...adFormData,
                          isActive: e.target.checked,
                        })
                      }
                      className='h-4 w-4 rounded border-gray-300'
                    />
                    <Label
                      htmlFor='isActive'
                      className='cursor-pointer font-medium'
                    >
                      광고 즉시 활성화 (체크하면 설정한 게시 기간에 노출됩니다)
                    </Label>
                  </div>

                  {/* 클릭수 초기화 (수정 모드에만 표시) */}
                  {selectedAd && (
                    <div className='space-y-2 p-4 rounded-lg bg-orange-50 border border-orange-200'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <Label className='text-sm font-semibold text-orange-900'>
                            클릭수 통계
                          </Label>
                          <p className='text-xs text-orange-700 mt-1'>
                            광고 클릭수: {selectedAd.adClickCount?.toLocaleString() || '0'} /
                            클릭 수: {selectedAd.clickCount?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => setIsResetClickDialogOpen(true)}
                          className='text-orange-700 border-orange-300 hover:bg-orange-100'
                        >
                          <X className='mr-1 h-3 w-3' />
                          초기화
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <DialogFooter className='gap-2'>
              <Button
                variant='outline'
                onClick={handleCloseDialog}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button
                onClick={handleSaveAd}
                disabled={isSaving || !isFormValid()}
                className='min-w-[100px]'
              >
                {isSaving ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    저장 중...
                  </>
                ) : (
                  <>{selectedAd ? '수정 완료' : '등록 완료'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 다이얼로그 */}
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <AlertCircle className='h-5 w-5 text-destructive' />
                광고 삭제
              </DialogTitle>
              <DialogDescription className='pt-2'>
                <span className='font-semibold'>{selectedAd?.title}</span>{' '}
                광고를 정말 삭제하시겠습니까?
                <br />이 작업은 취소할 수 없으며, 광고주 정보는 유지됩니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                variant='destructive'
                onClick={handleDelete}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 클릭수 초기화 확인 다이얼로그 */}
        <Dialog
          open={isResetClickDialogOpen}
          onOpenChange={setIsResetClickDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <AlertCircle className='h-5 w-5 text-blue-500' />
                클릭수 초기화
              </DialogTitle>
              <DialogDescription className='pt-2'>
                <span className='font-semibold'>{selectedAd?.title}</span> 광고의 클릭수를 0으로 초기화하시겠습니까?
                <br />
                <span className='text-blue-600 mt-2 block'>
                  현재: 광고 클릭수 {selectedAd?.adClickCount?.toLocaleString() || '0'} / 클릭 수 {selectedAd?.clickCount?.toLocaleString() || '0'}
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setIsResetClickDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                variant='default'
                className='bg-blue-500 hover:bg-blue-600'
                onClick={handleResetClickCount}
              >
                초기화
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
