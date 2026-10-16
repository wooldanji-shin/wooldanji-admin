// 단독 팝업 광고 공용 타입·상수·클라이언트 검증
// 최종 검증/금액 계산은 DB 함수(solo_popup_content_error, solo_popup_period_to_weeks, calc_solo_popup_amount)가 한다.
// 여기 값은 화면 안내·즉시 피드백용 미리보기이며 DB 규칙과 같아야 한다.

export type SoloPopupStatus = 'pending' | 'approved' | 'running' | 'ended' | 'rejected';
export type SoloButtonMode = 'direct' | 'split' | 'detail';
export type SoloPeriodUnit = 'week' | 'month';
/** 문구 형식 — 둘 다 bulletLines(줄 배열)에 저장, 자유 문장은 표시할 때 글머리표 기호 없음 */
export type SoloContentType = 'bullets' | 'text';

export const SOLO_TITLE_MAX = 20;
export const SOLO_BULLET_MAX_LINES = 3;
export const SOLO_BULLET_MAX_LENGTH = 25;
/** 자유 문장 — 최대 3줄, 줄 길이 합(줄바꿈 제외) 75자 */
export const SOLO_TEXT_MAX_LINES = 3;
export const SOLO_TEXT_MAX_LENGTH = 75;
export const SOLO_LABEL_MAX = 8;
export const SOLO_MAX_WEEKS = 48;
export const SOLO_MAX_MONTHS = 12;
/** 서버 solo_popup_period_to_weeks 와 동일해야 한다 */
export const SOLO_WEEKS_PER_MONTH = 4;
/** 3:4 세로 이미지, 업로드 시 이 크기로 축소 */
export const SOLO_IMAGE_WIDTH = 1080;
export const SOLO_IMAGE_HEIGHT = 1440;

export interface SoloButton {
  label?: string;
  url: string;
}

export interface SoloContent {
  title: string;
  imageUrl: string;
  bulletLines: string[];
  contentType: SoloContentType;
  buttonMode: SoloButtonMode;
  buttons: SoloButton[];
}

/** pendingChanges 에서 반영을 허용하는 콘텐츠 컬럼 (화이트리스트) */
export const SOLO_CONTENT_COLUMNS = ['title', 'imageUrl', 'bulletLines', 'contentType', 'buttonMode', 'buttons'] as const;

export const CONTENT_TYPE_LABEL: Record<SoloContentType, string> = {
  bullets: '글머리표',
  text: '자유 문장',
};

/** 자유 문장 원문 → 저장 줄 배열 (앞뒤 공백 제거, 빈 줄 제외) */
export function soloTextLines(body: string): string[] {
  return body.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** 자유 문장 글자수 — 줄 길이 합(줄바꿈 제외), 서버와 같은 기준 */
export function soloTextLength(body: string): number {
  return soloTextLines(body).reduce((sum, l) => sum + l.length, 0);
}

export const BUTTON_MODE_LABEL: Record<SoloButtonMode, string> = {
  direct: '바로 링크',
  split: '링크 분기(버튼 2개)',
  detail: '광고 상세',
};

export function periodToWeeks(unit: SoloPeriodUnit, count: number): number {
  return unit === 'month' ? count * SOLO_WEEKS_PER_MONTH : count;
}

export function periodLabel(unit: SoloPeriodUnit, count: number): string {
  return unit === 'month'
    ? `${count}개월 (${count * SOLO_WEEKS_PER_MONTH}주)`
    : `${count}주`;
}

const HTTP_URL = /^https?:\/\/\S+$/i;

export function isHttpUrl(value: string): boolean {
  return HTTP_URL.test(value.trim());
}

/** 폼 입력 검증 — 문제가 있으면 메시지, 없으면 null */
export function soloContentError(c: SoloContent): string | null {
  if (!c.title.trim()) return '제목을 입력해주세요.';
  if (c.title.length > SOLO_TITLE_MAX) return `제목은 ${SOLO_TITLE_MAX}자 이하여야 합니다.`;
  if (!c.imageUrl) return '이미지를 등록해주세요.';

  const linesError = c.contentType === 'text' ? textLinesError(c.bulletLines) : bulletLinesError(c.bulletLines);
  if (linesError) return linesError;

  if (c.buttonMode === 'detail') return null;
  const expected = c.buttonMode === 'split' ? 2 : 1;
  if (c.buttons.length !== expected) return '버튼 개수가 맞지 않습니다.';
  if (c.buttons.some((b) => !isHttpUrl(b.url))) return '버튼 링크는 http:// 또는 https:// 로 시작해야 합니다.';
  if (c.buttonMode === 'split' && c.buttons.some((b) => !b.label?.trim() || b.label.length > SOLO_LABEL_MAX)) {
    return `버튼 라벨은 1~${SOLO_LABEL_MAX}자여야 합니다.`;
  }
  return null;
}

function bulletLinesError(lines: string[]): string | null {
  if (lines.length < 1 || lines.length > SOLO_BULLET_MAX_LINES) {
    return `글머리표는 1~${SOLO_BULLET_MAX_LINES}줄이어야 합니다.`;
  }
  if (lines.some((l) => !l.trim() || l.length > SOLO_BULLET_MAX_LENGTH)) {
    return `글머리표는 줄당 1~${SOLO_BULLET_MAX_LENGTH}자여야 합니다.`;
  }
  return null;
}

function textLinesError(lines: string[]): string | null {
  if (lines.length < 1 || lines.some((l) => !l.trim())) return '문장을 입력해주세요.';
  if (lines.length > SOLO_TEXT_MAX_LINES) return `문장은 최대 ${SOLO_TEXT_MAX_LINES}줄입니다.`;
  const total = lines.reduce((sum, l) => sum + l.length, 0);
  if (total > SOLO_TEXT_MAX_LENGTH) return `문장은 ${SOLO_TEXT_MAX_LENGTH}자 이하여야 합니다.`;
  return null;
}

export function periodError(unit: SoloPeriodUnit, count: number): string | null {
  const max = unit === 'month' ? SOLO_MAX_MONTHS : SOLO_MAX_WEEKS;
  if (!Number.isInteger(count) || count < 1 || count > max) {
    return `${unit === 'month' ? '개월' : '주'} 수는 1~${max} 사이여야 합니다.`;
  }
  return null;
}

/** 저장용 정규화 — direct 는 url 만, split 는 label+url, detail 은 빈 배열 */
export function normalizeButtons(mode: SoloButtonMode, buttons: SoloButton[]): SoloButton[] {
  if (mode === 'detail') return [];
  if (mode === 'direct') return [{ url: buttons[0].url.trim() }];
  return buttons.map((b) => ({ label: b.label!.trim(), url: b.url.trim() }));
}
