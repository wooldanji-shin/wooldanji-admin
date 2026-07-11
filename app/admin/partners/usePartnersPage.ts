'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface PartnerUser {
  id: string;
  userId: string;
  businessName: string;
  representativeName: string;
  displayPhoneNumber: string | null;
  phoneNumber: string | null;
  businessAddress: string | null;
  businessDetailAddress: string | null;
  businessRegistrationNumber: string | null;
  businessRegistrationImageUrl: string | null;
  businessHoursNote: string | null;
  parkingInfo: string | null;
  hasHadRunningAd: boolean;
  marketingAgreed: boolean;
  analyticsEnabled: boolean;
  email: string | null;
  createdAt: string;
  categoryNames: string[];
  totalImpressionCount: number;
  totalClickCount: number;
}

export interface PartnerCategory {
  id: string;
  categoryName: string;
}

export interface PartnerSubCategory {
  id: string;
  subCategoryName: string;
}

export interface UsePartnersPageReturn {
  partners: PartnerUser[];
  loading: boolean;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  searchInput: string;
  categories: PartnerCategory[];
  subCategories: PartnerSubCategory[];
  categoryFilter: string | null;
  subCategoryFilter: string | null;
  handleSearch: (value: string) => void;
  handleCategoryFilterChange: (categoryId: string | null) => void;
  handleSubCategoryFilterChange: (subCategoryId: string | null) => void;
  handlePageChange: (page: number) => void;
  handleRowClick: (id: string) => void;
  handleToggleAnalytics: (partnerId: string, current: boolean) => Promise<void>;
}

const ITEMS_PER_PAGE = 15;

export function usePartnersPage(): UsePartnersPageReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const debounceTimer = useRef<NodeJS.Timeout>(null);

  const searchQuery = searchParams.get('search') ?? '';
  const categoryFilter = searchParams.get('category') ?? null;
  const subCategoryFilter = searchParams.get('subCategory') ?? null;
  const currentPage = parseInt(searchParams.get('page') ?? '1');

  const [partners, setPartners] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [categories, setCategories] = useState<PartnerCategory[]>([]);
  const [subCategories, setSubCategories] = useState<PartnerSubCategory[]>([]);

  const fetchCategories = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase
      .from('ad_categories_v2')
      .select('id, categoryName')
      .order('categoryName');
    if (error) {
      console.error('카테고리 목록 로드 실패:', error);
      return;
    }
    setCategories((data as PartnerCategory[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchSubCategories = useCallback(async (categoryId: string): Promise<void> => {
    const { data, error } = await supabase
      .from('ad_sub_categories_v2')
      .select('id, subCategoryName')
      .eq('categoryId', categoryId)
      .order('orderIndex', { ascending: true });
    if (error) {
      console.error('서브카테고리 목록 로드 실패:', error);
      return;
    }
    setSubCategories((data as PartnerSubCategory[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (categoryFilter) {
      fetchSubCategories(categoryFilter);
    } else {
      setSubCategories([]);
    }
  }, [categoryFilter, fetchSubCategories]);

  const fetchPartners = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // 카테고리/서브카테고리 필터 — advertisements_v2에서 해당 카테고리의 광고를 보유한 partnerId 추출
      let partnerIdsFilter: string[] | null = null;
      if (categoryFilter) {
        const { data: adsData, error: adsError } = await supabase
          .from('advertisements_v2')
          .select('id, partnerId')
          .eq('categoryId', categoryFilter)
          .neq('adStatus', 'draft');
        if (adsError) throw adsError;

        let matchingAds = adsData ?? [];
        if (subCategoryFilter) {
          const adIds = matchingAds.map((a: any) => a.id);
          if (adIds.length === 0) {
            matchingAds = [];
          } else {
            const { data: subData, error: subError } = await supabase
              .from('advertisement_sub_categories_v2')
              .select('advertisementId')
              .eq('subCategoryId', subCategoryFilter)
              .in('advertisementId', adIds);
            if (subError) throw subError;
            const matchedAdIds = new Set((subData ?? []).map((s: any) => s.advertisementId));
            matchingAds = matchingAds.filter((a: any) => matchedAdIds.has(a.id));
          }
        }
        partnerIdsFilter = Array.from(new Set(matchingAds.map((a: any) => a.partnerId)));
      }

      if (partnerIdsFilter !== null && partnerIdsFilter.length === 0) {
        setPartners([]);
        setTotalCount(0);
        return;
      }

      let query = supabase
        .from('partner_users')
        .select(
          'id, userId, businessName, representativeName, displayPhoneNumber, phoneNumber, businessAddress, businessDetailAddress, businessRegistrationNumber, businessRegistrationImageUrl, businessHoursNote, parkingInfo, hasHadRunningAd, marketingAgreed, analyticsEnabled, createdAt',
          { count: 'exact' }
        );

      if (searchQuery) {
        query = query.or(
          `businessName.ilike.%${searchQuery}%,representativeName.ilike.%${searchQuery}%,displayPhoneNumber.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%,businessRegistrationNumber.ilike.%${searchQuery}%`
        );
      }

      if (partnerIdsFilter !== null) {
        query = query.in('id', partnerIdsFilter);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const { data, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, from + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      const rows = data ?? [];

      // user 테이블에서 이메일 일괄 조회 (FK 없으므로 별도 쿼리)
      const userIds = rows.map((r: any) => r.userId);
      const emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user')
          .select('id, email')
          .in('id', userIds);
        (users ?? []).forEach((u: any) => { emailMap[u.id] = u.email; });
      }

      // 파트너별 노출수/클릭수 집계 (기본광고 + 프리미엄 합산)
      const partnerIds = rows.map((r: any) => r.id);
      const analyticsMap: Record<string, { impression: number; click: number }> = {};
      partnerIds.forEach((id: string) => { analyticsMap[id] = { impression: 0, click: 0 }; });

      if (partnerIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: analyticsData } = await (supabase as any)
          .rpc('get_partner_analytics_totals', { partner_ids: partnerIds });
        (analyticsData ?? []).forEach((a: any) => {
          analyticsMap[a.partner_id] = {
            impression: Number(a.total_impression_count) || 0,
            click: Number(a.total_click_count) || 0,
          };
        });
      }

      // 파트너별 보유 광고 카테고리 집계 (중복 없이)
      const categoryNamesMap: Record<string, Set<string>> = {};
      partnerIds.forEach((id: string) => { categoryNamesMap[id] = new Set(); });

      if (partnerIds.length > 0) {
        const { data: adCategoryData } = await supabase
          .from('advertisements_v2')
          .select('partnerId, ad_categories_v2:categoryId(categoryName)')
          .in('partnerId', partnerIds)
          .neq('adStatus', 'draft');
        (adCategoryData ?? []).forEach((row: any) => {
          const name = row.ad_categories_v2?.categoryName;
          if (name) categoryNamesMap[row.partnerId]?.add(name);
        });
      }

      const mapped: PartnerUser[] = rows.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        businessName: row.businessName,
        representativeName: row.representativeName,
        displayPhoneNumber: row.displayPhoneNumber,
        phoneNumber: row.phoneNumber,
        businessAddress: row.businessAddress,
        businessDetailAddress: row.businessDetailAddress,
        businessRegistrationNumber: row.businessRegistrationNumber,
        businessRegistrationImageUrl: row.businessRegistrationImageUrl,
        businessHoursNote: row.businessHoursNote,
        parkingInfo: row.parkingInfo,
        hasHadRunningAd: row.hasHadRunningAd,
        marketingAgreed: row.marketingAgreed,
        analyticsEnabled: row.analyticsEnabled ?? false,
        email: emailMap[row.userId] ?? null,
        createdAt: row.createdAt,
        categoryNames: Array.from(categoryNamesMap[row.id] ?? []),
        totalImpressionCount: analyticsMap[row.id]?.impression ?? 0,
        totalClickCount: analyticsMap[row.id]?.click ?? 0,
      }));

      setPartners(mapped);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('파트너 목록 로드 실패:', err);
      toast.error('파트너 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, subCategoryFilter, currentPage, supabase]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const updateSearchParams = (params: Record<string, string>): void => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(params).forEach(([key, value]) => {
      if (value) current.set(key, value);
      else current.delete(key);
    });
    const qs = current.toString();
    router.push(`/admin/partners${qs ? `?${qs}` : ''}`);
  };

  const handleSearch = (value: string): void => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateSearchParams({ search: value, page: '1' });
    }, 500);
  };

  const handleCategoryFilterChange = (categoryId: string | null): void => {
    updateSearchParams({ category: categoryId ?? '', subCategory: '', page: '1' });
  };

  const handleSubCategoryFilterChange = (subCategoryId: string | null): void => {
    updateSearchParams({ subCategory: subCategoryId ?? '', page: '1' });
  };

  const handlePageChange = (page: number): void => {
    updateSearchParams({ page: page.toString() });
  };

  const handleRowClick = (id: string): void => {
    router.push(`/admin/partners/${id}`);
  };

  const handleToggleAnalytics = async (partnerId: string, current: boolean): Promise<void> => {
    const next = !current;
    setPartners((prev) =>
      prev.map((p) => (p.id === partnerId ? { ...p, analyticsEnabled: next } : p))
    );
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('partner_users')
        .update({ analyticsEnabled: next })
        .eq('id', partnerId);
      if (error) throw error;
      toast.success(next ? '광고 분석 권한을 부여했습니다.' : '광고 분석 권한을 해제했습니다.');
    } catch (err) {
      // 실패 시 롤백
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? { ...p, analyticsEnabled: current } : p))
      );
      console.error('analyticsEnabled 변경 실패:', err);
      toast.error('권한 변경에 실패했습니다.');
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return {
    partners,
    loading,
    totalCount,
    totalPages,
    currentPage,
    searchInput,
    categories,
    subCategories,
    categoryFilter,
    subCategoryFilter,
    handleSearch,
    handleCategoryFilterChange,
    handleSubCategoryFilterChange,
    handlePageChange,
    handleRowClick,
    handleToggleAnalytics,
  };
}
