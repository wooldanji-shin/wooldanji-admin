'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setAutoApproveModification } from '@/lib/ads/auto-approve';
import type { PremiumStatus } from '@/components/status-badge';
import type { ApartmentOption } from '@/components/apartment-combobox';
import { SALES_REP_UNASSIGNED } from '@/components/sales-rep-filter';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';

export interface PremiumAd {
  id: string;
  partnerId: string;
  baseAdId: string;
  title: string | null;
  weeks: number;
  status: PremiumStatus;
  paymentStatus: 'unpaid' | 'paid';
  totalAmount: number | null;
  approvedDiscountRate: number | null;
  discountedTotalAmount: number | null;
  salesRepId: string | null;
  salesRepName: string | null;
  cumulativeAmount: number | null;
  modificationStatus: string | null;
  autoApproveModification: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  partnerBusinessName?: string;
  partnerAnalyticsEnabled: boolean;
  apartmentIds: string[];
  totalImpressions: number;
  totalClicks: number;
  totalPhoneClicks: number;
  /** 프리미엄에는 카테고리가 없다 — 원본 기본광고(baseAdId)에서 가져온다 */
  categoryId: string | null;
  subCategoryIds: string[];
}

export interface PremiumCategory {
  id: string;
  categoryName: string;
}

export interface PremiumSubCategory {
  id: string;
  subCategoryName: string;
}

const PAGE_SIZE = 20;

export interface UsePremiumPageReturn {
  ads: PremiumAd[];
  isLoading: boolean;
  statusFilter: PremiumStatus | 'all';
  setStatusFilter: (v: PremiumStatus | 'all') => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  apartmentFilter: string | null;
  salesRepFilter: string | null;
  setSalesRepFilter: (v: string | null) => void;
  setApartmentFilter: (v: string | null) => void;
  categoryFilter: string | null;
  setCategoryFilter: (v: string | null) => void;
  subCategoryFilter: string | null;
  setSubCategoryFilter: (v: string | null) => void;
  categories: PremiumCategory[];
  subCategories: PremiumSubCategory[];
  categoryCounts: Record<string, number>;
  allApartments: ApartmentOption[];
  statusCounts: Record<PremiumStatus | 'all', number>;
  paginatedAds: PremiumAd[];
  page: number;
  setPage: (v: number) => void;
  totalPages: number;
  filteredCount: number;
  handleRowClick: (id: string) => void;
  // 목록 인라인 승인/거절
  selectedAd: PremiumAd | null;
  approveDialog: boolean;
  setApproveDialog: (open: boolean) => void;
  rejectDialog: boolean;
  setRejectDialog: (open: boolean) => void;
  discountRate: number;
  setDiscountRate: (v: number) => void;
  adminMemo: string;
  setAdminMemo: (v: string) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  processing: boolean;
  handleOpenApprove: (ad: PremiumAd) => void;
  handleApproveConfirm: () => Promise<void>;
  handleOpenReject: (ad: PremiumAd) => void;
  handleReject: () => Promise<void>;
  handleToggleAutoApprove: (ad: PremiumAd, next: boolean) => Promise<void>;
  grantAnalytics: boolean;
  setGrantAnalytics: (v: boolean) => void;
}

export function usePremiumPage(): UsePremiumPageReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ads, setAds] = useState<PremiumAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, _setStatusFilter] = useState<PremiumStatus | 'all'>('all');
  const [searchTerm, _setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);
  const [apartmentFilter, _setApartmentFilter] = useState<string | null>(null);
  const [salesRepFilter, _setSalesRepFilter] = useState<string | null>(null);
  const [categoryFilter, _setCategoryFilter] = useState<string | null>(null);
  const [subCategoryFilter, _setSubCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<PremiumCategory[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<
    (PremiumSubCategory & { categoryId: string })[]
  >([]);
  const [allApartments, setAllApartments] = useState<ApartmentOption[]>([]);
  const page = useMemo(() => {
    const p = parseInt(searchParams.get('page') ?? '1');
    return isNaN(p) || p < 1 ? 1 : p;
  }, [searchParams]);

  const setPage = useCallback((p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(p));
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [router, searchParams]);

  const setStatusFilter = useCallback((v: PremiumStatus | 'all') => { _setStatusFilter(v); setPage(1); }, [setPage]);
  const setSearchTerm = useCallback((v: string) => { _setSearchTerm(v); setPage(1); }, [setPage]);
  const setApartmentFilter = useCallback((v: string | null) => { _setApartmentFilter(v); setPage(1); }, [setPage]);
  const setSalesRepFilter = useCallback((v: string | null) => { _setSalesRepFilter(v); setPage(1); }, [setPage]);
  // 카테고리를 바꾸면 하위 선택이 남아 결과가 0건이 되므로 서브카테고리도 함께 비운다
  const setCategoryFilter = useCallback((v: string | null) => {
    _setCategoryFilter(v);
    _setSubCategoryFilter(null);
    setPage(1);
  }, [setPage]);
  const setSubCategoryFilter = useCallback((v: string | null) => { _setSubCategoryFilter(v); setPage(1); }, [setPage]);

  const [selectedAd, setSelectedAd] = useState<PremiumAd | null>(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [discountRate, setDiscountRate] = useState(0);
  const [adminMemo, setAdminMemo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [grantAnalytics, setGrantAnalytics] = useState(false);

  const loadAds = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const { data: adsData, error: adsError } = await supabase
        .from('premium_advertisements_v2')
        .select(
          'id, "partnerId", "baseAdId", title, weeks, status, "paymentStatus", "totalAmount", "approvedDiscountRate", "discountedTotalAmount", "modificationStatus", "autoApproveModification", "startedAt", "endedAt", "createdAt", "salesRepId", sales_reps:salesRepId(name)'
        )
        .neq('status', 'draft')
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;
      if (!adsData || adsData.length === 0) {
        setAds([]);
        return;
      }

      const partnerUserIds = [...new Set(adsData.map((a: any) => a.partnerId))];
      const adIds = adsData.map((a: any) => a.id);
      const baseAdIds = [...new Set(adsData.map((a: any) => a.baseAdId).filter(Boolean))];

      const [
        { data: partnerData },
        { data: paymentRows },
        { data: apartmentRows },
        { data: apartmentList },
        { data: analyticsRows },
        { data: baseAdRows },
        { data: categoryRows },
      ] = await Promise.all([
        supabase
          .from('partner_users')
          .select('"userId", "businessName", "analyticsEnabled"')
          .in('userId', partnerUserIds),
        supabase
          .from('ad_payment_history_v2')
          .select('"premiumAdId", amount')
          .in('premiumAdId', adIds)
          .eq('status', 'paid'),
        // baseAdId를 통해 각 기본광고의 아파트 ID 조회
        baseAdIds.length > 0
          ? supabase
              .from('advertisement_apartments_v2')
              .select('"advertisementId", "apartmentId"')
              .in('advertisementId', baseAdIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('apartments')
          .select('id, name')
          .order('name'),
        supabase
          .from('premium_ad_analytics_v2')
          .select('"premiumAdId", "impressionCount", "homePremiumImpressionCount", "clickCount", "phoneClickCount"')
          .in('premiumAdId', adIds),
        // 프리미엄에는 카테고리 컬럼이 없어 원본 기본광고에서 끌어온다
        baseAdIds.length > 0
          ? supabase
              .from('advertisements_v2')
              .select('id, "categoryId", advertisement_sub_categories_v2("subCategoryId")')
              .in('id', baseAdIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('ad_categories_v2')
          .select('id, "categoryName", ad_sub_categories_v2(id, "subCategoryName", "isActive", "orderIndex")')
          .order('categoryName'),
      ]);

      const partnerMap = Object.fromEntries(
        (partnerData ?? []).map((p: any) => [p.userId, { businessName: p.businessName, analyticsEnabled: p.analyticsEnabled ?? false }])
      );

      const cumulativeAmountMap = (paymentRows ?? []).reduce<Record<string, number>>(
        (acc, r: any) => {
          const k = r.premiumAdId as string;
          acc[k] = (acc[k] ?? 0) + ((r.amount as number | null) ?? 0);
          return acc;
        },
        {}
      );

      // premiumAdId별 analytics 집계
      const analyticsMap = (analyticsRows ?? []).reduce<Record<string, { impressions: number; clicks: number; phoneClicks: number }>>(
        (acc, r: any) => {
          const key = r.premiumAdId as string;
          if (!acc[key]) acc[key] = { impressions: 0, clicks: 0, phoneClicks: 0 };
          acc[key].impressions += (r.homePremiumImpressionCount ?? 0) + (r.impressionCount ?? 0);
          acc[key].clicks += (r.clickCount ?? 0);
          acc[key].phoneClicks += (r.phoneClickCount ?? 0);
          return acc;
        },
        {}
      );

      // baseAdId별 아파트 ID 목록
      const baseAdApartmentMap = (apartmentRows ?? []).reduce<Record<string, string[]>>(
        (acc, r: any) => {
          const adId = r.advertisementId as string;
          if (!acc[adId]) acc[adId] = [];
          acc[adId].push(r.apartmentId as string);
          return acc;
        },
        {}
      );

      // baseAdId별 카테고리 / 서브카테고리
      const baseAdCategoryMap = (baseAdRows ?? []).reduce<
        Record<string, { categoryId: string | null; subCategoryIds: string[] }>
      >((acc, r: any) => {
        acc[r.id as string] = {
          categoryId: (r.categoryId as string | null) ?? null,
          subCategoryIds: (r.advertisement_sub_categories_v2 ?? []).map(
            (sc: any) => sc.subCategoryId as string
          ),
        };
        return acc;
      }, {});

      setCategories(
        ((categoryRows ?? []) as any[]).map((c: any) => ({
          id: c.id as string,
          categoryName: c.categoryName as string,
        }))
      );
      setAllSubCategories(
        ((categoryRows ?? []) as any[]).flatMap((c: any) =>
          ((c.ad_sub_categories_v2 ?? []) as any[])
            .filter((sub: any) => sub.isActive !== false)
            .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((sub: any) => ({
              id: sub.id as string,
              subCategoryName: sub.subCategoryName as string,
              categoryId: c.id as string,
            }))
        )
      );

      const mapped: PremiumAd[] = adsData.map((row: any) => ({
        ...row,
        autoApproveModification: row.autoApproveModification ?? false,
        partnerBusinessName: partnerMap[row.partnerId]?.businessName ?? '-',
        salesRepId: row.salesRepId ?? null,
        salesRepName: row.sales_reps?.name ?? null,
        partnerAnalyticsEnabled: partnerMap[row.partnerId]?.analyticsEnabled ?? false,
        cumulativeAmount: cumulativeAmountMap[row.id] ?? null,
        apartmentIds: baseAdApartmentMap[row.baseAdId] ?? [],
        totalImpressions: analyticsMap[row.id]?.impressions ?? 0,
        totalClicks: analyticsMap[row.id]?.clicks ?? 0,
        totalPhoneClicks: analyticsMap[row.id]?.phoneClicks ?? 0,
        categoryId: baseAdCategoryMap[row.baseAdId]?.categoryId ?? null,
        subCategoryIds: baseAdCategoryMap[row.baseAdId]?.subCategoryIds ?? [],
      }));

      setAds(mapped);
      setAllApartments((apartmentList ?? []) as ApartmentOption[]);
    } catch (err) {
      console.error('프리미엄 광고 목록 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // 아파트 필터 적용 후 목록 (상태별 개수도 이 기준으로 계산)
  // 아파트·영업담당자 필터는 상태 카운트에도 반영돼야 하므로 여기서 함께 적용한다
  const apartmentFilteredAds = useMemo(() => {
    let result = ads;

    if (apartmentFilter) {
      result = result.filter((ad) => ad.apartmentIds.includes(apartmentFilter));
    }

    if (salesRepFilter === SALES_REP_UNASSIGNED) {
      result = result.filter((ad) => ad.salesRepId === null);
    } else if (salesRepFilter) {
      result = result.filter((ad) => ad.salesRepId === salesRepFilter);
    }

    return result;
  }, [ads, apartmentFilter, salesRepFilter]);

  const statusCounts = useMemo<Record<PremiumStatus | 'all', number>>(() => {
    const counts: Record<string, number> = { all: apartmentFilteredAds.length };
    for (const ad of apartmentFilteredAds) {
      if (ad.status === 'running' && ad.modificationStatus === 'pending') {
        counts['modification_pending'] = (counts['modification_pending'] ?? 0) + 1;
      } else {
        counts[ad.status] = (counts[ad.status] ?? 0) + 1;
      }
    }
    return counts as Record<PremiumStatus | 'all', number>;
  }, [apartmentFilteredAds]);

  const filtered = useMemo(() => {
    let result =
      statusFilter === 'all'
        ? apartmentFilteredAds
        : statusFilter === 'modification_pending'
          ? apartmentFilteredAds.filter((ad) => ad.status === 'running' && ad.modificationStatus === 'pending')
          : apartmentFilteredAds.filter((ad) => ad.status === statusFilter);

    if (categoryFilter) {
      result = result.filter((ad) => ad.categoryId === categoryFilter);
    }

    if (subCategoryFilter) {
      result = result.filter((ad) => ad.subCategoryIds.includes(subCategoryFilter));
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.trim().toLowerCase();
      result = result.filter(
        (ad) =>
          ad.partnerBusinessName?.toLowerCase().includes(term) ||
          ad.title?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [apartmentFilteredAds, statusFilter, categoryFilter, subCategoryFilter, debouncedSearchTerm]);

  // 카테고리별 개수 — 기본광고 목록과 같이 상태 필터 적용 후 기준
  const statusFilteredAds = useMemo(
    () =>
      statusFilter === 'all'
        ? apartmentFilteredAds
        : statusFilter === 'modification_pending'
          ? apartmentFilteredAds.filter((ad) => ad.status === 'running' && ad.modificationStatus === 'pending')
          : apartmentFilteredAds.filter((ad) => ad.status === statusFilter),
    [apartmentFilteredAds, statusFilter]
  );

  const categoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const ad of statusFilteredAds) {
      if (ad.categoryId) counts[ad.categoryId] = (counts[ad.categoryId] ?? 0) + 1;
    }
    return counts;
  }, [statusFilteredAds]);

  const subCategories = useMemo<PremiumSubCategory[]>(
    () =>
      categoryFilter
        ? allSubCategories.filter((sub) => sub.categoryId === categoryFilter)
        : [],
    [allSubCategories, categoryFilter]
  );


  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedAds = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const handleRowClick = (id: string): void => {
    router.push(`/admin/advertising-v2/premium/${id}`);
  };

  const handleOpenApprove = useCallback((ad: PremiumAd) => {
    setSelectedAd(ad);
    setDiscountRate(0);
    setAdminMemo('');
    setGrantAnalytics(ad.partnerAnalyticsEnabled);
    setApproveDialog(true);
  }, []);

  const handleApproveConfirm = useCallback(async () => {
    if (!selectedAd) return;
    setProcessing(true);
    try {
      const supabase = createClient();
      const res = await fetch(`/api/advertising-v2/premium/${selectedAd.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountRate, adminMemo }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error ?? 'Failed to approve');
      }
      if (grantAnalytics && !selectedAd.partnerAnalyticsEnabled) {
        await (supabase as any)
          .from('partner_users')
          .update({ analyticsEnabled: true })
          .eq('userId', selectedAd.partnerId);
      }
      toast.success('프리미엄 광고가 승인되었습니다.');
      setApproveDialog(false);
      setDiscountRate(0);
      setAdminMemo('');
      loadAds();
    } catch (err) {
      console.error('프리미엄 광고 승인 실패:', err);
      toast.error('승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [selectedAd, discountRate, adminMemo, grantAnalytics, loadAds]);

  const handleToggleAutoApprove = useCallback(async (ad: PremiumAd, next: boolean) => {
    const ok = await setAutoApproveModification(
      createClient(),
      'premium_advertisements_v2',
      ad.id,
      next
    );
    if (!ok) return;
    setAds((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, autoApproveModification: next } : a))
    );
  }, []);

  const handleOpenReject = useCallback((ad: PremiumAd) => {
    setSelectedAd(ad);
    setRejectReason('');
    setRejectDialog(true);
  }, []);

  const handleReject = useCallback(async () => {
    if (!selectedAd) return;
    if (!rejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${selectedAd.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error ?? 'Failed to reject');
      }
      toast.success('프리미엄 광고가 거절되었습니다.');
      setRejectDialog(false);
      setRejectReason('');
      loadAds();
    } catch (err) {
      console.error('프리미엄 광고 거절 실패:', err);
      toast.error('거절 처리에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [selectedAd, rejectReason, loadAds]);

  return {
    ads,
    isLoading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    salesRepFilter,
    setSalesRepFilter,
    categoryFilter,
    setCategoryFilter,
    subCategoryFilter,
    setSubCategoryFilter,
    categories,
    subCategories,
    categoryCounts,
    allApartments,
    statusCounts,
    paginatedAds,
    page,
    setPage,
    totalPages,
    filteredCount: filtered.length,
    handleRowClick,
    selectedAd,
    approveDialog,
    setApproveDialog,
    rejectDialog,
    setRejectDialog,
    discountRate,
    setDiscountRate,
    adminMemo,
    setAdminMemo,
    rejectReason,
    setRejectReason,
    processing,
    handleOpenApprove,
    handleApproveConfirm,
    handleOpenReject,
    handleReject,
    handleToggleAutoApprove,
    grantAnalytics,
    setGrantAnalytics,
  };
}
