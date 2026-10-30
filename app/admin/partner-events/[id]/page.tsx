'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, Ban, Check, Pencil, X } from 'lucide-react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  Flex,
  Group,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { DetailSkeleton } from '@/components/skeletons';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { PARTICIPATION_TYPE_LABEL } from '../usePartnerEventsPage';
import { EventBannerPreview } from './EventBannerPreview';
import { eventBannerThemeOf } from './eventBannerThemes';
import {
  useEventDetailPage,
  bannerPreviewOf,
  couponBenefitText,
  drawStatusLabelOf,
  type EventDetail,
  type EventEditForm,
  type EventEntryRow,
} from './useEventDetailPage';

type Page = ReturnType<typeof useEventDetailPage>;
type SetForm = Page['setEditForm'];

/** 관리자가 수정할 수 있는 일정 */
const SCHEDULE_FIELDS = [
  ['entryStartAt', '응모 시작'],
  ['entryEndAt', '응모 종료'],
] as const;

/** DB generated column — 응모 종료로부터 자동 계산되어 수정 불가 */
const AUTO_SCHEDULE_FIELDS = [
  ['announceAt', '당첨자 발표', '응모 종료 + 2시간'],
  ['endAt', '이벤트 종료', '발표 다음날 자정'],
] as const;

function toDateTimeText(value: string | null): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '-';
}

/** '2026.09.26 18:00' */
function toCompactDateTime(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 상태 배지 — 공용 StatusBadge는 흰 배경용(연한 틴트)이라 검정·cobalt 면에서 묻힌다. 어두운 면 전용으로 색을 채운다 */
const EVENT_STATUS_PILL: Record<EventDetail['status'], { label: string }> = {
  pending: { label: '승인대기' },
  approved: { label: '승인됨' },
  rejected: { label: '거절됨' },
  ended: { label: '종료' },
};

function EventStatusPill({ status }: { status: EventDetail['status'] }): React.ReactElement {
  const { label } = EVENT_STATUS_PILL[status];
  return (
    <Badge
      variant="light"
      color={
        status === 'pending'
          ? 'yellow'
          : status === 'approved'
            ? 'green'
            : status === 'rejected'
              ? 'red'
              : 'gray'
      }
    >
      {label}
    </Badge>
  );
}

/** badge-tag — 중립 태그 */
function Tag({ children, dark }: { children: React.ReactNode; dark?: boolean }): React.ReactElement {
  return (
    <Badge variant={dark ? 'filled' : 'light'} color="gray">
      {children}
    </Badge>
  );
}

/** feature-card-light — 흰 카드, hairline, 20px, 32px 패딩 */
function Card({
  title,
  meta,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}): React.ReactElement {
  return (
    <Paper component="section" withBorder radius="md" p="lg" className={className}>
      <Group justify="space-between" gap="sm" mb="md">
        <Title order={4}>{title}</Title>
        {meta}
      </Group>
      <Box className={bodyClassName}>{children}</Box>
    </Paper>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Stack
      gap={6}
      py="sm"
      style={{ borderTop: '1px solid var(--app-divider)' }}
    >
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Box fz="sm">{children}</Box>
    </Stack>
  );
}

export default function PartnerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = useEventDetailPage(params);
  const bannerLb = useImageLightbox(page.detail?.bannerImageUrl ? [page.detail.bannerImageUrl] : []);
  const detailLb = useImageLightbox(page.detail?.detailImageUrls ?? []);
  const goBack = (): void => router.push('/admin/partner-events');

  if (page.loading) {
    return <DetailSkeleton sections={4} />;
  }

  if (!page.detail) {
    return (
      <PageShell>
        <Center py={96}>
          <Stack align="center" gap="lg">
            <AlertCircle size={32} color="var(--mantine-color-dimmed)" />
            <Text size="xl" fw={500}>
              이벤트 정보를 찾을 수 없습니다.
            </Text>
            <Button onClick={goBack}>목록으로</Button>
          </Stack>
        </Center>
      </PageShell>
    );
  }

  const { detail } = page;
  const form = page.editing ? page.editForm : null;

  return (
    <PageShell>
      {/* 이벤트명은 아래 본문에 크게(수정 중엔 입력칸으로) 나오니 헤더는 화면 이름만 */}
      <HeaderTitle title="이벤트 상세" onBack={goBack} />
      <HeroBand
        page={page}
        detail={detail}
        form={form}
        onOpenBanner={() => bannerLb.open(0)}
        onOpenDetailImage={(index) => detailLb.open(index)}
      />

      {detail.status === 'rejected' && detail.rejectionReason && (
        <Alert color="red" variant="light" icon={<AlertCircle size={20} />} title="거절 사유">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {detail.rejectionReason}
          </Text>
        </Alert>
      )}

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align="flex-start">
        {/* ── 좌측 ── */}
        <Stack gap="lg" w="100%" style={{ flex: 1, minWidth: 0 }}>
          <EventCard detail={detail} form={form} setForm={page.setEditForm} error={page.scheduleError} />
          <CouponCard detail={detail} form={form} setForm={page.setEditForm} />
          <ApartmentsCard detail={detail} form={form} setForm={page.setEditForm} allApartments={page.allApartments} />
          <EntriesCard entries={page.entries} winners={page.winners} />
        </Stack>

        {/* ── 우측 ── */}
        <Stack
          component="aside"
          gap="md"
          w={{ base: '100%', lg: 360 }}
          pos={{ base: 'static', lg: 'sticky' }}
          top={24}
          style={{ flexShrink: 0 }}
        >
          <SummaryCard detail={detail} entryCount={page.entries.length} winnerCount={page.winners.length} />
          {!page.editing && <ReviewActions page={page} />}
        </Stack>
      </Flex>

      <RejectDialog page={page} />
      <ForceEndDialog page={page} />
      <ImageLightbox {...bannerLb.props} />
      <ImageLightbox {...detailLb.props} />
    </PageShell>
  );
}

/** hero-band-dark — 상호명 · 제목 · 상태 + 앱 배너를 product mockup으로 */
function HeroBand({
  page,
  detail,
  form,
  onOpenBanner,
  onOpenDetailImage,
}: {
  page: Page;
  detail: EventDetail;
  form: EventEditForm | null;
  onOpenBanner: () => void;
  onOpenDetailImage: (index: number) => void;
}): React.ReactElement {
  const drawLabel = drawStatusLabelOf(detail);

  return (
    <Stack component="section" gap="lg">
      {/* 종료된 이벤트는 버튼이 없어 빈 줄이 생기지 않게 한다 */}
      {(page.editing || detail.status !== 'ended') && (
        <Group justify="flex-end">
          <HeaderActions page={page} />
        </Group>
      )}

      <Paper withBorder radius="md" p="lg">
        <Flex direction={{ base: 'column', lg: 'row' }} gap="xl" align={{ base: 'stretch', lg: 'flex-start' }}>
          <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs">
              <EventStatusPill status={detail.status} />
              {drawLabel && <Tag dark>{drawLabel}</Tag>}
            </Group>
            <Text c="dimmed">{detail.businessName}</Text>
            {form ? (
              <TextInput
                size="lg"
                maw={672}
                value={form.title}
                onChange={(e) => page.setEditForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="이벤트명"
              />
            ) : (
              <Title order={1} size="h2">
                {detail.title}
              </Title>
            )}
            <Text size="sm" c="dimmed">
              신청일시 {toDateTimeText(detail.createdAt)}
            </Text>
          </Stack>

          <BannerMockup detail={detail} form={form} onOpenBanner={onOpenBanner} onOpenDetailImage={onOpenDetailImage} />
        </Flex>
      </Paper>
    </Stack>
  );
}

/** product-mockup — 앱 홈 배너 그대로 + 상세 이미지 */
function BannerMockup({
  detail,
  form,
  onOpenBanner,
  onOpenDetailImage,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  onOpenBanner: () => void;
  onOpenDetailImage: (index: number) => void;
}): React.ReactElement {
  return (
    <Paper bg="var(--app-bg-muted)" radius="md" p="lg" w={{ base: '100%', sm: 'auto' }}>
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Text size="sm" fw={600}>
            홈 배너
          </Text>
          <Text size="xs" c="dimmed">
            {detail.bannerType === 'image' ? '이미지로만' : `기본 배너 · ${eventBannerThemeOf(detail.bannerTheme).label} 테마`}
          </Text>
        </Group>
        <Box style={{ overflowX: 'auto' }}>
          <EventBannerPreview data={bannerPreviewOf(detail, form)} onImageClick={onOpenBanner} />
        </Box>
        <Divider />
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            상세 이미지 {detail.detailImageUrls.length}장
          </Text>
          {detail.detailImageUrls.length > 0 && (
            <Group gap="xs">
              {detail.detailImageUrls.map((url, index) => (
                <ImageThumbnail
                  key={url}
                  src={url}
                  alt={`상세 이미지 ${index + 1}`}
                  onClick={() => onOpenDetailImage(index)}
                />
              ))}
            </Group>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function HeaderActions({ page }: { page: Page }): React.ReactElement | null {
  if (page.editing) {
    return (
      <Group gap="xs">
        <Button variant="default" onClick={page.cancelEdit} disabled={page.saving}>
          취소
        </Button>
        <Button onClick={page.handleSaveEdit} disabled={page.saving}>
          {page.saving ? '저장 중...' : '저장'}
        </Button>
      </Group>
    );
  }
  if (page.detail?.status === 'ended') return null;
  return (
    <Button variant="default" leftSection={<Pencil size={16} />} onClick={page.startEdit}>
      정보 수정
    </Button>
  );
}

/** 참여방식 · 당첨 인원 · 일정 */
function EventCard({
  detail,
  form,
  setForm,
  error,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  setForm: SetForm;
  error: string | null;
}): React.ReactElement {
  return (
    <Card title="이벤트">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" verticalSpacing={0}>
        <Field label="참여방식">
          {form ? (
            /* 선착순은 당분간 운영하지 않아 선택지에서 뺐다 (기존 선착순 이벤트 표시는 유지) */
            <Select
              data={[
                { value: 'draw', label: PARTICIPATION_TYPE_LABEL.draw },
                // 기존 선착순 이벤트는 현재 값이 보이도록 비활성 옵션으로만 노출
                ...(form.participationType !== 'draw'
                  ? [
                      {
                        value: form.participationType,
                        label: PARTICIPATION_TYPE_LABEL[form.participationType],
                        disabled: true,
                      },
                    ]
                  : []),
              ]}
              value={form.participationType}
              onChange={(v) => {
                if (v === null) return;
                setForm((p) => ({ ...p, participationType: v as typeof p.participationType }));
              }}
              allowDeselect={false}
            />
          ) : (
            PARTICIPATION_TYPE_LABEL[detail.participationType]
          )}
        </Field>
        <Field label="당첨 인원">
          {form ? (
            <TextInput
              type="number"
              min={1}
              value={form.winnerCount}
              onChange={(e) => setForm((p) => ({ ...p, winnerCount: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
          ) : (
            <Text span size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {detail.winnerCount.toLocaleString()}명
            </Text>
          )}
        </Field>
        {form &&
          SCHEDULE_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <TextInput
                type="datetime-local"
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </Field>
          ))}
        {form &&
          AUTO_SCHEDULE_FIELDS.map(([key, label, rule]) => (
            <Field key={key} label={`${label} (자동)`}>
              <Text span size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {toDateTimeText(detail[key])}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {rule}
              </Text>
            </Field>
          ))}
      </SimpleGrid>
      {form && error && (
        <Text size="sm" c="red" pt="xs">
          {error}
        </Text>
      )}
      {!form && <ScheduleTimeline detail={detail} />}
    </Card>
  );
}

/** 응모 시작 → 응모 종료 → 발표 → 종료 — 지난 단계는 ink로 채운다 */
function ScheduleTimeline({ detail }: { detail: EventDetail }): React.ReactElement {
  const now = Date.now();
  const steps = [
    ...SCHEDULE_FIELDS.map(([key, label]) => ({ key, label, rule: null as string | null })),
    ...AUTO_SCHEDULE_FIELDS.map(([key, label, rule]) => ({ key, label, rule: rule as string | null })),
  ];

  return (
    <Box pt="lg" style={{ borderTop: '1px solid var(--app-divider)' }}>
      <Text size="sm" c="dimmed" mb="md">
        일정
      </Text>
      <SimpleGrid component="ol" cols={{ base: 1, sm: 4 }} spacing={0} verticalSpacing="md" m={0} p={0} style={{ listStyle: 'none' }}>
        {steps.map((step, index) => {
          const passed = new Date(detail[step.key]).getTime() <= now;
          const isLast = index === steps.length - 1;
          return (
            <Box component="li" key={step.key} pr={{ sm: 'md' }}>
              <Group gap={0} wrap="nowrap" mb="xs">
                <ThemeIcon
                  size={12}
                  radius="xl"
                  variant={passed ? 'filled' : 'outline'}
                  color={passed ? 'blue' : 'gray'}
                />
                {!isLast && (
                  <Divider
                    visibleFrom="sm"
                    size={2}
                    color={passed ? 'blue' : undefined}
                    style={{ flex: 1 }}
                  />
                )}
              </Group>
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  {step.label}
                </Text>
                <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {toCompactDateTime(detail[step.key])}
                </Text>
                {step.rule && (
                  <Text size="xs" c="dimmed">
                    {step.rule}
                  </Text>
                )}
              </Stack>
            </Box>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}

/** 당첨 쿠폰 — 앱에는 '아메리카노 10% 할인'처럼 할인 대상과 혜택을 이어 붙여 보여준다 */
function CouponCard({
  detail,
  form,
  setForm,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  setForm: SetForm;
}): React.ReactElement {
  const source = form ?? detail;
  const benefit = couponBenefitText(source.couponTitle, source.couponDiscountType, source.couponDiscountValue);

  return (
    <Card title="당첨 쿠폰">
      <Paper bg="var(--app-bg-muted)" radius="md" p="lg" mb="lg">
        <Text size="xs" c="dimmed">
          {detail.businessName}
        </Text>
        <Title order={2} mt="xs">
          {benefit || '-'}
        </Title>
        <Text size="sm" c="dimmed" mt="md">
          {form ? '만료일은 아래에서 수정' : `${toCompactDateTime(detail.couponExpiresAt)}까지`}
        </Text>
      </Paper>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" verticalSpacing={0}>
        <Field label="혜택">
          {form ? (
            <BenefitEditor form={form} setForm={setForm} />
          ) : (
            couponBenefitText('', detail.couponDiscountType, detail.couponDiscountValue)
          )}
        </Field>
        <Field label={source.couponDiscountType === 'gift' ? '증정품' : '할인 대상'}>
          {form ? (
            <TextInput
              value={form.couponTitle}
              onChange={(e) => setForm((p) => ({ ...p, couponTitle: e.target.value }))}
              placeholder={form.couponDiscountType === 'gift' ? '예) 아메리카노 1잔' : '예) 아메리카노 / 전 메뉴'}
            />
          ) : (
            detail.couponTitle
          )}
        </Field>
        <Field label="쿠폰 만료일">
          {form ? (
            <TextInput
              type="datetime-local"
              value={form.couponExpiresAt}
              onChange={(e) => setForm((p) => ({ ...p, couponExpiresAt: e.target.value }))}
            />
          ) : (
            <Text span size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {toDateTimeText(detail.couponExpiresAt)}
            </Text>
          )}
        </Field>
      </SimpleGrid>
    </Card>
  );
}

function BenefitEditor({ form, setForm }: { form: EventEditForm; setForm: SetForm }): React.ReactElement {
  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        w={120}
        style={{ flexShrink: 0 }}
        data={[
          { value: 'percent', label: '% 할인' },
          { value: 'fixed', label: '원 할인' },
          { value: 'gift', label: '증정' },
        ]}
        value={form.couponDiscountType}
        onChange={(v) => {
          if (v === null) return;
          setForm((p) => ({
            ...p,
            couponDiscountType: v as typeof p.couponDiscountType,
            couponDiscountValue: v === 'gift' ? null : p.couponDiscountValue,
          }));
        }}
        allowDeselect={false}
      />
      {form.couponDiscountType !== 'gift' && (
        <TextInput
          type="number"
          min={0}
          style={{ flex: 1 }}
          value={form.couponDiscountValue ?? ''}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              couponDiscountValue: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
          placeholder={form.couponDiscountType === 'percent' ? '%' : '원'}
        />
      )}
    </Group>
  );
}

function ApartmentsCard({
  detail,
  form,
  setForm,
  allApartments,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  setForm: SetForm;
  allApartments: Page['allApartments'];
}): React.ReactElement {
  const count = form ? form.apartmentIds.length : detail.apartmentNames.length;
  const toggle = (id: string): void =>
    setForm((p) => ({
      ...p,
      apartmentIds: p.apartmentIds.includes(id)
        ? p.apartmentIds.filter((x) => x !== id)
        : [...p.apartmentIds, id],
    }));

  return (
    <Card title="대상 아파트" meta={<Tag>{count}곳</Tag>}>
      {form ? (
        <ScrollArea.Autosize mah={320}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
            {allApartments.map((apt) => {
              const checked = form.apartmentIds.includes(apt.id);
              return (
                <Paper key={apt.id} withBorder radius="md" px="md" py="sm">
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(apt.id)}
                    label={apt.name}
                    styles={{ body: { cursor: 'pointer' }, label: { cursor: 'pointer' } }}
                  />
                </Paper>
              );
            })}
          </SimpleGrid>
        </ScrollArea.Autosize>
      ) : detail.apartmentNames.length === 0 ? (
        <Text size="sm" c="dimmed">
          지정된 아파트가 없습니다.
        </Text>
      ) : (
        <Group gap="xs">
          {/* 이름이 같은 아파트가 있을 수 있어 순서까지 key에 넣는다 */}
          {detail.apartmentNames.map((name, i) => (
            <Badge key={`${name}-${i}`} variant="light" color="gray" size="lg">
              {name}
            </Badge>
          ))}
        </Group>
      )}
    </Card>
  );
}

function EntriesCard({
  entries,
  winners,
}: {
  entries: EventEntryRow[];
  winners: EventEntryRow[];
}): React.ReactElement {
  return (
    <Card title="응모 현황">
      <Tabs defaultValue="entries" variant="pills">
        <Tabs.List mb="md">
          <Tabs.Tab value="entries">응모자 {entries.length}</Tabs.Tab>
          <Tabs.Tab value="winners">당첨자 {winners.length}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="entries">
          <EntriesTable rows={entries} emptyText="응모자가 없습니다." />
        </Tabs.Panel>
        <Tabs.Panel value="winners">
          <EntriesTable rows={winners} emptyText="당첨자가 없습니다." />
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}

function EntriesTable({ rows, emptyText }: { rows: EventEntryRow[]; emptyText: string }): React.ReactElement {
  if (rows.length === 0) {
    return (
      <Text py={48} ta="center" c="dimmed">
        {emptyText}
      </Text>
    );
  }
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>이름</Table.Th>
            <Table.Th>응모 코드</Table.Th>
            <Table.Th>아파트</Table.Th>
            <Table.Th>동 · 호수</Table.Th>
            <Table.Th>당첨</Table.Th>
            <Table.Th>응모일시</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.entryId}>
              <Table.Td fw={600}>{row.userName}</Table.Td>
              <Table.Td ff="monospace" style={{ letterSpacing: '0.05em' }}>
                {row.entryCode}
              </Table.Td>
              <Table.Td>{row.apartmentName?.trim() || '-'}</Table.Td>
              <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {row.buildingNumber != null ? `${row.buildingNumber}동` : '-'}
                {row.unit != null && ` ${row.unit}호`}
              </Table.Td>
              <Table.Td>
                {row.isWinner ? (
                  <Badge variant="light" color="green">
                    당첨
                  </Badge>
                ) : (
                  <Text span c="dimmed">
                    -
                  </Text>
                )}
              </Table.Td>
              <Table.Td c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {toDateTimeText(row.enteredAt)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** plan-card-featured — 화면의 유일한 cobalt 면 */
function SummaryCard({
  detail,
  entryCount,
  winnerCount,
}: {
  detail: EventDetail;
  entryCount: number;
  winnerCount: number;
}): React.ReactElement {
  const fillRate = detail.winnerCount > 0 ? Math.min(100, (winnerCount / detail.winnerCount) * 100) : 0;
  const history = [
    ['승인일시', detail.approvedAt],
    ['거절일시', detail.rejectedAt],
    ['종료일시', detail.endedAt],
  ] as const;

  return (
    <Paper component="section" withBorder radius="md" p="lg">
      <Group justify="space-between">
        <Title order={4}>요약</Title>
        <EventStatusPill status={detail.status} />
      </Group>

      <Box mt="lg">
        <Text size="sm" c="dimmed">
          응모자
        </Text>
        <Text fz="2.5rem" fw={500} lh={1} mt={4} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {entryCount.toLocaleString()}
          <Text span fz="lg" ml={4}>
            명
          </Text>
        </Text>
      </Box>

      <Stack gap="xs" mt="lg">
        <Group justify="space-between" align="baseline">
          <Text size="sm" c="dimmed">
            당첨자
          </Text>
          <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {winnerCount.toLocaleString()} / {detail.winnerCount.toLocaleString()}명
          </Text>
        </Group>
        <Progress value={fillRate} size="sm" radius="xl" />
      </Stack>

      <Divider my="lg" />

      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            대상 아파트
          </Text>
          <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {detail.apartmentNames.length}곳
          </Text>
        </Group>
        {history
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <Group key={label} justify="space-between" gap="md">
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {toDateTimeText(value)}
              </Text>
            </Group>
          ))}
      </Stack>
    </Paper>
  );
}

function ReviewActions({ page }: { page: Page }): React.ReactElement | null {
  const status = page.detail?.status;

  if (status === 'pending') {
    // 응모 시작이 지난 이벤트는 승인하면 응모 기간이 줄거나 0명이 된다 — 일정 수정 후 승인
    const entryStartAt = page.detail?.entryStartAt;
    const entryStarted = !!entryStartAt && new Date(entryStartAt).getTime() <= Date.now();
    return (
      <Paper component="section" withBorder radius="md" p="lg">
        <Stack gap="sm">
          {entryStarted && (
            <Alert color="yellow" variant="light" icon={<AlertCircle size={16} />}>
              응모 시작 시각이 지나 승인할 수 없습니다. 일정을 수정한 뒤 승인해주세요.
            </Alert>
          )}
          <Button
            fullWidth
            leftSection={<Check size={16} />}
            onClick={page.handleApprove}
            disabled={page.approving || entryStarted}
          >
            {page.approving ? '처리 중...' : '승인하기'}
          </Button>
          <Button
            fullWidth
            variant="default"
            leftSection={<X size={16} />}
            onClick={() => page.setRejectDialog(true)}
          >
            거절하기
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (status === 'approved') {
    return (
      <Paper component="section" withBorder radius="md" p="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            종료하면 주민 앱에서 바로 사라지고 되돌릴 수 없습니다.
          </Text>
          <Button
            fullWidth
            variant="light"
            color="red"
            leftSection={<Ban size={16} />}
            onClick={() => page.setEndDialog(true)}
          >
            강제 종료
          </Button>
        </Stack>
      </Paper>
    );
  }

  return null;
}

function RejectDialog({ page }: { page: Page }): React.ReactElement {
  return (
    <Modal opened={page.rejectDialog} onClose={() => page.setRejectDialog(false)} title="이벤트 거절">
      <Text size="sm" c="dimmed">
        거절 사유는 파트너에게 그대로 보여집니다.
      </Text>
      <Textarea
        mt="md"
        minRows={5}
        autosize
        placeholder="거절 사유를 입력해주세요"
        value={page.rejectReason}
        onChange={(e) => page.setRejectReason(e.target.value)}
      />
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => page.setRejectDialog(false)} disabled={page.rejecting}>
          취소
        </Button>
        <Button color="red" onClick={page.handleReject} disabled={page.rejecting}>
          {page.rejecting ? '처리 중...' : '거절'}
        </Button>
      </Group>
    </Modal>
  );
}

function ForceEndDialog({ page }: { page: Page }): React.ReactElement {
  return (
    <Modal closeOnClickOutside={false} withCloseButton={false} opened={page.endDialog} onClose={() => page.setEndDialog(false)} title="이벤트를 종료할까요?">
      <Text size="sm" c="dimmed">
        종료하면 주민 앱에서 바로 사라지고 되돌릴 수 없습니다.
      </Text>
      <Group justify="flex-end" mt="lg">
        {/* AlertDialogCancel과 동일하게 클릭 시 다이얼로그를 닫는다 */}
        <Button variant="default" disabled={page.ending} onClick={() => page.setEndDialog(false)}>
          취소
        </Button>
        {/* 원본은 e.preventDefault()로 자동 닫힘을 막았으므로 여기서도 닫지 않는다 (처리 후 훅이 닫음) */}
        <Button
          color="red"
          onClick={() => {
            page.handleForceEnd();
          }}
          disabled={page.ending}
        >
          {page.ending ? '처리 중...' : '종료'}
        </Button>
      </Group>
    </Modal>
  );
}
