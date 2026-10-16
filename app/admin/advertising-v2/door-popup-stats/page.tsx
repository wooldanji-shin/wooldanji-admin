'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DoorOpen } from 'lucide-react';
import { PageContent, PageHeader, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DateInput } from '@/components/date-input';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type RangeUnit = 'day' | 'month';

interface EventRow {
  mode: string;
  action: string;
  count: number;
}

const MODES: { value: string; label: string }[] = [
  { value: 'ad', label: '광고 팝업' },
  { value: 'category', label: '카테고리 팝업' },
  { value: 'solo_popup', label: '단독 팝업' },
  { value: 'none', label: '기본 메시지' },
];

const ACTIONS: { value: string; label: string }[] = [
  { value: 'shown', label: '표시' },
  { value: 'browse', label: '둘러보기/링크' },
  { value: 'close', label: '닫기' },
  { value: 'confirm', label: '확인' },
  { value: 'dismiss', label: '바깥 탭/뒤로' },
];

/** KST 기준 yyyy-mm-dd */
function kstDate(offsetDays = 0): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** yyyy-mm → [첫날, 말일] */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

export default function DoorPopupStatsPage(): React.ReactElement {
  const supabase = createClient();
  const [unit, setUnit] = useState<RangeUnit>('day');
  const [from, setFrom] = useState(kstDate(-6));
  const [to, setTo] = useState(kstDate());
  const [month, setMonth] = useState(kstDate().slice(0, 7));
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [start, end] = unit === 'month' ? monthRange(month) : [from, to];
    if (start > end) return;
    setLoading(true);
    try {
      // 관리자 세션 SELECT (RLS: is_admin)
      const { data, error } = await (supabase as any)
        .from('door_popup_event_daily')
        .select('mode, action, count')
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      setRows((data ?? []) as EventRow[]);
    } catch (err) {
      console.error('문열림 팝업 통계 조회 실패:', err);
      toast.error('통계를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, unit, from, to, month]);

  useEffect(() => {
    load();
  }, [load]);

  /** mode → action → 합계 */
  const totals = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const actions = map.get(r.mode) ?? new Map<string, number>();
      actions.set(r.action, (actions.get(r.action) ?? 0) + r.count);
      map.set(r.mode, actions);
    }
    return map;
  }, [rows]);

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="문열림 팝업 통계"
          description="모드별로 사용자가 팝업을 어떻게 끝냈는지 일별 합계로 보여줍니다."
        />
      </PageHeader>

      <PageContent>
        <div className="flex flex-wrap items-center gap-3">
          {(['day', 'month'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={cn(
                'h-10 rounded-md border px-5 text-sm font-medium transition-colors',
                unit === u
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent'
              )}
            >
              {u === 'day' ? '일' : '월'}
            </button>
          ))}
          {unit === 'day' ? (
            <div className="flex items-center gap-2">
              <DateInput value={from} onChange={setFrom} className="h-10 w-[140px]" />
              <span className="text-muted-foreground">~</span>
              <DateInput value={to} onChange={setTo} className="h-10 w-[140px]" />
            </div>
          ) : (
            <Input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="h-10 w-[160px]"
            />
          )}
        </div>

        <DataTableShell>
          {loading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="집계된 데이터가 없습니다"
              description="선택한 기간에 기록된 문열림 팝업 이벤트가 없습니다."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>모드</TableHead>
                  {ACTIONS.map((a) => (
                    <TableHead key={a.value} className="text-right">{a.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODES.map((m) => {
                  const actions = totals.get(m.value);
                  const shown = actions?.get('shown') ?? 0;
                  return (
                    <TableRow key={m.value}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      {ACTIONS.map((a) => {
                        const count = actions?.get(a.value) ?? 0;
                        const ratio = a.value !== 'shown' && shown > 0
                          ? ` (${((count / shown) * 100).toFixed(1)}%)`
                          : '';
                        return (
                          <TableCell key={a.value} className="text-right tabular-nums">
                            {count.toLocaleString()}
                            <span className="text-xs text-muted-foreground">{ratio}</span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
        <p className="text-xs text-muted-foreground">
          괄호 안 비율은 같은 모드의 &apos;표시&apos; 횟수 대비입니다. 팝업을 연 채 앱을 종료하면 &apos;표시&apos;만 남습니다.
        </p>
      </PageContent>
    </PageShell>
  );
}
