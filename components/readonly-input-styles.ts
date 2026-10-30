import type { CSSProperties } from 'react';

/** 표시 전용으로 disabled 처리한 입력을 흐리지 않고 또렷하게 보여주는 스타일 */
export const READONLY_INPUT_STYLES: { input: CSSProperties } = {
  input: {
    opacity: 1,
    color: 'var(--mantine-color-text)',
    backgroundColor: 'var(--app-bg-muted)',
    cursor: 'default',
  },
};
