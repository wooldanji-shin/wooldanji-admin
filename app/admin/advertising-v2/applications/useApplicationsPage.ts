'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setAutoApproveModification } from '@/lib/ads/auto-approve';
import { calcMonthlyAmount } from '@/lib/ads/pricing';
import { exportToCsv } from '@/lib/utils/csv';
import type { ApartmentOption } from '@/components/apartment-combobox';
import { useDebounce } from '@/hooks/use-debounce';
import { useBizCallDuplicate } from '@/hooks/use-biz-call-duplicate';
import { BIZ_CALL_DUPLICATE_MESSAGE } from '@/lib/biz-call';
import { SALES_REP_UNASSIGNED } from '@/components/sales-rep-filter';
import { toast } from 'sonner';

export type AdStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'ended' | 'draft';
export type ModificationStatus = 'pending' | 'approved' | 'rejected' | null;
export type PaymentStatus = 'unpaid' | 'paid';
export type StatusFilter = 'all' | 'free_running' | 'paid_running' | 'unpaid' | 'pending' | 'modification' | 'ended' | 'rejected' | 'hidden';
/** 비즈콜(안심번호) 부여 여부 필터 */
export type BizCallFilter = 'all' | 'used' | 'unused';

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
  imageUrls: string[];
  adStatus: AdStatus;
  paymentStatus: PaymentStatus;
  modificationStatus: ModificationStatus;
  autoApproveModification: boolean;
  /** 숨김 처리한 광고 — 테스트·더미 분리용. 관리자 목록에는 그대로 남고 사용자 앱 노출에서만 빠진다 */
  isHidden: boolean;
  submittedAt: string | null;
  activatedAt: string | null;
  freeMonths: number;
  isFirstAdApplication: boolean;
  categoryId: string | null;
  approvedMonthlyAmount: number | null;
  approvedDiscountRate: number | null;
  salesRepId: string | null;
  salesRepName: string | null;
  partner_users: {
    id: string;
    businessName: string;
    displayPhoneNumber: string | null;
    /** 관리자가 부여한 비즈콜(안심) 번호. 있으면 앱에서 displayPhoneNumber 대신 노출 */
    bizCallNumber: string | null;
    hasHadRunningAd: boolean;
    analyticsEnabled: boolean;
  } | null;
  ad_categories_v2: {
    categoryName: string;
  } | null;
  subCategoryIds: string[];
  apartments: ApartmentSummary[];
  totalImpressions: number;
  totalClicks: number;
  totalPhoneClicks: number;
  /** 다음 정기결제일 — 현재 결제 주기가 끝나는 날 */
  nextBillingDate: string | null;
  /** 무료체험 종료일 */
  freeEndDate: string | null;
  /** 구독 상태 — cancel_pending이면 파트너가 광고 중단을 신청한 상태 */
  subscriptionStatus: string | null;
}

const PAGE_SIZE = 20;

/** 목록 '구분' 컬럼 라벨 — 중단예정이 첫광고보다 우선 */
export function adDivisionLabel(ad: AdApplication): string {
  if (ad.subscriptionStatus === 'cancel_pending') return '중단예정';
  if (ad.isFirstAdApplication) return '첫광고';
  return '-';
}

/** 관리자가 비즈콜(안심번호)을 부여한 광고인지 */
function hasBizCall(ad: AdApplication): boolean {
  return (ad.partner_users?.bizCallNumber ?? '').trim() !== '';
}

/** 승인은 났지만 아직 첫 결제가 이뤄지지 않은 광고 */
function isUnpaidApproved(ad: AdApplication): boolean {
  return ad.adStatus === 'approved' && ad.paymentStatus === 'unpaid';
}

/**
 * 목록에 표시되는 월 광고료.
 * approvedMonthlyAmount가 있으면 그것이 확정 금액이고, 없으면 세대수 × 단가에 할인율을 적용한다.
 */
function monthlyAmountOf(ad: AdApplication, pricePerHousehold: number): number {
  if (ad.approvedMonthlyAmount !== null) return ad.approvedMonthlyAmount;
  const totalHouseholds = ad.apartments.reduce((sum, a) => sum + a.totalHouseholds, 0);
  return calcMonthlyAmount(totalHouseholds, pricePerHousehold, ad.approvedDiscountRate ?? 0);
}

const AD_STATUS_LABEL: Record<AdStatus, string> = {
  pending: '승인대기',
  approved: '승인됨',
  rejected: '거절됨',
  running: '진행중',
  ended: '종료',
  draft: '임시저장',
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: '결제완료',
  unpaid: '미결제',
};

function toDateText(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('ko-KR') : '-';
}

export interface UseApplicationsPageReturn {
  applications: AdApplication[];
  loading: boolean;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  subCategoryFilter: string | null;
  setSubCategoryFilter: (id: string | null) => void;
  bizCallFilter: BizCallFilter;
  setBizCallFilter: (v: BizCallFilter) => void;
  bizCallCounts: Record<BizCallFilter, number>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  apartmentFilter: string | null;
  setApartmentFilter: (id: string | null) => void;
  salesRepFilter: string | null;
  setSalesRepFilter: (id: string | null) => void;
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
  /** 현재 필터 결과의 월 광고료 합계 */
  totalMonthlyAmount: number;
  handleExportCsv: () => void;
  handleToggleHidden: (ad: AdApplication, next: boolean) => Promise<void>;
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
  bizCallNumber: string;
  setBizCallNumber: (v: string) => void;
  /** 같은 비즈콜을 이미 쓰는 다른 파트너의 상호명 (중복 없으면 null) */
  bizCallDuplicateName: string | null;
  salesRepId: string | null;
  setSalesRepId: (v: string | null) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  processing: boolean;
  handleOpenApprove: (ad: AdApplication) => void;
  handleApprove: () => Promise<void>;
  handleOpenReject: (ad: AdApplication) => void;
  handleReject: () => Promise<void>;
  handleToggleAutoApprove: (ad: AdApplication, next: boolean) => Promise<void>;
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
  const [bizCallFilter, _setBizCallFilter] = useState<BizCallFilter>('all');
  const [searchTerm, _setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);
  const [apartmentFilter, _setApartmentFilter] = useState<string | null>(null);
  const [salesRepFilter, _setSalesRepFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<AdCategory[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [allApartments, setAllApartments] = useState<ApartmentOption[]>([]);
  const [pricePerHousehold, setPricePerHousehold] = useState(70);
  const [defaultDiscountRate, setDefaultDiscountRate] = useState(28);
  const [defaultFreeMonths, setDefaultFreeMonths] = useState(1);
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
  const setBizCallFilter = useCallback((v: BizCallFilter) => { _setBizCallFilter(v); setPage(1); }, [setPage]);
  const setSearchTerm = useCallback((v: string) => { _setSearchTerm(v); setPage(1); }, [setPage]);
  const setApartmentFilter = useCallback((v: string | null) => { _setApartmentFilter(v); setPage(1); }, [setPage]);
  const setSalesRepFilter = useCallback((v: string | null) => { _setSalesRepFilter(v); setPage(1); }, [setPage]);

  const [allCategoriesWithSubs, setAllCategoriesWithSubs] = useState<AdCategoryWithSubs[]>([]);
  const [selectedAd, setSelectedAd] = useState<AdApplication | null>(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [freeMonths, setFreeMonths] = useState(0);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [discountRate, setDiscountRate] = useState(0);
  const [discountNote, setDiscountNote] = useState('');
  const [adminMemo, setAdminMemo] = useState('');
  const [bizCallNumber, setBizCallNumber] = useState('');
  const [salesRepId, setSalesRepId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [grantAnalytics, setGrantAnalytics] = useState(false);
  const [approveCategory, setApproveCategory] = useState<string | null>(null);
  const [approveSubCategoryIds, setApproveSubCategoryIds] = useState<string[]>([]);

  const bizCallDuplicateName = useBizCallDuplicate(
    bizCallNumber,
    selectedAd?.partner_users?.id ?? null
  );

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
      .select('pricePerHousehold, defaultDiscountRate, defaultFreeMonths')
      .order('effectiveFrom', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setPricePerHousehold((data as any).pricePerHousehold ?? 70);
      setDefaultDiscountRate((data as any).defaultDiscountRate ?? 28);
      setDefaultFreeMonths((data as any).defaultFreeMonths ?? 1);
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
          imageUrls,
          adStatus,
          paymentStatus,
          modificationStatus,
          autoApproveModification,
          isHidden,
          submittedAt,
          activatedAt,
          freeMonths,
          isFirstAdApplication,
          approvedMonthlyAmount,
          approvedDiscountRate,
          salesRepId,
          sales_reps:salesRepId(name),
          partner_users:partnerId(id, businessName, displayPhoneNumber, bizCallNumber, hasHadRunningAd, analyticsEnabled),
          ad_categories_v2:categoryId(categoryName),
          advertisement_sub_categories_v2(subCategoryId),
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
            .select('baseAdId, impressionCount, homeImpressionCount, clickCount, phoneClickCount')
            .in('baseAdId', adIds)
        : { data: [] };

      const { data: subscriptionRows } = adIds.length > 0
        ? await supabase
            .from('ad_subscriptions_v2')
            .select('advertisementId, nextBillingDate, freeEndDate, subscriptionStatus, createdAt')
            .in('advertisementId', adIds)
            .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending'])
            .order('createdAt', { ascending: false })
        : { data: [] };

      // 광고당 가장 최근 구독 1건만 남긴다 (createdAt 내림차순이라 먼저 온 것이 최신)
      const subscriptionMap = (subscriptionRows ?? []).reduce<
        Record<
          string,
          { nextBillingDate: string | null; freeEndDate: string | null; subscriptionStatus: string | null }
        >
      >((acc, r: any) => {
        const key = r.advertisementId as string;
        if (!acc[key]) {
          acc[key] = {
            nextBillingDate: (r.nextBillingDate as string | null) ?? null,
            freeEndDate: (r.freeEndDate as string | null) ?? null,
            subscriptionStatus: (r.subscriptionStatus as string | null) ?? null,
          };
        }
        return acc;
      }, {});

      // baseAdId별 누적 집계
      const analyticsMap = (analyticsRows ?? []).reduce<Record<string, { impressions: number; clicks: number; phoneClicks: number }>>(
        (acc, r: any) => {
          const key = r.baseAdId as string;
          if (!acc[key]) acc[key] = { impressions: 0, clicks: 0, phoneClicks: 0 };
          acc[key].impressions += (r.homeImpressionCount ?? 0) + (r.impressionCount ?? 0);
          acc[key].clicks += (r.clickCount ?? 0);
          acc[key].phoneClicks += (r.phoneClickCount ?? 0);
          return acc;
        },
        {}
      );

      const mapped: AdApplication[] = (data ?? []).map((row: any) => ({
        id: row.id,
        categoryId: row.categoryId ?? null,
        title: row.title,
        content: row.content,
        imageUrls: (row.imageUrls ?? []) as string[],
        adStatus: row.adStatus,
        paymentStatus: row.paymentStatus,
        modificationStatus: row.modificationStatus ?? null,
        autoApproveModification: row.autoApproveModification ?? false,
        isHidden: row.isHidden ?? false,
        submittedAt: row.submittedAt,
        activatedAt: row.activatedAt ?? null,
        freeMonths: row.freeMonths,
        isFirstAdApplication: row.isFirstAdApplication ?? false,
        approvedMonthlyAmount: row.approvedMonthlyAmount ?? null,
        approvedDiscountRate: row.approvedDiscountRate ?? null,
        salesRepId: row.salesRepId ?? null,
        salesRepName: row.sales_reps?.name ?? null,
        partner_users: row.partner_users,
        ad_categories_v2: row.ad_categories_v2,
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
        totalPhoneClicks: analyticsMap[row.id]?.phoneClicks ?? 0,
        nextBillingDate: subscriptionMap[row.id]?.nextBillingDate ?? null,
        freeEndDate: subscriptionMap[row.id]?.freeEndDate ?? null,
        subscriptionStatus: subscriptionMap[row.id]?.subscriptionStatus ?? null,
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

  // 아파트·영업담당자 필터는 상태 카운트에도 반영돼야 하므로 상태 필터보다 먼저 적용한다
  const applyScopeFilters = useCallback((list: AdApplication[]): AdApplication[] => {
    let result = list;

    if (apartmentFilter) {
      result = result.filter((a) =>
        a.apartments.some((apt) => apt.apartmentId === apartmentFilter)
      );
    }

    if (salesRepFilter === SALES_REP_UNASSIGNED) {
      result = result.filter((a) => a.salesRepId === null);
    } else if (salesRepFilter) {
      result = result.filter((a) => a.salesRepId === salesRepFilter);
    }

    return result;
  }, [apartmentFilter, salesRepFilter]);

  const apartmentFilteredApplications = useMemo(
    () => applyScopeFilters(applications),
    [applications, applyScopeFilters]
  );

  // 숨긴 광고는 '숨김' 탭에서만 보인다
  const hiddenApplications = useMemo(
    () => apartmentFilteredApplications.filter((a) => a.isHidden),
    [apartmentFilteredApplications]
  );

  // '숨김'을 뺀 나머지 탭이 공통으로 쓰는 목록
  const visibleApplications = useMemo(
    () => apartmentFilteredApplications.filter((a) => !a.isHidden),
    [apartmentFilteredApplications]
  );

  // 상태 필터 적용 후 목록
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'hidden') return hiddenApplications;
    if (statusFilter === 'all') return visibleApplications;
    if (statusFilter === 'free_running') return visibleApplications.filter((a) => a.adStatus === 'running' && a.freeMonths > 0);
    if (statusFilter === 'paid_running') return visibleApplications.filter((a) => a.adStatus === 'running' && a.freeMonths === 0);
    if (statusFilter === 'unpaid') return visibleApplications.filter(isUnpaidApproved);
    if (statusFilter === 'pending') return visibleApplications.filter((a) => a.adStatus === 'pending');
    if (statusFilter === 'modification') return visibleApplications.filter((a) => a.modificationStatus === 'pending');
    if (statusFilter === 'ended') return visibleApplications.filter((a) => a.adStatus === 'ended');
    if (statusFilter === 'rejected') return visibleApplications.filter((a) => a.adStatus === 'rejected');
    return visibleApplications;
  }, [visibleApplications, hiddenApplications, statusFilter]);

  // 상태별 개수 (아파트 필터 적용 기준 · 숨김 제외)
  const statusCounts = useMemo<Record<StatusFilter, number>>(() => ({
    all: visibleApplications.length,
    free_running: visibleApplications.filter((a) => a.adStatus === 'running' && a.freeMonths > 0).length,
    paid_running: visibleApplications.filter((a) => a.adStatus === 'running' && a.freeMonths === 0).length,
    unpaid: visibleApplications.filter(isUnpaidApproved).length,
    pending: visibleApplications.filter((a) => a.adStatus === 'pending').length,
    modification: visibleApplications.filter((a) => a.modificationStatus === 'pending').length,
    ended: visibleApplications.filter((a) => a.adStatus === 'ended').length,
    rejected: visibleApplications.filter((a) => a.adStatus === 'rejected').length,
    hidden: hiddenApplications.length,
  }), [visibleApplications, hiddenApplications]);

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

  const bizCallCounts = useMemo<Record<BizCallFilter, number>>(() => {
    const used = statusFiltered.filter(hasBizCall).length;
    return { all: statusFiltered.length, used, unused: statusFiltered.length - used };
  }, [statusFiltered]);

  // 전체 클라이언트 필터 (상태 → 카테고리 → 서브카테고리 → 비즈콜 → 검색)
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

    if (bizCallFilter !== 'all') {
      const want = bizCallFilter === 'used';
      result = result.filter((a) => hasBizCall(a) === want);
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
  }, [statusFiltered, categoryFilter, subCategoryFilter, bizCallFilter, debouncedSearchTerm, categories]);


  // 필터를 바꾸면 같이 바뀌는 월 광고료 합계
  const totalMonthlyAmount = useMemo(
    () => filtered.reduce((sum, a) => sum + monthlyAmountOf(a, pricePerHousehold), 0),
    [filtered, pricePerHousehold]
  );

  const handleExportCsv = useCallback(() => {
    if (filtered.length === 0) {
      toast.error('내보낼 광고가 없습니다.');
      return;
    }

    exportToCsv(`기본광고_${new Date().toLocaleDateString('sv-SE')}.csv`, filtered, [
      { header: '상호명', accessor: (a) => a.partner_users?.businessName ?? '-' },
      { header: '광고 제목', accessor: (a) => a.title ?? '-' },
      { header: '카테고리', accessor: (a) => a.ad_categories_v2?.categoryName ?? '-' },
      { header: '구분', accessor: (a) => adDivisionLabel(a) },
      { header: '광고 상태', accessor: (a) => AD_STATUS_LABEL[a.adStatus] ?? a.adStatus },
      { header: '결제 상태', accessor: (a) => PAYMENT_STATUS_LABEL[a.paymentStatus] ?? a.paymentStatus },
      { header: '아파트 수', accessor: (a) => a.apartments.length },
      { header: '총 세대수', accessor: (a) => a.apartments.reduce((s, apt) => s + apt.totalHouseholds, 0) },
      { header: '월 금액', accessor: (a) => monthlyAmountOf(a, pricePerHousehold) },
      { header: '할인율(%)', accessor: (a) => a.approvedDiscountRate ?? 0 },
      { header: '무료 개월', accessor: (a) => a.freeMonths },
      { header: '광고 시작일', accessor: (a) => toDateText(a.activatedAt) },
      { header: '광고 종료일', accessor: (a) => toDateText(a.nextBillingDate) },
      { header: '무료체험 종료일', accessor: (a) => toDateText(a.freeEndDate) },
      { header: '영업 담당자', accessor: (a) => a.salesRepName ?? '-' },
      { header: '비즈콜 번호', accessor: (a) => a.partner_users?.bizCallNumber ?? '-' },
      { header: '노출수', accessor: (a) => a.totalImpressions },
      { header: '클릭수', accessor: (a) => a.totalClicks },
      { header: '전화클릭수', accessor: (a) => a.totalPhoneClicks },
    ]);
  }, [filtered, pricePerHousehold]);

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
    setFreeMonths(isFirstAd ? defaultFreeMonths : 0);
    setOverrideEnabled(false);
    setDiscountRate(isFirstAd ? defaultDiscountRate : 0);
    setDiscountNote('');
    setAdminMemo('');
    // 이미 부여된 비즈콜이 있으면 그대로 노출 (재승인 시 실수로 지워지는 것 방지)
    setBizCallNumber(ad.partner_users?.bizCallNumber ?? '');
    setSalesRepId(ad.salesRepId ?? null);
    setGrantAnalytics(ad.partner_users?.analyticsEnabled ?? false);
    setApproveCategory(ad.categoryId);
    setApproveSubCategoryIds(ad.subCategoryIds);
    setApproveDialog(true);
  }, [defaultDiscountRate, defaultFreeMonths]);

  const handleApprove = useCallback(async () => {
    if (!selectedAd) return;
    if (bizCallDuplicateName) {
      toast.error(`${BIZ_CALL_DUPLICATE_MESSAGE} (${bizCallDuplicateName})`);
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${selectedAd.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeMonths, discountRate, overrideEnabled, discountNote, adminMemo, bizCallNumber, salesRepId, categoryId: approveCategory, subCategoryIds: approveSubCategoryIds }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        // 비즈콜 중복(409)은 관리자가 바로 고칠 수 있도록 서버 메시지를 그대로 보여준다
        if (response.status === 409) {
          toast.error(err.error);
          return;
        }
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
  }, [selectedAd, freeMonths, discountRate, overrideEnabled, discountNote, adminMemo, bizCallNumber, bizCallDuplicateName, salesRepId, approveCategory, approveSubCategoryIds, grantAnalytics, supabase, fetchApplications]);

  const handleToggleAutoApprove = useCallback(async (ad: AdApplication, next: boolean) => {
    const ok = await setAutoApproveModification(supabase, 'advertisements_v2', ad.id, next);
    if (!ok) return;
    setApplications((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, autoApproveModification: next } : a))
    );
  }, [supabase]);

  const handleToggleHidden = useCallback(async (ad: AdApplication, next: boolean) => {
    const { error } = await (supabase as any)
      .from('advertisements_v2')
      .update({ isHidden: next })
      .eq('id', ad.id);

    if (error) {
      console.error('광고 숨김 설정 변경 실패:', error);
      toast.error('숨김 설정 변경에 실패했습니다.');
      return;
    }

    setApplications((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, isHidden: next } : a))
    );
    toast.success(next ? '앱 노출에서 숨겼습니다.' : '숨김을 해제했습니다.');
  }, [supabase]);

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
    bizCallFilter,
    setBizCallFilter,
    bizCallCounts,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    salesRepFilter,
    setSalesRepFilter,
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
    totalMonthlyAmount,
    handleExportCsv,
    handleToggleHidden,
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
    bizCallNumber,
    setBizCallNumber,
    bizCallDuplicateName,
    salesRepId,
    setSalesRepId,
    rejectReason,
    setRejectReason,
    processing,
    handleOpenApprove,
    handleApprove,
    handleOpenReject,
    handleReject,
    handleToggleAutoApprove,
    grantAnalytics,
    setGrantAnalytics,
    allCategoriesWithSubs,
    approveCategory,
    handleApproveCategoryChange,
    approveSubCategoryIds,
    setApproveSubCategoryIds,
  };
}
