'use client';

import { Select, SimpleGrid } from '@mantine/core';
import { SOLO_MAX_MONTHS, SOLO_MAX_WEEKS, type SoloPeriodUnit } from '@/lib/ads/solo-popup';

export interface RestartPeriod {
  unit: SoloPeriodUnit;
  count: number;
}

/** 종료 광고 무료 재시작 다이얼로그의 기간 선택 (수정 폼과 같은 주/개월 단위) */
export function RestartPeriodFields({
  value,
  onChange,
}: {
  value: RestartPeriod;
  onChange: (next: RestartPeriod) => void;
}): React.ReactElement {
  const max = value.unit === 'month' ? SOLO_MAX_MONTHS : SOLO_MAX_WEEKS;
  const suffix = value.unit === 'month' ? '개월' : '주';

  return (
    <SimpleGrid cols={2} spacing="sm">
      <Select
        label="기간 단위"
        data={[
          { value: 'week', label: '주' },
          { value: 'month', label: '개월 (1개월 = 4주)' },
        ]}
        value={value.unit}
        onChange={(v) => {
          if (v === null) return;
          const unit = v as SoloPeriodUnit;
          const unitMax = unit === 'month' ? SOLO_MAX_MONTHS : SOLO_MAX_WEEKS;
          onChange({ unit, count: Math.min(value.count, unitMax) });
        }}
        allowDeselect={false}
      />
      <Select
        label={`${suffix} 수`}
        data={Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `${i + 1}${suffix}` }))}
        value={String(value.count)}
        onChange={(v) => {
          if (v === null) return;
          onChange({ ...value, count: Number(v) });
        }}
        allowDeselect={false}
      />
    </SimpleGrid>
  );
}
