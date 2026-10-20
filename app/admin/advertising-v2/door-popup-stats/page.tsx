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

interface DepthRow {
  totalCards: number;
  viewedCards: number;
  count: number;
}

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

// DB CHECK(door_popup_view_depth_daily) 와 같은 상한
const DOOR_POPUP_MAX_CARDS = 10;

interface DepthSummary {
  /** 팝업 전체 닫힘 횟수 */
  total: number;
  /** 본 장수(1~10)별 횟수 — 카드가 2장 이상인 팝업만 */
  byViewed: number[];
  /** 카드 2장 이상인 팝업 수 */
  multiTotal: number;
  /** 카드 2장 이상 중 끝까지 본 횟수 */
  completed: number;
}

/** 카드 1장짜리 팝업은 항상 끝까지 본 것이 되므로 분포·끝까지 비율은 2장 이상만 계산한다 */
function summarizeDepth(rows: DepthRow[]): DepthSummary {
  const summary: DepthSummary = { total: 0, byViewed: Array<number>(DOOR_POPUP_MAX_CARDS).fill(0), multiTotal: 0, completed: 0 };
  for (const r of rows) {
    summary.total += r.count;
    if (r.totalCards < 2) continue;
    summary.multiTotal += r.count;
    summary.byViewed[r.viewedCards - 1] += r.count;
    if (r.viewedCards === r.totalCards) summary.completed += r.count;
  }
  return summary;
}

const percent = (count: number, total: number): string =>
  total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '-';

function ViewDepthCard({ depth, loading }: { depth: DepthSummary; loading: boolean }): React.ReactElement | null {
  if (loading) return null;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-semibold">단독 팝업 — 몇 장까지 봤나요?</h3>
        <p className="text-sm text-muted-foreground">
          카드가 2장 이상인 단독 팝업을 닫을 때 몇 장까지 넘겨 봤는지 보여줍니다.
        </p>
      </div>
      {depth.multiTotal === 0 ? (
        <p className="text-sm text-muted-foreground">선택한 기간에 집계된 데이터가 없습니다.</p>
      ) : (
        <>
          <p className="text-sm">
            끝까지 본 비율{' '}
            <strong className="text-lg tabular-nums">{percent(depth.completed, depth.multiTotal)}</strong>
            <span className="ml-2 text-muted-foreground tabular-nums">
              ({depth.completed.toLocaleString()} / {depth.multiTotal.toLocaleString()}회)
            </span>
          </p>
          <ul className="space-y-1 text-sm">
            {depth.byViewed.map((count, i) => (
              count > 0 && (
                <li key={i} className="tabular-nums">
                  {i + 1}장까지 보고 닫음 {count.toLocaleString()}회 ({percent(count, depth.multiTotal)})
                </li>
              )
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        카드가 1장뿐인 팝업은 항상 끝까지 본 것이 되어 이 숫자에서 뺐습니다.
      </p>
    </div>
  );
}

export default function DoorPopupStatsPage(): React.ReactElement {
  const supabase = createClient();
  const [unit, setUnit] = useState<RangeUnit>('day');
  const [from, setFrom] = useState(kstDate(-6));
  const [to, setTo] = useState(kstDate());
  const [month, setMonth] = useState(kstDate().slice(0, 7));
  const [rows, setRows] = useState<EventRow[]>([]);
  const [depthRows, setDepthRows] = useState<DepthRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [start, end] = unit === 'month' ? monthRange(month) : [from, to];
    if (start > end) return;
    setLoading(true);
    try {
      // 관리자 세션 SELECT (RLS: is_admin)
      const db = supabase as any;
      const [events, depth] = await Promise.all([
        db.from('door_popup_event_daily').select('mode, action, count').gte('date', start).lte('date', end),
        db.from('door_popup_view_depth_daily').select('"totalCards", "viewedCards", count').gte('date', start).lte('date', end),
      ]);
      if (events.error) throw events.error;
      if (depth.error) throw depth.error;
      setRows((events.data ?? []) as EventRow[]);
      setDepthRows((depth.data ?? []) as DepthRow[]);
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

  const depth = useMemo(() => summarizeDepth(depthRows), [depthRows]);

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
        <ViewDepthCard depth={depth} loading={loading} />
        <p className="text-xs text-muted-foreground">
          괄호 안 비율은 같은 모드의 &apos;표시&apos; 횟수 대비입니다. 팝업을 연 채 앱을 종료하면 &apos;표시&apos;만 남습니다.
        </p>
      </PageContent>
    </PageShell>
  );
}
