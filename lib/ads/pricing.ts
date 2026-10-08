// 광고 금액 계산 · 첫 광고 혜택 판정
//
// 파트너가 신청한 광고의 승인(approve)과 관리자가 대신 등록하는 광고(create)가
// 같은 산식을 써야 하므로 한곳에 모아둔다.

import type { SupabaseClient } from '@supabase/supabase-js';

export const PRICE_LOOKUP_FAILED_MESSAGE =
  '세대당 단가를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.';

/**
 * 가장 최근에 적용된 세대당 단가.
 * 조회에 실패하면 throw — 임의의 기본 단가로 금액을 계산해 저장하면 안 된다.
 */
export async function fetchPricePerHousehold(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from('ad_pricing_v2')
    .select('pricePerHousehold')
    .order('effectiveFrom', { ascending: false })
    .limit(1)
    .maybeSingle();

  const price = (data as { pricePerHousehold?: number } | null)?.pricePerHousehold;
  if (error || typeof price !== 'number' || price <= 0) {
    console.error('Failed to fetch pricePerHousehold:', error ?? data);
    throw new Error(PRICE_LOOKUP_FAILED_MESSAGE);
  }
  return price;
}

export const ZERO_HOUSEHOLDS_MESSAGE =
  '노출 아파트의 세대수 합계가 0입니다. 아파트 동·세대수 정보를 확인해주세요.';

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

/** 광고중 광고의 아파트를 바꿀 때 기준이 되는 현재 청구 조건 */
export interface RunningAdBilling {
  /** 지금 금액을 계산할 때 쓴 세대수 합계 (advertisement_apartments_v2.totalHouseholds 합) */
  totalHouseholds: number;
  /** 현재 청구액 (할인 후) */
  monthlyAmount: number;
  /** 현재 정상가 (할인 전) */
  originalMonthlyAmount: number;
  discountRate: number;
}

export interface RepricedAmounts {
  monthlyAmount: number;
  originalMonthlyAmount: number;
  /** standard: 현재 단가로 새로 계산 / proportional: 기존 단가를 유지한 채 세대수 비율로 조정 */
  method: 'standard' | 'proportional';
}

/**
 * amount × (newHouseholds / oldHouseholds)를 10원 단위로 반올림한다.
 * 예전 단가는 69.9원처럼 딱 떨어지지 않아 세대당 단가를 먼저 구해 반올림하면 오차가 쌓인다.
 * 정수 연산만으로 한 번에 계산해 부동소수 오차를 피한다.
 */
export function scaleByHouseholds(
  amount: number,
  oldHouseholds: number,
  newHouseholds: number
): number {
  // floor(amount × new / old / 10 + 0.5) × 10 을 정수 나눗셈으로 옮긴 식
  return Math.floor(
    (2 * amount * newHouseholds + 10 * oldHouseholds) / (20 * oldHouseholds)
  ) * 10;
}

/**
 * 광고중 광고의 노출 아파트가 바뀔 때 새 청구액·정상가를 계산한다.
 *
 * 현재 단가로 청구 중인 광고는 다른 흐름(승인·수정 승인)과 같은 산식으로 새로 계산한다.
 * 예전 단가로 청구 중인 광고는 그 단가와 할인 조건을 그대로 둔 채 세대수 비율만큼만 조정한다
 * — 현재 단가로 다시 계산하면 아파트를 조금만 바꿔도 단가 차이만큼 금액이 뛴다.
 */
export function repriceRunningAd(
  current: RunningAdBilling,
  newTotalHouseholds: number,
  pricePerHousehold: number
): RepricedAmounts {
  const { totalHouseholds, monthlyAmount, originalMonthlyAmount, discountRate } = current;

  const billedAtCurrentPrice =
    originalMonthlyAmount === calcMonthlyAmount(totalHouseholds, pricePerHousehold, 0) &&
    monthlyAmount === calcMonthlyAmount(totalHouseholds, pricePerHousehold, discountRate);

  if (billedAtCurrentPrice) {
    return {
      monthlyAmount: calcMonthlyAmount(newTotalHouseholds, pricePerHousehold, discountRate),
      originalMonthlyAmount: calcMonthlyAmount(newTotalHouseholds, pricePerHousehold, 0),
      method: 'standard',
    };
  }

  return {
    monthlyAmount: scaleByHouseholds(monthlyAmount, totalHouseholds, newTotalHouseholds),
    originalMonthlyAmount: scaleByHouseholds(
      originalMonthlyAmount,
      totalHouseholds,
      newTotalHouseholds
    ),
    method: 'proportional',
  };
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
