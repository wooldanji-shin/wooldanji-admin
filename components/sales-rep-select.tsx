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
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="영업 담당자 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>지정 안 함</SelectItem>
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
