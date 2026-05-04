'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface CouponItem {
  id: string;
  title: string;
  description: string | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minAmount: number | null;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  partnerUserId: string;
  partnerBusinessName: string;
  downloadCount: number;
  usageCount: number;
}

export interface UseCouponsPageReturn {
  coupons: CouponItem[];
  loading: boolean;
  deleteCoupon: (id: string) => Promise<void>;
}

export function useCouponsPage(): UseCouponsPageReturn {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select(`
          id, title, description, discountType, discountValue,
          minAmount, expiresAt, isActive, createdAt, partnerUserId,
          partner_users!inner(businessName),
          coupon_downloads(count)
        `)
        .order('createdAt', { ascending: false });

      if (error) throw error;

      const items: CouponItem[] = (data ?? []).map((row: any) => {
        const downloads = row.coupon_downloads as { count: number }[] | null;
        const downloadCount = downloads?.[0]?.count ?? 0;

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
          downloadCount,
          usageCount: 0,
        };
      });

      // 사용 수 별도 집계
      const { data: usageData } = await supabase
        .from('coupon_usages')
        .select('couponDownloadId, coupon_downloads!inner(couponId)');

      const usageMap = new Map<string, number>();
      for (const u of usageData ?? []) {
        const couponId = (u as any).coupon_downloads?.couponId;
        if (couponId) usageMap.set(couponId, (usageMap.get(couponId) ?? 0) + 1);
      }

      setCoupons(items.map(c => ({ ...c, usageCount: usageMap.get(c.id) ?? 0 })));
    } catch (err) {
      console.error('[CouponsPage] 조회 실패:', err);
      toast.error('쿠폰 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const deleteCoupon = useCallback(async (id: string) => {
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
    setCoupons(prev => prev.filter(c => c.id !== id));
  }, []);

  return { coupons, loading, deleteCoupon };
}
