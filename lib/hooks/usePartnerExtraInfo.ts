'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DAY_OF_WEEK_ORDER,
  type DayOfWeek,
  type PartnerAuthInfo,
  type PartnerBusinessHour,
  type PartnerCoupon,
} from '@/lib/types/partner';

export interface UsePartnerExtraInfoReturn {
  businessHours: PartnerBusinessHour[];
  coupons: PartnerCoupon[];
  /** auth.users 기반 계정 정보 (관리자 API 경유, 실패 시 null) */
  authInfo: PartnerAuthInfo | null;
  loading: boolean;
}

/** '09:00:00' → '09:00' (null이면 그대로 null) */
function toHourMinute(time: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

/**
 * 광고 상세 페이지에서 파트너의 영업시간과 발급 쿠폰을 함께 조회한다.
 * partnerDbId는 partner_users.id 기준이며, null이면 조회하지 않는다.
 */
export function usePartnerExtraInfo(partnerDbId: string | null): UsePartnerExtraInfoReturn {
  const supabase = createClient();
  const [businessHours, setBusinessHours] = useState<PartnerBusinessHour[]>([]);
  const [coupons, setCoupons] = useState<PartnerCoupon[]>([]);
  const [authInfo, setAuthInfo] = useState<PartnerAuthInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchExtraInfo = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      const [hoursResult, couponsResult, authResponse] = await Promise.all([
        supabase
          .from('business_hours')
          .select('dayOfWeek, isClosed, openTime, closeTime, breakStartTime, breakEndTime, lastOrderTime, createdAt')
          .eq('partnerUserId', id)
          .order('createdAt', { ascending: false }),
        supabase
          .from('coupons')
          .select('id, title, description, discountType, discountValue, minAmount, expiresAt, isActive, createdAt, coupon_downloads(count)')
          .eq('partnerUserId', id)
          .order('createdAt', { ascending: false }),
        // auth.users는 클라이언트에서 못 읽어 관리자 API 경유
        fetch(`/api/partners/${id}/auth-info`),
      ]);

      setAuthInfo(authResponse.ok ? ((await authResponse.json()) as PartnerAuthInfo) : null);

      // 같은 요일이 여러 행 쌓여 있을 수 있어 최신 1건만 사용한다
      const latestByDay = new Map<DayOfWeek, PartnerBusinessHour>();
      for (const row of (hoursResult.data ?? []) as any[]) {
        const day = row.dayOfWeek as DayOfWeek;
        if (latestByDay.has(day)) continue;
        latestByDay.set(day, {
          dayOfWeek: day,
          isClosed: row.isClosed === true,
          openTime: toHourMinute(row.openTime),
          closeTime: toHourMinute(row.closeTime),
          breakStartTime: toHourMinute(row.breakStartTime),
          breakEndTime: toHourMinute(row.breakEndTime),
          lastOrderTime: toHourMinute(row.lastOrderTime),
        });
      }

      setBusinessHours(
        DAY_OF_WEEK_ORDER.map((day) => latestByDay.get(day)).filter(
          (hour): hour is PartnerBusinessHour => hour !== undefined
        )
      );

      setCoupons(
        ((couponsResult.data ?? []) as any[]).map((row) => {
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
            downloadCount: downloads?.[0]?.count ?? 0,
          };
        })
      );
    } catch (err) {
      console.error('[usePartnerExtraInfo] 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!partnerDbId) {
      setBusinessHours([]);
      setCoupons([]);
      setAuthInfo(null);
      return;
    }
    fetchExtraInfo(partnerDbId);
  }, [partnerDbId, fetchExtraInfo]);

  return { businessHours, coupons, authInfo, loading };
}
