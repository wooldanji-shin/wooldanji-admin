'use client';

import type { ReactNode } from 'react';
import { Group, UnstyledButton } from '@mantine/core';
import classes from './filter-chips.module.css';

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  /** 있으면 이름 옆에 개수를 표시한다 (0이면 흐리게) */
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: FilterChipOption<T>[];
  /** 선택된 값 (없으면 null) */
  value: T | null;
  /** 누른 칩의 값을 그대로 넘긴다 — 토글·전체 처리 등은 호출하는 쪽에서 결정 */
  onChange: (value: T) => void;
}

/** 목록 상단 필터용 알약 칩 묶음 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: FilterChipsProps<T>): React.ReactElement {
  return (
    <Group gap={6}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <UnstyledButton
            key={option.value}
            className={classes.chip}
            data-active={isActive || undefined}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={classes.count} data-zero={option.count === 0 || undefined}>
                {option.count.toLocaleString()}
              </span>
            )}
          </UnstyledButton>
        );
      })}
    </Group>
  );
}

interface FilterRowProps {
  label: string;
  children: ReactNode;
}

/** 필터 카드 안의 한 줄: 왼쪽 이름표 + 오른쪽 칩/입력 */
export function FilterRow({ label, children }: FilterRowProps): React.ReactElement {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap" className={classes.row}>
      <span className={classes.rowLabel}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </Group>
  );
}
