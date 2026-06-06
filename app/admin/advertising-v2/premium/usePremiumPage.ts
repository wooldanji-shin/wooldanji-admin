'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { PremiumStatus } from '@/components/status-badge';
import type { ApartmentOption } from '@/components/apartment-combobox';
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
  cumulativeAmount: number | null;
  modificationStatus: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  partnerBusinessName?: string;
  partnerAnalyticsEnabled: boolean;
  apartmentIds: string[];
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
  setApartmentFilter: (v: string | null) => void;
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
  grantAnalytics: boolean;
  setGrantAnalytics: (v: boolean) => void;
}

export function usePremiumPage(): UsePremiumPageReturn {
  const router = useRouter();
  const [ads, setAds] = useState<PremiumAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PremiumStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);
  const [apartmentFilter, setApartmentFilter] = useState<string | null>(null);
  const [allApartments, setAllApartments] = useState<ApartmentOption[]>([]);
  const [page, setPage] = useState(1);
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
          'id, "partnerId", "baseAdId", title, weeks, status, "paymentStatus", "totalAmount", "approvedDiscountRate", "discountedTotalAmount", "modificationStatus", "startedAt", "endedAt", "createdAt"'
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

      const mapped: PremiumAd[] = adsData.map((row: any) => ({
        ...row,
        partnerBusinessName: partnerMap[row.partnerId]?.businessName ?? '-',
        partnerAnalyticsEnabled: partnerMap[row.partnerId]?.analyticsEnabled ?? false,
        cumulativeAmount: cumulativeAmountMap[row.id] ?? null,
        apartmentIds: baseAdApartmentMap[row.baseAdId] ?? [],
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

  const statusCounts = useMemo<Record<PremiumStatus | 'all', number>>(() => {
    const counts: Record<string, number> = { all: ads.length };
    for (const ad of ads) {
      if (ad.status === 'running' && ad.modificationStatus === 'pending') {
        counts['modification_pending'] = (counts['modification_pending'] ?? 0) + 1;
      } else {
        counts[ad.status] = (counts[ad.status] ?? 0) + 1;
      }
    }
    return counts as Record<PremiumStatus | 'all', number>;
  }, [ads]);

  const filtered = useMemo(() => {
    let result =
      statusFilter === 'all'
        ? ads
        : statusFilter === 'modification_pending'
          ? ads.filter((ad) => ad.status === 'running' && ad.modificationStatus === 'pending')
          : ads.filter((ad) => ad.status === statusFilter);

    if (apartmentFilter) {
      result = result.filter((ad) => ad.apartmentIds.includes(apartmentFilter));
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
  }, [ads, statusFilter, apartmentFilter, debouncedSearchTerm]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, apartmentFilter, debouncedSearchTerm]);

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
    grantAnalytics,
    setGrantAnalytics,
  };
}
