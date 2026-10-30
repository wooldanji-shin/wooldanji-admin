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
import { TableSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
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
  marketingAgreed: boolean;
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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 수신자 모달
  const [recipientsModal, setRecipientsModal] = useState<{ key: string; title: string } | null>(null);
  const [recipients, setRecipients] = useState<Array<{ partnerUserId: string; businessName: string | null; representativeName: string | null; displayPhoneNumber: string | null }>>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

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
      setError('파트너 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
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
        .from('partner_announcement_recipients')
        .select('partnerUserId')
        .eq('announcementId', announcementId);
      if (recErr) throw recErr;

      const ids = (recData ?? []).map((r: any) => r.partnerUserId as string);
      if (ids.length === 0) return;

      const { data: partnerData, error: partnerErr } = await supabase
        .from('partner_users')
        .select('id, businessName, representativeName, displayPhoneNumber')
        .in('id', ids);
      if (partnerErr) throw partnerErr;

      setRecipients(
        (partnerData ?? []).map((p: any) => ({
          partnerUserId: p.id,
          businessName: p.businessName,
          representativeName: p.representativeName,
          displayPhoneNumber: p.displayPhoneNumber,
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
  const eligiblePartners = useMemo(
    () => partners.filter((p) => p.marketingAgreed && p.hasFcmToken),
    [partners],
  );

  const allOnPageSelected = useMemo(
    () => eligiblePartners.length > 0 && eligiblePartners.every((p) => selected.has(p.id)),
    [eligiblePartners, selected],
  );

  function togglePartner(id: string) {
    const partner = partners.find((p) => p.id === id);
    if (!partner?.marketingAgreed || !partner?.hasFcmToken) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) {
      eligiblePartners.forEach((p) => next.delete(p.id));
    } else {
      eligiblePartners.forEach((p) => next.add(p.id));
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
    if (!(await confirmModal({ title: '알림 발송', message: `${selected.size}명에게 발송합니다. 진행할까요?`, confirmLabel: '발송' }))) return;

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
      const res = await fetch(`/api/admin/partner-announcements/${id}`, { method: 'DELETE' });
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
        <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
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
          title="파트너 공지 발송"
          description="광고 상태(A/B/C) 필터 + 다중 선택 후 자유 문구 푸시 발송"
        />
      </PageHeader>

      <PageContent>

      <Grid columns={5} gap="lg">
        {/* ─── 좌측 60% ─────────────────────────────────────────── */}
        <Grid.Col span={{ base: 5, lg: 3 }}>
          <Stack gap="md">
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                파트너 목록 (총 {totalCount}명)
              </Title>
              <Stack gap="md">
                <Group gap="xs">
                  <TextInput
                    placeholder="상호명 / 대표자 / 전화번호"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setPage(0);
                        void loadPartners();
                      }
                    }}
                    w="100%"
                    maw={320}
                  />
                  <Button
                    variant="default"
                    leftSection={<Search size={16} />}
                    onClick={() => {
                      setPage(0);
                      void loadPartners();
                    }}
                  >
                    검색
                  </Button>

                  <Select
                    w={180}
                    data={[
                      { value: 'ALL', label: '전체 케이스' },
                      { value: 'A', label: 'A — 광고전' },
                      { value: 'B', label: 'B — 광고중' },
                      { value: 'C', label: 'C — 광고중단' },
                    ]}
                    value={filterCase}
                    onChange={(v) => {
                      if (v === null) return;
                      setFilterCase(v as 'ALL' | AdCase);
                      setPage(0);
                    }}
                    allowDeselect={false}
                  />

                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={() => loadPartners()}
                    disabled={loading}
                    aria-label="새로고침"
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
                  </ActionIcon>
                </Group>

                <Table.ScrollContainer minWidth={560}>
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={40}>
                          <Checkbox
                            checked={allOnPageSelected}
                            onChange={() => toggleAllOnPage()}
                            aria-label="페이지 전체 선택 (마케팅 미동의자 제외)"
                          />
                        </Table.Th>
                        <Table.Th>상호명</Table.Th>
                        <Table.Th>대표자</Table.Th>
                        <Table.Th>전화</Table.Th>
                        <Table.Th w={120}>케이스</Table.Th>
                        <Table.Th w={80}>FCM</Table.Th>
                        <Table.Th w={80}>마케팅</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {loading && partners.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={7} p={0}>
                            <TableSkeleton rows={8} columns={7} showHeader={false} />
                          </Table.Td>
                        </Table.Tr>
                      ) : partners.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={7} py="xl" ta="center" c="dimmed">
                            조회된 파트너가 없습니다
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        partners.map((p) => (
                          <Table.Tr
                            key={p.id}
                            style={
                              p.marketingAgreed && p.hasFcmToken
                                ? { cursor: 'pointer' }
                                : { opacity: 0.4 }
                            }
                            onClick={() => togglePartner(p.id)}
                          >
                            <Table.Td onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(p.id)}
                                disabled={!p.marketingAgreed || !p.hasFcmToken}
                                onChange={() => togglePartner(p.id)}
                                aria-label="선택"
                              />
                            </Table.Td>
                            <Table.Td>{p.businessName ?? '-'}</Table.Td>
                            <Table.Td>{p.representativeName ?? '-'}</Table.Td>
                            <Table.Td>{p.displayPhoneNumber ?? '-'}</Table.Td>
                            <Table.Td>
                              <Badge
                                variant="light"
                                color={CASE_COLORS[p.adCase] === 'default' ? 'blue' : 'gray'}
                              >
                                {p.adCase} · {CASE_LABELS[p.adCase]}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {p.hasFcmToken ? (
                                <CheckCircle2 size={16} color="var(--mantine-color-green-filled)" />
                              ) : (
                                <XCircle size={16} color="var(--mantine-color-red-filled)" />
                              )}
                            </Table.Td>
                            <Table.Td>
                              {p.marketingAgreed ? (
                                <CheckCircle2 size={16} color="var(--mantine-color-green-filled)" />
                              ) : (
                                <XCircle size={16} color="var(--mantine-color-red-filled)" />
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>

                {/* 페이지네이션 */}
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {totalCount === 0 ? (
                      '0건'
                    ) : (
                      <>
                        {page * PAGE_SIZE + 1}–
                        {Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
                      </>
                    )}
                  </Text>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="default"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      이전
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      다음
                    </Button>
                  </Group>
                </Group>
              </Stack>
            </Paper>

            {/* 발송 폼 */}
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                발송
              </Title>
              <Stack gap="sm">
                <Group gap="xs">
                  <Badge variant="filled">선택 {selected.size}명</Badge>
                  {selected.size > 0 && (
                    <Button size="xs" variant="subtle" onClick={clearSelection}>
                      선택 해제
                    </Button>
                  )}
                </Group>
                <TextInput
                  id="ann-title"
                  label="제목"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={50}
                  placeholder="예: 봄 프로모션 안내"
                />
                <Textarea
                  id="ann-body"
                  label="내용"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={300}
                  rows={4}
                  placeholder="예: 5월 한 달간 첫 광고 등록 시 50% 할인!"
                />
                <Group justify="flex-end">
                  <Button
                    onClick={handleSend}
                    disabled={sending || selected.size === 0 || !title.trim() || !body.trim()}
                    leftSection={
                      sending ? (
                        <Loader2 size={16} className="animate-spin" />
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
          <Paper withBorder radius="md" p="lg" h="100%">
            <Group justify="space-between" mb="md">
              <Group gap="xs">
                <History size={16} />
                <Title order={4}>발송 이력</Title>
              </Group>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => loadHistory()}
                disabled={historyLoading}
                aria-label="발송 이력 새로고침"
              >
                <RefreshCw size={16} className={historyLoading ? 'animate-spin' : undefined} />
              </ActionIcon>
            </Group>
            {historyLoading ? (
              <Center h={128}>
                <Loader size="sm" color="gray" />
              </Center>
            ) : history.length === 0 ? (
              <Text py="xl" ta="center" c="dimmed">
                발송 이력이 없습니다
              </Text>
            ) : (
              <Stack gap="sm">
                {history.map((h) => (
                  <Paper key={h.key} withBorder radius="md" p="sm">
                    <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                      <Text fw={500}>{h.title}</Text>
                      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Badge
                          component="button"
                          type="button"
                          variant="light"
                          color="gray"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setRecipientsModal({ key: h.key, title: h.title });
                            void loadRecipients(h.key);
                          }}
                        >
                          {h.recipients}명
                        </Badge>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(h.key, h.title)}
                          disabled={deletingId === h.key}
                          aria-label="삭제"
                        >
                          {deletingId === h.key ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </ActionIcon>
                      </Group>
                    </Group>
                    <Text size="sm" c="dimmed" mt={4} lineClamp={2}>
                      {h.body}
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs">
                      {format(new Date(h.sentAt), 'yyyy-MM-dd HH:mm', {
                        locale: ko,
                      })}
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
        title="발송 결과"
        size={672}
      >
        <Text size="sm" c="dimmed">
          {resultModal?.chunks}개 청크로 처리됨 · {resultModal?.durationMs}ms
        </Text>
        {resultModal && (
          <Stack gap="md" mt="md">
            <SimpleGrid cols={4} spacing="xs">
              <Stat label='총 대상' value={resultModal.total} />
              <Stat label='성공' value={resultModal.success} variant='success' />
              <Stat label='실패' value={resultModal.failed} variant='danger' />
              <Stat label='토큰없음' value={resultModal.noToken} variant='warning' />
            </SimpleGrid>
            {resultModal.chunkErrors > 0 && (
              <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
                청크 호출 실패 {resultModal.chunkErrors}건 — 일부 파트너 미발송 가능성
              </Alert>
            )}
            {resultModal.failures.length > 0 && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  실패 사유 (최대 50건 표시)
                </Text>
                <Paper withBorder radius="sm">
                  <Table verticalSpacing="xs" horizontalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>partnerUserId</Table.Th>
                        <Table.Th>사유</Table.Th>
                        <Table.Th>메시지</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {resultModal.failures.slice(0, 50).map((f, i) => (
                        <Table.Tr key={`${f.partnerUserId}-${i}`}>
                          <Table.Td ff="monospace" fz="xs">
                            {f.partnerUserId.slice(0, 8)}…
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="gray">
                              {f.reason === 'UNREGISTERED' ? '앱 삭제/재설치' : f.reason}
                            </Badge>
                          </Table.Td>
                          <Table.Td fz="xs" c="dimmed">
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
        <Group justify="flex-end" mt="lg">
          <Button onClick={() => setResultModal(null)}>닫기</Button>
        </Group>
      </Modal>
      {/* 수신자 목록 모달 */}
      <Modal
        opened={!!recipientsModal}
        onClose={() => setRecipientsModal(null)}
        title="수신자 목록"
        size="lg"
      >
        <Text size="sm" c="dimmed" lineClamp={1}>
          {recipientsModal?.title}
        </Text>
        {recipientsLoading ? (
          <Center h={128}>
            <Loader size="sm" color="gray" />
          </Center>
        ) : (
          <ScrollArea.Autosize mah={384} mt="md">
            <Table verticalSpacing="xs" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>상호명</Table.Th>
                  <Table.Th>대표자</Table.Th>
                  <Table.Th>전화</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recipients.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3} py="xl" ta="center" c="dimmed">
                      수신자 정보 없음
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  recipients.map((r) => (
                    <Table.Tr key={r.partnerUserId}>
                      <Table.Td>{r.businessName ?? '-'}</Table.Td>
                      <Table.Td>{r.representativeName ?? '-'}</Table.Td>
                      <Table.Td>{r.displayPhoneNumber ?? '-'}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}
        <Group justify="flex-end" mt="lg">
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
  return (
    <Paper withBorder radius="md" p="sm" ta="center">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text
        fz="1.5rem"
        fw={600}
        c={
          variant === 'success'
            ? 'green'
            : variant === 'danger'
              ? 'red'
              : variant === 'warning'
                ? 'yellow.7'
                : undefined
        }
      >
        {value}
      </Text>
    </Paper>
  );
}
