'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ApartmentOption } from '@/components/apartment-combobox';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';

export type AdStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'ended' | 'draft';
export type ModificationStatus = 'pending' | 'approved' | 'rejected' | null;
export type PaymentStatus = 'unpaid' | 'paid';
export type StatusFilter = 'all' | 'free_running' | 'paid_running' | 'pending' | 'modification' | 'ended' | 'rejected';

export interface AdCategoryWithSubs {
  id: string;
  categoryName: string;
  subCategories: { id: string; subCategoryName: string }[];
}

export interface AdCategory {
  id: string;
  categoryName: string;
}

export interface SubCategory {
  id: string;
  subCategoryName: string;
}

export interface ApartmentSummary {
  apartmentId: string;
  apartmentName: string;
  totalHouseholds: number;
}

export interface AdApplication {
  id: string;
  title: string;
  content: string | null;
  adStatus: AdStatus;
  paymentStatus: PaymentStatus;
  modificationStatus: ModificationStatus;
  submittedAt: string | null;
  activatedAt: string | null;
  freeMonths: number;
  isFirstAdApplication: boolean;
  categoryId: string | null;
  approvedMonthlyAmount: number | null;
  approvedDiscountRate: number | null;
  partner_users: {
    id: string;
    businessName: string;
    displayPhoneNumber: string | null;
    hasHadRunningAd: boolean;
    analyticsEnabled: boolean;
  } | null;
  ad_categories_v2: {
    categoryName: string;
  } | null;
  subCategoryNames: string[];
  subCategoryIds: string[];
  apartments: ApartmentSummary[];
  totalImpressions: number;
  totalClicks: number;
}

const PAGE_SIZE = 20;

export interface UseApplicationsPageReturn {
  applications: AdApplication[];
  loading: boolean;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  subCategoryFilter: string | null;
  setSubCategoryFilter: (id: string | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  apartmentFilter: string | null;
  setApartmentFilter: (id: string | null) => void;
  categories: AdCategory[];
  subCategories: SubCategory[];
  allApartments: ApartmentOption[];
  pricePerHousehold: number;
  statusCounts: Record<StatusFilter, number>;
  categoryCounts: Record<string, number>;
  paginatedApplications: AdApplication[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  filteredCount: number;
  handleRowClick: (id: string) => void;
  // 목록 인라인 승인/거절
  selectedAd: AdApplication | null;
  approveDialog: boolean;
  setApproveDialog: (open: boolean) => void;
  rejectDialog: boolean;
  setRejectDialog: (open: boolean) => void;
  freeMonths: number;
  setFreeMonths: (v: number) => void;
  overrideEnabled: boolean;
  setOverrideEnabled: (v: boolean) => void;
  discountRate: number;
  setDiscountRate: (v: number) => void;
  discountNote: string;
  setDiscountNote: (v: string) => void;
  adminMemo: string;
  setAdminMemo: (v: string) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  processing: boolean;
  handleOpenApprove: (ad: AdApplication) => void;
  handleApprove: () => Promise<void>;
  handleOpenReject: (ad: AdApplication) => void;
  handleReject: () => Promise<void>;
  grantAnalytics: boolean;
  setGrantAnalytics: (v: boolean) => void;
  allCategoriesWithSubs: AdCategoryWithSubs[];
  approveCategory: string | null;
  handleApproveCategoryChange: (categoryId: string) => void;
  approveSubCategoryIds: string[];
  setApproveSubCategoryIds: (ids: string[]) => void;
}

export function useApplicationsPage(): UseApplicationsPageReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [applications, setApplications] = useState<AdApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, _setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, _setCategoryFilter] = useState<string | null>(null);
  const [subCategoryFilter, _setSubCategoryFilter] = useState<string | null>(null);
  const [searchTerm, _setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);
  const [apartmentFilter, _setApartmentFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<AdCategory[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [allApartments, setAllApartments] = useState<ApartmentOption[]>([]);
  const [pricePerHousehold, setPricePerHousehold] = useState(70);
  const [defaultDiscountRate, setDefaultDiscountRate] = useState(28);
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

  const setStatusFilter = useCallback((v: StatusFilter) => { _setStatusFilter(v); setPage(1); }, [setPage]);
  const setCategoryFilter = useCallback((v: string | null) => { _setCategoryFilter(v); setPage(1); }, [setPage]);
  const setSubCategoryFilter = useCallback((v: string | null) => { _setSubCategoryFilter(v); setPage(1); }, [setPage]);
  const setSearchTerm = useCallback((v: string) => { _setSearchTerm(v); setPage(1); }, [setPage]);
  const setApartmentFilter = useCallback((v: string | null) => { _setApartmentFilter(v); setPage(1); }, [setPage]);

  const [allCategoriesWithSubs, setAllCategoriesWithSubs] = useState<AdCategoryWithSubs[]>([]);
  const [selectedAd, setSelectedAd] = useState<AdApplication | null>(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [freeMonths, setFreeMonths] = useState(0);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [discountRate, setDiscountRate] = useState(0);
  const [discountNote, setDiscountNote] = useState('');
  const [adminMemo, setAdminMemo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [grantAnalytics, setGrantAnalytics] = useState(false);
  const [approveCategory, setApproveCategory] = useState<string | null>(null);
  const [approveSubCategoryIds, setApproveSubCategoryIds] = useState<string[]>([]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('ad_categories_v2')
      .select('id, categoryName, ad_sub_categories_v2(id, subCategoryName, isActive, orderIndex)')
      .order('categoryName');
    setCategories(((data ?? []) as any[]).map((c: any) => ({ id: c.id, categoryName: c.categoryName })));
    setAllCategoriesWithSubs(
      ((data ?? []) as any[]).map((cat: any) => ({
        id: cat.id,
        categoryName: cat.categoryName,
        subCategories: ((cat.ad_sub_categories_v2 ?? []) as any[])
          .filter((s: any) => s.isActive !== false)
          .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((s: any) => ({ id: s.id, subCategoryName: s.subCategoryName })),
      }))
    );
  }, [supabase]);

  const fetchPricing = useCallback(async () => {
    const { data } = await supabase
      .from('ad_pricing_v2')
      .select('pricePerHousehold, defaultDiscountRate')
      .order('effectiveFrom', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setPricePerHousehold((data as any).pricePerHousehold ?? 70);
      setDefaultDiscountRate((data as any).defaultDiscountRate ?? 28);
    }
  }, [supabase]);

  const fetchApartments = useCallback(async () => {
    const { data } = await supabase
      .from('apartments')
      .select('id, name')
      .order('name');
    setAllApartments((data ?? []) as ApartmentOption[]);
  }, [supabase]);

  const fetchSubCategories = useCallback(async (categoryId: string) => {
    const { data } = await supabase
      .from('ad_sub_categories_v2')
      .select('id, subCategoryName')
      .eq('categoryId', categoryId)
      .order('orderIndex', { ascending: true });
    setSubCategories((data as SubCategory[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
    fetchPricing();
    fetchApartments();
  }, [fetchCategories, fetchPricing, fetchApartments]);

  useEffect(() => {
    if (categoryFilter) {
      fetchSubCategories(categoryFilter);
    } else {
      setSubCategories([]);
    }
    _setSubCategoryFilter(null);
  }, [categoryFilter, fetchSubCategories]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('advertisements_v2')
        .select(`
          id,
          categoryId,
          title,
          content,
          adStatus,
          paymentStatus,
          modificationStatus,
          submittedAt,
          activatedAt,
          freeMonths,
          isFirstAdApplication,
          approvedMonthlyAmount,
          approvedDiscountRate,
          partner_users:partnerId(id, businessName, displayPhoneNumber, hasHadRunningAd, analyticsEnabled),
          ad_categories_v2:categoryId(categoryName),
          advertisement_sub_categories_v2(subCategoryId, ad_sub_categories_v2(subCategoryName)),
          advertisement_apartments_v2(
            apartmentId,
            totalHouseholds,
            apartments:apartmentId(name)
          )
        `)
        .order('submittedAt', { ascending: false });

      if (error) throw error;

      const adIds = (data ?? []).map((r: any) => r.id as string);

      const { data: analyticsRows } = adIds.length > 0
        ? await supabase
            .from('ad_analytics_v2')
            .select('baseAdId, impressionCount, homeImpressionCount, clickCount')
            .in('baseAdId', adIds)
        : { data: [] };

      // baseAdId별 누적 집계
      const analyticsMap = (analyticsRows ?? []).reduce<Record<string, { impressions: number; clicks: number }>>(
        (acc, r: any) => {
          const key = r.baseAdId as string;
          if (!acc[key]) acc[key] = { impressions: 0, clicks: 0 };
          acc[key].impressions += (r.homeImpressionCount ?? 0) + (r.impressionCount ?? 0);
          acc[key].clicks += (r.clickCount ?? 0);
          return acc;
        },
        {}
      );

      const mapped: AdApplication[] = (data ?? []).map((row: any) => ({
        id: row.id,
        categoryId: row.categoryId ?? null,
        title: row.title,
        content: row.content,
        adStatus: row.adStatus,
        paymentStatus: row.paymentStatus,
        modificationStatus: row.modificationStatus ?? null,
        submittedAt: row.submittedAt,
        activatedAt: row.activatedAt ?? null,
        freeMonths: row.freeMonths,
        isFirstAdApplication: row.isFirstAdApplication ?? false,
        approvedMonthlyAmount: row.approvedMonthlyAmount ?? null,
        approvedDiscountRate: row.approvedDiscountRate ?? null,
        partner_users: row.partner_users,
        ad_categories_v2: row.ad_categories_v2,
        subCategoryNames: (row.advertisement_sub_categories_v2 ?? []).map(
          (sc: any) => sc.ad_sub_categories_v2?.subCategoryName ?? ''
        ).filter(Boolean),
        subCategoryIds: (row.advertisement_sub_categories_v2 ?? []).map(
          (sc: any) => sc.subCategoryId ?? ''
        ).filter(Boolean),
        apartments: (row.advertisement_apartments_v2 ?? []).map((apt: any) => ({
          apartmentId: apt.apartmentId,
          apartmentName: apt.apartments?.name ?? '-',
          totalHouseholds: apt.totalHouseholds,
        })),
        totalImpressions: analyticsMap[row.id]?.impressions ?? 0,
        totalClicks: analyticsMap[row.id]?.clicks ?? 0,
      }));

      setApplications(mapped);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // 아파트 필터 적용 후 목록 (상태별 개수도 이 기준으로 계산)
  const apartmentFilteredApplications = useMemo(() => {
    if (!apartmentFilter) return applications;
    return applications.filter((a) =>
      a.apartments.some((apt) => apt.apartmentId === apartmentFilter)
    );
  }, [applications, apartmentFilter]);

  // 상태 필터 적용 후 목록
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return apartmentFilteredApplications;
    if (statusFilter === 'free_running') return apartmentFilteredApplications.filter((a) => a.adStatus === 'running' && a.freeMonths > 0);
    if (statusFilter === 'paid_running') return apartmentFilteredApplications.filter((a) => a.adStatus === 'running' && a.freeMonths === 0);
    if (statusFilter === 'pending') return apartmentFilteredApplications.filter((a) => a.adStatus === 'pending');
    if (statusFilter === 'modification') return apartmentFilteredApplications.filter((a) => a.modificationStatus === 'pending');
    if (statusFilter === 'ended') return apartmentFilteredApplications.filter((a) => a.adStatus === 'ended');
    if (statusFilter === 'rejected') return apartmentFilteredApplications.filter((a) => a.adStatus === 'rejected');
    return apartmentFilteredApplications;
  }, [apartmentFilteredApplications, statusFilter]);

  // 상태별 개수 (아파트 필터 적용 기준)
  const statusCounts = useMemo<Record<StatusFilter, number>>(() => ({
    all: apartmentFilteredApplications.length,
    free_running: apartmentFilteredApplications.filter((a) => a.adStatus === 'running' && a.freeMonths > 0).length,
    paid_running: apartmentFilteredApplications.filter((a) => a.adStatus === 'running' && a.freeMonths === 0).length,
    pending: apartmentFilteredApplications.filter((a) => a.adStatus === 'pending').length,
    modification: apartmentFilteredApplications.filter((a) => a.modificationStatus === 'pending').length,
    ended: apartmentFilteredApplications.filter((a) => a.adStatus === 'ended').length,
    rejected: apartmentFilteredApplications.filter((a) => a.adStatus === 'rejected').length,
  }), [apartmentFilteredApplications]);

  // 카테고리별 개수 (상태 필터 후 기준)
  const categoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const app of statusFiltered) {
      const catId = categories.find(
        (c) => c.categoryName === app.ad_categories_v2?.categoryName
      )?.id;
      if (catId) counts[catId] = (counts[catId] ?? 0) + 1;
    }
    return counts;
  }, [statusFiltered, categories]);

  // 전체 클라이언트 필터 (상태 → 카테고리 → 서브카테고리 → 아파트 → 검색)
  const filtered = useMemo(() => {
    let result = statusFiltered;

    if (categoryFilter) {
      result = result.filter((a) => {
        const catId = categories.find(
          (c) => c.categoryName === a.ad_categories_v2?.categoryName
        )?.id;
        return catId === categoryFilter;
      });
    }

    if (subCategoryFilter) {
      result = result.filter((a) => a.subCategoryIds.includes(subCategoryFilter));
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.partner_users?.businessName?.toLowerCase().includes(term) ||
          a.title?.toLowerCase().includes(term) ||
          a.content?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [statusFiltered, categoryFilter, subCategoryFilter, debouncedSearchTerm, categories]);


  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedApplications = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const handleRowClick = (id: string): void => {
    router.push(`/admin/advertising-v2/applications/${id}`);
  };

  const handleApproveCategoryChange = useCallback((categoryId: string) => {
    setApproveCategory(categoryId);
    setApproveSubCategoryIds([]);
  }, []);

  const handleOpenApprove = useCallback((ad: AdApplication) => {
    const isFirstAd = ad.isFirstAdApplication && !ad.partner_users?.hasHadRunningAd;
    setSelectedAd(ad);
    setFreeMonths(isFirstAd ? 1 : 0);
    setOverrideEnabled(false);
    setDiscountRate(isFirstAd ? defaultDiscountRate : 0);
    setDiscountNote('');
    setAdminMemo('');
    setGrantAnalytics(ad.partner_users?.analyticsEnabled ?? false);
    setApproveCategory(ad.categoryId);
    setApproveSubCategoryIds(ad.subCategoryIds);
    setApproveDialog(true);
  }, [defaultDiscountRate]);

  const handleApprove = useCallback(async () => {
    if (!selectedAd) return;
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${selectedAd.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeMonths, discountRate, overrideEnabled, discountNote, adminMemo, categoryId: approveCategory, subCategoryIds: approveSubCategoryIds }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve');
      }
      if (grantAnalytics && !selectedAd.partner_users?.analyticsEnabled && selectedAd.partner_users?.id) {
        await (supabase as any)
          .from('partner_users')
          .update({ analyticsEnabled: true })
          .eq('id', selectedAd.partner_users.id);
      }
      toast.success('광고 신청이 승인되었습니다.');
      setApproveDialog(false);
      fetchApplications();
    } catch (err) {
      console.error('Failed to approve:', err);
      toast.error('광고 승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [selectedAd, freeMonths, discountRate, overrideEnabled, discountNote, adminMemo, approveCategory, approveSubCategoryIds, grantAnalytics, supabase, fetchApplications]);

  const handleOpenReject = useCallback((ad: AdApplication) => {
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
      const response = await fetch(
        `/api/advertising-v2/applications/${selectedAd.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectReason: rejectReason.trim() }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to reject');
      }
      toast.success('광고 신청이 거절되었습니다.');
      setRejectDialog(false);
      fetchApplications();
    } catch (err) {
      console.error('Failed to reject:', err);
      toast.error('광고 거절에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [selectedAd, rejectReason, fetchApplications]);

  return {
    applications,
    loading,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    subCategoryFilter,
    setSubCategoryFilter,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    categories,
    subCategories,
    allApartments,
    pricePerHousehold,
    statusCounts,
    categoryCounts,
    paginatedApplications,
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
    freeMonths,
    setFreeMonths,
    overrideEnabled,
    setOverrideEnabled,
    discountRate,
    setDiscountRate,
    discountNote,
    setDiscountNote,
    adminMemo,
    setAdminMemo,
    rejectReason,
    setRejectReason,
    processing,
    handleOpenApprove,
    handleApprove,
    handleOpenReject,
    handleReject,
    grantAnalytics,
    setGrantAnalytics,
    allCategoriesWithSubs,
    approveCategory,
    handleApproveCategoryChange,
    approveSubCategoryIds,
    setApproveSubCategoryIds,
  };
}
