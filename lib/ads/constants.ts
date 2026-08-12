// 광고 입력 제한값 — 폼과 API가 같은 기준으로 검사하도록 한곳에 둔다.

/** 광고 이미지 최대 개수 (사용자 앱 광고 신청 화면과 동일) */
export const MAX_AD_IMAGES = 10;

/** 프리미엄 광고 신청 가능 주수 (사용자 앱은 1~5로 clamp한다) */
export const PREMIUM_MIN_WEEKS = 1;
export const PREMIUM_MAX_WEEKS = 5;
