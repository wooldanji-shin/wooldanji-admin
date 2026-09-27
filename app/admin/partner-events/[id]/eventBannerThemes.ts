/**
 * 홈 이벤트 배너 테마 — 앱 lib/user/event/utils/event_text_styles.dart 의 EventBannerTheme 과 같은 값.
 * 앱 쪽 테마를 추가·수정하면 여기도 같이 맞춰야 관리자 미리보기가 실제 앱과 같게 보인다.
 * DB partner_events."bannerTheme" 에 key 가 저장된다.
 */

export interface EventBannerPalette {
  background: string;
  /** 1순위 이벤트명 + 금액 + 자세히 보기 */
  title: string;
  /** 2순위 할인 대상 + '추첨' */
  benefit: string;
  /** 3순위 인원(N명) */
  winner: string;
  /** 4순위 기간 */
  sub: string;
  /** 5순위 상호명 */
  business: string;
  /** 썸네일 빈 자리 */
  thumbnail: string;
}

export type EventBannerDecoShape = 'circle' | 'ring' | 'diamond' | 'pill' | 'dotGrid';

/** 배경 장식 — 카드 오른쪽 기준 위치(top 또는 bottom), 단위 px */
export interface EventBannerDeco {
  shape: EventBannerDecoShape;
  width: number;
  height?: number;
  color: string;
  right: number;
  top?: number;
  bottom?: number;
  opacity?: number;
  rotationDeg?: number;
  ringWidth?: number;
}

export interface EventBannerTheme {
  key: string;
  label: string;
  palette: EventBannerPalette;
  decos: EventBannerDeco[];
}

const THUMB_ON_DARK = 'rgba(255,255,255,0.16)';
const THUMB_ON_LIGHT = 'rgba(0,0,0,0.08)';

export const EVENT_BANNER_THEMES: EventBannerTheme[] = [
  {
    key: 'warm',
    label: '웜',
    palette: { background: '#2B2118', title: '#FFF6EC', benefit: '#F2D9C2', winner: '#FF9A55', sub: '#D9C8B6', business: '#C7B5A2', thumbnail: THUMB_ON_DARK },
    decos: [
      { shape: 'circle', width: 24, color: '#FF7A2F', right: 108, top: 14 },
      { shape: 'circle', width: 36, color: '#FF7A2F', right: -10, top: -12 },
      { shape: 'circle', width: 22, color: '#FF9A55', opacity: 0.8, right: -4, bottom: -6 },
      { shape: 'circle', width: 10, color: '#FFD23F', opacity: 0.9, right: 12, top: 14 },
      { shape: 'circle', width: 10, color: '#FFD23F', opacity: 0.7, right: 112, top: 90 },
    ],
  },
  {
    key: 'forest',
    label: '포레스트',
    palette: { background: '#1F2B22', title: '#F6F3EA', benefit: '#DDE5D6', winner: '#FFB36B', sub: '#C9D3C4', business: '#B7C4B5', thumbnail: THUMB_ON_DARK },
    decos: [
      { shape: 'ring', width: 120, ringWidth: 14, color: '#FF7A2F', right: -22, top: -38 },
      { shape: 'circle', width: 10, color: '#FFB36B', right: 118, bottom: 50 },
    ],
  },
  {
    key: 'indigo',
    label: '인디고',
    palette: { background: '#23244A', title: '#F6F6FF', benefit: '#DCDDF5', winner: '#FFD23F', sub: '#C7C9E6', business: '#B4B6D9', thumbnail: THUMB_ON_DARK },
    decos: [
      { shape: 'dotGrid', width: 124, height: 96, color: '#FFD23F', opacity: 0.55, right: 0, top: 6 },
      { shape: 'circle', width: 56, color: '#FFD23F', right: -26, top: -20 },
    ],
  },
  {
    key: 'plum',
    label: '플럼',
    palette: { background: '#3A1E3F', title: '#FFF3FA', benefit: '#F1D6EA', winner: '#FF9FC2', sub: '#E0C6DC', business: '#D4B7D4', thumbnail: THUMB_ON_DARK },
    decos: [
      { shape: 'circle', width: 70, color: '#FF6F9E', right: -28, top: -24 },
      { shape: 'circle', width: 22, color: '#FF9FC2', opacity: 0.9, right: 104, top: 14 },
      { shape: 'circle', width: 12, color: '#FFC2D8', opacity: 0.8, right: 106, bottom: 52 },
      { shape: 'circle', width: 26, color: '#FF6F9E', right: -10, bottom: -12 },
    ],
  },
  {
    key: 'terracotta',
    label: '테라코타',
    palette: { background: '#F7E6D9', title: '#2A1A12', benefit: '#4A3226', winner: '#B8430F', sub: '#6B4C3D', business: '#8A6552', thumbnail: THUMB_ON_LIGHT },
    decos: [
      { shape: 'diamond', width: 64, color: '#E8906A', right: -22, top: -18 },
      { shape: 'diamond', width: 14, color: '#D96A3D', opacity: 0.9, right: 110, top: 20 },
      { shape: 'diamond', width: 9, color: '#D96A3D', opacity: 0.7, right: 111, bottom: 53 },
    ],
  },
  {
    key: 'charcoal',
    label: '차콜',
    palette: { background: '#1E1E23', title: '#F7F7F9', benefit: '#DEDEE4', winner: '#FF9A55', sub: '#C8C8D0', business: '#B5B5BD', thumbnail: THUMB_ON_DARK },
    decos: [
      { shape: 'pill', width: 22, height: 8, color: '#FF7A2F', rotationDeg: -30, right: 102, top: 12 },
      { shape: 'pill', width: 26, height: 8, color: '#FFD23F', rotationDeg: 40, right: 0, top: 8 },
      { shape: 'pill', width: 18, height: 7, color: '#FF6F9E', rotationDeg: 20, right: 98, bottom: 51 },
      { shape: 'circle', width: 10, color: '#4FD1C5', right: 4, top: 52 },
      { shape: 'pill', width: 14, height: 6, color: '#4FD1C5', rotationDeg: -15, right: 26, top: -6 },
      { shape: 'circle', width: 7, color: '#FFD23F', right: 125, top: 58 },
      { shape: 'pill', width: 22, height: 8, color: '#FF6F9E', rotationDeg: -35, right: -2, bottom: 4 },
    ],
  },
  {
    key: 'teal',
    label: '딥 틸',
    palette: { background: '#0F3B3A', title: '#F4FBF9', benefit: '#D5EAE6', winner: '#FFC98A', sub: '#BFD9D5', business: '#A9C9C5', thumbnail: THUMB_ON_DARK },
    decos: [
      { shape: 'circle', width: 150, color: '#F1DFC0', opacity: 0.9, right: -40, top: -70 },
      { shape: 'circle', width: 10, color: '#FFC98A', right: 116, bottom: 48 },
    ],
  },
  {
    key: 'mint',
    label: '민트',
    palette: { background: '#E3F1E9', title: '#14271D', benefit: '#2C4336', winner: '#0E7045', sub: '#3F5A4B', business: '#4F6B5C', thumbnail: THUMB_ON_LIGHT },
    decos: [
      { shape: 'ring', width: 96, ringWidth: 10, color: '#8FD1AE', right: -36, top: -30 },
      { shape: 'circle', width: 14, color: '#3FAE78', opacity: 0.8, right: 110, top: 18 },
      { shape: 'circle', width: 30, color: '#8FD1AE', right: -14, bottom: -10 },
    ],
  },
];

/** 모르는 값은 첫 테마(웜)로 — 앱 EventBannerTheme.fromKey 와 같은 규칙 */
export function eventBannerThemeOf(key: string | null | undefined): EventBannerTheme {
  return EVENT_BANNER_THEMES.find((t) => t.key === key) ?? EVENT_BANNER_THEMES[0];
}
