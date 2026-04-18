'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface ApartmentInfo {
  apartmentId: string;
  apartmentName: string;
  address: string;
  totalHouseholds: number;
}

export interface PendingChanges {
  title?: string;
  content?: string | null;
  imageUrls?: string[];
  categoryId?: string;
  subCategoryIds?: string[];
  naverMapUrl?: string | null;
  blogUrl?: string | null;
  youtubeUrl?: string | null;
  instagramUrl?: string | null;
  kakaoOpenChatUrl?: string | null;
  apartments?: { apartmentId: string; totalHouseholds: number }[];
  // 비교용: 카테고리 이름 (훅에서 resolve)
  resolvedCategoryName?: string | null;
  resolvedSubCategoryNames?: string[];
  // 비교용: 아파트 상세 (훅에서 resolve)
  resolvedApartments?: ApartmentInfo[];
}

export interface AdApplicationDetail {
  id: string;
  adStatus: string;
  paymentStatus: string;
  freeMonths: number;
  submittedAt: string | null;
  title: string;
  content: string | null;
  imageUrls: string[];
  naverMapUrl: string | null;
  blogUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  kakaoOpenChatUrl: string | null;
  rejectReason: string | null;
  modificationStatus: string | null;
  modificationRejectedReason: string | null;
  pendingChanges: PendingChanges | null;
  partner: {
    businessName: string;
    displayPhoneNumber: string | null;
    representativeName: string | null;
  } | null;
  category: {
    categoryName: string;
  } | null;
  subCategoryNames: string[];
  apartments: ApartmentInfo[];
  pricePerHousehold: number;
  defaultDiscountRate: number;
  // 구독 정보 (running 상태일 때)
  freeEndDate: string | null;
  nextBillingDate: string | null;
  approvedDiscountRate: number | null;
  approvedMonthlyAmount: number | null;
  isFirstAd: boolean;
  // 아파트 변경 상태 (pending_payment | pending_next_cycle | null)
  apartmentChangeStatus: string | null;
  // 승인 시점에 고정된 차액 결제 금액 (일할 계산 완료, pending_payment 상태에서만 유효)
  pendingDiffAmount: number | null;
}

export interface UseApplicationDetailPageReturn {
  detail: AdApplicationDetail | null;
  loading: boolean;
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
  rejectReason: string;
  setRejectReason: (v: string) => void;
  processing: boolean;
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
  // 수정 심사
  modificationRejectDialog: boolean;
  setModificationRejectDialog: (open: boolean) => void;
  modificationRejectReason: string;
  setModificationRejectReason: (v: string) => void;
  handleApproveModification: () => Promise<void>;
  handleRejectModification: () => Promise<void>;
  totalHouseholds: number;
  monthlyAmount: number;
}

export function useApplicationDetailPage(
  params: Promise<{ id: string }>
): UseApplicationDetailPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [adId, setAdId] = useState<string>('');
  const [detail, setDetail] = useState<AdApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [freeMonths, setFreeMonths] = useState(0);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [discountRate, setDiscountRate] = useState(28);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [modificationRejectDialog, setModificationRejectDialog] = useState(false);
  const [modificationRejectReason, setModificationRejectReason] = useState('');

  useEffect(() => {
    params.then((p) => setAdId(p.id));
  }, [params]);

  const fetchDetail = useCallback(async () => {
    if (!adId) return;
    setLoading(true);

    try {
      const [adResult, pricingResult] = await Promise.all([
        supabase
          .from('advertisements_v2')
          .select(`
            id,
            partnerId,
            categoryId,
            adStatus,
            paymentStatus,
            freeMonths,
            approvedDiscountRate,
            approvedMonthlyAmount,
            submittedAt,
            isFirstAdApplication,
            title,
            content,
            imageUrls,
            naverMapUrl,
            blogUrl,
            youtubeUrl,
            instagramUrl,
            kakaoOpenChatUrl,
            rejectReason,
            modificationStatus,
            modificationRejectedReason,
            apartmentChangeStatus,
            pendingDiffAmount,
            pendingChanges,
            partner_users:partnerId(businessName, displayPhoneNumber, representativeName),
            ad_categories_v2:categoryId(categoryName),
            advertisement_sub_categories_v2(subCategoryId, ad_sub_categories_v2(subCategoryName)),
            advertisement_apartments_v2(
              apartmentId,
              totalHouseholds,
              apartments:apartmentId(name, address)
            )
          `)
          .eq('id', adId)
          .single(),
        supabase
          .from('ad_pricing_v2')
          .select('pricePerHousehold, defaultDiscountRate')
          .order('effectiveFrom', { ascending: false })
          .limit(1)
          .single(),
      ]);

      if (adResult.error) throw adResult.error;

      const row = adResult.data as any;
      const pricing = pricingResult.data as any;

      // Design Ref: §5.1 — isFirstAdApplication(광고 레벨) + hasHadRunningAd(파트너 레벨) 이중 체크
      // isFirstAdApplication: 제출 시점에 결정 (파트너당 1개만 true), 관리자 UX 가시성 기준
      // hasHadRunningAd: running 전환 시 설정, 어뷰징 방어용 fallback
      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('hasHadRunningAd')
        .eq('id', row.partnerId)
        .single();

      // isFirstAdApplication이 null이면(DB 컬럼 추가 전) hasHadRunningAd로 fallback
      const isFirstAd = (row.isFirstAdApplication !== null && row.isFirstAdApplication !== undefined)
        ? (row.isFirstAdApplication === true && !partnerData?.hasHadRunningAd)
        : !partnerData?.hasHadRunningAd;
      const effectiveDiscountRate = isFirstAd ? (pricing?.defaultDiscountRate ?? 28) : 0;

      // 활성 구독 정보 조회 (running 상태일 때 무료종료일, 다음결제일 표시용)
      const { data: subscription } = await supabase
        .from('ad_subscriptions_v2')
        .select('freeEndDate, nextBillingDate')
        .eq('advertisementId', adId)
        .eq('subscriptionStatus', 'active')
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      // pendingChanges 카테고리 이름 resolve (변경된 경우에만 조회)
      let pendingChanges: PendingChanges | null = null;
      if (row.pendingChanges) {
        const pc = row.pendingChanges as PendingChanges;
        let resolvedCategoryName: string | null = null;
        let resolvedSubCategoryNames: string[] = [];

        if (pc.categoryId && pc.categoryId !== row.categoryId) {
          const { data: catData } = await supabase
            .from('ad_categories_v2')
            .select('categoryName')
            .eq('id', pc.categoryId)
            .single();
          resolvedCategoryName = (catData as any)?.categoryName ?? null;
        }

        if (pc.subCategoryIds && pc.subCategoryIds.length > 0) {
          const { data: subCatData } = await supabase
            .from('ad_sub_categories_v2')
            .select('subCategoryName')
            .in('id', pc.subCategoryIds);
          resolvedSubCategoryNames = ((subCatData as any[]) ?? [])
            .map((r) => r.subCategoryName as string)
            .filter(Boolean);
        }

        // pendingChanges 아파트 이름/주소 resolve
        let resolvedApartments: ApartmentInfo[] = [];
        if (pc.apartments && pc.apartments.length > 0) {
          const aptIds = pc.apartments.map((a) => a.apartmentId);
          const { data: aptRows } = await supabase
            .from('apartments')
            .select('id, name, address')
            .in('id', aptIds);
          resolvedApartments = pc.apartments.map((a) => {
            const aptRow = (aptRows as any[])?.find((r) => r.id === a.apartmentId);
            return {
              apartmentId: a.apartmentId,
              apartmentName: aptRow?.name ?? '-',
              address: aptRow?.address ?? '-',
              totalHouseholds: a.totalHouseholds,
            };
          });
        }

        pendingChanges = { ...pc, resolvedCategoryName, resolvedSubCategoryNames, resolvedApartments };
      }

      const apartments: ApartmentInfo[] = (row.advertisement_apartments_v2 ?? []).map(
        (apt: any) => ({
          apartmentId: apt.apartmentId,
          apartmentName: apt.apartments?.name ?? '-',
          address: apt.apartments?.address ?? '-',
          totalHouseholds: apt.totalHouseholds,
        })
      );

      const mapped: AdApplicationDetail = {
        id: row.id,
        adStatus: row.adStatus,
        paymentStatus: row.paymentStatus,
        freeMonths: row.freeMonths,
        submittedAt: row.submittedAt,
        title: row.title,
        content: row.content,
        imageUrls: row.imageUrls ?? [],
        naverMapUrl: row.naverMapUrl,
        blogUrl: row.blogUrl,
        youtubeUrl: row.youtubeUrl,
        instagramUrl: row.instagramUrl,
        kakaoOpenChatUrl: row.kakaoOpenChatUrl,
        rejectReason: row.rejectReason,
        modificationStatus: row.modificationStatus ?? null,
        modificationRejectedReason: row.modificationRejectedReason ?? null,
        pendingChanges,
        partner: row.partner_users,
        category: row.ad_categories_v2,
        subCategoryNames: (row.advertisement_sub_categories_v2 ?? []).map(
          (sc: any) => sc.ad_sub_categories_v2?.subCategoryName ?? ''
        ).filter(Boolean),
        apartments,
        pricePerHousehold: pricing?.pricePerHousehold ?? 70,
        defaultDiscountRate: effectiveDiscountRate,
        approvedDiscountRate: row.approvedDiscountRate ?? null,
        approvedMonthlyAmount: row.approvedMonthlyAmount ?? null,
        freeEndDate: (subscription as any)?.freeEndDate ?? null,
        nextBillingDate: (subscription as any)?.nextBillingDate ?? null,
        isFirstAd,
        apartmentChangeStatus: row.apartmentChangeStatus ?? null,
        pendingDiffAmount: row.pendingDiffAmount ?? null,
      };

      setDetail(mapped);
      // 다이얼로그 열릴 때 매번 초기화
      // 첫광고이면 무료기간 기본 1개월, 아니면 0
      setFreeMonths(isFirstAd ? 1 : 0);
      setOverrideEnabled(false);
      setDiscountRate(isFirstAd ? mapped.defaultDiscountRate : 0);
    } catch (err) {
      console.error('Failed to fetch detail:', err);
      toast.error('광고 신청 정보를 불러오는데 실패했습니다.');
      router.push('/admin/advertising-v2/applications');
    } finally {
      setLoading(false);
    }
  }, [adId, supabase, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    if (!detail) return;
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeMonths, discountRate, overrideEnabled }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve');
      }
      toast.success('광고 신청이 승인되었습니다.');
      router.push('/admin/advertising-v2/applications');
    } catch (err) {
      console.error('Failed to approve:', err);
      toast.error('광고 승인에 실패했습니다.');
    } finally {
      setProcessing(false);
      setApproveDialog(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    if (!rejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/reject`,
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
      router.push('/admin/advertising-v2/applications');
    } catch (err) {
      console.error('Failed to reject:', err);
      toast.error('광고 거절에 실패했습니다.');
    } finally {
      setProcessing(false);
      setRejectDialog(false);
    }
  };

  const handleApproveModification = async () => {
    if (!detail) return;
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/approve-modification`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve modification');
      }
      toast.success('수정 내용이 승인되었습니다.');
      fetchDetail();
    } catch (err) {
      console.error('Failed to approve modification:', err);
      toast.error('수정 승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectModification = async () => {
    if (!detail) return;
    if (!modificationRejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/reject-modification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectReason: modificationRejectReason.trim() }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to reject modification');
      }
      toast.success('수정 내용이 거절되었습니다.');
      setModificationRejectDialog(false);
      setModificationRejectReason('');
      fetchDetail();
    } catch (err) {
      console.error('Failed to reject modification:', err);
      toast.error('수정 거절에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const totalHouseholds = detail?.apartments.reduce(
    (sum, apt) => sum + apt.totalHouseholds,
    0
  ) ?? 0;

  const monthlyAmount = totalHouseholds * (detail?.pricePerHousehold ?? 70);

  return {
    detail,
    loading,
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
    rejectReason,
    setRejectReason,
    processing,
    handleApprove,
    handleReject,
    modificationRejectDialog,
    setModificationRejectDialog,
    modificationRejectReason,
    setModificationRejectReason,
    handleApproveModification,
    handleRejectModification,
    totalHouseholds,
    monthlyAmount,
  };
}
