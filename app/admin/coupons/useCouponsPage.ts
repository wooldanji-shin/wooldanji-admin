'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { confirmModal } from '@/components/confirm-modal';
import { useDebounce } from '@/hooks/use-debounce';
import { useApartmentLookup } from '@/lib/hooks/useLookups';
import type { ApartmentOption } from '@/components/apartment-combobox';

/** 한 페이지에 표시할 쿠폰 수 */
export const COUPONS_PAGE_SIZE = 20;

/** 상태 필터 — 표의 상태 배지와 같은 기준 */
export type CouponStatusFilter = 'all' | 'active' | 'expired' | 'inactive';
const COUPON_STATUS_FILTERS: CouponStatusFilter[] = ['all', 'active', 'expired', 'inactive'];

export interface CouponItem {
  id: string;
  title: string;
  description: string | null;
  discountType: 'percent' | 'fixed' | 'gift';
  discountValue: number | null;
  minAmount: number | null;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  partnerUserId: string | null;
  partnerBusinessName: string;
  // 파트너 회원이 탈퇴한 경우 (탈퇴 시 partnerUserId가 SET NULL 처리됨)
  isPartnerWithdrawn: boolean;
  downloadCount: number;
  // 최대 다운로드 수 (null = 무제한)
  maxDownloadCount: number | null;
  usageCount: number;
  // 파트너 직접 만료 시각 (파트너가 쿠폰을 직접 만료시킨 경우)
  expiredAt: string | null;
  // 파트너가 쿠폰을 만료시킨 사유
  expiredReason: string | null;
  // 파트너가 쿠폰을 수정한 사유
  updateReason: string | null;
}

/** 쿠폰은 광고가 아니라 파트너에 묶여 있어, 검색·아파트 필터는 파트너의 광고(종료 포함)로 판단한다 */
interface PartnerAdInfo {
  titles: string[];
  apartmentIds: Set<string>;
}

export interface UseCouponsPageReturn {
  coupons: CouponItem[];
  /** 매 조회마다 true가 되는 로딩 상태 */
  loading: boolean;
  /** 첫 진입 시에만 true — 재조회 중에는 기존 테이블을 유지하기 위해 구분 */
  initialLoading: boolean;
  page: number;
  pageSize: number;
  /** 필터 적용 후 건수 */
  totalCount: number;
  /** 필터 적용 전 전체 건수 */
  allCount: number;
  setPage: (page: number) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  apartmentFilter: string | null;
  setApartmentFilter: (v: string | null) => void;
  allApartments: ApartmentOption[];
  statusFilter: CouponStatusFilter;
  setStatusFilter: (v: CouponStatusFilter) => void;
  statusCounts: Record<CouponStatusFilter, number>;
  deleteCoupon: (id: string) => Promise<void>;
}

function couponStatus(c: CouponItem): Exclude<CouponStatusFilter, 'all'> {
  if (!c.isActive) return 'inactive';
  if (new Date(c.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function toCouponItem(row: any): CouponItem {
  const downloads = row.coupon_downloads as { count: number }[] | null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue,
    minAmount: row.minAmount,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    partnerUserId: row.partnerUserId,
    partnerBusinessName: row.partner_users?.businessName ?? '-',
    // 파트너 탈퇴 시 coupons.partnerUserId가 ON DELETE SET NULL로 비워짐
    isPartnerWithdrawn: row.partnerUserId === null,
    downloadCount: downloads?.[0]?.count ?? 0,
    maxDownloadCount: row.maxDownloadCount ?? null,
    usageCount: 0,
    expiredAt: row.expiredAt ?? null,
    expiredReason: row.expiredReason ?? null,
    updateReason: row.updateReason ?? null,
  };
}

function toPartnerAdMap(rows: any[]): Map<string, PartnerAdInfo> {
  const map = new Map<string, PartnerAdInfo>();
  for (const ad of rows) {
    const info = map.get(ad.partnerId) ?? { titles: [], apartmentIds: new Set<string>() };
    if (ad.title) info.titles.push(ad.title);
    for (const aa of (ad.advertisement_apartments_v2 ?? []) as { apartmentId: string }[]) {
      info.apartmentIds.add(aa.apartmentId);
    }
    map.set(ad.partnerId, info);
  }
  return map;
}

export function useCouponsPage(): UseCouponsPageReturn {
  const supabase = useMemo(() => createClient(), []);
  const allApartments = useApartmentLookup() as ApartmentOption[];
  const [allCoupons, setAllCoupons] = useState<CouponItem[]>([]);
  const [partnerAds, setPartnerAds] = useState<Map<string, PartnerAdInfo>>(new Map());
  const [usageMap, setUsageMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, _setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [apartmentFilter, _setApartmentFilter] = useState<string | null>(null);
  const [statusFilter, _setStatusFilter] = useState<CouponStatusFilter>('all');

  // 필터를 바꾸면 1페이지로 돌아간다
  const setSearchTerm = useCallback((v: string) => { _setSearchTerm(v); setPage(1); }, []);
  const setApartmentFilter = useCallback((v: string | null) => { _setApartmentFilter(v); setPage(1); }, []);
  const setStatusFilter = useCallback((v: CouponStatusFilter) => { _setStatusFilter(v); setPage(1); }, []);

  // 검색·필터를 위해 전체 쿠폰과 파트너 광고를 한 번에 받아 화면에서 거른다
  const fetchCoupons = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [couponRes, adRes] = await Promise.all([
        supabase
          .from('coupons')
          .select(
            `
            id, title, description, discountType, discountValue,
            minAmount, expiresAt, isActive, createdAt, partnerUserId,
            expiredAt, expiredReason, updateReason, maxDownloadCount,
            partner_users(businessName),
            coupon_downloads(count)
          `
          )
          .order('createdAt', { ascending: false }),
        (supabase as any)
          .from('advertisements_v2')
          .select('partnerId, title, advertisement_apartments_v2(apartmentId)'),
      ]);

      if (couponRes.error) throw couponRes.error;
      if (adRes.error) throw adRes.error;

      setAllCoupons((couponRes.data ?? []).map(toCouponItem));
      setPartnerAds(toPartnerAdMap(adRes.data ?? []));
    } catch (err) {
      console.error('[CouponsPage] 조회 실패:', err);
      toast.error('쿠폰 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // 상태 개수에도 반영되도록 검색·아파트 필터를 상태 필터보다 먼저 적용한다
  const bySearchAndApartment = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return allCoupons.filter((c) => {
      const ads = c.partnerUserId ? partnerAds.get(c.partnerUserId) : undefined;
      if (apartmentFilter && !ads?.apartmentIds.has(apartmentFilter)) return false;
      if (!term) return true;
      return (
        c.partnerBusinessName.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        (ads?.titles ?? []).some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [allCoupons, partnerAds, debouncedSearch, apartmentFilter]);

  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        COUPON_STATUS_FILTERS.map((f) => [
          f,
          f === 'all' ? bySearchAndApartment.length : bySearchAndApartment.filter((c) => couponStatus(c) === f).length,
        ])
      ) as Record<CouponStatusFilter, number>,
    [bySearchAndApartment]
  );

  const filtered = useMemo(
    () => (statusFilter === 'all' ? bySearchAndApartment : bySearchAndApartment.filter((c) => couponStatus(c) === statusFilter)),
    [bySearchAndApartment, statusFilter]
  );

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * COUPONS_PAGE_SIZE, page * COUPONS_PAGE_SIZE),
    [filtered, page]
  );
  const pageIdsKey = pageRows.map((c) => c.id).join(',');

  // 사용 수는 현재 페이지에 표시되는 쿠폰에 대해서만 별도 집계
  useEffect(() => {
    if (!pageIdsKey) return;
    let cancelled = false;
    (async () => {
      const { data: usageData } = await supabase
        .from('coupon_usages')
        .select('couponDownloadId, coupon_downloads!inner(couponId)')
        .in('coupon_downloads.couponId', pageIdsKey.split(','));
      if (cancelled) return;

      const next = new Map<string, number>();
      for (const u of usageData ?? []) {
        const couponId = (u as any).coupon_downloads?.couponId;
        if (couponId) next.set(couponId, (next.get(couponId) ?? 0) + 1);
      }
      setUsageMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, pageIdsKey]);

  const coupons = useMemo(
    () => pageRows.map((c) => ({ ...c, usageCount: usageMap.get(c.id) ?? 0 })),
    [pageRows, usageMap]
  );

  const deleteCoupon = useCallback(
    async (id: string): Promise<void> => {
      const confirmed = await confirmModal({
        title: '쿠폰 비활성화',
        message: '이 쿠폰을 비활성화하시겠습니까?\n이미 받은 유저의 쿠폰함에서 사라집니다.',
        confirmLabel: '비활성화',
        danger: true,
      });
      if (!confirmed) return;

      const { error } = await supabase
        .from('coupons')
        .update({ isActive: false })
        .eq('id', id);

      if (error) {
        toast.error('쿠폰 삭제에 실패했습니다.');
        return;
      }

      toast.success('쿠폰이 비활성화됐습니다.');
      // 비활성 쿠폰도 목록에 남으므로 다시 조회해 상태를 갱신
      await fetchCoupons();
    },
    [supabase, fetchCoupons]
  );

  return {
    coupons,
    loading,
    initialLoading,
    page,
    pageSize: COUPONS_PAGE_SIZE,
    totalCount: filtered.length,
    allCount: allCoupons.length,
    setPage,
    searchTerm,
    setSearchTerm,
    apartmentFilter,
    setApartmentFilter,
    allApartments,
    statusFilter,
    setStatusFilter,
    statusCounts,
    deleteCoupon,
  };
}
