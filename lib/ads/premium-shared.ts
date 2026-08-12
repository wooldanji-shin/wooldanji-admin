// 프리미엄 광고 대리 등록/수정이 공유하는 검증·조립 로직

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcDiscountedTotalAmount,
  calcPremiumTotalAmount,
  fetchPremiumPricePerHouseholdPerWeek,
} from '@/lib/ads/pricing';
import { PREMIUM_MAX_WEEKS, PREMIUM_MIN_WEEKS, MAX_AD_IMAGES } from '@/lib/ads/constants';
import { ctaButtonsError, ctaUrlOfType, type CtaButton } from '@/lib/cta-button';

export interface PremiumBody {
  partnerId?: string;
  baseAdId?: string;
  title?: string;
  content?: string;
  imageUrls?: string[];
  naverMapUrl?: string;
  blogUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  kakaoOpenChatUrl?: string;
  ctaButtons?: CtaButton[];
  weeks?: number;
  discountRate?: number;
  adminMemo?: string;
  salesRepId?: string | null;
}

/** 사용자 앱이 저장하는 스냅샷 형태 — apartmentId는 넣지 않는다 */
export interface PremiumApartmentSnapshot {
  apartmentName: string;
  address: string;
  totalHouseholds: number;
}

export function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** 폼 입력 공통 검증 — 문제가 있으면 메시지, 없으면 null */
export function validatePremiumBody(body: PremiumBody): string | null {
  if (!body.title?.trim()) return '제목은 필수입니다.';

  const imageUrls = body.imageUrls ?? [];
  if (imageUrls.length === 0) return '광고 이미지를 1장 이상 등록해주세요.';
  if (imageUrls.length > MAX_AD_IMAGES) {
    return `광고 이미지는 최대 ${MAX_AD_IMAGES}장까지 등록할 수 있습니다.`;
  }

  const weeks = body.weeks ?? 0;
  if (weeks < PREMIUM_MIN_WEEKS || weeks > PREMIUM_MAX_WEEKS) {
    return `노출 주수는 ${PREMIUM_MIN_WEEKS}~${PREMIUM_MAX_WEEKS}주 사이여야 합니다.`;
  }

  return ctaButtonsError(body.ctaButtons ?? []);
}

/**
 * 기본 광고의 노출 아파트를 스냅샷으로 만든다.
 *
 * 프리미엄은 아파트를 따로 고르지 않고 기본 광고의 것을 그대로 승계하므로,
 * 클라이언트가 보낸 값이 아니라 여기서 DB를 다시 읽어 만든다.
 */
export async function buildApartmentSnapshot(
  admin: SupabaseClient,
  baseAdId: string
): Promise<{ snapshot: PremiumApartmentSnapshot[]; totalHouseholds: number }> {
  const { data } = await admin
    .from('advertisement_apartments_v2')
    .select('totalHouseholds, apartments:apartmentId(name, address)')
    .eq('advertisementId', baseAdId);

  const snapshot = ((data ?? []) as any[]).map((row) => ({
    apartmentName: row.apartments?.name ?? '',
    address: row.apartments?.address ?? '',
    totalHouseholds: row.totalHouseholds ?? 0,
  }));

  return {
    snapshot,
    totalHouseholds: snapshot.reduce((sum, a) => sum + a.totalHouseholds, 0),
  };
}

/** 총액·할인액 계산 */
export async function resolvePremiumAmounts(
  admin: SupabaseClient,
  totalHouseholds: number,
  weeks: number,
  discountRate: number
): Promise<{ totalAmount: number; discountedTotalAmount: number | null }> {
  const pricePerWeek = await fetchPremiumPricePerHouseholdPerWeek(admin);
  const totalAmount = calcPremiumTotalAmount(totalHouseholds, pricePerWeek, weeks);

  return {
    totalAmount,
    discountedTotalAmount: calcDiscountedTotalAmount(totalAmount, discountRate),
  };
}

/** 본문·링크·CTA 컬럼 (등록·수정 공통) */
export function premiumContentColumns(body: PremiumBody) {
  const ctaButtons = body.ctaButtons ?? [];

  return {
    title: body.title!.trim(),
    content: trimmedOrNull(body.content),
    imageUrls: body.imageUrls ?? [],
    naverMapUrl: trimmedOrNull(body.naverMapUrl),
    blogUrl: trimmedOrNull(body.blogUrl),
    youtubeUrl: trimmedOrNull(body.youtubeUrl),
    instagramUrl: trimmedOrNull(body.instagramUrl),
    kakaoOpenChatUrl: trimmedOrNull(body.kakaoOpenChatUrl),
    // 구버전 앱은 ctaButtons를 모르고 이 컬럼만 보므로 함께 채운다
    baeminUrl: ctaUrlOfType(ctaButtons, 'baemin'),
    coupangEatsUrl: ctaUrlOfType(ctaButtons, 'coupangEats'),
    ctaButtons: ctaButtons.length > 0 ? ctaButtons : null,
  };
}
