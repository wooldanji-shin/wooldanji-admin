'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { TableSkeleton } from '@/components/skeletons';
import { DataPagination } from '@/components/data-pagination';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Grid,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
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
import { confirmModal } from '@/components/confirm-modal';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import { useRouter, useSearchParams } from 'next/navigation';
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
  openDoorCount: number;
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
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [filterRole, setFilterRole] = useState<FilterRole>('ALL');
  // URL query param 기반 페이지 (URL은 1-indexed, 내부는 0-indexed)
  const page = Math.max(0, parseInt(searchParams.get('page') || '1') - 1);
  const setPage = (newPage: number | ((prev: number) => number)) => {
    const resolved = typeof newPage === 'function' ? newPage(page) : newPage;
    const params = new URLSearchParams(searchParams.toString());
    if (resolved <= 0) {
      params.delete('page');
    } else {
      params.set('page', String(resolved + 1));
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };
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

      // service role이 필요하므로 API 라우트를 통해 조회
      const params = new URLSearchParams({
        search: search.trim(),
        status: filterStatus,
        role: filterRole,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/user-announcements/users?${params}`);
      if (!res.ok) {
        setError((await readApiErrorMessage(res)) ?? '회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const json = await res.json();

      setUsers(json.rows as UserRow[]);
      setTotalCount(json.totalCount as number);
    } catch (e: any) {
      console.error(e);
      setError(networkFailedMessage('회원 목록을 불러오지 못했습니다.'));
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
      if (!res.ok) {
        toast.error((await readApiErrorMessage(res)) ?? '발송 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const json = await res.json();
      setHistory(json.rows as HistoryRow[]);
    } catch (e: any) {
      console.error(e);
      toast.error(networkFailedMessage('발송 이력을 불러오지 못했습니다.'));
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
      console.error(e);
      toast.error('수신자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
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
    if (!(await confirmModal({ title: '알림 발송', message: `${selected.size}명에게 발송합니다. 진행할까요?`, confirmLabel: '발송' }))) return;

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
      if (!res.ok) {
        toast.error(
          (await readApiErrorMessage(res)) ??
            '알림 발송 중 문제가 생겼습니다. 발송 이력을 새로고침해 발송 여부를 확인한 뒤 다시 시도해 주세요.'
        );
        return;
      }

      const result = (await res.json()) as SendResult;
      toast.success(
        `발송 완료 — 성공 ${result.success} / 실패 ${result.failed} / 토큰없음 ${result.noToken} (${result.durationMs}ms)`,
      );
      setResultModal(result);
      setTitle('');
      setBody('');
      clearSelection();
      void loadHistory();
    } catch (e: any) {
      console.error(e);
      toast.error(networkFailedMessage('알림을 보내지 못했습니다.'));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!(await confirmModal({ title: '알림 삭제', message: `"${title}" 알림을 삭제합니다. 수신자 기록도 함께 삭제됩니다.`, confirmLabel: '삭제', danger: true }))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/user-announcements/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error((await readApiErrorMessage(res)) ?? '알림을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setHistory((prev) => prev.filter((h) => h.key !== id));
      toast.success('삭제됐습니다');
    } catch (e: any) {
      console.error(e);
      toast.error(networkFailedMessage('알림을 삭제하지 못했습니다.'));
    } finally {
      setDeletingId(null);
    }
  }

  if (error) {
    return (
      <PageShell>
        <Alert color='red' variant='light' icon={<AlertCircle size={16} />}>
          {error}
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
        <Grid columns={5} gap='lg'>
          {/* ─── 좌측 60% ─────────────────────────────────────────── */}
          <Grid.Col span={{ base: 5, lg: 3 }}>
            <Stack gap='md'>
              <Paper withBorder radius='md' p='lg'>
                <Title order={4} mb='md'>회원 목록 (총 {totalCount}명)</Title>
                <Stack gap='md'>
                  <Group gap='xs'>
                    <TextInput
                      placeholder='이름 / 전화번호 / 이메일 / 아파트명'
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setPage(0);
                          void loadUsers();
                        }
                      }}
                      w='100%'
                      maw={320}
                    />
                    <Button
                      variant='default'
                      size='sm'
                      leftSection={<Search size={16} />}
                      onClick={() => {
                        setPage(0);
                        void loadUsers();
                      }}
                    >
                      검색
                    </Button>

                    <Select
                      placeholder='승인 상태'
                      data={[
                        { value: 'ALL', label: '전체 상태' },
                        { value: 'approve', label: '승인' },
                        { value: 'inactive', label: '비활성' },
                        { value: 'suspended', label: '보류' },
                      ]}
                      value={filterStatus}
                      onChange={(v) => {
                        if (v === null) return;
                        setFilterStatus(v as FilterStatus);
                        setPage(0);
                      }}
                      allowDeselect={false}
                      w={140}
                    />

                    <Select
                      placeholder='회원 유형'
                      data={[
                        { value: 'ALL', label: '전체 유형' },
                        { value: 'APP_USER', label: '앱회원' },
                        { value: 'APT_ADMIN', label: '아파트관리자' },
                        { value: 'MANAGER', label: '매니저' },
                        { value: 'SUPER_ADMIN', label: '슈퍼관리자' },
                      ]}
                      value={filterRole}
                      onChange={(v) => {
                        if (v === null) return;
                        setFilterRole(v as FilterRole);
                        setPage(0);
                      }}
                      allowDeselect={false}
                      w={150}
                    />

                    <ActionIcon
                      variant='subtle'
                      color='gray'
                      size='lg'
                      aria-label='새로고침'
                      onClick={() => loadUsers()}
                      disabled={loading}
                    >
                      <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
                    </ActionIcon>
                  </Group>

                  <Paper withBorder radius='md' style={{ overflow: 'hidden' }}>
                    <Table.ScrollContainer minWidth={720} type='native'>
                      <Table highlightOnHover verticalSpacing='sm' horizontalSpacing='md'>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th w={40}>
                              <Checkbox
                                checked={allOnPageSelected}
                                onChange={() => toggleAllOnPage()}
                                aria-label='페이지 전체 선택 (마케팅 미동의자 제외)'
                              />
                            </Table.Th>
                            <Table.Th>이름</Table.Th>
                            <Table.Th>전화번호</Table.Th>
                            <Table.Th>이메일</Table.Th>
                            <Table.Th>아파트</Table.Th>
                            <Table.Th>회원 유형</Table.Th>
                            <Table.Th w={90}>승인 상태</Table.Th>
                            <Table.Th w={80}>문연횟수</Table.Th>
                            <Table.Th w={80}>FCM</Table.Th>
                            <Table.Th w={80}>마케팅</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {loading && users.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={10} p={0}>
                                <TableSkeleton rows={8} columns={10} showHeader={false} />
                              </Table.Td>
                            </Table.Tr>
                          ) : users.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={10} py='xl' ta='center' c='dimmed'>
                                조회된 회원이 없습니다
                              </Table.Td>
                            </Table.Tr>
                          ) : (
                            users.map((u) => (
                              <Table.Tr
                                key={u.id}
                                style={(u.marketingAgreed && u.hasFcmToken) ? { cursor: 'pointer' } : { opacity: 0.4 }}
                                onClick={() => toggleUser(u.id)}
                              >
                                <Table.Td onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selected.has(u.id)}
                                    disabled={!u.marketingAgreed || !u.hasFcmToken}
                                    onChange={() => toggleUser(u.id)}
                                  />
                                </Table.Td>
                                <Table.Td>{u.name}</Table.Td>
                                <Table.Td>{u.phoneNumber}</Table.Td>
                                <Table.Td>
                                  <Text size='sm' c='dimmed' maw={160} truncate>
                                    {u.email || '-'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size='sm' maw={120} truncate>
                                    {u.apartmentName ?? '-'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap={4}>
                                    {u.roles.length === 0 ? (
                                      <Text span size='xs' c='dimmed'>-</Text>
                                    ) : (
                                      u.roles.map((r) => (
                                        <Badge key={r} variant='light' color='gray' size='sm'>
                                          {ROLE_LABELS[r] ?? r}
                                        </Badge>
                                      ))
                                    )}
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  {u.approvalStatus === 'approve' ? (
                                    <Badge variant='light' color='green'>승인</Badge>
                                  ) : u.approvalStatus === 'inactive' ? (
                                    <Badge variant='light' color='gray'>비활성</Badge>
                                  ) : (
                                    <Badge variant='light' color='red'>보류</Badge>
                                  )}
                                </Table.Td>
                                <Table.Td fz='sm' c='dimmed'>
                                  {u.openDoorCount > 0 ? `${u.openDoorCount}회` : '-'}
                                </Table.Td>
                                <Table.Td>
                                  {u.hasFcmToken ? (
                                    <CheckCircle2 size={16} color='var(--mantine-color-green-6)' />
                                  ) : (
                                    <XCircle size={16} color='var(--mantine-color-red-6)' />
                                  )}
                                </Table.Td>
                                <Table.Td>
                                  {u.marketingAgreed ? (
                                    <CheckCircle2 size={16} color='var(--mantine-color-green-6)' />
                                  ) : (
                                    <XCircle size={16} color='var(--mantine-color-red-6)' />
                                  )}
                                </Table.Td>
                              </Table.Tr>
                            ))
                          )}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Paper>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <DataPagination
                      page={page + 1}
                      pageSize={PAGE_SIZE}
                      totalCount={totalCount}
                      onPageChange={(p) => setPage(p - 1)}
                    />
                  )}
                </Stack>
              </Paper>

              {/* 발송 폼 */}
              <Paper withBorder radius='md' p='lg'>
                <Title order={4} mb='md'>발송</Title>
                <Stack gap='sm'>
                  <Group gap='xs'>
                    <Badge variant='filled' color='blue'>
                      선택 {selected.size}명
                    </Badge>
                    {selected.size > 0 && (
                      <Button size='compact-sm' variant='subtle' color='gray' onClick={clearSelection}>
                        선택 해제
                      </Button>
                    )}
                  </Group>
                  <TextInput
                    id='ann-title'
                    label='제목'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={50}
                    placeholder='예: 이벤트 안내'
                  />
                  <Textarea
                    id='ann-body'
                    label='내용'
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder='예: 울단지 신규 기능 출시를 알려드립니다!'
                  />
                  <Group justify='flex-end'>
                    <Button
                      onClick={handleSend}
                      disabled={sending || selected.size === 0 || !title.trim() || !body.trim()}
                      leftSection={
                        sending ? (
                          <Loader2 size={16} className='animate-spin' />
                        ) : (
                          <Send size={16} />
                        )
                      }
                    >
                      발송 ({selected.size}명)
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Grid.Col>

          {/* ─── 우측 40% — 발송 이력 ────────────────────────────── */}
          <Grid.Col span={{ base: 5, lg: 2 }}>
            <Paper withBorder radius='md' p='lg' h='100%'>
              <Group justify='space-between' mb='md'>
                <Group gap='xs'>
                  <History size={16} />
                  <Title order={4}>발송 이력</Title>
                </Group>
                <ActionIcon
                  variant='subtle'
                  color='gray'
                  aria-label='새로고침'
                  onClick={() => loadHistory()}
                  disabled={historyLoading}
                >
                  <RefreshCw size={16} className={historyLoading ? 'animate-spin' : undefined} />
                </ActionIcon>
              </Group>
              {historyLoading ? (
                <Group h={128} justify='center'>
                  <Loader2 size={20} className='animate-spin' color='var(--mantine-color-dimmed)' />
                </Group>
              ) : history.length === 0 ? (
                <Text py='xl' ta='center' c='dimmed'>
                  발송 이력이 없습니다
                </Text>
              ) : (
                <Stack gap='sm'>
                  {history.map((h) => (
                    <Paper key={h.key} withBorder radius='md' p='sm'>
                      <Group justify='space-between' align='flex-start' gap='xs' wrap='nowrap'>
                        <Text fw={500}>{h.title}</Text>
                        <Group gap={4} wrap='nowrap' style={{ flexShrink: 0 }}>
                          <Badge
                            variant='light'
                            color='gray'
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setRecipientsModal({ key: h.key, title: h.title });
                              void loadRecipients(h.key);
                            }}
                          >
                            {h.recipients}명
                          </Badge>
                          <ActionIcon
                            variant='subtle'
                            color='red'
                            size='sm'
                            aria-label='삭제'
                            onClick={() => handleDelete(h.key, h.title)}
                            disabled={deletingId === h.key}
                          >
                            {deletingId === h.key ? (
                              <Loader2 size={14} className='animate-spin' />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </ActionIcon>
                        </Group>
                      </Group>
                      <Text size='sm' c='dimmed' lineClamp={2} mt={4}>
                        {h.body}
                      </Text>
                      <Text size='xs' c='dimmed' mt='xs'>
                        {format(new Date(h.sentAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>

        {/* 발송 결과 모달 */}
        <Modal
          opened={!!resultModal}
          onClose={() => setResultModal(null)}
          title='발송 결과'
          size={672}
        >
          <Text size='sm' c='dimmed'>
            {resultModal?.chunks}개 청크로 처리됨 · {resultModal?.durationMs}ms
          </Text>
          {resultModal && (
            <Stack gap='md' mt='md'>
              <SimpleGrid cols={4} spacing='xs'>
                <Stat label='총 대상' value={resultModal.total} />
                <Stat label='성공' value={resultModal.success} variant='success' />
                <Stat label='실패' value={resultModal.failed} variant='danger' />
                <Stat label='토큰없음' value={resultModal.noToken} variant='warning' />
              </SimpleGrid>
              {resultModal.chunkErrors > 0 && (
                <Alert color='red' variant='light' icon={<AlertCircle size={16} />}>
                  청크 호출 실패 {resultModal.chunkErrors}건 — 일부 회원 미발송 가능성
                </Alert>
              )}
              {resultModal.failures.length > 0 && (
                <div>
                  <Text size='sm' fw={500} mb='xs'>실패 사유 (최대 50건 표시)</Text>
                  <Paper withBorder radius='sm' style={{ overflow: 'hidden' }}>
                    <Table verticalSpacing='xs' horizontalSpacing='sm'>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>userId</Table.Th>
                          <Table.Th>사유</Table.Th>
                          <Table.Th>메시지</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {resultModal.failures.slice(0, 50).map((f, i) => (
                          <Table.Tr key={`${f.userId}-${i}`}>
                            <Table.Td ff='monospace' fz='xs'>
                              {f.userId.slice(0, 8)}…
                            </Table.Td>
                            <Table.Td>
                              <Badge variant='light' color='gray'>
                                {f.reason === 'UNREGISTERED' ? '앱 삭제/재설치' : f.reason}
                              </Badge>
                            </Table.Td>
                            <Table.Td fz='xs' c='dimmed'>
                              {f.message ?? '-'}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </div>
              )}
            </Stack>
          )}
          <Group justify='flex-end' mt='lg'>
            <Button onClick={() => setResultModal(null)}>닫기</Button>
          </Group>
        </Modal>

        {/* 수신자 목록 모달 */}
        <Modal
          opened={!!recipientsModal}
          onClose={() => setRecipientsModal(null)}
          title='수신자 목록'
          size={512}
        >
          <Text size='sm' c='dimmed' lineClamp={1}>{recipientsModal?.title}</Text>
          {recipientsLoading ? (
            <Group h={128} justify='center'>
              <Loader2 size={20} className='animate-spin' color='var(--mantine-color-dimmed)' />
            </Group>
          ) : (
            <ScrollArea.Autosize mah={384} mt='md'>
              <Table verticalSpacing='xs' horizontalSpacing='sm'>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>이름</Table.Th>
                    <Table.Th>전화번호</Table.Th>
                    <Table.Th>이메일</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recipients.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={3} py='xl' ta='center' c='dimmed'>
                        수신자 정보 없음
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    recipients.map((r) => (
                      <Table.Tr key={r.userId}>
                        <Table.Td>{r.name}</Table.Td>
                        <Table.Td>{r.phoneNumber}</Table.Td>
                        <Table.Td fz='sm'>{r.email}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}
          <Group justify='flex-end' mt='lg'>
            <Button onClick={() => setRecipientsModal(null)}>닫기</Button>
          </Group>
        </Modal>
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
  const color =
    variant === 'success'
      ? 'green'
      : variant === 'danger'
        ? 'red'
        : variant === 'warning'
          ? 'yellow.7'
          : undefined;
  return (
    <Paper withBorder radius='md' p='sm' ta='center'>
      <Text size='xs' c='dimmed'>{label}</Text>
      <Text fz="1.5rem" fw={600} c={color}>{value}</Text>
    </Paper>
  );
}
