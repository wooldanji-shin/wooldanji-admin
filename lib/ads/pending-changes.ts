// 파트너가 쓰는 pendingChanges 를 본 레코드에 반영하기 전에 콘텐츠 컬럼만 남긴다.
// status/endedAt/paymentStatus 등이 섞여 들어와도 결제·상태 컬럼이 덮어써지지 않게 한다.
// (EF auto-approve-ad-modifications 와 동일한 목록을 유지해야 한다)

const PREMIUM_CONTENT_KEYS = [
  'title',
  'content',
  'naverMapUrl',
  'blogUrl',
  'youtubeUrl',
  'instagramUrl',
  'kakaoOpenChatUrl',
  'baeminUrl',
  'coupangEatsUrl',
  'ctaButtons',
  'imageUrls',
] as const;

const BASE_CONTENT_KEYS = ['categoryId', ...PREMIUM_CONTENT_KEYS] as const;

function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.includes(key)));
}

export function pickPremiumContentChanges(changes: Record<string, unknown>) {
  return pickKeys(changes, PREMIUM_CONTENT_KEYS);
}

export function pickBaseContentChanges(changes: Record<string, unknown>) {
  return pickKeys(changes, BASE_CONTENT_KEYS);
}
