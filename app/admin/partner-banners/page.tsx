'use client';

// Design Ref: §6.3 partner-banners 페이지 — 탭 2(케이스 4행 + 파트너 검색·편집)
// Plan SC: SC-4(케이스 공통 배너) / SC-5(파트너 개별 배너) / SC-6(비활성/만료)
// Decision: Design §4.4의 별도 API route 대신 admin CRUD 일관성을 위해
//           page.tsx에서 supabase 직접 호출 (RLS가 admin 권한 검증).

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
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
  Megaphone,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirmModal } from '@/components/confirm-modal';
import { TableSkeleton } from '@/components/skeletons';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getSessionUser } from '@/lib/auth';

type BannerCase = 'A' | 'B' | 'C' | 'D';

interface PartnerBanner {
  id: string;
  bannerType: 'case';
  targetCase: BannerCase | null;
  targetPartnerUserId: string | null;
  title: string;
  content: string;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CASE_LABELS: Record<BannerCase, string> = {
  A: '광고전',
  B: '광고중',
  C: '광고중단',
  D: '프리미엄 광고',
};

const CASES: BannerCase[] = ['A', 'B', 'C', 'D'];

export default function PartnerBannersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseBanners, setCaseBanners] = useState<PartnerBanner[]>([]);

  // 모달 상태
  const [editing, setEditing] = useState<{
    targetCase: BannerCase;
    existing?: PartnerBanner;
  } | null>(null);

  useEffect(() => {
    void initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialLoad() {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await getSessionUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      await loadCaseBanners();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '초기 로드 실패');
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseBanners() {
    const { data, error: fetchErr } = await supabase
      .from('partner_banners')
      .select('*')
      .eq('bannerType', 'case')
      .order('targetCase', { ascending: true });
    if (fetchErr) throw fetchErr;
    setCaseBanners((data ?? []) as PartnerBanner[]);
  }

  // ─── 케이스 공통 배너 ───────────────────────────────────────────
  const caseRows = useMemo(() => {
    return CASES.map((c) => ({
      caseKey: c,
      banner: caseBanners.find((b) => b.targetCase === c) ?? null,
    }));
  }, [caseBanners]);

  function openCaseEditor(c: BannerCase, existing: PartnerBanner | null) {
    setEditing({
      targetCase: c,
      existing: existing ?? undefined,
    });
  }

  // ─── 토글 / 삭제 ────────────────────────────────────────────────
  async function toggleActive(b: PartnerBanner) {
    try {
      const { error: updateErr } = await supabase
        .from('partner_banners')
        .update({ isActive: !b.isActive })
        .eq('id', b.id);
      if (updateErr) throw updateErr;
      toast.success(b.isActive ? '비활성화 완료' : '활성화 완료');
      await loadCaseBanners();
    } catch (e: any) {
      toast.error(`토글 실패: ${e?.message ?? e}`);
    }
  }

  async function deleteBanner(b: PartnerBanner) {
    if (!(await confirmModal({ title: '배너 삭제', message: '이 배너를 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) return;
    try {
      const { error: deleteErr } = await supabase
        .from('partner_banners')
        .delete()
        .eq('id', b.id);
      if (deleteErr) throw deleteErr;
      toast.success('삭제 완료');
      await loadCaseBanners();
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? e}`);
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

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="파트너 안내 배너"
          description="나의광고 화면 상단 + 회원가입 시작 화면 상단 배너 (케이스 공통 또는 특정 파트너)"
        />
      </PageHeader>

      <PageContent>
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="md">
            케이스 공통 배너 (A/B/C/D)
          </Title>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm" horizontalSpacing="md" style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w="12%">케이스</Table.Th>
                  <Table.Th w="20%">제목</Table.Th>
                  <Table.Th w="25%">내용</Table.Th>
                  <Table.Th w="10%">활성</Table.Th>
                  <Table.Th w="10%">시작</Table.Th>
                  <Table.Th w="10%">종료</Table.Th>
                  <Table.Th w="13%" ta="right">
                    관리
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} p={0}>
                      <TableSkeleton rows={4} columns={7} showHeader={false} />
                    </Table.Td>
                  </Table.Tr>
                ) : caseRows.map(({ caseKey, banner }) => (
                  <Table.Tr key={caseKey}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {caseKey}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {CASE_LABELS[caseKey]}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {banner ? (
                        <Text size="sm" lineClamp={2}>
                          {banner.title}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          (없음)
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {banner ? (
                        <Text size="sm" c="dimmed" truncate>
                          {banner.content}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {banner ? (
                        <Switch
                          checked={banner.isActive}
                          onChange={() => toggleActive(banner)}
                          aria-label="활성"
                        />
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {banner?.startAt
                        ? format(new Date(banner.startAt), 'yyyy-MM-dd', {
                            locale: ko,
                          })
                        : banner
                          ? '즉시'
                          : '-'}
                    </Table.Td>
                    <Table.Td>
                      {banner?.endAt
                        ? format(new Date(banner.endAt), 'yyyy-MM-dd', {
                            locale: ko,
                          })
                        : banner
                          ? '무기한'
                          : '-'}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Button
                          size="xs"
                          variant="default"
                          leftSection={<Pencil size={12} />}
                          onClick={() => openCaseEditor(caseKey, banner)}
                        >
                          {banner ? '편집' : '신규'}
                        </Button>
                        {banner ? (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="삭제"
                            onClick={() => deleteBanner(banner)}
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        ) : null}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>

        {/* 편집 모달 */}
        <BannerEditorDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadCaseBanners();
          }}
        />
      </PageContent>
    </PageShell>
  );
}

// =====================================================================
// 배너 편집 모달 — 케이스 / 파트너 공용. UPSERT는 onConflict로 1행 보장.
// =====================================================================
function BannerEditorDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: {
    targetCase: BannerCase;
    existing?: PartnerBanner;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    if (editing.existing) {
      setTitle(editing.existing.title);
      setContent(editing.existing.content);
      setIsActive(editing.existing.isActive);
      setStartAt(toLocalDateString(editing.existing.startAt));
      setEndAt(toLocalDateString(editing.existing.endAt));
    } else {
      setTitle('');
      setContent('');
      setIsActive(true);
      setStartAt('');
      setEndAt('');
    }
  }, [editing]);

  if (!editing) return null;

  const headerLabel = `케이스 ${editing.targetCase} — ${editing.existing ? '편집' : '신규'}`;

  async function handleSave() {
    if (!editing) return;
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bannerType: 'case' as const,
        targetCase: editing.targetCase,
        targetPartnerUserId: null,
        title: title.trim(),
        content: content.trim(),
        isActive,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      };

      // partial unique index는 ON CONFLICT (col) 단순 호출과 매칭되지 않으므로
      // 기존 row 유무에 따라 update/insert 분기 (case당 1행은 UI에서 보장)
      const saveErr = editing.existing
        ? (
            await supabase
              .from('partner_banners')
              .update(payload)
              .eq('id', editing.existing.id)
          ).error
        : (await supabase.from('partner_banners').insert(payload)).error;

      if (saveErr) throw saveErr;
      toast.success('저장되었습니다');
      onSaved();
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={!!editing}
      onClose={() => onClose()}
      size="lg"
      title={
        <Group gap="xs">
          <Megaphone size={16} color="var(--mantine-color-blue-filled)" />
          {headerLabel}
        </Group>
      }
    >
      <Text size="sm" c="dimmed">
        케이스/파트너당 1행만 존재합니다. 저장 시 기존 배너가 있으면 덮어씁니다.
      </Text>

      <Stack gap="md" mt="md">
        <TextInput
          id="banner-title"
          label="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
          placeholder="예: 가입 환영 — 첫 광고 무료"
        />
        <Textarea
          id="banner-content"
          label="내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={300}
          placeholder="예: 신규 파트너 회원에게는 첫 달 광고 비용을 면제합니다."
        />
        <Group gap="sm">
          <Switch
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
            label="활성"
          />
          <Badge variant="light" color={isActive ? 'blue' : 'gray'}>
            {isActive ? '활성' : '비활성'}
          </Badge>
        </Group>
        <SimpleGrid cols={2} spacing="sm">
          <TextInput
            id="banner-start"
            label="시작 일시 (선택)"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            description="비워두면 즉시 시작"
            inputWrapperOrder={['label', 'input', 'description', 'error']}
          />
          <TextInput
            id="banner-end"
            label="종료 일시 (선택)"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            description="비워두면 무기한"
            inputWrapperOrder={['label', 'input', 'description', 'error']}
          />
        </SimpleGrid>
      </Stack>

      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          leftSection={saving ? <Loader2 size={16} className="animate-spin" /> : null}
        >
          저장 (UPSERT)
        </Button>
      </Group>
    </Modal>
  );
}

function toLocalDateString(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // datetime-local 입력은 'YYYY-MM-DDTHH:mm' 포맷 (로컬 시간)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
