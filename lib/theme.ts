import {
  ActionIcon,
  Badge,
  Button,
  createTheme,
  Divider,
  Input,
  Pagination,
  Paper,
  rgba,
  ScrollArea,
  Table,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from '@mantine/core';

// 디자인 기준: banselin-admin(Skote 관리자 템플릿)의 색·표면·표 스타일을 Mantine 테마로 옮긴 것.
// 색·크기·간격을 바꿀 때는 페이지가 아니라 이 파일을 고친다. 크기는 모두 rem 단위로 쓴다.

const FONT_FAMILY =
  'Pretendard, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// 기준 색을 shade 6(Mantine 기본 primaryShade)에 고정한 팔레트
const blue: MantineColorsTuple = ['#eef1fd', '#d4dbfb', '#bac5f8', '#a1aff5', '#8999f1', '#7084ec', '#556ee6', '#3f57ca', '#2741af', '#002c95'];
const green: MantineColorsTuple = ['#ebf9f4', '#d0f1e4', '#b4e8d4', '#98dfc4', '#7bd6b3', '#5ccda1', '#34c38f', '#26a876', '#158e5e', '#007548'];
const red: MantineColorsTuple = ['#fef0f0', '#ffdada', '#ffc4c4', '#ffafad', '#fd9897', '#f98280', '#f46a6a', '#d65053', '#b9353d', '#9c1528'];
const yellow: MantineColorsTuple = ['#fef8ed', '#fcedd2', '#fbe2b7', '#f9d79c', '#f6cb82', '#f4c067', '#f1b44c', '#d49a36', '#b7811e', '#9b6900'];
const cyan: MantineColorsTuple = ['#eef6fe', '#d6e9fc', '#bddbfa', '#a5cef8', '#8bc0f6', '#70b2f3', '#50a5f1', '#3b8cd6', '#2473ba', '#005ca0'];

// 카드·헤더에 쓰는 부드러운 그림자 (테두리 대신)
const SOFT_SHADOW = '0 0.75rem 1.5rem rgba(18, 38, 63, 0.03)';

// 입력창·버튼 높이 — 기본(sm) 48px
type ControlSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const CONTROL_HEIGHTS: Record<ControlSizeKey, string> = {
  xs: '2.25rem', // 36px — 표 안 작은 버튼 등
  sm: '3rem', // 48px — 기본
  md: '3.125rem', // 50px
  lg: '3.375rem', // 54px
  xl: '3.75rem', // 60px
};

const BUTTON_PADDING_X: Record<ControlSizeKey, string> = {
  xs: '0.75rem',
  sm: '1.125rem',
  md: '1.25rem',
  lg: '1.5rem',
  xl: '1.75rem',
};

function controlSize(size: unknown): ControlSizeKey | null {
  const key = (size ?? 'sm') as string;
  return key in CONTROL_HEIGHTS ? (key as ControlSizeKey) : null;
}

// 아이콘 버튼 크기 — 기본(md) 36px로 표 안 글자 버튼(xs, 36px)과 높이를 맞춘다
const ACTION_ICON_SIZES: Record<ControlSizeKey, string> = {
  xs: '1.5rem', // 24px
  sm: '1.875rem', // 30px
  md: '2.25rem', // 36px — 기본
  lg: '2.5rem', // 40px — 헤더 버튼
  xl: '2.75rem', // 44px
};

type BadgeSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BADGE_SIZES: Record<BadgeSizeKey, { height: string; fontSize: string; paddingX: string }> = {
  xs: { height: '1.25rem', fontSize: '0.75rem', paddingX: '0.375rem' }, // 12px
  sm: { height: '1.375rem', fontSize: '0.8125rem', paddingX: '0.5rem' }, // 13px
  md: { height: '1.625rem', fontSize: '0.875rem', paddingX: '0.625rem' }, // 14px
  lg: { height: '1.875rem', fontSize: '0.9375rem', paddingX: '0.75rem' }, // 15px
  xl: { height: '2.125rem', fontSize: '1rem', paddingX: '0.875rem' }, // 16px
};

export const theme: MantineThemeOverride = createTheme({
  fontFamily: FONT_FAMILY,
  headings: { fontFamily: FONT_FAMILY, fontWeight: '600' },
  // 토글·체크박스·라디오(와 라벨)에 마우스를 올리면 손가락 모양
  cursorType: 'pointer',

  primaryColor: 'blue',
  colors: { blue, green, red, yellow, cyan },

  // 본문·입력창·버튼·표는 16px(1rem)
  fontSizes: {
    xs: '0.875rem', // 14px — 배지·캡션
    sm: '1rem', // 16px — 입력창·버튼·표 기본
    md: '1rem', // 16px — 본문
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
  },

  // 글자 굵기는 최소 medium(500) — Pretendard 400은 화면에서 너무 가늘게 보인다
  fontWeights: {
    regular: '500',
    medium: '600',
    bold: '700',
  },

  spacing: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    md: '1.25rem', // 20px
    lg: '1.5rem', // 24px — 카드 사이 간격(grid gutter)
    xl: '2.25rem', // 36px
  },

  // 모서리: 기본 0.5rem(8px), 카드 등 큰 요소 0.75rem(12px)
  defaultRadius: 'sm',
  radius: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
  },

  shadows: {
    xs: SOFT_SHADOW,
    sm: SOFT_SHADOW,
  },

  components: {
    // 표 가로 스크롤바는 얇고 연하게 — 기본 스크롤바(native)와 Mantine ScrollArea 둘 다
    TableScrollContainer: {
      styles: {
        scrollContainer: {
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--app-scrollbar-thumb) transparent',
        },
      },
    },
    ScrollArea: ScrollArea.extend({
      defaultProps: { scrollbarSize: 6 },
      styles: { thumb: { backgroundColor: 'var(--app-scrollbar-thumb)' } },
    }),
    // 페이지 번호도 이전/다음 버튼(xs)과 같은 36px로 맞춘다 — 테두리는 globals.css에서 없앤다
    Pagination: Pagination.extend({
      vars: () => ({
        root: {
          '--pagination-control-size': CONTROL_HEIGHTS.xs,
          '--pagination-control-fz': 'var(--mantine-font-size-sm)',
        },
      }),
    }),
    Paper: Paper.extend({
      defaultProps: { shadow: 'sm', radius: 'md' },
      // withBorder를 줘도 외곽선은 그리지 않는다 (테두리 대신 그림자·배경으로 구분)
      styles: { root: { '--paper-border-color': 'transparent' } as React.CSSProperties },
    }),
    Input: Input.extend({
      vars: (_theme, props) => {
        const size = controlSize(props.size);
        return { wrapper: size ? { '--input-height': CONTROL_HEIGHTS[size] } : {} };
      },
      // 토스처럼 테두리 없이 연한 블루그레이 배경, 포커스 때만 주색 테두리
      defaultProps: { variant: 'filled' },
      styles: { input: { '--input-bg': 'var(--app-input-bg)' } as React.CSSProperties },
    }),
    ActionIcon: ActionIcon.extend({
      vars: (_theme, props) => {
        const key = (props.size ?? 'md') as string;
        return {
          root: key in ACTION_ICON_SIZES ? { '--ai-size': ACTION_ICON_SIZES[key as ControlSizeKey] } : {},
        };
      },
    }),
    Button: Button.extend({
      // compact-* 크기는 Mantine 기본값을 그대로 쓴다
      vars: (_theme, props) => {
        const size = controlSize(props.size);
        return {
          root: size
            ? { '--button-height': CONTROL_HEIGHTS[size], '--button-padding-x': BUTTON_PADDING_X[size] }
            : {},
        };
      },
    }),
    // 테두리 대신 배경·여백으로 구분한다 — 구분선이 필요한 곳은 아주 연한 --app-divider 하나로 통일
    Divider: Divider.extend({ defaultProps: { color: 'var(--app-divider)' } }),
    Table: Table.extend({
      defaultProps: { highlightOnHover: true, borderColor: 'var(--app-divider)' },
      // 가운데 정렬 + 한 줄 셀. 화면이 좁으면 표가 가로 스크롤된다
      styles: {
        thead: { background: 'var(--app-table-head-bg)' },
        th: {
          whiteSpace: 'nowrap',
          textAlign: 'center',
          fontWeight: 600,
          color: 'var(--mantine-color-text)',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
        },
        td: {
          whiteSpace: 'nowrap',
          textAlign: 'center',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
        },
      },
    }),
    Badge: Badge.extend({
      // Mantine 기본 배지(md 11px, 굵게, 대문자)는 너무 작아 크기를 키우고 굵기를 낮춘다
      vars: (_theme, props) => {
        const size = BADGE_SIZES[(props.size as BadgeSizeKey) ?? 'md'] ?? BADGE_SIZES.md;
        return {
          root: {
            '--badge-height': size.height,
            '--badge-fz': size.fontSize,
            '--badge-padding-x': size.paddingX,
          },
        };
      },
      // label이 overflow: hidden이면 표 열 너비 계산 때 0까지 줄어 "진..."처럼 잘리므로 전체를 보여준다
      styles: {
        // 배지 안 숫자·글자가 잘 보이도록 한 단계 굵게
        root: { textTransform: 'none', fontWeight: 700 },
        label: { overflow: 'visible' },
      },
    }),
  },
});

// 다크 모드에서 light 변형(배지·칩)이 진한 원색 배경으로 쨍하게 보이지 않도록
// 기준 색(shade 6)을 반투명하게 깔고 글자는 같은 색의 밝은 톤(shade 3)으로 쓴다
const DARK_TINTED_COLORS = ['blue', 'green', 'red', 'yellow', 'cyan', 'orange', 'violet', 'grape', 'pink', 'teal', 'indigo', 'lime'];

export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    // 사이드바는 라이트/다크 모두 어두운 네이비
    '--app-sidebar-bg': '#2a3042',
    // 기준(#a6b0cf/#6a7187)은 네이비 위에서 흐려 한 단계씩 밝게
    '--app-sidebar-text': '#c3cbe4',
    '--app-sidebar-icon': '#8a93ad',
    '--app-sidebar-active': '#ffffff',
    '--app-sidebar-hover-bg': 'rgba(255, 255, 255, 0.04)',
    '--app-sidebar-divider': 'rgba(255, 255, 255, 0.06)',
    '--app-shadow-soft': SOFT_SHADOW,
  },
  light: {
    '--mantine-color-body': '#ffffff',
    '--mantine-color-text': '#495057',
    // 기준 text-muted(#74788d)는 흰 배경에서 흐려 한 단계 진하게
    '--mantine-color-dimmed': '#5f6478',
    // Mantine 기본 테두리(카드 외곽선, 기본 버튼 테두리 등)는 쓰지 않는다
    '--mantine-color-default-border': 'transparent',
    // 기본(회색) 버튼은 테두리 대신 연한 회색 배경 — 입력창과 같은 톤
    '--mantine-color-default': '#f2f4f8',
    '--mantine-color-default-hover': '#e8ebf1',
    '--app-divider': '#eef0f4',
    '--mantine-color-placeholder': '#8a8fa0',
    // 페이지 배경과 보조 배경 — gray.0/gray.1을 직접 쓰지 말고 이 변수를 쓴다
    '--app-bg-muted': '#f8f8fb',
    '--app-bg-subtle': '#eff2f7',
    '--app-table-head-bg': '#f8f9fa',
    '--app-input-bg': '#f2f4f8',
    '--app-scrollbar-thumb': '#dfe3ea',
  },
  dark: {
    '--mantine-color-text': '#ffffff',
    ...Object.fromEntries(
      DARK_TINTED_COLORS.flatMap((color) => [
        [`--mantine-color-${color}-light`, rgba(theme.colors[color][6], 0.18)],
        [`--mantine-color-${color}-light-hover`, rgba(theme.colors[color][6], 0.26)],
        [`--mantine-color-${color}-light-color`, theme.colors[color][3]],
      ])
    ),
    '--mantine-color-gray-light': 'rgba(255, 255, 255, 0.08)',
    '--mantine-color-gray-light-hover': 'rgba(255, 255, 255, 0.12)',
    '--mantine-color-gray-light-color': '#e9ecef',
    '--mantine-color-dimmed': 'var(--mantine-color-dark-1)',
    '--mantine-color-default-border': 'transparent',
    '--mantine-color-default': 'var(--mantine-color-dark-6)',
    '--mantine-color-default-hover': 'var(--mantine-color-dark-5)',
    '--app-divider': 'var(--mantine-color-dark-5)',
    '--app-bg-muted': 'var(--mantine-color-dark-8)',
    '--app-bg-subtle': 'var(--mantine-color-dark-6)',
    '--app-table-head-bg': 'var(--mantine-color-dark-6)',
    '--app-input-bg': 'var(--mantine-color-dark-6)',
    '--app-scrollbar-thumb': 'var(--mantine-color-dark-4)',
  },
});
