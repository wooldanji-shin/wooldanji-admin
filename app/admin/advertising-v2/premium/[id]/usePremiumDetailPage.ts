'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type PremiumStatus =
  | 'pending'
  | 'approved'
  | 'running'
  | 'ended'
  | 'rejected'
  | 'draft'
  | 'modification_pending';

export interface SnapshotApartment {
  apartmentName: string;
  address: string;
  totalHouseholds: number;
}

export interface ExtensionRow {
  id: string;
  paidAt: Date;
  weeks: number;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  paymentKey: string | null;
  receiptUrl: string | null;
}

export interface PremiumAdDetail {
  id: string;
  partnerId: string;
  baseAdId: string;
  title: string | null;
  content: string | null;
  imageUrls: string[];
  naverMapUrl: string | null;
  blogUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  kakaoOpenChatUrl: string | null;
  weeks: number;
  status: PremiumStatus;
  paymentStatus: 'unpaid' | 'paid';
  totalAmount: number | null;
  rejectedReason: string | null;
  modificationStatus: string | null;
  modificationRejectedReason: string | null;
  pendingChanges: Record<string, unknown> | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  snapshotApartments: SnapshotApartment[];
  partner: {
    businessName: string | null;
  } | null;
  category: { categoryName: string } | null;
  subCategoryNames: string[];
}

export interface PremiumAdAnalyticsSummary {
  impressionCount: number;
  homePremiumImpressionCount: number;
  dialogImpressionCount: number;
  clickCount: number;
  phoneClickCount: number;
  messageClickCount: number;
  naverMapClickCount: number;
  blogClickCount: number;
  youtubeClickCount: number;
  instagramClickCount: number;
  kakaoChatClickCount: number;
}

export interface UsePremiumDetailPageReturn {
  detail: PremiumAdDetail | null;
  loading: boolean;
  analytics: PremiumAdAnalyticsSummary | null;
  cumulativeAmount: number | null;
  extensions: ExtensionRow[];
  // 파생값
  totalHouseholds: number;
  cumulativeWeeks: number;
  extensionWeeks: number;
  displayAmount: number | null;
  extensionAmount: number | null;
  // 거절 다이얼로그
  rejectDialog: boolean;
  setRejectDialog: (open: boolean) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  // 수정 거절 다이얼로그
  modificationRejectDialog: boolean;
  setModificationRejectDialog: (open: boolean) => void;
  modificationRejectReason: string;
  setModificationRejectReason: (v: string) => void;
  // 처리 상태
  processing: boolean;
  // 액션
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
  handleApproveModification: () => Promise<void>;
  handleRejectModification: () => Promise<void>;
}

export function usePremiumDetailPage(
  params: Promise<{ id: string }>
): UsePremiumDetailPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [adId, setAdId] = useState<string>('');
  const [detail, setDetail] = useState<PremiumAdDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<PremiumAdAnalyticsSummary | null>(null);
  const [cumulativeAmount, setCumulativeAmount] = useState<number | null>(null);
  const [extensions, setExtensions] = useState<ExtensionRow[]>([]);

  const [rejectDialog, setRejectDialog] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [modificationRejectDialog, setModificationRejectDialog] = useState<boolean>(false);
  const [modificationRejectReason, setModificationRejectReason] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    params.then((p) => setAdId(p.id));
  }, [params]);

  const fetchDetail = useCallback(async (): Promise<void> => {
    if (!adId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('premium_advertisements_v2')
        .select(
          'id, "partnerId", "baseAdId", title, content, "imageUrls", ' +
            '"naverMapUrl", "blogUrl", "youtubeUrl", "instagramUrl", "kakaoOpenChatUrl", ' +
            'weeks, status, "paymentStatus", "totalAmount", "rejectedReason", ' +
            '"modificationStatus", "modificationRejectedReason", "pendingChanges", ' +
            '"startedAt", "endedAt", "createdAt", "snapshotApartments"'
        )
        .eq('id', adId)
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown> & { partnerId: string };

      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('"businessName"')
        .eq('userId', row.partnerId)
        .maybeSingle();

      // 카테고리는 기본 광고(advertisements_v2)에서 baseAdId로 조회
      const baseAdId = row.baseAdId as string;
      const { data: baseAdData } = await supabase
        .from('advertisements_v2')
        .select(
          'categoryId, ad_categories_v2:categoryId(categoryName), advertisement_sub_categories_v2(ad_sub_categories_v2(subCategoryName))'
        )
        .eq('id', baseAdId)
        .maybeSingle();

      const baseAd = baseAdData as
        | {
            categoryId: string | null;
            ad_categories_v2: { categoryName: string } | null;
            advertisement_sub_categories_v2:
              | { ad_sub_categories_v2: { subCategoryName: string } | null }[]
              | null;
          }
        | null;
      const category = baseAd?.ad_categories_v2 ?? null;
      const subCategoryNames = (baseAd?.advertisement_sub_categories_v2 ?? [])
        .map((sc) => sc.ad_sub_categories_v2?.subCategoryName ?? '')
        .filter(Boolean);

      const mapped: PremiumAdDetail = {
        id: row.id as string,
        partnerId: row.partnerId,
        baseAdId: row.baseAdId as string,
        title: (row.title as string | null) ?? null,
        content: (row.content as string | null) ?? null,
        imageUrls: (row.imageUrls as string[]) ?? [],
        naverMapUrl: (row.naverMapUrl as string | null) ?? null,
        blogUrl: (row.blogUrl as string | null) ?? null,
        youtubeUrl: (row.youtubeUrl as string | null) ?? null,
        instagramUrl: (row.instagramUrl as string | null) ?? null,
        kakaoOpenChatUrl: (row.kakaoOpenChatUrl as string | null) ?? null,
        weeks: row.weeks as number,
        status: row.status as PremiumStatus,
        paymentStatus: row.paymentStatus as 'unpaid' | 'paid',
        totalAmount: (row.totalAmount as number | null) ?? null,
        rejectedReason: (row.rejectedReason as string | null) ?? null,
        modificationStatus: (row.modificationStatus as string | null) ?? null,
        modificationRejectedReason: (row.modificationRejectedReason as string | null) ?? null,
        pendingChanges: (row.pendingChanges as Record<string, unknown> | null) ?? null,
        startedAt: (row.startedAt as string | null) ?? null,
        endedAt: (row.endedAt as string | null) ?? null,
        createdAt: row.createdAt as string,
        snapshotApartments: (row.snapshotApartments as SnapshotApartment[]) ?? [],
        partner: partnerData
          ? { businessName: (partnerData as { businessName: string | null }).businessName }
          : null,
        category,
        subCategoryNames,
      };

      setDetail(mapped);

      // 누적 결제 합계 + 연장 이력 + 통계 동시 조회
      const [{ data: paidRows }, { data: extRows }, { data: analyticsRows }] = await Promise.all([
        supabase
          .from('ad_payment_history_v2')
          .select('amount')
          .eq('premiumAdId', adId)
          .eq('status', 'paid'),
        supabase
          .from('ad_payment_history_v2')
          .select(
            'id, amount, "paymentDate", "billingPeriodStart", "billingPeriodEnd", "paymentKey", "receiptUrl"'
          )
          .eq('premiumAdId', adId)
          .eq('paymentType', 'extension')
          .eq('status', 'paid')
          .order('paymentDate', { ascending: true }),
        supabase
          .from('ad_analytics_v2')
          .select(
            'impressionCount, homePremiumImpressionCount, dialogImpressionCount, clickCount, phoneClickCount, messageClickCount, naverMapClickCount, blogClickCount, youtubeClickCount, instagramClickCount, kakaoChatClickCount'
          )
          .eq('targetType', 'premium_advertisements_v2')
          .eq('targetId', adId),
      ]);

      const sum = (paidRows ?? []).reduce(
        (s: number, r: { amount: number | null }) => s + (r.amount ?? 0),
        0
      );
      setCumulativeAmount(sum > 0 ? sum : null);

      const rows = (analyticsRows ?? []) as Record<string, number>[];
      if (rows.length > 0) {
        const s: PremiumAdAnalyticsSummary = {
          impressionCount: 0, homePremiumImpressionCount: 0, dialogImpressionCount: 0,
          clickCount: 0, phoneClickCount: 0, messageClickCount: 0,
          naverMapClickCount: 0, blogClickCount: 0, youtubeClickCount: 0,
          instagramClickCount: 0, kakaoChatClickCount: 0,
        };
        for (const r of rows) {
          s.impressionCount += r.impressionCount ?? 0;
          s.homePremiumImpressionCount += r.homePremiumImpressionCount ?? 0;
          s.dialogImpressionCount += r.dialogImpressionCount ?? 0;
          s.clickCount += r.clickCount ?? 0;
          s.phoneClickCount += r.phoneClickCount ?? 0;
          s.messageClickCount += r.messageClickCount ?? 0;
          s.naverMapClickCount += r.naverMapClickCount ?? 0;
          s.blogClickCount += r.blogClickCount ?? 0;
          s.youtubeClickCount += r.youtubeClickCount ?? 0;
          s.instagramClickCount += r.instagramClickCount ?? 0;
          s.kakaoChatClickCount += r.kakaoChatClickCount ?? 0;
        }
        setAnalytics(s);
      } else {
        setAnalytics(null);
      }

      const parsedExtensions: ExtensionRow[] = (extRows ?? []).map((r) => {
        const periodStart = new Date(r.billingPeriodStart as string);
        const periodEnd = new Date(r.billingPeriodEnd as string);
        const weeks = Math.floor(
          (periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        return {
          id: r.id as string,
          paidAt: new Date(r.paymentDate as string),
          weeks,
          amount: r.amount as number,
          periodStart,
          periodEnd,
          paymentKey: (r.paymentKey as string | null) ?? null,
          receiptUrl: (r.receiptUrl as string | null) ?? null,
        };
      });
      setExtensions(parsedExtensions);
    } catch (err) {
      console.error('프리미엄 광고 상세 로드 실패:', err);
      toast.error('프리미엄 광고 정보를 불러오는데 실패했습니다.');
      router.push('/admin/advertising-v2/premium');
    } finally {
      setLoading(false);
    }
  }, [adId, supabase, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async (): Promise<void> => {
    if (!detail) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${detail.id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error ?? 'Failed to approve');
      }
      toast.success('프리미엄 광고가 승인되었습니다.');
      fetchDetail();
    } catch (err) {
      console.error('프리미엄 광고 승인 실패:', err);
      toast.error('승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (): Promise<void> => {
    if (!detail) return;
    if (!rejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${detail.id}/reject`, {
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
      fetchDetail();
    } catch (err) {
      console.error('프리미엄 광고 거절 실패:', err);
      toast.error('거절 처리에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveModification = async (): Promise<void> => {
    if (!detail) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${detail.id}/approve-modification`, {
        method: 'POST',
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error ?? 'Failed to approve modification');
      }
      toast.success('수정 내용이 승인되었습니다.');
      fetchDetail();
    } catch (err) {
      console.error('수정 승인 실패:', err);
      toast.error('수정 승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectModification = async (): Promise<void> => {
    if (!detail) return;
    if (!modificationRejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${detail.id}/reject-modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: modificationRejectReason.trim() }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error ?? 'Failed to reject modification');
      }
      toast.success('수정 내용이 거절되었습니다.');
      setModificationRejectDialog(false);
      setModificationRejectReason('');
      fetchDetail();
    } catch (err) {
      console.error('수정 거절 실패:', err);
      toast.error('수정 거절에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  // 파생 값
  const totalHouseholds = detail
    ? detail.snapshotApartments.reduce((s, a) => s + a.totalHouseholds, 0)
    : 0;

  const cumulativeWeeks = detail
    ? detail.startedAt && detail.endedAt
      ? Math.floor(
          (new Date(detail.endedAt).getTime() - new Date(detail.startedAt).getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        )
      : detail.weeks
    : 0;
  const extensionWeeks = detail ? cumulativeWeeks - detail.weeks : 0;
  const displayAmount = detail ? cumulativeAmount ?? detail.totalAmount : null;
  const extensionAmount =
    detail && displayAmount != null && detail.totalAmount != null
      ? displayAmount - detail.totalAmount
      : null;

  return {
    detail,
    loading,
    analytics,
    cumulativeAmount,
    extensions,
    totalHouseholds,
    cumulativeWeeks,
    extensionWeeks,
    displayAmount,
    extensionAmount,
    rejectDialog,
    setRejectDialog,
    rejectReason,
    setRejectReason,
    modificationRejectDialog,
    setModificationRejectDialog,
    modificationRejectReason,
    setModificationRejectReason,
    processing,
    handleApprove,
    handleReject,
    handleApproveModification,
    handleRejectModification,
  };
}
