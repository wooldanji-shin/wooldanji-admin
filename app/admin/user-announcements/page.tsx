'use client';

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
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface UserRow {
  id: string;
  name: string;
  phoneNumber: string;
  email: string;
  apartmentName: string | null;
  approvalStatus: string;
  roles: string[];
  hasFcmToken: boolean;
  marketingAgreed: boolean;
  total_count: number;
}

const ROLE_LABELS: Record<string, string> = {
  APP_USER: '앱회원',
  APT_ADMIN: '아파트관리자',
  MANAGER: '매니저',
  SUPER_ADMIN: '슈퍼관리자',
};

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
    userId: string;
    token?: string;
    reason: string;
    message?: string;
  }>;
  durationMs: number;
}

type FilterStatus = 'ALL' | 'approve' | 'inactive' | 'suspended';
type FilterRole = 'ALL' | 'APP_USER' | 'APT_ADMIN' | 'MANAGER' | 'SUPER_ADMIN';

const PAGE_SIZE = 50;

export default function UserAnnouncementsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [filterRole, setFilterRole] = useState<FilterRole>('ALL');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [resultModal, setResultModal] = useState<SendResult | null>(null);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [recipientsModal, setRecipientsModal] = useState<{ key: string; title: string } | null>(null);
  const [recipients, setRecipients] = useState<Array<{ userId: string; name: string; phoneNumber: string; email: string }>>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void initialAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    await Promise.all([loadUsers(), loadHistory()]);
  }

  // ─── 회원 목록 조회 ──────────────────────────────────────────
  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // service role이 필요하므로 API 라우트를 통해 조회
      const params = new URLSearchParams({
        search: search.trim(),
        status: filterStatus,
        role: filterRole,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/user-announcements/users?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? '회원 조회 실패');

      setUsers(json.rows as UserRow[]);
      setTotalCount(json.totalCount as number);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '회원 조회 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterStatus, filterRole]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 0) {
        setPage(0); // page 리셋 → 위 effect가 loadUsers 재호출
      } else {
        void loadUsers();
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ─── 이력 조회 ─────────────────────────────────────────────────
  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const res = await fetch('/api/admin/user-announcements/history?limit=50');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? '이력 조회 실패');
      setHistory(json.rows as HistoryRow[]);
    } catch (e: any) {
      toast.error(`이력 조회 실패: ${e?.message ?? e}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ─── 수신자 조회 ───────────────────────────────────────────────
  async function loadRecipients(announcementId: string) {
    setRecipientsLoading(true);
    setRecipients([]);
    try {
      const { data: recData, error: recErr } = await supabase
        .from('user_announcement_recipients')
        .select('userId')
        .eq('announcementId', announcementId);
      if (recErr) throw recErr;

      const ids = (recData ?? []).map((r: any) => r.userId as string);
      if (ids.length === 0) return;

      const { data: userData, error: userErr } = await supabase
        .from('user')
        .select('id, name, phoneNumber, email')
        .in('id', ids);
      if (userErr) throw userErr;

      setRecipients(
        (userData ?? []).map((u: any) => ({
          userId: u.id,
          name: u.name,
          phoneNumber: u.phoneNumber,
          email: u.email,
        })),
      );
    } catch (e: any) {
      toast.error(`수신자 조회 실패: ${e?.message ?? e}`);
    } finally {
      setRecipientsLoading(false);
    }
  }

  // ─── 선택 동작 ─────────────────────────────────────────────────
  const eligibleUsers = useMemo(
    () => users.filter((u) => u.marketingAgreed && u.hasFcmToken),
    [users],
  );

  const allOnPageSelected = useMemo(
    () => eligibleUsers.length > 0 && eligibleUsers.every((u) => selected.has(u.id)),
    [eligibleUsers, selected],
  );

  function toggleUser(id: string) {
    const user = users.find((u) => u.id === id);
    if (!user?.marketingAgreed || !user.hasFcmToken) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) {
      eligibleUsers.forEach((u) => next.delete(u.id));
    } else {
      eligibleUsers.forEach((u) => next.add(u.id));
    }
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ─── 발송 ─────────────────────────────────────────────────────
  async function handleSend() {
    if (selected.size === 0) {
      toast.error('회원을 1명 이상 선택하세요');
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error('제목과 내용을 입력하세요');
      return;
    }
    if (!confirm(`${selected.size}명에게 발송합니다. 진행할까요?`)) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/user-announcements/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selected),
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

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" 알림을 삭제합니다. 수신자 기록도 함께 삭제됩니다.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/user-announcements/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? '삭제 실패');
      setHistory((prev) => prev.filter((h) => h.key !== id));
      toast.success('삭제됐습니다');
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? e}`);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading && users.length === 0) {
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
          title="회원 알림 발송"
          description="회원 필터 + 다중 선택 후 자유 문구 푸시 발송 (마케팅 동의자만)"
        />
      </PageHeader>

      <PageContent>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-5'>
          {/* ─── 좌측 60% ─────────────────────────────────────────── */}
          <div className='space-y-4 lg:col-span-3'>
            <Card>
              <CardHeader>
                <CardTitle>회원 목록 (총 {totalCount}명)</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Input
                    placeholder='이름 / 전화번호 / 이메일 / 아파트명'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setPage(0);
                        void loadUsers();
                      }
                    }}
                    className='max-w-xs'
                  />
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setPage(0);
                      void loadUsers();
                    }}
                  >
                    <Search className='mr-1 h-4 w-4' />
                    검색
                  </Button>

                  <Select
                    value={filterStatus}
                    onValueChange={(v) => {
                      setFilterStatus(v as FilterStatus);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className='w-[140px]'>
                      <SelectValue placeholder='승인 상태' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ALL'>전체 상태</SelectItem>
                      <SelectItem value='approve'>승인</SelectItem>
                      <SelectItem value='inactive'>비활성</SelectItem>
                      <SelectItem value='suspended'>정지</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterRole}
                    onValueChange={(v) => {
                      setFilterRole(v as FilterRole);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className='w-[150px]'>
                      <SelectValue placeholder='회원 유형' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ALL'>전체 유형</SelectItem>
                      <SelectItem value='APP_USER'>앱회원</SelectItem>
                      <SelectItem value='APT_ADMIN'>아파트관리자</SelectItem>
                      <SelectItem value='MANAGER'>매니저</SelectItem>
                      <SelectItem value='SUPER_ADMIN'>슈퍼관리자</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => loadUsers()}
                    disabled={loading}
                  >
                    <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-10'>
                          <Checkbox
                            checked={allOnPageSelected}
                            onCheckedChange={toggleAllOnPage}
                            aria-label='페이지 전체 선택 (마케팅 미동의자 제외)'
                          />
                        </TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead>전화번호</TableHead>
                        <TableHead>이메일</TableHead>
                        <TableHead>아파트</TableHead>
                        <TableHead>회원 유형</TableHead>
                        <TableHead className='w-[90px]'>승인 상태</TableHead>
                        <TableHead className='w-[80px]'>FCM</TableHead>
                        <TableHead className='w-[80px]'>마케팅</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className='py-8 text-center text-muted-foreground'>
                            조회된 회원이 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((u) => (
                          <TableRow
                            key={u.id}
                            className={(u.marketingAgreed && u.hasFcmToken) ? 'cursor-pointer' : 'opacity-40'}
                            onClick={() => toggleUser(u.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(u.id)}
                                disabled={!u.marketingAgreed || !u.hasFcmToken}
                                onCheckedChange={() => toggleUser(u.id)}
                              />
                            </TableCell>
                            <TableCell>{u.name}</TableCell>
                            <TableCell>{u.phoneNumber}</TableCell>
                            <TableCell className='max-w-[160px] truncate text-sm text-muted-foreground'>
                              {u.email || '-'}
                            </TableCell>
                            <TableCell className='max-w-[120px] truncate'>
                              {u.apartmentName ?? '-'}
                            </TableCell>
                            <TableCell>
                              <div className='flex flex-wrap gap-1'>
                                {u.roles.length === 0 ? (
                                  <span className='text-muted-foreground text-xs'>-</span>
                                ) : (
                                  u.roles.map((r) => (
                                    <Badge key={r} variant='outline' className='text-xs'>
                                      {ROLE_LABELS[r] ?? r}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {u.approvalStatus === 'approve' ? (
                                <Badge variant='default'>승인</Badge>
                              ) : u.approvalStatus === 'inactive' ? (
                                <Badge variant='secondary'>비활성</Badge>
                              ) : (
                                <Badge variant='destructive'>정지</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {u.hasFcmToken ? (
                                <CheckCircle2 className='h-4 w-4 text-green-600' />
                              ) : (
                                <XCircle className='h-4 w-4 text-destructive' />
                              )}
                            </TableCell>
                            <TableCell>
                              {u.marketingAgreed ? (
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
                </div>

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
                    placeholder='예: 이벤트 안내'
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
                    placeholder='예: 울단지 신규 기능 출시를 알려드립니다!'
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
                  <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
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
                      <div key={h.key} className='rounded-lg border bg-card p-3'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='font-medium'>{h.title}</div>
                          <div className='flex shrink-0 items-center gap-1'>
                            <Badge
                              variant='outline'
                              className='cursor-pointer hover:bg-accent'
                              onClick={() => {
                                setRecipientsModal({ key: h.key, title: h.title });
                                void loadRecipients(h.key);
                              }}
                            >
                              {h.recipients}명
                            </Badge>
                            <button
                              onClick={() => handleDelete(h.key, h.title)}
                              disabled={deletingId === h.key}
                              className='rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50'
                            >
                              {deletingId === h.key ? (
                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                              ) : (
                                <Trash2 className='h-3.5 w-3.5' />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className='line-clamp-2 mt-1 text-sm text-muted-foreground'>
                          {h.body}
                        </div>
                        <div className='mt-2 text-xs text-muted-foreground'>
                          {format(new Date(h.sentAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
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
          <DialogContent className='flex max-h-[85vh] max-w-2xl flex-col'>
            <DialogHeader>
              <DialogTitle>발송 결과</DialogTitle>
              <DialogDescription>
                {resultModal?.chunks}개 청크로 처리됨 · {resultModal?.durationMs}ms
              </DialogDescription>
            </DialogHeader>
            {resultModal && (
              <div className='flex-1 space-y-4 overflow-y-auto pr-1'>
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
                      청크 호출 실패 {resultModal.chunkErrors}건 — 일부 회원 미발송 가능성
                    </AlertDescription>
                  </Alert>
                )}
                {resultModal.failures.length > 0 && (
                  <div>
                    <div className='mb-2 text-sm font-medium'>실패 사유 (최대 50건 표시)</div>
                    <div className='rounded border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>userId</TableHead>
                            <TableHead>사유</TableHead>
                            <TableHead>메시지</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resultModal.failures.slice(0, 50).map((f, i) => (
                            <TableRow key={`${f.userId}-${i}`}>
                              <TableCell className='font-mono text-xs'>
                                {f.userId.slice(0, 8)}…
                              </TableCell>
                              <TableCell>
                                <Badge variant='secondary'>
                                  {f.reason === 'UNREGISTERED' ? '앱 삭제/재설치' : f.reason}
                                </Badge>
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

        {/* 수신자 목록 모달 */}
        <Dialog open={!!recipientsModal} onOpenChange={(o) => !o && setRecipientsModal(null)}>
          <DialogContent className='max-w-lg'>
            <DialogHeader>
              <DialogTitle>수신자 목록</DialogTitle>
              <DialogDescription className='line-clamp-1'>{recipientsModal?.title}</DialogDescription>
            </DialogHeader>
            {recipientsLoading ? (
              <div className='flex h-32 items-center justify-center'>
                <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
              </div>
            ) : (
              <div className='max-h-96 overflow-y-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>전화번호</TableHead>
                      <TableHead>이메일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className='py-8 text-center text-muted-foreground'>
                          수신자 정보 없음
                        </TableCell>
                      </TableRow>
                    ) : (
                      recipients.map((r) => (
                        <TableRow key={r.userId}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.phoneNumber}</TableCell>
                          <TableCell className='text-sm'>{r.email}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setRecipientsModal(null)}>닫기</Button>
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
