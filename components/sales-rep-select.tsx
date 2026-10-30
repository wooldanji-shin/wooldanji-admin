'use client';

import { useEffect, useState } from 'react';
import { Select } from '@mantine/core';
import { fetchSelectableSalesReps, type SalesRep } from '@/lib/ads/sales-reps';

/** "지정 안 함"을 나타내는 값 — Select는 빈 문자열을 값으로 쓸 수 없다 */
const NONE_VALUE = '__none__';

interface SalesRepSelectProps {
  value: string | null;
  onChange: (salesRepId: string | null) => void;
  className?: string;
}

/**
 * 영업 담당자 선택 (선택 항목 — 비워둘 수 있다)
 *
 * 비활성 담당자는 목록에서 빠지지만, 이미 지정돼 있던 담당자는 그대로 보인다.
 */
export function SalesRepSelect({
  value,
  onChange,
  className,
}: SalesRepSelectProps): React.ReactElement {
  const [reps, setReps] = useState<SalesRep[]>([]);

  useEffect(() => {
    fetchSelectableSalesReps({ includeId: value })
      .then(setReps)
      .catch(() => setReps([]));
  }, [value]);

  return (
    <Select
      value={value ?? NONE_VALUE}
      onChange={(v) => onChange(v === null || v === NONE_VALUE ? null : v)}
      allowDeselect={false}
      placeholder="영업 담당자 선택"
      data={[
        { value: NONE_VALUE, label: '지정 안 함' },
        ...reps.map((rep) => ({
          value: rep.id,
          label: `${rep.name}${!rep.isActive ? ' (비활성)' : ''}`,
        })),
      ]}
      className={className}
    />
  );
}
