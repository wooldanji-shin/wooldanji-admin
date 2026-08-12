'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      onValueChange={(v) => onChange(v === ALL_VALUE ? null : v)}
    >
      <SelectTrigger className="h-11 w-[180px]">
        <SelectValue placeholder="영업 담당자" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>담당자 전체</SelectItem>
        <SelectItem value={SALES_REP_UNASSIGNED}>미지정</SelectItem>
        {reps.map((rep) => (
          <SelectItem key={rep.id} value={rep.id}>
            {rep.name}
            {!rep.isActive && ' (비활성)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
