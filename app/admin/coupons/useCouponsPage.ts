'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/** 한 페이지에 표시할 쿠폰 수 */
export const COUPONS_PAGE_SIZE = 20;

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
  usageCount: number;
  // 파트너 직접 만료 시각 (파트너가 쿠폰을 직접 만료시킨 경우)
  expiredAt: string | null;
  // 파트너가 쿠폰을 만료시킨 사유
  expiredReason: string | null;
  // 파트너가 쿠폰을 수정한 사유
  updateReason: string | null;
}

export interface UseCouponsPageReturn {
  coupons: CouponItem[];
  /** 매 조회마다 true가 되는 로딩 상태 (페이지 이동 포함) */
  loading: boolean;
  /** 첫 진입 시에만 true — 페이지 이동 중에는 기존 테이블을 유지하기 위해 구분 */
  initialLoading: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  setPage: (page: number) => void;
  deleteCoupon: (id: string) => Promise<void>;
}

export function useCouponsPage(): UseCouponsPageReturn {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchCoupons = useCallback(async (targetPage: number): Promise<void> => {
    setLoading(true);
    try {
      const from = (targetPage - 1) * COUPONS_PAGE_SIZE;
      const to = from + COUPONS_PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('coupons')
        .select(
          `
          id, title, description, discountType, discountValue,
          minAmount, expiresAt, isActive, createdAt, partnerUserId,
          expiredAt, expiredReason, updateReason,
          partner_users(businessName),
          coupon_downloads(count)
        `,
          { count: 'exact' }
        )
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalCount(count ?? 0);

      const items: CouponItem[] = (data ?? []).map((row: any) => {
        const downloads = row.coupon_downloads as { count: number }[] | null;
        const downloadCount = downloads?.[0]?.count ?? 0;
        // 파트너 탈퇴 시 coupons.partnerUserId가 ON DELETE SET NULL로 비워짐
        const isPartnerWithdrawn = row.partnerUserId === null;

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
          isPartnerWithdrawn,
          downloadCount,
          usageCount: 0,
          expiredAt: row.expiredAt ?? null,
          expiredReason: row.expiredReason ?? null,
          updateReason: row.updateReason ?? null,
        };
      });

      // 사용 수는 현재 페이지에 표시되는 쿠폰에 대해서만 별도 집계
      const couponIds = items.map((c) => c.id);
      const usageMap = new Map<string, number>();

      if (couponIds.length > 0) {
        const { data: usageData } = await supabase
          .from('coupon_usages')
          .select('couponDownloadId, coupon_downloads!inner(couponId)')
          .in('coupon_downloads.couponId', couponIds);

        for (const u of usageData ?? []) {
          const couponId = (u as any).coupon_downloads?.couponId;
          if (couponId) usageMap.set(couponId, (usageMap.get(couponId) ?? 0) + 1);
        }
      }

      setCoupons(items.map((c) => ({ ...c, usageCount: usageMap.get(c.id) ?? 0 })));
    } catch (err) {
      console.error('[CouponsPage] 조회 실패:', err);
      toast.error('쿠폰 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons(page);
  }, [fetchCoupons, page]);

  const deleteCoupon = useCallback(
    async (id: string): Promise<void> => {
      const confirmed = window.confirm('이 쿠폰을 비활성화하시겠습니까?\n이미 받은 유저의 쿠폰함에서 사라집니다.');
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
      // 비활성 쿠폰도 목록에 남으므로 현재 페이지를 다시 조회해 상태를 갱신
      await fetchCoupons(page);
    },
    [fetchCoupons, page]
  );

  return {
    coupons,
    loading,
    initialLoading,
    page,
    pageSize: COUPONS_PAGE_SIZE,
    totalCount,
    setPage,
    deleteCoupon,
  };
}
