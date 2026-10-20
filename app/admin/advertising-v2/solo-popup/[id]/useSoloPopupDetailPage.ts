'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import { createClient } from '@/lib/supabase/client';
import { setAutoApproveModification } from '@/lib/ads/auto-approve';
import type { SoloButton, SoloButtonMode, SoloContentType, SoloPeriodUnit, SoloPopupStatus } from '@/lib/ads/solo-popup';

export interface SoloPopupDetail {
  id: string;
  partnerId: string;
  baseAdId: string | null;
  title: string;
  imageUrls: string[];
  bulletLines: string[];
  contentType: SoloContentType;
  buttonMode: SoloButtonMode;
  buttons: SoloButton[];
  periodUnit: SoloPeriodUnit;
  periodCount: number;
  weeks: number;
  status: SoloPopupStatus;
  paymentStatus: 'unpaid' | 'paid';
  totalAmount: number;
  approvedDiscountRate: number | null;
  discountedTotalAmount: number | null;
  snapshotApartments: { apartmentName: string; address: string; totalHouseholds: number }[];
  rejectedReason: string | null;
  modificationStatus: string | null;
  modificationRejectedReason: string | null;
  pendingChanges: Partial<{
    title: string;
    imageUrls: string[];
    /** 이전 형식 수정 요청 (imageUrls 없음) */
    imageUrl: string;
    bulletLines: string[];
    contentType: SoloContentType;
    buttonMode: SoloButtonMode;
    buttons: SoloButton[];
    /** 키가 없으면 링크 변경 없음(구버전 앱 요청), null 이면 링크 삭제 */
    detailLinkUrl: string | null;
    /** 키가 없으면 문구 변경 없음, null 이면 문구 삭제(앱 기본 문구) */
    detailButtonLabel: string | null;
  }> | null;
  adminMemo: string | null;
  autoApproveModification: boolean;
  /** 자세히 보기 링크 (있으면 앱이 외부 브라우저, 없으면 기본 광고 상세) */
  detailLinkUrl: string | null;
  /** 자세히 보기 버튼 문구 (null 이면 앱이 '자세히 보기' 표시) */
  detailButtonLabel: string | null;
  salesRepId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  partnerBusinessName: string;
  baseAdTitle: string | null;
}

export interface SoloPaymentRow {
  id: string;
  paymentType: string | null;
  amount: number;
  status: string;
  paymentDate: string;
  periodWeeks: number | null;
  receiptUrl: string | null;
}

export interface SoloStats {
  impressions: number;
  primaryClicks: number;
  secondaryClicks: number;
}

type ActionPath = 'approve' | 'reject' | 'approve-modification' | 'reject-modification' | 'delete';

export function useSoloPopupDetailPage(params: Promise<{ id: string }>) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [detail, setDetail] = useState<SoloPopupDetail | null>(null);
  const [payments, setPayments] = useState<SoloPaymentRow[]>([]);
  const [stats, setStats] = useState<SoloStats>({ impressions: 0, primaryClicks: 0, secondaryClicks: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [autoApproveToggling, setAutoApproveToggling] = useState(false);

  const load = useCallback(async () => {
    const db = createClient() as any;
    const { data } = await db
      .from('solo_popup_ads_v2')
      // partnerId 는 partner_users 로의 FK 가 없어 조인(embed)이 실패한다 → 업체명은 아래에서 따로 조회 (목록 화면과 동일)
      .select('*, advertisements_v2:baseAdId(title)')
      .eq('id', id)
      .maybeSingle();
    if (!data) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const [{ data: pay }, { data: analytics }, { data: partner }] = await Promise.all([
      db
        .from('ad_payment_history_v2')
        .select('id, paymentType, amount, status, paymentDate, periodWeeks, receiptUrl')
        .eq('soloPopupAdId', id)
        .order('paymentDate', { ascending: false }),
      db
        .from('solo_popup_ad_analytics_v2')
        .select('"impressionCount", "primaryClickCount", "secondaryClickCount"')
        .eq('soloPopupAdId', id),
      db.from('partner_users').select('businessName').eq('id', data.partnerId).maybeSingle(),
    ]);

    setDetail({
      ...data,
      partnerBusinessName: partner?.businessName ?? '-',
      baseAdTitle: data.advertisements_v2?.title ?? null,
    });
    setPayments((pay ?? []) as SoloPaymentRow[]);
    setStats(
      ((analytics ?? []) as any[]).reduce(
        (acc, a) => ({
          impressions: acc.impressions + a.impressionCount,
          primaryClicks: acc.primaryClicks + a.primaryClickCount,
          secondaryClicks: acc.secondaryClicks + a.secondaryClickCount,
        }),
        { impressions: 0, primaryClicks: 0, secondaryClicks: 0 }
      )
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** 관리자 액션 API 호출 공통 처리 */
  const runAction = useCallback(
    async (path: ActionPath, body: Record<string, unknown>, successMessage: string): Promise<boolean> => {
      setProcessing(true);
      try {
        const res = await fetch(`/api/advertising-v2/solo-popup/${id}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          toast.error(
            (await readApiErrorMessage(res)) ??
              '처리 중 문제가 생겼습니다. 화면을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.'
          );
          return false;
        }
        toast.success(successMessage);
        if (path === 'delete') router.push('/admin/advertising-v2/solo-popup');
        else await load();
        return true;
      } catch (err) {
        console.error(`단독 팝업 ${path} 요청 실패:`, err);
        toast.error(networkFailedMessage('요청을 처리하지 못했습니다.'));
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [id, load, router]
  );

  const saveMemo = useCallback(
    async (adminMemo: string) => {
      const res = await fetch(`/api/advertising-v2/solo-popup/${id}/memo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminMemo }),
      });
      if (!res.ok) {
        return toast.error(
          (await readApiErrorMessage(res)) ?? '메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }
      toast.success('메모를 저장했습니다.');
      await load();
    },
    [id, load]
  );

  const saveDetailLink = useCallback(
    async (detailLinkUrl: string, detailButtonLabel: string) => {
      const res = await fetch(`/api/advertising-v2/solo-popup/${id}/detail-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detailLinkUrl, detailButtonLabel }),
      });
      if (!res.ok) {
        return toast.error(
          (await readApiErrorMessage(res)) ?? '링크를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }
      toast.success('링크와 버튼 이름을 저장했습니다.');
      await load();
    },
    [id, load]
  );

  const handleToggleAutoApprove = useCallback(
    async (next: boolean) => {
      if (!detail || autoApproveToggling) return;
      setAutoApproveToggling(true);
      const ok = await setAutoApproveModification(supabase, 'solo_popup_ads_v2', detail.id, next);
      if (ok) setDetail((prev) => (prev ? { ...prev, autoApproveModification: next } : prev));
      setAutoApproveToggling(false);
    },
    [detail, autoApproveToggling, supabase]
  );

  return {
    id, detail, payments, stats, loading, processing, runAction, saveMemo, saveDetailLink,
    autoApproveToggling, handleToggleAutoApprove,
  };
}
