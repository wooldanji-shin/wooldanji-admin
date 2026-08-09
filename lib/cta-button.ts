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
