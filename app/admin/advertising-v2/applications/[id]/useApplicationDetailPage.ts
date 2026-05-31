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

export interface AdCategoryWithSubs {
  id: string;
  categoryName: string;
  subCategories: { id: string; subCategoryName: string }[];
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
  baeminUrl?: string | null;
  coupangEatsUrl?: string | null;
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
  baeminUrl: string | null;
  coupangEatsUrl: string | null;
  rejectReason: string | null;
  adminMemo: string | null;
  modificationStatus: string | null;
  modificationRejectedReason: string | null;
  pendingChanges: PendingChanges | null;
  partner: {
    businessName: string;
    displayPhoneNumber: string | null;
    representativeName: string | null;
    phoneNumber: string | null;
    businessAddress: string | null;
    businessDetailAddress: string | null;
    parkingInfo: string | null;
    businessRegistrationNumber: string | null;
    createdAt: string | null;
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
  partnerDbId: string;
  partnerAnalyticsEnabled: boolean;
}

export interface AdAnalyticsSummary {
  impressionCount: number;
  clickCount: number;
  phoneClickCount: number;
  messageClickCount: number;
  naverMapClickCount: number;
  blogClickCount: number;
  youtubeClickCount: number;
  instagramClickCount: number;
  kakaoChatClickCount: number;
  homeImpressionCount: number;
  dialogImpressionCount: number;
  wishCount: number;
}

export interface UseApplicationDetailPageReturn {
  detail: AdApplicationDetail | null;
  loading: boolean;
  analytics: AdAnalyticsSummary | null;
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
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
  handleUpdateMemo: () => Promise<void>;
  // 수정 심사
  modificationApproveDialog: boolean;
  setModificationApproveDialog: (open: boolean) => void;
  newMonthlyAmount: string;
  setNewMonthlyAmount: (v: string) => void;
  modificationRejectDialog: boolean;
  setModificationRejectDialog: (open: boolean) => void;
  modificationRejectReason: string;
  setModificationRejectReason: (v: string) => void;
  handleApproveModification: () => Promise<void>;
  handleRejectModification: () => Promise<void>;
  grantAnalytics: boolean;
  setGrantAnalytics: (v: boolean) => void;
  totalHouseholds: number;
  monthlyAmount: number;
  allCategories: AdCategoryWithSubs[];
  approveCategory: string | null;
  handleApproveCategoryChange: (categoryId: string) => void;
  approveSubCategoryIds: string[];
  setApproveSubCategoryIds: (ids: string[]) => void;
}

export function useApplicationDetailPage(
  params: Promise<{ id: string }>
): UseApplicationDetailPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [adId, setAdId] = useState<string>('');
  const [detail, setDetail] = useState<AdApplicationDetail | null>(null);
  const [analytics, setAnalytics] = useState<AdAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [freeMonths, setFreeMonths] = useState(0);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [discountRate, setDiscountRate] = useState(28);
  const [discountNote, setDiscountNote] = useState('');
  const [adminMemo, setAdminMemo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [modificationApproveDialog, setModificationApproveDialog] = useState(false);
  const [newMonthlyAmount, setNewMonthlyAmount] = useState('');
  const [modificationRejectDialog, setModificationRejectDialog] = useState(false);
  const [modificationRejectReason, setModificationRejectReason] = useState('');
  const [grantAnalytics, setGrantAnalytics] = useState(false);
  const [allCategories, setAllCategories] = useState<AdCategoryWithSubs[]>([]);
  const [approveCategory, setApproveCategory] = useState<string | null>(null);
  const [approveSubCategoryIds, setApproveSubCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    params.then((p) => setAdId(p.id));
  }, [params]);

  const fetchDetail = useCallback(async () => {
    if (!adId) return;
    setLoading(true);

    try {
      const [adResult, pricingResult, analyticsResult, categoriesResult] = await Promise.all([
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
            baeminUrl,
            coupangEatsUrl,
            rejectReason,
            adminMemo,
            modificationStatus,
            modificationRejectedReason,
            apartmentChangeStatus,
            pendingChanges,
            partner_users:partnerId(businessName, displayPhoneNumber, representativeName, phoneNumber, businessAddress, businessDetailAddress, parkingInfo, businessRegistrationNumber, createdAt),
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
          .maybeSingle(),
        supabase
          .from('ad_analytics_v2')
          .select('impressionCount, clickCount, phoneClickCount, messageClickCount, naverMapClickCount, blogClickCount, youtubeClickCount, instagramClickCount, kakaoChatClickCount, homeImpressionCount, dialogImpressionCount, wishCount')
          .eq('targetId', adId),
        supabase
          .from('ad_categories_v2')
          .select('id, categoryName, ad_sub_categories_v2(id, subCategoryName, isActive, orderIndex)')
          .eq('isActive', true)
          .order('orderIndex', { ascending: true }),
      ]);

      if (adResult.error) throw adResult.error;

      const row = adResult.data as any;
      const pricing = pricingResult.data as any;

      // Design Ref: §5.1 — isFirstAdApplication(광고 레벨) + hasHadRunningAd(파트너 레벨) 이중 체크
      // isFirstAdApplication: 제출 시점에 결정 (파트너당 1개만 true), 관리자 UX 가시성 기준
      // hasHadRunningAd: running 전환 시 설정, 어뷰징 방어용 fallback
      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('hasHadRunningAd, analyticsEnabled')
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
        baeminUrl: (row as any).baeminUrl ?? null,
        coupangEatsUrl: (row as any).coupangEatsUrl ?? null,
        rejectReason: row.rejectReason,
        adminMemo: row.adminMemo ?? null,
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
        partnerDbId: row.partnerId,
        partnerAnalyticsEnabled: (partnerData as any)?.analyticsEnabled ?? false,
      };

      const analyticsRows = (analyticsResult.data ?? []) as any[];
      if (analyticsRows.length > 0) {
        const sum: AdAnalyticsSummary = {
          impressionCount: 0, clickCount: 0, phoneClickCount: 0,
          messageClickCount: 0, naverMapClickCount: 0, blogClickCount: 0,
          youtubeClickCount: 0, instagramClickCount: 0, kakaoChatClickCount: 0,
          homeImpressionCount: 0, dialogImpressionCount: 0, wishCount: 0,
        };
        for (const r of analyticsRows) {
          sum.impressionCount += r.impressionCount ?? 0;
          sum.clickCount += r.clickCount ?? 0;
          sum.phoneClickCount += r.phoneClickCount ?? 0;
          sum.messageClickCount += r.messageClickCount ?? 0;
          sum.naverMapClickCount += r.naverMapClickCount ?? 0;
          sum.blogClickCount += r.blogClickCount ?? 0;
          sum.youtubeClickCount += r.youtubeClickCount ?? 0;
          sum.instagramClickCount += r.instagramClickCount ?? 0;
          sum.kakaoChatClickCount += r.kakaoChatClickCount ?? 0;
          sum.homeImpressionCount += r.homeImpressionCount ?? 0;
          sum.dialogImpressionCount += r.dialogImpressionCount ?? 0;
          sum.wishCount += r.wishCount ?? 0;
        }
        setAnalytics(sum);
      } else {
        setAnalytics(null);
      }

      setDetail(mapped);
      setGrantAnalytics((partnerData as any)?.analyticsEnabled ?? false);
      // 다이얼로그 열릴 때 매번 초기화
      // 첫광고이면 무료기간 기본 1개월, 아니면 0
      setFreeMonths(isFirstAd ? 1 : 0);
      setOverrideEnabled(false);
      setDiscountRate(isFirstAd ? mapped.defaultDiscountRate : 0);
      setDiscountNote('');
      setAdminMemo(row.adminMemo ?? '');
      // 승인 다이얼로그 카테고리 초기값: 현재 광고의 카테고리/서브카테고리
      const currentSubCategoryIds = (row.advertisement_sub_categories_v2 ?? [])
        .map((sc: any) => sc.subCategoryId)
        .filter(Boolean);
      setApproveCategory(row.categoryId ?? null);
      setApproveSubCategoryIds(currentSubCategoryIds);
      setAllCategories(
        ((categoriesResult.data ?? []) as any[]).map((cat: any) => ({
          id: cat.id,
          categoryName: cat.categoryName,
          subCategories: ((cat.ad_sub_categories_v2 ?? []) as any[])
            .filter((s: any) => s.isActive !== false)
            .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((s: any) => ({ id: s.id, subCategoryName: s.subCategoryName })),
        }))
      );
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

  const handleApproveCategoryChange = useCallback((categoryId: string) => {
    setApproveCategory(categoryId);
    setApproveSubCategoryIds([]);
  }, []);

  const handleApprove = async () => {
    if (!detail) return;
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/approve`,
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
      if (grantAnalytics && !detail.partnerAnalyticsEnabled) {
        await (supabase as any)
          .from('partner_users')
          .update({ analyticsEnabled: true })
          .eq('id', detail.partnerDbId);
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

  const handleUpdateMemo = async () => {
    if (!detail) return;
    setProcessing(true);
    try {
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/memo`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminMemo: adminMemo.trim() }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update memo');
      }
      toast.success('메모가 저장되었습니다.');
      fetchDetail();
    } catch (err) {
      console.error('Failed to update memo:', err);
      toast.error('메모 저장에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveModification = async () => {
    if (!detail) return;
    setProcessing(true);
    try {
      const parsed = parseInt(newMonthlyAmount.replace(/,/g, ''), 10);
      const monthlyAmount = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
      const response = await fetch(
        `/api/advertising-v2/applications/${detail.id}/approve-modification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...(monthlyAmount !== undefined ? { monthlyAmount } : {}) }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve modification');
      }
      toast.success('수정 내용이 승인되었습니다.');
      setModificationApproveDialog(false);
      setNewMonthlyAmount('');
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
    analytics,
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
    handleApprove,
    handleReject,
    handleUpdateMemo,
    modificationApproveDialog,
    setModificationApproveDialog,
    newMonthlyAmount,
    setNewMonthlyAmount,
    modificationRejectDialog,
    setModificationRejectDialog,
    modificationRejectReason,
    setModificationRejectReason,
    handleApproveModification,
    handleRejectModification,
    grantAnalytics,
    setGrantAnalytics,
    totalHouseholds,
    monthlyAmount,
    allCategories,
    approveCategory,
    handleApproveCategoryChange,
    approveSubCategoryIds,
    setApproveSubCategoryIds,
  };
}
