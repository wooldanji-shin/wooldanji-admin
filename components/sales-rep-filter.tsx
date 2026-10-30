'use client';

import { useEffect, useState } from 'react';
import { Select } from '@mantine/core';
import { fetchSelectableSalesReps, type SalesRep } from '@/lib/ads/sales-reps';

const ALL_VALUE = '__all__';

/** 담당자가 지정되지 않은 광고만 보기 */
export const SALES_REP_UNASSIGNED = '__unassigned__';

interface SalesRepFilterProps {
  /** null이면 전체 */
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * 목록 화면의 영업 담당자 필터
 *
 * 비활성 담당자도 포함한다 — 과거 광고를 담당자로 찾아볼 수 있어야 한다.
 */
export function SalesRepFilter({
  value,
  onChange,
}: SalesRepFilterProps): React.ReactElement {
  const [reps, setReps] = useState<SalesRep[]>([]);

  useEffect(() => {
    fetchSelectableSalesReps({ includeInactive: true })
      .then(setReps)
      .catch(() => setReps([]));
  }, []);

  return (
    <Select
      value={value ?? ALL_VALUE}
      onChange={(v) => onChange(v === null || v === ALL_VALUE ? null : v)}
      allowDeselect={false}
      placeholder="영업 담당자"
      w={180}
      data={[
        { value: ALL_VALUE, label: '담당자 전체' },
        { value: SALES_REP_UNASSIGNED, label: '미지정' },
        ...reps.map((rep) => ({
          value: rep.id,
          label: `${rep.name}${!rep.isActive ? ' (비활성)' : ''}`,
        })),
      ]}
    />
  );
}
