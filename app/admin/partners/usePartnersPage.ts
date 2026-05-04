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
          'id, userId, businessName, representativeName, displayPhoneNumber, phoneNumber, businessAddress, businessDetailAddress, businessRegistrationNumber, businessRegistrationImageUrl, businessHoursNote, parkingInfo, hasHadRunningAd, marketingAgreed, createdAt, ad_categories_v2:categoryId(categoryName)',
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

      const mapped: PartnerUser[] = (data ?? []).map((row: any) => ({
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
  };
}
