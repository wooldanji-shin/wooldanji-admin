'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { DataTableShell } from '@/components/data-table-shell';
import { TableSkeleton } from '@/components/skeletons';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageShell } from '@/components/page-shell';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  CloseButton,
  Divider,
  Group,
  HoverCard,
  Input,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
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
  Clock,
  CheckCircle,
  XCircle,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Package,
  Download,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
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
  const [, setUploadedImageUrls] = useState<string[]>([]);

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
        icon: Calendar
      },
      pending: {
        label: '대기중',
        icon: Clock
      },
      active: {
        label: '진행중',
        icon: CheckCircle
      },
      expiring: {
        label: '만료예정',
        icon: AlertCircle
      },
      expired: {
        label: '만료',
        icon: XCircle
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge
        variant='light'
        color={{ scheduled: 'blue', pending: 'gray', active: 'green', expiring: 'yellow', expired: 'red' }[status as keyof typeof statusConfig]}
        leftSection={<Icon size={12} />}
      >
        {config.label}
      </Badge>
    );
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
    link.setAttribute('download', `광고목록_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${dataToExport.length}개의 광고를 CSV로 내보냈습니다.`);
  };

  return (
    <PageShell>
      <AdminHeader
        title='광고 등록/수정'
        actions={
          <>
            <Button
              variant='default'
              leftSection={<Download size={16} />}
              onClick={handleExportCSV}
              disabled={filteredAds.length === 0}
            >
              CSV 내보내기
            </Button>
            <Button
              leftSection={<Plus size={16} />}
              onClick={() => handleOpenDialog()}
            >
              광고 등록
            </Button>
          </>
        }
      />

      <PageContent>
        {/* 검색 및 필터 */}
        <Paper p={{ base: 'md', sm: 'lg' }} className='app-filter-card'>
          <Stack gap='md'>
            <Group gap='xs' justify='space-between' wrap='wrap'>
              <Group gap='xs' wrap='wrap' style={{ flex: 1 }}>
                <TextInput
                  placeholder='광고 제목, 광고주명으로 검색...'
                  leftSection={<Search size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ flex: 1 }}
                  miw={240}
                />
                <Button
                  variant='default'
                  leftSection={<Filter size={16} />}
                  rightSection={
                    isFilterExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  }
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                >
                  필터
                  {getActiveFilterCount() > 0 && (
                    <Badge ml='xs' variant='light' color='blue' size='sm'>
                      {getActiveFilterCount()}
                    </Badge>
                  )}
                </Button>
              </Group>
              <Checkbox
                id='hide-click-column'
                label='클릭수 숨기기'
                checked={hideClickColumn}
                onChange={(e) => setHideClickColumn(e.currentTarget.checked === true)}
              />
            </Group>

            {/* 필터 영역 */}
            {isFilterExpanded && (
              <Group gap='xs' wrap='wrap'>
                <Select
                  w={200}
                  placeholder='광고 타입'
                  data={[
                    { value: 'all', label: '전체 타입' },
                    { value: 'NEIGHBORHOOD', label: '동네 광고' },
                    { value: 'REGION', label: '지역 광고' },
                  ]}
                  value={filterAdType || null}
                  onChange={(v) => {
                    if (v === null) return;
                    setFilterAdType(v);
                  }}
                  allowDeselect={false}
                />

                <Select
                  w={200}
                  placeholder='광고주'
                  data={[
                    { value: 'all', label: '전체 광고주' },
                    ...advertisers.map((adv) => ({
                      value: adv.id,
                      label: adv.businessName,
                    })),
                  ]}
                  value={filterAdvertiser || null}
                  onChange={(v) => {
                    if (v === null) return;
                    setFilterAdvertiser(v);
                  }}
                  allowDeselect={false}
                />

                {/* 게시자 필터 (SUPER_ADMIN만 표시) */}
                {userRoles.includes('SUPER_ADMIN') && (
                  <Select
                    w={200}
                    placeholder='게시자'
                    data={[
                      { value: 'all', label: '전체 등록자' },
                      ...creators.map((creator) => ({
                        value: creator.id,
                        label: creator.name,
                      })),
                    ]}
                    value={filterCreator || null}
                    onChange={(v) => {
                      if (v === null) return;
                      setFilterCreator(v);
                    }}
                    allowDeselect={false}
                  />
                )}

                <Button
                  variant='default'
                  w={120}
                  leftSection={<X size={16} />}
                  onClick={() => {
                    setSearchTerm('');
                    setFilterAdType('all');
                    setFilterCategory('all');
                    setFilterAdvertiser('all');
                    setFilterCreator('all');
                  }}
                >
                  초기화
                </Button>
              </Group>
            )}

            <Divider />

            <FilterRow label='상태'>
              <FilterChips
                options={(
                  [
                    { value: 'all', label: '전체' },
                    { value: 'pending', label: '대기중' },
                    { value: 'scheduled', label: '예정' },
                    { value: 'active', label: '진행중' },
                    { value: 'expiring', label: '만료예정' },
                    { value: 'expired', label: '만료' },
                  ] as const
                ).map(({ value, label }) => ({
                  value,
                  label,
                  count: getStatusCount(value),
                }))}
                value={activeTab}
                onChange={setActiveTab}
              />
            </FilterRow>

            {categories.length > 0 && (
              <FilterRow label='카테고리'>
                <FilterChips
                  options={[
                    { value: 'all', label: '전체 카테고리' },
                    ...categories.map((cat) => ({
                      value: cat.id,
                      label: cat.categoryName,
                    })),
                  ]}
                  value={filterCategory || null}
                  onChange={setFilterCategory}
                />
              </FilterRow>
            )}
          </Stack>
        </Paper>

        {/* 광고 목록 - 카테고리별로 분리 */}
        {loading ? (
          <DataTableShell>
            <TableSkeleton rows={8} columns={hideClickColumn ? 12 : 14} />
          </DataTableShell>
        ) : Object.keys(groupedAdsByCategory).length === 0 ? (
          <Paper withBorder radius='md'>
            <EmptyState
              icon={Package}
              title='광고가 없습니다'
              description={
                searchTerm || getActiveFilterCount() > 0
                  ? '검색 조건에 맞는 광고가 없습니다. 다른 조건으로 시도해보세요.'
                  : '새로운 광고를 등록하여 시작하세요.'
              }
              action={
                !searchTerm && getActiveFilterCount() === 0 && (
                  <Button
                    leftSection={<Plus size={16} />}
                    onClick={() => handleOpenDialog()}
                  >
                    첫 광고 등록하기
                  </Button>
                )
              }
            />
          </Paper>
        ) : (
          Object.entries(groupedAdsByCategory).map(([categoryId, { categoryName, ads }]) => (
            <DataTableShell
              key={categoryId}
              // 카테고리 제목은 표 카드 안 맨 위에 둔다 (필터 카드와 구분)
              summary={
                <Group gap='xs'>
                  <Title order={4}>{categoryName}</Title>
                  <Badge variant='light' color='gray'>
                    {ads.length}개
                  </Badge>
                </Group>
              }
            >
              <Table
                miw={1600}
                highlightOnHover
                verticalSpacing='sm'
                horizontalSpacing='md'
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={80}>이미지</Table.Th>
                    <Table.Th w={100}>상태</Table.Th>
                    <Table.Th w={200}>광고 제목</Table.Th>
                    <Table.Th w={150}>광고주</Table.Th>
                    <Table.Th w={140}>연락처</Table.Th>
                    <Table.Th w={120}>카테고리</Table.Th>
                    <Table.Th w={100}>타입</Table.Th>
                    <Table.Th w={180}>범위</Table.Th>
                    <Table.Th w={180}>게시 기간</Table.Th>
                    <Table.Th w={150}>등록자</Table.Th>
                    <Table.Th w={200}>계약메모</Table.Th>
                    {!hideClickColumn && (
                      <>
                        <Table.Th w={100} ta='center'>광고 클릭수</Table.Th>
                        <Table.Th w={100} ta='center'>클릭 수</Table.Th>
                      </>
                    )}
                    <Table.Th w={120} ta='right'>
                      작업
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ads.map((ad) => (
                    <Table.Tr key={ad.id}>
                      <Table.Td>
                        {ad.imageUrl ? (
                          <UnstyledButton
                            w={56}
                            h={56}
                            bg='var(--app-bg-subtle)'
                            style={{
                              borderRadius: 'var(--mantine-radius-md)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onClick={() =>
                              ad.imageUrl &&
                              window.open(ad.imageUrl, '_blank')
                            }
                            title='이미지 크게 보기'
                          >
                            <img
                              src={ad.imageUrl}
                              alt={ad.title}
                              className='w-full h-full object-cover'
                            />
                          </UnstyledButton>
                        ) : (
                          <Center
                            w={56}
                            h={56}
                            bg='var(--app-bg-subtle)'
                            style={{ borderRadius: 'var(--mantine-radius-md)' }}
                          >
                            <ImageIcon size={24} color='var(--mantine-color-dimmed)' />
                          </Center>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap='xs' align='flex-start'>
                          <StatusBadge ad={ad} />
                          {ad.isEvent && (
                            <Badge
                              variant='light'
                              color='grape'
                              leftSection={<Tag size={12} />}
                            >
                              이벤트
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td maw={200}>
                        <Tooltip label={ad.title} multiline maw={320}>
                          <Text size='sm' fw={500} truncate>
                            {ad.title}
                          </Text>
                        </Tooltip>
                        {ad.linkUrl && (
                          <Anchor
                            href={ad.linkUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            size='xs'
                            mt={4}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <ExternalLink size={12} />
                            링크
                          </Anchor>
                        )}
                      </Table.Td>
                      <Table.Td maw={150}>
                        <Tooltip
                          label={ad.advertisers?.businessName}
                          disabled={!ad.advertisers?.businessName}
                          multiline
                          maw={320}
                        >
                          <Text size='sm' truncate>
                            {ad.advertisers?.businessName || '-'}
                          </Text>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          {ad.advertisers?.displayPhoneNumber && (
                            <Text size='sm' fw={500} truncate>
                              <Text span size='xs' c='dimmed'>표시용: </Text>
                              {ad.advertisers.displayPhoneNumber}
                            </Text>
                          )}
                          <Text size='xs' c='dimmed' truncate>
                            <span>연락처: </span>
                            {ad.advertisers?.contactPhoneNumber || '-'}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        {ad.ad_categories ? (
                          <Badge
                            variant='light'
                            color='gray'
                            maw='100%'
                            tt='none'
                            leftSection={<Tag size={12} />}
                          >
                            {ad.ad_categories.categoryName}
                          </Badge>
                        ) : (
                          <Text size='sm' c='dimmed'>
                            미분류
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {ad.adType === 'NEIGHBORHOOD' ? (
                          <Badge
                            variant='light'
                            color='gray'
                            leftSection={<Building2 size={12} />}
                          >
                            동네
                          </Badge>
                        ) : (
                          <Badge
                            variant='light'
                            color='gray'
                            leftSection={<MapPin size={12} />}
                          >
                            지역
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {ad.adType === 'NEIGHBORHOOD' ? (
                          ad.advertisement_apartments && ad.advertisement_apartments.length > 0 ? (
                            <HoverCard shadow='md' withinPortal openDelay={100}>
                              <HoverCard.Target>
                                <Group gap={4} wrap='nowrap' style={{ cursor: 'pointer' }}>
                                  <Building2 size={12} color='var(--mantine-color-dimmed)' />
                                  <Text size='sm' maw={120} truncate>
                                    {ad.advertisement_apartments[0].apartments.name}
                                  </Text>
                                  {ad.advertisement_apartments.length > 1 && (
                                    <Badge variant='light' color='gray' size='sm'>
                                      +{ad.advertisement_apartments.length - 1}
                                    </Badge>
                                  )}
                                </Group>
                              </HoverCard.Target>
                              <HoverCard.Dropdown maw={320} p='xs'>
                                <ScrollArea.Autosize mah={256}>
                                  <Stack gap={4}>
                                    {ad.advertisement_apartments.map((aa, idx) => (
                                      <Text key={idx} size='sm' fw={500} py={2}>
                                        {aa.apartments.name}
                                      </Text>
                                    ))}
                                  </Stack>
                                </ScrollArea.Autosize>
                              </HoverCard.Dropdown>
                            </HoverCard>
                          ) : (
                            <Text size='sm' c='dimmed'>-</Text>
                          )
                        ) : (
                          ad.advertisement_regions && ad.advertisement_regions.length > 0 ? (
                            <HoverCard shadow='md' withinPortal openDelay={100}>
                              <HoverCard.Target>
                                <Group gap={4} wrap='nowrap' style={{ cursor: 'pointer' }}>
                                  <MapPin size={12} color='var(--mantine-color-dimmed)' />
                                  <Text size='sm' maw={120} truncate>
                                    {ad.advertisement_regions[0].regionSido}
                                    {ad.advertisement_regions[0].regionSigungu && ` ${ad.advertisement_regions[0].regionSigungu}`}
                                    {ad.advertisement_regions[0].regionDong && ` ${ad.advertisement_regions[0].regionDong}`}
                                  </Text>
                                  {ad.advertisement_regions.length > 1 && (
                                    <Badge variant='light' color='gray' size='sm'>
                                      +{ad.advertisement_regions.length - 1}
                                    </Badge>
                                  )}
                                </Group>
                              </HoverCard.Target>
                              <HoverCard.Dropdown maw={320} p='xs'>
                                <ScrollArea.Autosize mah={256}>
                                  <Stack gap={4}>
                                    {ad.advertisement_regions.map((region, idx) => (
                                      <Text key={idx} size='sm' py={2}>
                                        {region.regionSido}
                                        {region.regionSigungu && ` > ${region.regionSigungu}`}
                                        {region.regionDong && ` > ${region.regionDong}`}
                                      </Text>
                                    ))}
                                  </Stack>
                                </ScrollArea.Autosize>
                              </HoverCard.Dropdown>
                            </HoverCard>
                          ) : (
                            <Text size='sm' c='dimmed'>-</Text>
                          )
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap='xs'>
                          <Stack gap={4}>
                            <Group gap={4} wrap='nowrap'>
                              <Calendar size={12} color='var(--mantine-color-dimmed)' />
                              <Text size='sm' c='dimmed'>
                                {formatDisplayDate(ad.startDate)}
                              </Text>
                            </Group>
                            <Group gap={4} wrap='nowrap'>
                              <Calendar size={12} color='var(--mantine-color-dimmed)' />
                              <Text size='sm' c='dimmed'>
                                {formatDisplayDate(ad.endDate)}
                              </Text>
                            </Group>
                          </Stack>
                          {ad.isEvent && ad.eventStartDate && ad.eventEndDate && (
                            <Stack
                              gap={4}
                              pt={4}
                              style={{ borderTop: '1px solid var(--app-divider)' }}
                            >
                              <Text size='xs' fw={500} c='grape'>
                                이벤트 기간:
                              </Text>
                              <Group gap={4} wrap='nowrap'>
                                <Calendar size={12} color='var(--mantine-color-grape-6)' />
                                <Text size='xs' c='grape'>
                                  {formatDisplayDate(ad.eventStartDate)}
                                </Text>
                              </Group>
                              <Group gap={4} wrap='nowrap'>
                                <Calendar size={12} color='var(--mantine-color-grape-6)' />
                                <Text size='xs' c='grape'>
                                  {formatDisplayDate(ad.eventEndDate)}
                                </Text>
                              </Group>
                            </Stack>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size='sm' fw={500} truncate>
                          {ad.user?.name || '-'}
                        </Text>
                        {ad.user?.phoneNumber && (
                          <Text size='xs' c='dimmed' truncate>
                            {ad.user.phoneNumber}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {editingMemoId === ad.advertiserId ? (
                          <Stack gap='xs'>
                            <Textarea
                              value={editingMemoValue}
                              onChange={(e) =>
                                setEditingMemoValue(e.target.value)
                              }
                              size='sm'
                              autosize
                              minRows={2}
                              placeholder='계약 메모를 입력하세요'
                            />
                            <Group gap={4}>
                              <Button
                                size='compact-sm'
                                onClick={() =>
                                  handleMemoSave(ad.advertiserId)
                                }
                              >
                                저장
                              </Button>
                              <Button
                                size='compact-sm'
                                variant='default'
                                onClick={handleMemoCancel}
                              >
                                취소
                              </Button>
                            </Group>
                          </Stack>
                        ) : (
                          <UnstyledButton
                            w='100%'
                            p='xs'
                            style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                            onClick={() =>
                              handleMemoEdit(
                                ad.advertiserId,
                                ad.advertisers?.contractMemo
                              )
                            }
                            title='클릭하여 수정'
                          >
                            {ad.advertisers?.contractMemo ? (
                              <Tooltip
                                label={ad.advertisers.contractMemo}
                                multiline
                                maw={320}
                                style={{ whiteSpace: 'pre-wrap' }}
                              >
                                <Text size='sm' truncate>
                                  {ad.advertisers.contractMemo}
                                </Text>
                              </Tooltip>
                            ) : (
                              <Text size='sm' c='dimmed' fs='italic'>
                                메모 없음
                              </Text>
                            )}
                          </UnstyledButton>
                        )}
                      </Table.Td>
                      {!hideClickColumn && (
                        <>
                          <Table.Td ta='center' style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <span>
                              {ad.adClickCount?.toLocaleString() || '0'}
                            </span>
                          </Table.Td>
                          <Table.Td ta='center' style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <span>
                              {ad.clickCount?.toLocaleString() || '0'}
                            </span>
                          </Table.Td>
                        </>
                      )}
                      <Table.Td>
                        <Group gap={4} justify='flex-end' wrap='nowrap'>
                          <Tooltip label='수정'>
                            <ActionIcon
                              variant='subtle'
                              color='gray'
                              aria-label='수정'
                              onClick={() => handleOpenDialog(ad)}
                            >
                              <Edit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label='클릭수 초기화'>
                            <ActionIcon
                              variant='subtle'
                              color='gray'
                              aria-label='클릭수 초기화'
                              onClick={() => {
                                setSelectedAd(ad);
                                setIsResetClickDialogOpen(true);
                              }}
                            >
                              <RotateCcw size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label='삭제'>
                            <ActionIcon
                              variant='subtle'
                              color='red'
                              aria-label='삭제'
                              onClick={() => {
                                setSelectedAd(ad);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </DataTableShell>
          ))
        )}
      </PageContent>

      {/* 광고 등록/수정 다이얼로그 */}
      <Modal
        // 위에 클릭수 초기화 모달이 떠 있으면 ESC는 그 모달만 닫는다 (Radix와 동일)
        closeOnEscape={!isResetClickDialogOpen}
        opened={isDialogOpen}
        onClose={() => {
          handleCloseDialog();
        }}
        title={
          <Text span size='xl' fw={600}>
            {selectedAd ? '광고 수정' : '새 광고 등록'}
          </Text>
        }
        size={768}
      >
        <Stack gap='lg'>
          <Text size='sm' c='dimmed'>
            광고주를 선택하고 광고 내용을 입력하세요. 모든 필수 항목(*)을
            입력해야 합니다.
          </Text>

          {/* 광고주 선택 */}
          <Select
            label={
              <Group gap={6} component='span' style={{ display: 'inline-flex' }}>
                <Building2 size={16} />
                광고주 선택
              </Group>
            }
            withAsterisk
            description='이미 광고가 등록된 광고주는 선택할 수 없습니다.'
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            placeholder='광고주를 검색하거나 선택하세요'
            searchable
            nothingFoundMessage='선택 가능한 광고주가 없습니다.'
            data={availableAdvertisers.map((adv) => ({
              value: adv.id,
              label: `${adv.businessName} (${adv.representativeName})`,
            }))}
            value={selectedAdvertiserId || null}
            // cmdk onSelect처럼 같은 광고주를 다시 골라도 매번 실행되도록 onOptionSubmit 사용
            onOptionSubmit={(v) => {
              const adv = availableAdvertisers.find((a) => a.id === v);
              if (!adv) return;
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
            dropdownOpened={advertiserPopoverOpen}
            onDropdownOpen={() => setAdvertiserPopoverOpen(true)}
            onDropdownClose={() => setAdvertiserPopoverOpen(false)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />

          {/* 광고 정보 */}
          <SimpleGrid cols={2} spacing='sm'>
            <TextInput
              id='title'
              label='광고 제목'
              withAsterisk
              value={adFormData.title}
              onChange={(e) =>
                setAdFormData({
                  ...adFormData,
                  title: e.target.value,
                })
              }
              placeholder='광고 제목을 입력해주세요'
            />
            <TextInput
              id='categoryId'
              label='카테고리'
              value={categories.find(c => c.id === adFormData.categoryId)?.categoryName || ''}
              disabled
              placeholder='광고주 선택 시 자동 설정'
              styles={{ input: { opacity: 1, color: 'var(--mantine-color-text)', cursor: 'default' } }}
            />
          </SimpleGrid>

          <Textarea
            id='description'
            label='소개내용'
            withAsterisk
            value={adFormData.description}
            onChange={(e) =>
              setAdFormData({
                ...adFormData,
                description: e.target.value,
              })
            }
            placeholder='광고 소개 내용을 입력하세요'
            rows={3}
            styles={{ input: { resize: 'none' } }}
          />

          <Input.Wrapper label='광고 이미지' withAsterisk>
            <ImageUpload
              value={adFormData.imageUrl}
              onChange={(url) =>
                setAdFormData({ ...adFormData, imageUrl: url })
              }
              bucket='advertisements'
              storagePath={`ads/${imageUploadFolderId}/ad-image`}
            />
          </Input.Wrapper>

          <TextInput
            id='linkUrl'
            label='링크 URL'
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

          <Stack gap='xs'>
            <SimpleGrid cols={2} spacing='sm'>
              <TextInput
                id='startDate'
                label='게시 시작일'
                withAsterisk
                type='date'
                value={adFormData.startDate}
                onChange={(e) =>
                  setAdFormData({
                    ...adFormData,
                    startDate: e.target.value,
                  })
                }
              />
              <TextInput
                id='endDate'
                label='게시 종료일'
                withAsterisk
                type='date'
                value={adFormData.endDate}
                onChange={(e) =>
                  setAdFormData({
                    ...adFormData,
                    endDate: e.target.value,
                  })
                }
              />
            </SimpleGrid>
            <Group gap='xs'>
              {[
                { days: 14, label: '14일' },
                { days: 30, label: '1개월' },
                { days: 180, label: '6개월' },
                { days: 365, label: '12개월' },
              ].map(({ days, label }) => (
                <Button
                  key={days}
                  type='button'
                  variant='default'
                  size='xs'
                  onClick={() => {
                    const today = new Date();
                    const endDate = new Date();
                    endDate.setDate(today.getDate() + days);
                    setAdFormData({
                      ...adFormData,
                      startDate: format(today, 'yyyy-MM-dd'),
                      endDate: format(endDate, 'yyyy-MM-dd'),
                    });
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
          </Stack>

          {/* 이벤트 설정 */}
          <Paper withBorder radius='md' p='md' bg='var(--app-bg-muted)'>
            <Stack gap='sm'>
              <Checkbox
                id='isEvent'
                label='이벤트로 등록'
                fw={500}
                checked={adFormData.isEvent}
                onChange={(e) =>
                  setAdFormData({
                    ...adFormData,
                    isEvent: e.target.checked,
                  })
                }
              />

              {adFormData.isEvent && (
                <>
                  <Text size='sm' c='dimmed'>
                    이벤트 기간 동안만 이벤트 섹션에 표시됩니다
                  </Text>
                  <Stack gap='xs'>
                    <SimpleGrid cols={2} spacing='sm'>
                      <TextInput
                        id='eventStartDate'
                        label='이벤트 시작일'
                        withAsterisk
                        type='date'
                        value={adFormData.eventStartDate}
                        onChange={(e) =>
                          setAdFormData({
                            ...adFormData,
                            eventStartDate: e.target.value,
                          })
                        }
                      />
                      <TextInput
                        id='eventEndDate'
                        label='이벤트 종료일'
                        withAsterisk
                        type='date'
                        value={adFormData.eventEndDate}
                        onChange={(e) =>
                          setAdFormData({
                            ...adFormData,
                            eventEndDate: e.target.value,
                          })
                        }
                      />
                    </SimpleGrid>
                    <Group gap='xs'>
                      {[
                        { days: 14, label: '14일' },
                        { days: 30, label: '1개월' },
                        { days: 180, label: '6개월' },
                        { days: 365, label: '12개월' },
                      ].map(({ days, label }) => (
                        <Button
                          key={days}
                          type='button'
                          variant='default'
                          size='xs'
                          onClick={() => {
                            const today = new Date();
                            const endDate = new Date();
                            endDate.setDate(today.getDate() + days);
                            setAdFormData({
                              ...adFormData,
                              eventStartDate: format(today, 'yyyy-MM-dd'),
                              eventEndDate: format(endDate, 'yyyy-MM-dd'),
                            });
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </Group>
                  </Stack>
                  <Textarea
                    id='eventDescription'
                    label='이벤트 소개글'
                    value={adFormData.eventDescription}
                    onChange={(e) =>
                      setAdFormData({
                        ...adFormData,
                        eventDescription: e.target.value,
                      })
                    }
                    placeholder='이벤트에 대한 소개글을 입력하세요'
                    minRows={4}
                    autosize
                  />
                </>
              )}
            </Stack>
          </Paper>

          <Select
            label='광고 타입'
            withAsterisk
            data={[
              { value: 'NEIGHBORHOOD', label: '동네 광고 (특정 아파트)' },
              { value: 'REGION', label: '지역 광고 (시/군/구)' },
            ]}
            value={adFormData.adType}
            onChange={(value) => {
              if (value === null) return;
              setAdFormData({ ...adFormData, adType: value as 'NEIGHBORHOOD' | 'REGION' });
            }}
            allowDeselect={false}
            leftSection={
              adFormData.adType === 'NEIGHBORHOOD' ? <Building2 size={16} /> : <MapPin size={16} />
            }
          />

          {/* 동네 광고 - 아파트 선택 */}
          {adFormData.adType === 'NEIGHBORHOOD' && (
            <Input.Wrapper label='노출 아파트' withAsterisk>
              <Stack gap='xs' mt={4}>
                <Text size='sm' c='dimmed'>
                  {adFormData.selectedApartments.length > 0
                    ? `${adFormData.selectedApartments.length}개 아파트 선택됨`
                    : '아파트를 선택하세요'}
                </Text>
                <Group gap='xs'>
                  <Button
                    type='button'
                    variant='default'
                    size='xs'
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
                    variant='default'
                    size='xs'
                    onClick={() => {
                      setAdFormData({
                        ...adFormData,
                        selectedApartments: [],
                      });
                    }}
                  >
                    전체 해제
                  </Button>
                </Group>
                <Paper withBorder radius='md'>
                  <Box
                    p='xs'
                    style={{ borderBottom: '1px solid var(--app-divider)' }}
                  >
                    <TextInput
                      placeholder='아파트명 또는 주소 검색...'
                      leftSection={<Search size={16} />}
                      value={apartmentSearch}
                      onChange={(e) => setApartmentSearch(e.target.value)}
                    />
                  </Box>
                  <ScrollArea h={200}>
                    {apartments
                      .filter(apt =>
                        apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                        apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                      )
                      .map((apt) => (
                        <Box key={apt.id} px='sm' py='xs'>
                          <Checkbox
                            checked={adFormData.selectedApartments.includes(apt.id)}
                            onChange={(e) => {
                              const checked = e.currentTarget.checked;
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
                            label={
                              <>
                                <Text span display='block' size='sm' fw={500}>{apt.name}</Text>
                                <Text span display='block' size='xs' c='dimmed'>{apt.address}</Text>
                              </>
                            }
                            styles={{ label: { cursor: 'pointer' } }}
                          />
                        </Box>
                      ))}
                    {apartments.filter(apt =>
                      apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                      apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                    ).length === 0 && (
                      <Text size='sm' c='dimmed' ta='center' px='sm' py='md'>
                        검색 결과가 없습니다.
                      </Text>
                    )}
                  </ScrollArea>
                </Paper>
                {/* 선택된 아파트 뱃지 */}
                {adFormData.selectedApartments.length > 0 && (
                  <Group gap='xs' pt='xs'>
                    {adFormData.selectedApartments.map((aptId) => {
                      const apt = apartments.find((a) => a.id === aptId);
                      return apt ? (
                        <Badge
                          key={aptId}
                          variant='light'
                          color='gray'
                          tt='none'
                          rightSection={
                            <CloseButton
                              size='xs'
                              aria-label={`${apt.name} 제거`}
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
                            />
                          }
                        >
                          {apt.name}
                        </Badge>
                      ) : null;
                    })}
                  </Group>
                )}
              </Stack>
            </Input.Wrapper>
          )}

          {/* 지역 광고 - 지역 선택 */}
          {adFormData.adType === 'REGION' && (
            <Input.Wrapper label='노출 지역' withAsterisk>
              <Paper withBorder radius='md' p='md' bg='var(--app-bg-muted)' mt={4}>
                <Stack gap='sm'>
                  {/* 주소 검색으로 추가 */}
                  <Stack gap={6}>
                    <Button
                      type='button'
                      size='sm'
                      fullWidth
                      leftSection={<MapPin size={16} />}
                      onClick={handleRegionAddressSearch}
                    >
                      주소 검색으로 지역 추가 (권장)
                    </Button>
                    <Text size='xs' c='dimmed' ta='center'>
                      표준화된 지역명으로 정확하게 매칭됩니다
                    </Text>
                  </Stack>

                  {/* 구분선 */}
                  <Divider label='또는 직접 입력' labelPosition='center' />

                  {/* 수동 입력 */}
                  <SimpleGrid cols={3} spacing='xs'>
                    <TextInput
                      placeholder='시/도 *'
                      value={regionSido}
                      onChange={(e) => setRegionSido(e.target.value)}
                    />
                    <TextInput
                      placeholder='시/군/구'
                      value={regionSigungu}
                      onChange={(e) => setRegionSigungu(e.target.value)}
                    />
                    <TextInput
                      placeholder='읍/면/동'
                      value={regionDong}
                      onChange={(e) => setRegionDong(e.target.value)}
                    />
                  </SimpleGrid>
                  <Button
                    type='button'
                    variant='default'
                    size='sm'
                    fullWidth
                    leftSection={<Plus size={16} />}
                    onClick={handleAddRegion}
                  >
                    수동으로 지역 추가
                  </Button>
                  {adFormData.selectedRegions.length > 0 && (
                    <Stack gap='xs'>
                      <Text size='sm' fw={500}>
                        선택된 지역 ({adFormData.selectedRegions.length}
                        개):
                      </Text>
                      <Stack gap={6}>
                        {adFormData.selectedRegions.map(
                          (region, index) => (
                            <Paper key={index} withBorder radius='sm' p='xs'>
                              <Group justify='space-between' wrap='nowrap'>
                                <Text size='sm' fw={500}>
                                  {region.regionSido}
                                  {region.regionSigungu &&
                                    ` > ${region.regionSigungu}`}
                                  {region.regionDong &&
                                    ` > ${region.regionDong}`}
                                </Text>
                                <ActionIcon
                                  type='button'
                                  variant='subtle'
                                  color='gray'
                                  aria-label='지역 삭제'
                                  onClick={() => handleRemoveRegion(index)}
                                >
                                  <X size={16} />
                                </ActionIcon>
                              </Group>
                            </Paper>
                          )
                        )}
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Input.Wrapper>
          )}

          <Paper withBorder radius='md' p='md' bg='var(--app-bg-muted)'>
            <Checkbox
              id='isActive'
              label='광고 즉시 활성화 (체크하면 설정한 게시 기간에 노출됩니다)'
              fw={500}
              checked={adFormData.isActive}
              onChange={(e) =>
                setAdFormData({
                  ...adFormData,
                  isActive: e.target.checked,
                })
              }
            />
          </Paper>

          {/* 클릭수 초기화 (수정 모드에만 표시) */}
          {selectedAd && (
            <Paper withBorder radius='md' p='md' bg='var(--mantine-color-orange-light)'>
              <Group justify='space-between' wrap='nowrap'>
                <div>
                  <Text size='sm' fw={600} c='orange'>
                    클릭수 통계
                  </Text>
                  <Text size='xs' mt={4} c='orange'>
                    광고 클릭수: {selectedAd.adClickCount?.toLocaleString() || '0'} /
                    클릭 수: {selectedAd.clickCount?.toLocaleString() || '0'}
                  </Text>
                </div>
                <Button
                  type='button'
                  variant='light'
                  color='orange'
                  size='xs'
                  leftSection={<X size={12} />}
                  onClick={() => setIsResetClickDialogOpen(true)}
                >
                  초기화
                </Button>
              </Group>
            </Paper>
          )}
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button
            variant='default'
            onClick={handleCloseDialog}
            disabled={isSaving}
          >
            취소
          </Button>
          <Button
            onClick={handleSaveAd}
            disabled={isSaving || !isFormValid()}
            miw={100}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className='mr-2 animate-spin' />
                저장 중...
              </>
            ) : (
              <>{selectedAd ? '수정 완료' : '등록 완료'}</>
            )}
          </Button>
        </Group>
      </Modal>

      {/* 삭제 확인 다이얼로그 */}
      <Modal
        opened={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title={
          <Group component='span' gap='xs'>
            <AlertCircle size={20} color='var(--mantine-color-red-6)' />
            <Text span fw={600}>광고 삭제</Text>
          </Group>
        }
      >
        <Text size='sm' c='dimmed'>
          <Text span fw={600} c='var(--mantine-color-text)'>{selectedAd?.title}</Text>{' '}
          광고를 정말 삭제하시겠습니까?
          <br />이 작업은 취소할 수 없으며, 광고주 정보는 유지됩니다.
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button
            variant='default'
            onClick={() => setIsDeleteDialogOpen(false)}
          >
            취소
          </Button>
          <Button
            color='red'
            leftSection={<Trash2 size={16} />}
            onClick={handleDelete}
          >
            삭제
          </Button>
        </Group>
      </Modal>

      {/* 클릭수 초기화 확인 다이얼로그 */}
      <Modal
        opened={isResetClickDialogOpen}
        onClose={() => setIsResetClickDialogOpen(false)}
        title={
          <Group component='span' gap='xs'>
            <AlertCircle size={20} color='var(--mantine-color-blue-6)' />
            <Text span fw={600}>클릭수 초기화</Text>
          </Group>
        }
      >
        <Text size='sm' c='dimmed'>
          <Text span fw={600} c='var(--mantine-color-text)'>{selectedAd?.title}</Text> 광고의 클릭수를 0으로 초기화하시겠습니까?
        </Text>
        <Text size='sm' c='blue' mt='xs'>
          현재: 광고 클릭수 {selectedAd?.adClickCount?.toLocaleString() || '0'} / 클릭 수 {selectedAd?.clickCount?.toLocaleString() || '0'}
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button
            variant='default'
            onClick={() => setIsResetClickDialogOpen(false)}
          >
            취소
          </Button>
          <Button
            color='blue'
            onClick={handleResetClickCount}
          >
            초기화
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
