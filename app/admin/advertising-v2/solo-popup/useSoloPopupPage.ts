'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { setAutoApproveModification } from '@/lib/ads/auto-approve';
import { useDebounce } from '@/hooks/use-debounce';
import type { SoloPeriodUnit, SoloPopupStatus } from '@/lib/ads/solo-popup';

export interface SoloPopupRow {
  id: string;
  partnerId: string;
  baseAdId: string | null;
  title: string;
  status: SoloPopupStatus;
  paymentStatus: 'unpaid' | 'paid';
  periodUnit: SoloPeriodUnit;
  periodCount: number;
  weeks: number;
  totalAmount: number;
  approvedDiscountRate: number | null;
  discountedTotalAmount: number | null;
  modificationStatus: string | null;
  autoApproveModification: boolean;
  /** 관리자 '첫 화면' 체크 — 문열림 단독 팝업 맨 앞 카드로 노출 */
  isDoorPopupFirst: boolean;
  startedAt: string | null;
  endedAt: string | null;
  salesRepName: string | null;
  partnerBusinessName: string;
  impressions: number;
  clicks: number;
  /** 홈 프리미엄 추천 섹션 (위 2개는 문열림 팝업) */
  homeImpressions: number;
  homeClicks: number;
}

/** 필터 탭 — 수정 심사는 running + modificationStatus=pending */
export type SoloStatusFilter = 'all' | 'running' | 'pending' | 'modification' | 'approved' | 'ended' | 'rejected';

const PAGE_SIZE = 20;

function matchesFilter(row: SoloPopupRow, filter: SoloStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'modification') return row.modificationStatus === 'pending';
  return row.status === filter;
}

export function useSoloPopupPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SoloPopupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilterState] = useState<SoloStatusFilter>('all');
  const [searchTerm, setSearchTermState] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [page, setPage] = useState(1);
  const supabase = useMemo(() => createClient(), []);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 신규 테이블이라 생성 타입에 없어 any 캐스팅
      const db = createClient() as any;
      const { data, error } = await db
        .from('solo_popup_ads_v2')
        .select(
          'id, "partnerId", "baseAdId", title, status, "paymentStatus", "periodUnit", "periodCount", weeks, "totalAmount", "approvedDiscountRate", "discountedTotalAmount", "modificationStatus", "autoApproveModification", "isDoorPopupFirst", "startedAt", "endedAt", sales_reps:salesRepId(name)'
        )
        .order('createdAt', { ascending: false });
      if (error) throw error;

      const ads = (data ?? []) as any[];
      const partnerIds = [...new Set(ads.map((a) => a.partnerId))];
      const adIds = ads.map((a) => a.id);

      const [{ data: partners }, { data: stats }] = await Promise.all([
        partnerIds.length
          ? db.from('partner_users').select('id, businessName').in('id', partnerIds)
          : Promise.resolve({ data: [] }),
        adIds.length
          ? db
              .from('solo_popup_ad_analytics_v2')
              .select('"soloPopupAdId", "impressionCount", "primaryClickCount", "secondaryClickCount", "homeImpressionCount", "homeClickCount"')
              .in('soloPopupAdId', adIds)
          : Promise.resolve({ data: [] }),
      ]);

      const names = new Map<string, string>((partners ?? []).map((p: any) => [p.id, p.businessName]));
      const sums = new Map<string, { imp: number; clk: number; homeImp: number; homeClk: number }>();
      for (const s of (stats ?? []) as any[]) {
        const cur = sums.get(s.soloPopupAdId) ?? { imp: 0, clk: 0, homeImp: 0, homeClk: 0 };
        cur.imp += s.impressionCount;
        cur.clk += s.primaryClickCount + s.secondaryClickCount;
        cur.homeImp += s.homeImpressionCount;
        cur.homeClk += s.homeClickCount;
        sums.set(s.soloPopupAdId, cur);
      }

      setRows(
        ads.map((a) => ({
          ...a,
          salesRepName: a.sales_reps?.name ?? null,
          partnerBusinessName: names.get(a.partnerId) ?? '-',
          impressions: sums.get(a.id)?.imp ?? 0,
          clicks: sums.get(a.id)?.clk ?? 0,
          homeImpressions: sums.get(a.id)?.homeImp ?? 0,
          homeClicks: sums.get(a.id)?.homeClk ?? 0,
        }))
      );
    } catch (err) {
      console.error('단독 팝업 광고 목록 조회 실패:', err);
      toast.error('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bySearch = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.partnerBusinessName.toLowerCase().includes(term) || r.title.toLowerCase().includes(term)
    );
  }, [rows, debouncedSearch]);

  const statusCounts = useMemo(() => {
    const filters: SoloStatusFilter[] = ['all', 'running', 'pending', 'modification', 'approved', 'ended', 'rejected'];
    return Object.fromEntries(
      filters.map((f) => [f, bySearch.filter((r) => matchesFilter(r, f)).length])
    ) as Record<SoloStatusFilter, number>;
  }, [bySearch]);

  const filtered = useMemo(
    () => bySearch.filter((r) => matchesFilter(r, statusFilter)),
    [bySearch, statusFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleToggleAutoApprove = useCallback(async (row: SoloPopupRow, next: boolean) => {
    if (togglingId) return;
    setTogglingId(row.id);
    const ok = await setAutoApproveModification(supabase, 'solo_popup_ads_v2', row.id, next);
    if (ok) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, autoApproveModification: next } : r)));
    setTogglingId(null);
  }, [supabase, togglingId]);

  // 첫 화면 토글 — 선택 로직은 DB 함수(get_door_popup_payload)에 있어 앱 릴리스 없이 즉시 반영된다
  const handleToggleDoorPopupFirst = useCallback(async (row: SoloPopupRow, next: boolean) => {
    if (togglingId) return;
    setTogglingId(row.id);
    const { error } = await (supabase as any)
      .from('solo_popup_ads_v2')
      .update({ isDoorPopupFirst: next })
      .eq('id', row.id);
    setTogglingId(null);

    if (error) {
      console.error('첫 화면 설정 변경 실패:', error);
      toast.error('첫 화면 설정 변경에 실패했습니다.');
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isDoorPopupFirst: next } : r)));
    toast.success(next ? '문열림 팝업 첫 화면에 노출합니다.' : '첫 화면 노출을 해제했습니다.');
  }, [supabase, togglingId]);

  return {
    loading,
    statusFilter,
    setStatusFilter: (f: SoloStatusFilter) => { setStatusFilterState(f); setPage(1); },
    searchTerm,
    setSearchTerm: (v: string) => { setSearchTermState(v); setPage(1); },
    statusCounts,
    pageRows,
    page,
    setPage,
    totalPages,
    handleToggleAutoApprove,
    handleToggleDoorPopupFirst,
    togglingId,
    handleRowClick: (id: string) => router.push(`/admin/advertising-v2/solo-popup/${id}`),
  };
}
