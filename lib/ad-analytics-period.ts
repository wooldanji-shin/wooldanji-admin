/**
 * 광고 통계 기간 필터 — 일별 행(date)을 연/월 단위로 좁혀 본다.
 *
 * 파트너 앱의 광고 분석 카드와 같은 방식으로, 데이터가 존재하는 (연, 월)만 선택지로 제공한다.
 */

/** 조회 기간 — year가 null이면 전체 누적, month가 null이면 해당 연도 전체 */
export interface AnalyticsPeriod {
  year: number | null;
  month: number | null;
}

export const ALL_PERIOD: AnalyticsPeriod = { year: null, month: null };

/** 통계 행 — 일별 집계라 date를 갖는다 */
interface DatedRow {
  date?: string | null;
}

/** date 컬럼은 'YYYY-MM-DD' 문자열이다. Date로 파싱하면 타임존이 개입해 하루가 밀린다 */
function parseYearMonth(date: string): { year: number; month: number } | null {
  const [y, m] = date.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) return null;
  return { year, month };
}

/** 데이터가 존재하는 (연, 월) 목록 — 최신순 */
export function extractPeriods(
  rows: DatedRow[]
): { year: number; month: number }[] {
  const keys = new Set<string>();
  for (const r of rows) {
    const ym = r.date ? parseYearMonth(r.date) : null;
    if (ym) keys.add(`${ym.year}-${ym.month}`);
  }

  return [...keys]
    .map((k) => {
      const [year, month] = k.split('-').map(Number);
      return { year, month };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

/** 선택한 기간에 해당하는 행만 남긴다 */
export function filterRowsByPeriod<T extends DatedRow>(
  rows: T[],
  period: AnalyticsPeriod
): T[] {
  if (period.year === null) return rows;

  return rows.filter((r) => {
    const ym = r.date ? parseYearMonth(r.date) : null;
    if (!ym) return false;
    if (ym.year !== period.year) return false;
    return period.month === null || ym.month === period.month;
  });
}

/** 카드 제목에 붙이는 기간 표기 */
export function formatPeriodLabel(period: AnalyticsPeriod): string {
  if (period.year === null) return '(누적)';
  if (period.month === null) return `(${period.year}년)`;
  return `(${period.year}년 ${period.month}월)`;
}
