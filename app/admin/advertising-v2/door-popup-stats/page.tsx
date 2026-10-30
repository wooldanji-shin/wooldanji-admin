'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DoorOpen } from 'lucide-react';
import { PageContent, PageHeader, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DateInput } from '@/components/date-input';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Box, Group, List, Paper, SegmentedControl, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { createClient } from '@/lib/supabase/client';

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
    <Paper withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Box>
          <Title order={4}>단독 팝업 — 몇 장까지 봤나요?</Title>
          <Text size="sm" c="dimmed">
            카드가 2장 이상인 단독 팝업을 닫을 때 몇 장까지 넘겨 봤는지 보여줍니다.
          </Text>
        </Box>
        {depth.multiTotal === 0 ? (
          <Text size="sm" c="dimmed">선택한 기간에 집계된 데이터가 없습니다.</Text>
        ) : (
          <>
            <Text size="sm">
              끝까지 본 비율{' '}
              <Text span size="lg" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {percent(depth.completed, depth.multiTotal)}
              </Text>
              <Text span c="dimmed" ml="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                ({depth.completed.toLocaleString()} / {depth.multiTotal.toLocaleString()}회)
              </Text>
            </Text>
            <List size="sm" spacing={4} listStyleType="none">
              {depth.byViewed.map((count, i) => (
                count > 0 && (
                  <List.Item key={i} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {i + 1}장까지 보고 닫음 {count.toLocaleString()}회 ({percent(count, depth.multiTotal)})
                  </List.Item>
                )
              ))}
            </List>
          </>
        )}
        <Text size="xs" c="dimmed">
          카드가 1장뿐인 팝업은 항상 끝까지 본 것이 되어 이 숫자에서 뺐습니다.
        </Text>
      </Stack>
    </Paper>
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
        <Group gap="sm">
          <SegmentedControl
            value={unit}
            onChange={(v) => setUnit(v as RangeUnit)}
            data={(['day', 'month'] as const).map((u) => ({
              value: u,
              label: u === 'day' ? '일' : '월',
            }))}
          />
          {unit === 'day' ? (
            <Stack gap={4}>
              <Group gap="xs" wrap="nowrap">
                <Box w={140}>
                  <DateInput value={from} onChange={setFrom} />
                </Box>
                <Text c="dimmed">~</Text>
                <Box w={140}>
                  <DateInput value={to} onChange={setTo} />
                </Box>
              </Group>
              {from > to && (
                <Text size="xs" c="red">
                  시작일이 종료일보다 늦습니다
                </Text>
              )}
            </Stack>
          ) : (
            <TextInput
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              w={160}
            />
          )}
        </Group>

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
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>모드</Table.Th>
                  {ACTIONS.map((a) => (
                    <Table.Th key={a.value} ta="right">{a.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {MODES.map((m) => {
                  const actions = totals.get(m.value);
                  const shown = actions?.get('shown') ?? 0;
                  return (
                    <Table.Tr key={m.value}>
                      <Table.Td fw={500}>{m.label}</Table.Td>
                      {ACTIONS.map((a) => {
                        const count = actions?.get(a.value) ?? 0;
                        const ratio = a.value !== 'shown' && shown > 0
                          ? ` (${((count / shown) * 100).toFixed(1)}%)`
                          : '';
                        return (
                          <Table.Td key={a.value} ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {count.toLocaleString()}
                            <Text span size="xs" c="dimmed">{ratio}</Text>
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </DataTableShell>
        <ViewDepthCard depth={depth} loading={loading} />
        <Text size="xs" c="dimmed">
          괄호 안 비율은 같은 모드의 &apos;표시&apos; 횟수 대비입니다. 팝업을 연 채 앱을 종료하면 &apos;표시&apos;만 남습니다.
        </Text>
      </PageContent>
    </PageShell>
  );
}
