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
  categoryName: string | null;
}

export interface UsePartnersPageReturn {
  partners: PartnerUser[];
  loading: boolean;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  searchInput: string;
  handleSearch: (value: string) => void;
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
  const currentPage = parseInt(searchParams.get('page') ?? '1');

  const [partners, setPartners] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const fetchPartners = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      let query = supabase
        .from('partner_users')
        .select(
          'id, userId, businessName, representativeName, displayPhoneNumber, phoneNumber, businessAddress, businessDetailAddress, businessRegistrationNumber, businessRegistrationImageUrl, businessHoursNote, parkingInfo, hasHadRunningAd, marketingAgreed, analyticsEnabled, createdAt, ad_categories_v2:categoryId(categoryName)',
          { count: 'exact' }
        );

      if (searchQuery) {
        query = query.or(
          `businessName.ilike.%${searchQuery}%,representativeName.ilike.%${searchQuery}%,displayPhoneNumber.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%,businessRegistrationNumber.ilike.%${searchQuery}%`
        );
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
        categoryName: (row.ad_categories_v2 as any)?.categoryName ?? null,
      }));

      setPartners(mapped);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('파트너 목록 로드 실패:', err);
      toast.error('파트너 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage, supabase]);

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
    handleSearch,
    handlePageChange,
    handleRowClick,
    handleToggleAnalytics,
  };
}
