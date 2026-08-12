// 광고 상세 하단 CTA 버튼 (advertisements_v2.ctaButtons / premium_advertisements_v2.ctaButtons)
// 사용자 앱(lib/common/models/cta_button_model.dart)과 동일한 스키마를 사용한다.

export type CtaButtonType =
  | 'phone'
  | 'sms'
  | 'baemin'
  | 'coupangEats'
  | 'custom';

export interface CtaButton {
  /** 통계 집계 키 — extraClickCounts jsonb의 키로 쓰인다 */
  id: string;
  type: CtaButtonType;
  /** custom 타입 전용 라벨 (최대 8자) */
  label?: string | null;
  /** 전화/문자는 파트너 전화번호를 쓰므로 null */
  url?: string | null;
}

const PRESET_LABELS: Record<Exclude<CtaButtonType, 'custom'>, string> = {
  phone: '전화문의',
  sms: '문자문의',
  baemin: '배민',
  coupangEats: '쿠팡이츠',
};

/** 광고 상세 하단에 노출할 수 있는 버튼 최대 개수 (사용자 앱 kMaxCtaButtons와 동일) */
export const MAX_CTA_BUTTONS = 4;

/** 직접 추가할 수 있는 커스텀 버튼 최대 개수 (kMaxCustomCtaButtons와 동일) */
export const MAX_CUSTOM_CTA_BUTTONS = 2;

/** 커스텀 버튼 라벨 최대 글자수 (kCtaCustomLabelMaxLength와 동일) */
export const CTA_CUSTOM_LABEL_MAX_LENGTH = 4;

/** 배달앱 버튼을 선택할 수 있는 카테고리 이름 */
const DELIVERY_CATEGORY_NAME = '음식';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 통계 집계 키로 쓰이는 버튼 id (광고당 최대 4개라 6자면 충분) */
export function newCtaButtonId(): string {
  return Array.from(
    { length: 6 },
    () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]
  ).join('');
}

/** 배달앱 버튼을 고를 수 있는 카테고리인지 — 음식 카테고리 + 서브카테고리 선택 필요 */
export function isDeliveryCategory(
  categoryName: string | null | undefined,
  subCategoryIds: string[]
): boolean {
  return categoryName === DELIVERY_CATEGORY_NAME && subCategoryIds.length > 0;
}

/** 전화·문자는 파트너 전화번호를 쓰므로 링크가 필요 없다 */
export function needsUrl(button: CtaButton): boolean {
  return button.type !== 'phone' && button.type !== 'sms';
}

export function isDeliveryButton(button: CtaButton): boolean {
  return button.type === 'baemin' || button.type === 'coupangEats';
}

/** 저장 가능한 상태인지 검사 — 문제가 있으면 보여줄 메시지, 없으면 null */
export function ctaButtonsError(buttons: CtaButton[]): string | null {
  for (const button of buttons) {
    if (button.type === 'custom' && !button.label?.trim()) {
      return '추가한 버튼의 이름을 입력해주세요.';
    }
    if (!needsUrl(button)) continue;

    const url = button.url?.trim() ?? '';
    if (!url) return `${ctaButtonLabel(button)} 버튼의 링크를 입력해주세요.`;
    if (!url.startsWith('https://')) {
      return 'https://로 시작하는 링크를 입력해주세요.';
    }
  }
  return null;
}

/** 특정 타입 버튼의 URL — baeminUrl/coupangEatsUrl 컬럼 미러링에 쓴다 */
export function ctaUrlOfType(
  buttons: CtaButton[],
  type: CtaButtonType
): string | null {
  return buttons.find((b) => b.type === type)?.url?.trim() || null;
}

/** 화면에 표시할 버튼 이름 */
export function ctaButtonLabel(button: CtaButton): string {
  if (button.type === 'custom') return button.label ?? '(이름 없음)';
  return PRESET_LABELS[button.type] ?? button.type;
}

/** jsonb 값 → 버튼 목록 (미설정이면 null) */
export function parseCtaButtons(raw: unknown): CtaButton[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((b): b is CtaButton => !!b && typeof b === 'object');
}

/** 버튼 목록을 한 줄 요약으로 (비교 표시용) */
export function ctaButtonsSummary(buttons: CtaButton[] | null | undefined): string {
  if (!buttons || buttons.length === 0) return '(없음)';
  return buttons.map(ctaButtonLabel).join(' · ');
}

/** 파트너가 직접 추가한 버튼만 (버튼별 클릭 통계 표시용) */
export function customCtaButtons(buttons: CtaButton[] | null | undefined): CtaButton[] {
  return (buttons ?? []).filter((b) => b.type === 'custom');
}

/** 날짜별 extraClickCounts jsonb를 버튼 id 기준으로 합산 */
export function mergeExtraClickCounts(rows: any[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const row of rows) {
    const raw = row?.extraClickCounts;
    if (!raw || typeof raw !== 'object') continue;
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== 'number') continue;
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
}
