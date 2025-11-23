'use client';

import { useState, useEffect, useCallback } from 'react';
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

// 날짜를 시작 시간(00:00:00)으로 변환 (로컬 타임존 사용)
const formatDateToStartOfDay = (date: string): string => {
  if (!date) return '';
  // 로컬 시간으로 Date 객체 생성 (00:00:00)
  const localDate = new Date(date + 'T00:00:00');
  // ISO 8601 형식으로 변환 (UTC로 자동 변환됨)
  return localDate.toISOString();
};

// 날짜를 종료 시간(23:59:59)으로 변환 (로컬 타임존 사용)
const formatDateToEndOfDay = (date: string): string => {
  if (!date) return '';
  // 로컬 시간으로 Date 객체 생성 (23:59:59)
  const localDate = new Date(date + 'T23:59:59');
  // ISO 8601 형식으로 변환 (UTC로 자동 변환됨)
  return localDate.toISOString();
};

// 통합 전화번호 포맷팅 함수 (휴대폰 및 유선전화 모두 지원)
const formatPhoneNumber = (value: string): string => {
  // 숫자만 추출
  const numbers = value.replace(/[^\d]/g, '');

  // 휴대폰번호 (010, 011, 016, 017, 018, 019로 시작)
  if (numbers.startsWith('010') || numbers.startsWith('011') || numbers.startsWith('016') ||
      numbers.startsWith('017') || numbers.startsWith('018') || numbers.startsWith('019')) {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }

  // 서울 (02로 시작): 2-3-4 또는 2-4-4
  if (numbers.startsWith('02')) {
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
  }

  // 기타 지역번호 (031, 032, 033, etc): 3-3-4 또는 3-4-4
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length <= 10) return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
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
  clickCount: number;
  createdAt: string;
  advertisers: {
    id: string;
    businessName: string;
    representativeName: string;
    email: string | null;
    contactPhoneNumber: string;
    displayPhoneNumber: string | null;
    address: string;
    logo: string | null;
    representativeImage: string | null;
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
    contactPhoneNumber: '',
    displayPhoneNumber: '',
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
    isEvent: false,
    eventStartDate: '',
    eventEndDate: '',
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

  // 계약메모 인라인 수정 상태
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoValue, setEditingMemoValue] = useState('');

  // 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      const roles = await getUserRoles();
      setUserRoles(roles);
      await fetchData();
    };
    initializeData();
  }, []);

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
            contactPhoneNumber,
            displayPhoneNumber,
            address,
            logo,
            representativeImage,
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
        .order('createdAt', { ascending: false });

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
      toast.error('데이터 로드 실패: ' + error.message);
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

    // 만료 30일 전 체크
    const thirtyDaysBeforeEnd = new Date(end);
    thirtyDaysBeforeEnd.setDate(thirtyDaysBeforeEnd.getDate() - 30);

    if (now >= thirtyDaysBeforeEnd) return 'expiring';
    return 'active';
  };

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

    setFilteredAds(filtered);
  }, [advertisements, activeTab, searchTerm, filterAdType, filterCategory, filterAdvertiser]);

  // 필터링 useEffect
  useEffect(() => {
    filterAdvertisements();
  }, [filterAdvertisements]);

  // 전화번호 변경 핸들러 (메모이제이션)
  const handleContactPhoneChange = useCallback((value: string) => {
    const formatted = formatPhoneNumber(value);
    setAdvertiserFormData(prev => ({ ...prev, contactPhoneNumber: formatted }));
  }, []);

  const handleDisplayPhoneChange = useCallback((value: string) => {
    const formatted = formatPhoneNumber(value);
    setAdvertiserFormData(prev => ({ ...prev, displayPhoneNumber: formatted }));
  }, []);

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

  // 광고 등록/수정 다이얼로그 열기
  const handleOpenDialog = (ad?: Advertisement) => {
    if (ad) {
      setSelectedAd(ad);

      // 광고주 정보 설정
      setAdvertiserFormData({
        businessName: ad.advertisers.businessName,
        representativeName: ad.advertisers.representativeName,
        email: ad.advertisers.email || '',
        contactPhoneNumber: ad.advertisers.contactPhoneNumber,
        displayPhoneNumber: ad.advertisers.displayPhoneNumber || '',
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
        isEvent: ad.isEvent || false,
        eventStartDate: ad.eventStartDate ? ad.eventStartDate.split('T')[0] : '',
        eventEndDate: ad.eventEndDate ? ad.eventEndDate.split('T')[0] : '',
        selectedApartments: ad.advertisement_apartments?.map(aa => aa.apartments.id) || [],
        selectedRegions: ad.advertisement_regions || [],
      });
    } else {
      setSelectedAd(null);
      setAdvertiserFormData({
        businessName: '',
        representativeName: '',
        email: '',
        contactPhoneNumber: '',
        displayPhoneNumber: '',
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
        isEvent: false,
        eventStartDate: '',
        eventEndDate: '',
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
      if (!advertiserFormData.businessName.trim()) {
        throw new Error('상호명을 입력해주세요');
      }
      if (!advertiserFormData.representativeName.trim()) {
        throw new Error('대표자명을 입력해주세요');
      }
      if (!advertiserFormData.contactPhoneNumber.trim()) {
        throw new Error('광고주 연락처를 입력해주세요');
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
            contactPhoneNumber: advertiserFormData.contactPhoneNumber,
            displayPhoneNumber: advertiserFormData.displayPhoneNumber || null,
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
            startDate: formatDateToStartOfDay(adFormData.startDate),
            endDate: formatDateToEndOfDay(adFormData.endDate),
            isActive: adFormData.isActive,
            isEvent: adFormData.isEvent,
            eventStartDate: adFormData.isEvent ? formatDateToStartOfDay(adFormData.eventStartDate) : null,
            eventEndDate: adFormData.isEvent ? formatDateToEndOfDay(adFormData.eventEndDate) : null,
          })
          .eq('id', selectedAd.id);

        if (adError) throw adError;

        // 아파트/지역 연결 업데이트
        await updateAdConnections(selectedAd.id);

        // 검색 태그 생성 및 업데이트
        await updateAdvertiserSearchTags(selectedAd.advertiserId, adFormData.adType);

        toast.success('광고가 수정되었습니다');
      } else {
        // 등록 모드
        // 1. 광고주 등록
        const { data: advertiserData, error: advertiserError } = await supabase
          .from('advertisers')
          .insert({
            businessName: advertiserFormData.businessName,
            representativeName: advertiserFormData.representativeName,
            email: advertiserFormData.email || null,
            contactPhoneNumber: advertiserFormData.contactPhoneNumber,
            displayPhoneNumber: advertiserFormData.displayPhoneNumber || null,
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
            startDate: formatDateToStartOfDay(adFormData.startDate),
            endDate: formatDateToEndOfDay(adFormData.endDate),
            isActive: adFormData.isActive,
            isEvent: adFormData.isEvent,
            eventStartDate: adFormData.isEvent ? formatDateToStartOfDay(adFormData.eventStartDate) : null,
            eventEndDate: adFormData.isEvent ? formatDateToEndOfDay(adFormData.eventEndDate) : null,
            createdBy: currentUser.id,
          })
          .select()
          .single();

        if (adError) throw adError;

        // 3. 아파트/지역 연결
        await updateAdConnections(adData.id);

        // 4. 검색 태그 생성 및 업데이트
        await updateAdvertiserSearchTags(advertiserData.id, adFormData.adType);

        toast.success('광고가 등록되었습니다');
      }

      await fetchData();
      setIsDialogOpen(false);
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
    // 광고주 정보 필수 항목
    if (!advertiserFormData.businessName.trim()) return false;
    if (!advertiserFormData.representativeName.trim()) return false;
    if (!advertiserFormData.contactPhoneNumber.trim()) return false;
    if (!advertiserFormData.address.trim()) return false;

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

                    <Button
                      variant='outline'
                      onClick={() => {
                        setSearchTerm('');
                        setFilterAdType('all');
                        setFilterCategory('all');
                        setFilterAdvertiser('all');
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

          {/* 광고 목록 */}
          <Card>
            <CardContent className='pt-6'>
              <div className='mb-4 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='text-lg font-semibold'>광고 목록</div>
                  <Badge
                    variant='secondary'
                    className='text-sm'
                  >
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
                    <Button
                      onClick={() => handleOpenDialog()}
                      size='lg'
                    >
                      <Plus className='mr-2 h-5 w-5' />첫 광고 등록하기
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
                        <TableHead className='w-[140px]'>연락처</TableHead>
                        <TableHead className='w-[120px]'>카테고리</TableHead>
                        <TableHead className='w-[100px]'>타입</TableHead>
                        <TableHead className='w-[180px]'>게시 기간</TableHead>
                        <TableHead className='w-[200px]'>계약메모</TableHead>
                        <TableHead className='w-[100px] text-center'>클릭 수</TableHead>
                        <TableHead className='text-right w-[120px]'>
                          작업
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAds.map((ad) => (
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
                                  {truncateText(
                                    ad.advertisers?.businessName || '-',
                                    20
                                  )}
                                </div>
                              </TooltipTrigger>
                              {ad.advertisers?.businessName &&
                                ad.advertisers.businessName.length > 20 && (
                                  <TooltipContent>
                                    <p>{ad.advertisers.businessName}</p>
                                  </TooltipContent>
                                )}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className='space-y-1 text-sm'>
                              <div className='font-medium'>
                                <span className='text-xs text-muted-foreground'>연락처: </span>
                                {ad.advertisers?.contactPhoneNumber || '-'}
                              </div>
                              {ad.advertisers?.displayPhoneNumber && (
                                <div className='text-xs text-muted-foreground'>
                                  <span>표시용: </span>
                                  {ad.advertisers.displayPhoneNumber}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {ad.ad_categories ? (
                              <Badge
                                variant='outline'
                                className='font-normal'
                              >
                                <Tag className='mr-1 h-3 w-3' />
                                {ad.ad_categories.categoryName}
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
                            <div className='space-y-2'>
                              <div className='space-y-1 text-sm'>
                                <div className='flex items-center gap-1 text-muted-foreground'>
                                  <Calendar className='h-3 w-3' />
                                  {new Date(ad.startDate).toLocaleDateString(
                                    'ko-KR'
                                  )}
                                </div>
                                <div className='flex items-center gap-1 text-muted-foreground'>
                                  <Calendar className='h-3 w-3' />
                                  {new Date(ad.endDate).toLocaleDateString(
                                    'ko-KR'
                                  )}
                                </div>
                              </div>
                              {ad.isEvent && ad.eventStartDate && ad.eventEndDate && (
                                <div className='space-y-1 text-xs pt-1 border-t'>
                                  <div className='text-purple-600 font-medium'>
                                    이벤트 기간:
                                  </div>
                                  <div className='flex items-center gap-1 text-purple-600'>
                                    <Calendar className='h-3 w-3' />
                                    {new Date(ad.eventStartDate).toLocaleDateString(
                                      'ko-KR'
                                    )}
                                  </div>
                                  <div className='flex items-center gap-1 text-purple-600'>
                                    <Calendar className='h-3 w-3' />
                                    {new Date(ad.eventEndDate).toLocaleDateString(
                                      'ko-KR'
                                    )}
                                  </div>
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
                                      <div className='max-w-[180px]'>
                                        {truncateText(
                                          ad.advertisers.contractMemo,
                                          50
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    {ad.advertisers.contractMemo.length >
                                      50 && (
                                      <TooltipContent>
                                        <p className='max-w-xs whitespace-pre-wrap'>
                                          {ad.advertisers.contractMemo}
                                        </p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                ) : (
                                  <span className='text-muted-foreground italic'>
                                    메모 없음
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className='text-center'>
                            <span>
                              {ad.clickCount?.toLocaleString() || '0'}
                            </span>
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
        <Dialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <DialogContent className='max-h-[90vh] w-[95vw] max-w-6xl sm:max-w-6xl overflow-y-auto'>
            <DialogHeader>
              <DialogTitle className='text-2xl'>
                {selectedAd ? '광고 수정' : '새 광고 등록'}
              </DialogTitle>
              <DialogDescription>
                광고주 정보와 광고 내용을 입력하세요. 모든 필수 항목(*)을
                입력해야 합니다.
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
                      <Label
                        htmlFor='businessName'
                        className='required'
                      >
                        상호명 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='businessName'
                        value={advertiserFormData.businessName}
                        onChange={(e) =>
                          setAdvertiserFormData({
                            ...advertiserFormData,
                            businessName: e.target.value,
                          })
                        }
                        placeholder='상호명을 적어주세요'
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
                          setAdvertiserFormData({
                            ...advertiserFormData,
                            representativeName: e.target.value,
                          })
                        }
                        placeholder='홍길동'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label htmlFor='contactPhoneNumber'>
                        광고주 연락처 <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        id='contactPhoneNumber'
                        value={advertiserFormData.contactPhoneNumber}
                        onChange={(e) =>
                          handleContactPhoneChange(e.target.value)
                        }
                        placeholder='010-1234-5678 또는 02-123-4567'
                      />
                      <p className='text-xs text-muted-foreground'>
                        관리용 연락처 (비공개)
                      </p>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='displayPhoneNumber'>광고 표시용 전화번호</Label>
                      <Input
                        id='displayPhoneNumber'
                        value={advertiserFormData.displayPhoneNumber}
                        onChange={(e) =>
                          handleDisplayPhoneChange(e.target.value)
                        }
                        placeholder='010-1234-5678 또는 02-123-4567'
                      />
                      <p className='text-xs text-muted-foreground'>
                        앱에서 고객에게 보여질 번호
                      </p>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='email'>이메일</Label>
                    <Input
                      id='email'
                      type='email'
                      value={advertiserFormData.email}
                      onChange={(e) =>
                        setAdvertiserFormData({
                          ...advertiserFormData,
                          email: e.target.value,
                        })
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
                        setAdvertiserFormData({
                          ...advertiserFormData,
                          address: e.target.value,
                        })
                      }
                      placeholder='영업점 주소를 입력 하세요'
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-2'>
                      <Label>로고 이미지</Label>
                      <ImageUpload
                        value={advertiserFormData.logo}
                        onChange={(url) =>
                          setAdvertiserFormData({
                            ...advertiserFormData,
                            logo: url,
                          })
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
                          setAdvertiserFormData({
                            ...advertiserFormData,
                            representativeImage: url,
                          })
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
                          setAdvertiserFormData({
                            ...advertiserFormData,
                            businessRegistration: url,
                          })
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
                          setAdvertiserFormData({
                            ...advertiserFormData,
                            contractDocument: url,
                          })
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
                        setAdvertiserFormData({
                          ...advertiserFormData,
                          contractMemo: e.target.value,
                        })
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
                        카테고리<span className='text-destructive'>*</span>
                      </Label>
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
                            <SelectItem
                              key={cat.id}
                              value={cat.id}
                            >
                              {cat.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        setAdFormData({
                          ...adFormData,
                          linkUrl: e.target.value,
                        })
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
                      <Popover
                        open={apartmentSearchOpen}
                        onOpenChange={setApartmentSearchOpen}
                      >
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
                              <CommandEmpty>
                                아파트를 찾을 수 없습니다.
                              </CommandEmpty>
                              <CommandGroup>
                                {apartments
                                  .filter((apt) =>
                                    apt.name
                                      .toLowerCase()
                                      .includes(apartmentSearch.toLowerCase())
                                  )
                                  .map((apt) => (
                                    <CommandItem
                                      key={apt.id}
                                      onSelect={() => {
                                        const isSelected =
                                          adFormData.selectedApartments.includes(
                                            apt.id
                                          );
                                        setAdFormData({
                                          ...adFormData,
                                          selectedApartments: isSelected
                                            ? adFormData.selectedApartments.filter(
                                                (id) => id !== apt.id
                                              )
                                            : [
                                                ...adFormData.selectedApartments,
                                                apt.id,
                                              ],
                                        });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          adFormData.selectedApartments.includes(
                                            apt.id
                                          )
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
                            const apt = apartments.find((a) => a.id === aptId);
                            return apt ? (
                              <Badge
                                key={aptId}
                                variant='secondary'
                                className='font-normal'
                              >
                                {apt.name}
                                <X
                                  className='ml-1 h-3 w-3 cursor-pointer'
                                  onClick={() =>
                                    setAdFormData({
                                      ...adFormData,
                                      selectedApartments:
                                        adFormData.selectedApartments.filter(
                                          (id) => id !== aptId
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
      </div>
    </TooltipProvider>
  );
}
