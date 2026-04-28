'use client';

// Design Ref: §6.2 partner-announcements 페이지 — 좌(발송 폼) + 우(이력 패널)
// Plan SC: SC-1(SLA) / SC-2(결과 토스트) / SC-3(인앱 알림 노출)
// Decision: 광고 케이스(A/B/C)는 RPC get_partner_ad_cases로 SQL CASE 부여

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { InlineLoadingSkeleton } from '@/components/skeletons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  AlertCircle,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type AdCase = 'A' | 'B' | 'C';

interface PartnerRow {
  id: string;
  businessName: string | null;
  representativeName: string | null;
  displayPhoneNumber: string | null;
  categoryId: string | null;
  createdAt: string;
  adCase: AdCase;
  hasFcmToken: boolean;
  total_count: number;
}

interface HistoryRow {
  key: string;
  title: string;
  body: string;
  sentAt: string;
  recipients: number;
}

interface SendResult {
  total: number;
  success: number;
  failed: number;
  noToken: number;
  chunks: number;
  chunkErrors: number;
  failures: Array<{
    partnerUserId: string;
    token?: string;
    reason: string;
    message?: string;
  }>;
  durationMs: number;
}

const CASE_LABELS: Record<AdCase, string> = {
  A: '광고전',
  B: '광고중',
  C: '광고중단',
};

const CASE_COLORS: Record<AdCase, 'default' | 'secondary' | 'outline'> = {
  A: 'outline',
  B: 'default',
  C: 'secondary',
};

const PAGE_SIZE = 50;

export default function PartnerAnnouncementsPage() {
  const router = useRouter();
  const supabase = createClient();

  // 좌측 상태
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCase, setFilterCase] = useState<'ALL' | AdCase>('ALL');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 발송 폼
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [resultModal, setResultModal] = useState<SendResult | null>(null);

  // 우측 이력
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    void initialAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    await Promise.all([loadPartners(), loadHistory()]);
  }

  // ─── 파트너 목록 조회 ──────────────────────────────────────────
  async function loadPartners() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc('get_partner_ad_cases', {
        p_search: search.trim() || null,
        p_case: filterCase === 'ALL' ? null : filterCase,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (rpcErr) throw rpcErr;
      const rows = (data ?? []) as PartnerRow[];
      setPartners(rows);
      setTotalCount(rows[0]?.total_count ?? 0);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '파트너 조회 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterCase]);

  // ─── 이력 조회 ─────────────────────────────────────────────────
  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const res = await fetch('/api/admin/partner-announcements/history?limit=50');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? '이력 조회 실패');
      setHistory(json.rows as HistoryRow[]);
    } catch (e: any) {
      toast.error(`이력 조회 실패: ${e?.message ?? e}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ─── 선택 동작 ─────────────────────────────────────────────────
  const allOnPageSelected = useMemo(
    () =>
      partners.length > 0 && partners.every((p) => selected.has(p.id)),
    [partners, selected],
  );

  function togglePartner(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) {
      partners.forEach((p) => next.delete(p.id));
    } else {
      partners.forEach((p) => next.add(p.id));
    }
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ─── 발송 ─────────────────────────────────────────────────────
  async function handleSend() {
    if (selected.size === 0) {
      toast.error('파트너를 1명 이상 선택하세요');
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error('제목과 내용을 입력하세요');
      return;
    }
    if (!confirm(`${selected.size}명에게 발송합니다. 진행할까요?`)) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/partner-announcements/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerUserIds: Array.from(selected),
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const json = (await res.json()) as SendResult | { error: string };
      if (!res.ok) throw new Error(('error' in json ? json.error : '발송 실패') as string);

      const result = json as SendResult;
      toast.success(
        `발송 완료 — 성공 ${result.success} / 실패 ${result.failed} / 토큰없음 ${result.noToken} (${result.durationMs}ms)`,
      );
      setResultModal(result);
      setTitle('');
      setBody('');
      clearSelection();
      void loadHistory();
    } catch (e: any) {
      toast.error(`발송 실패: ${e?.message ?? e}`);
    } finally {
      setSending(false);
    }
  }

  if (loading && partners.length === 0) {
    return (
      <PageShell>
        <InlineLoadingSkeleton />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="파트너 공지 발송"
          description="광고 상태(A/B/C) 필터 + 다중 선택 후 자유 문구 푸시 발송"
        />
      </PageHeader>

      <PageContent>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-5'>
        {/* ─── 좌측 60% ─────────────────────────────────────────── */}
        <div className='space-y-4 lg:col-span-3'>
          <Card>
            <CardHeader>
              <CardTitle>파트너 목록 (총 {totalCount}명)</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Input
                  placeholder='상호명 / 대표자 / 전화번호'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPage(0);
                      void loadPartners();
                    }
                  }}
                  className='max-w-xs'
                />
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setPage(0);
                    void loadPartners();
                  }}
                >
                  <Search className='mr-1 h-4 w-4' />
                  검색
                </Button>

                <Select
                  value={filterCase}
                  onValueChange={(v) => {
                    setFilterCase(v as 'ALL' | AdCase);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className='w-[180px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ALL'>전체 케이스</SelectItem>
                    <SelectItem value='A'>A — 광고전</SelectItem>
                    <SelectItem value='B'>B — 광고중</SelectItem>
                    <SelectItem value='C'>C — 광고중단</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => loadPartners()}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10'>
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleAllOnPage}
                        aria-label='페이지 전체 선택 (공지 거부자 제외)'
                      />
                    </TableHead>
                    <TableHead>상호명</TableHead>
                    <TableHead>대표자</TableHead>
                    <TableHead>전화</TableHead>
                    <TableHead className='w-[120px]'>케이스</TableHead>
                    <TableHead className='w-[80px]'>FCM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>
                        조회된 파트너가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    partners.map((p) => (
                      <TableRow
                        key={p.id}
                        className='cursor-pointer'
                        onClick={() => togglePartner(p.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => togglePartner(p.id)}
                          />
                        </TableCell>
                        <TableCell>{p.businessName ?? '-'}</TableCell>
                        <TableCell>{p.representativeName ?? '-'}</TableCell>
                        <TableCell>{p.displayPhoneNumber ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant={CASE_COLORS[p.adCase]}>
                            {p.adCase} · {CASE_LABELS[p.adCase]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.hasFcmToken ? (
                            <CheckCircle2 className='h-4 w-4 text-green-600' />
                          ) : (
                            <XCircle className='h-4 w-4 text-destructive' />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              <div className='flex items-center justify-between'>
                <div className='text-sm text-muted-foreground'>
                  {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
                </div>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    이전
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 발송 폼 */}
          <Card>
            <CardHeader>
              <CardTitle>발송</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <Badge variant='default' className='mr-2'>
                    선택 {selected.size}명
                  </Badge>
                  {selected.size > 0 && (
                    <Button size='sm' variant='ghost' onClick={clearSelection}>
                      선택 해제
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor='ann-title'>제목</Label>
                <Input
                  id='ann-title'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={50}
                  placeholder='예: 봄 프로모션 안내'
                />
              </div>
              <div>
                <Label htmlFor='ann-body'>내용</Label>
                <Textarea
                  id='ann-body'
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={300}
                  rows={4}
                  placeholder='예: 5월 한 달간 첫 광고 등록 시 50% 할인!'
                />
              </div>
              <div className='flex justify-end'>
                <Button
                  onClick={handleSend}
                  disabled={sending || selected.size === 0 || !title.trim() || !body.trim()}
                >
                  {sending ? (
                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                  ) : (
                    <Send className='mr-1 h-4 w-4' />
                  )}
                  발송 ({selected.size}명)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── 우측 40% — 발송 이력 ────────────────────────────── */}
        <div className='lg:col-span-2'>
          <Card className='h-full'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <CardTitle className='flex items-center gap-2'>
                <History className='h-4 w-4' />
                발송 이력
              </CardTitle>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => loadHistory()}
                disabled={historyLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className='flex h-32 items-center justify-center'>
                  <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
                </div>
              ) : history.length === 0 ? (
                <div className='py-8 text-center text-muted-foreground'>
                  발송 이력이 없습니다
                </div>
              ) : (
                <div className='space-y-3'>
                  {history.map((h) => (
                    <div
                      key={h.key}
                      className='rounded-lg border bg-card p-3'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='font-medium'>{h.title}</div>
                        <Badge variant='outline'>{h.recipients}명</Badge>
                      </div>
                      <div className='line-clamp-2 mt-1 text-sm text-muted-foreground'>
                        {h.body}
                      </div>
                      <div className='mt-2 text-xs text-muted-foreground'>
                        {format(new Date(h.sentAt), 'yyyy-MM-dd HH:mm', {
                          locale: ko,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 발송 결과 모달 */}
      <Dialog open={!!resultModal} onOpenChange={(o) => !o && setResultModal(null)}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>발송 결과</DialogTitle>
            <DialogDescription>
              {resultModal?.chunks}개 청크로 처리됨 · {resultModal?.durationMs}ms
            </DialogDescription>
          </DialogHeader>
          {resultModal && (
            <div className='space-y-4'>
              <div className='grid grid-cols-4 gap-2'>
                <Stat label='총 대상' value={resultModal.total} />
                <Stat label='성공' value={resultModal.success} variant='success' />
                <Stat label='실패' value={resultModal.failed} variant='danger' />
                <Stat label='토큰없음' value={resultModal.noToken} variant='warning' />
              </div>
              {resultModal.chunkErrors > 0 && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>
                    청크 호출 실패 {resultModal.chunkErrors}건 — 일부 파트너 미발송 가능성
                  </AlertDescription>
                </Alert>
              )}
              {resultModal.failures.length > 0 && (
                <div>
                  <div className='mb-2 text-sm font-medium'>
                    실패 사유 (최대 50건 표시)
                  </div>
                  <div className='max-h-80 overflow-y-auto rounded border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>partnerUserId</TableHead>
                          <TableHead>사유</TableHead>
                          <TableHead>메시지</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultModal.failures.slice(0, 50).map((f, i) => (
                          <TableRow key={`${f.partnerUserId}-${i}`}>
                            <TableCell className='font-mono text-xs'>
                              {f.partnerUserId.slice(0, 8)}…
                            </TableCell>
                            <TableCell>
                              <Badge variant='secondary'>{f.reason}</Badge>
                            </TableCell>
                            <TableCell className='text-xs text-muted-foreground'>
                              {f.message ?? '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultModal(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageContent>
    </PageShell>
  );
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: 'success' | 'danger' | 'warning';
}) {
  const colorClass =
    variant === 'success'
      ? 'text-green-600'
      : variant === 'danger'
        ? 'text-destructive'
        : variant === 'warning'
          ? 'text-amber-600'
          : 'text-foreground';
  return (
    <div className='rounded-lg border p-3 text-center'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className={`text-2xl font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}
