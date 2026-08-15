'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnalyticsPeriod } from '@/lib/ad-analytics-period';

/** "전체"를 나타내는 값 — Select는 빈 문자열을 값으로 쓸 수 없다 */
const ALL_VALUE = '__all__';

interface AnalyticsPeriodSelectProps {
  /** 데이터가 존재하는 (연, 월) 목록 — 최신순 */
  periods: { year: number; month: number }[];
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}

/**
 * 광고 통계 조회 기간 선택 — 연도와 월을 나눠 목록을 짧게 유지한다.
 *
 * 연도를 바꾸면 그 연도에 없는 월일 수 있어 월 선택은 초기화한다.
 */
export function AnalyticsPeriodSelect({
  periods,
  value,
  onChange,
}: AnalyticsPeriodSelectProps): React.ReactElement | null {
  if (periods.length === 0) return null;

  const years = [...new Set(periods.map((p) => p.year))];
  const months = periods.filter((p) => p.year === value.year).map((p) => p.month);

  return (
    <div className='flex items-center gap-1.5'>
      <Select
        value={value.year === null ? ALL_VALUE : String(value.year)}
        onValueChange={(v) =>
          onChange({ year: v === ALL_VALUE ? null : Number(v), month: null })
        }
      >
        <SelectTrigger className='h-8 w-[92px] text-xs'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>전체</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}년
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.year !== null && (
        <Select
          value={value.month === null ? ALL_VALUE : String(value.month)}
          onValueChange={(v) =>
            onChange({
              year: value.year,
              month: v === ALL_VALUE ? null : Number(v),
            })
          }
        >
          <SelectTrigger className='h-8 w-[80px] text-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>전체</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m}월
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
