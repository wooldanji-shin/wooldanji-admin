// 광고 금액 계산 · 첫 광고 혜택 판정
//
// 파트너가 신청한 광고의 승인(approve)과 관리자가 대신 등록하는 광고(create)가
// 같은 산식을 써야 하므로 한곳에 모아둔다.

import type { SupabaseClient } from '@supabase/supabase-js';

/** ad_pricing_v2 조회 실패 시 사용하는 세대당 기본 단가 */
const FALLBACK_PRICE_PER_HOUSEHOLD = 70;

/** 가장 최근에 적용된 세대당 단가 */
export async function fetchPricePerHousehold(
  supabase: SupabaseClient
): Promise<number> {
  const { data } = await supabase
    .from('ad_pricing_v2')
    .select('pricePerHousehold')
    .order('effectiveFrom', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { pricePerHousehold?: number } | null)?.pricePerHousehold
    ?? FALLBACK_PRICE_PER_HOUSEHOLD;
}

/** 월 광고료 = 총 세대수 × 세대당 단가 × (1 - 할인율), 10원 단위 반올림 */
export function calcMonthlyAmount(
  totalHouseholds: number,
  pricePerHousehold: number,
  discountRate: number
): number {
  return Math.round(
    (totalHouseholds * pricePerHousehold * (100 - discountRate)) / 100 / 10
  ) * 10;
}

/** ad_pricing_v2 조회 실패 시 사용하는 프리미엄 세대당 주간 단가 */
const FALLBACK_PREMIUM_PRICE_PER_WEEK = 20;

/** 가장 최근에 적용된 프리미엄 세대당 주간 단가 */
export async function fetchPremiumPricePerHouseholdPerWeek(
  supabase: SupabaseClient
): Promise<number> {
  const { data } = await supabase
    .from('ad_pricing_v2')
    .select('premiumPricePerHouseholdPerWeek')
    .order('effectiveFrom', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { premiumPricePerHouseholdPerWeek?: number } | null)
    ?.premiumPricePerHouseholdPerWeek ?? FALLBACK_PREMIUM_PRICE_PER_WEEK;
}

/** 프리미엄 총액 = 총 세대수 × 세대당 주간 단가 × 주수 (반올림 없음 — 사용자 앱과 동일) */
export function calcPremiumTotalAmount(
  totalHouseholds: number,
  pricePerHouseholdPerWeek: number,
  weeks: number
): number {
  return totalHouseholds * pricePerHouseholdPerWeek * weeks;
}

/** 할인 적용 금액 (10원 단위 반올림). 할인율이 0이면 null — 미할인과 구분한다 */
export function calcDiscountedTotalAmount(
  totalAmount: number,
  discountRate: number
): number | null {
  if (discountRate <= 0) return null;
  return Math.round((totalAmount * (100 - discountRate)) / 100 / 10) * 10;
}

/**
 * 아파트별 총 세대수를 DB에서 직접 집계한다.
 *
 * 클라이언트가 보낸 세대수를 그대로 믿으면 광고료를 임의로 낮출 수 있으므로
 * 등록 시점에 서버가 다시 계산한 값만 저장한다.
 */
export async function fetchApartmentHouseholds(
  supabase: SupabaseClient,
  apartmentIds: string[]
): Promise<Map<string, number>> {
  const households = new Map<string, number>();
  if (apartmentIds.length === 0) return households;

  const { data } = await supabase
    .from('apartment_buildings')
    .select('apartmentId, householdsCount')
    .in('apartmentId', apartmentIds);

  for (const row of (data ?? []) as { apartmentId: string; householdsCount: number | null }[]) {
    households.set(
      row.apartmentId,
      (households.get(row.apartmentId) ?? 0) + (row.householdsCount ?? 0)
    );
  }

  return households;
}

/**
 * 이 파트너의 신규 광고가 "첫 광고"인지 판정한다.
 *
 * 사용자 앱의 제출 로직(AdApplicationRepository.upsertAdvertisement)과 같은 규칙:
 * 운영까지 간 광고가 없고, 첫 광고 표식을 이미 가진 광고도 없어야 한다.
 * 관리자 대리 등록이 이 판정을 건너뛰면 파트너마다 첫 광고 혜택이 무제한으로 붙는다.
 */
export async function computeIsFirstAdApplication(
  supabase: SupabaseClient,
  partnerId: string
): Promise<boolean> {
  const { data: partner } = await supabase
    .from('partner_users')
    .select('hasHadRunningAd')
    .eq('id', partnerId)
    .single();

  if ((partner as { hasHadRunningAd?: boolean } | null)?.hasHadRunningAd) return false;

  const { data: existing } = await supabase
    .from('advertisements_v2')
    .select('id')
    .eq('partnerId', partnerId)
    .eq('isFirstAdApplication', true)
    .neq('adStatus', 'rejected');

  return (existing ?? []).length === 0;
}

export interface BenefitInput {
  isFirstAd: boolean;
  /** 관리자가 파트너와 협의해 첫 광고가 아닌데도 혜택을 적용하는 경우 */
  overrideEnabled?: boolean;
  discountRate?: number;
  freeMonths?: number;
}

/** 첫 광고도 아니고 예외 승인도 아니면 할인율·무료기간을 모두 0으로 강제한다 */
export function resolveBenefits({
  isFirstAd,
  overrideEnabled,
  discountRate,
  freeMonths,
}: BenefitInput): { discountRate: number; freeMonths: number } {
  if (!isFirstAd && overrideEnabled !== true) {
    return { discountRate: 0, freeMonths: 0 };
  }

  return {
    discountRate: Math.min(100, Math.max(0, discountRate ?? 0)),
    freeMonths: Math.max(0, freeMonths ?? 0),
  };
}
