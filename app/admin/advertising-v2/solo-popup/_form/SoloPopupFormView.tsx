'use client';

import { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { DetailSkeleton } from '@/components/skeletons';
import { PartnerCombobox } from '@/components/partner-combobox';
import { SalesRepSelect } from '@/components/sales-rep-select';
import {
  SOLO_BULLET_MAX_LENGTH,
  SOLO_IMAGE_MAX_COUNT,
  SOLO_BULLET_MAX_LINES,
  SOLO_TEXT_MAX_LENGTH,
  SOLO_TEXT_MAX_LINES,
  SOLO_MAX_MONTHS,
  SOLO_MAX_WEEKS,
  SOLO_BUTTON_LABEL_MAX,
  SOLO_TITLE_MAX,
  CONTENT_TYPE_LABEL,
  soloTextLength,
  type SoloContentType,
} from '@/lib/ads/solo-popup';
import { SoloImageSortableList } from './SoloImageSortableList';
import { SoloImageCropDialog } from './SoloImageCropDialog';
import { useSoloPopupForm, type SoloBaseAdOption } from './useSoloPopupForm';

const LIST_PATH = '/admin/advertising-v2/solo-popup';

// 선택칸·짧은 입력칸 폭 / 긴 입력칸 최대 폭 / 글자 수 표시 — 폼 전체에서 통일
const FIELD_WIDTH = 'w-full md:w-[420px]';
const LONG_FIELD_WIDTH = 'w-full max-w-2xl';

interface SoloPopupFormViewProps {
  /** 주면 수정 모드 */
  soloId?: string;
}

/** 연결된 기본 광고의 현재 노출 아파트 — 확인용 읽기 전용 목록 */
function BaseAdApartments({
  baseAd,
  changedSinceApply,
}: {
  baseAd: SoloBaseAdOption;
  changedSinceApply: boolean;
}): React.ReactElement {
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        노출 아파트{' '}
        <Text span size="xs" fw={500} c="dimmed">(기본 광고를 그대로 따라요)</Text>
      </Text>
      <Text size="xs" c="dimmed">카테고리 {baseAd.categoryName ?? '-'}</Text>
      {baseAd.apartments.length === 0 ? (
        <Text size="sm" c="dimmed">아파트 정보 없음</Text>
      ) : (
        <Paper withBorder radius="md" px="sm" className={LONG_FIELD_WIDTH}>
          <ScrollArea.Autosize mah={240}>
            {baseAd.apartments.map((apt) => (
              <Group
                key={apt.apartmentId}
                justify="space-between"
                align="flex-start"
                gap="sm"
                wrap="nowrap"
                py={8}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--app-divider)' }}
              >
                <Box miw={0} style={{ flex: 1 }}>
                  <Text size="sm" fw={500} truncate>{apt.name}</Text>
                  {apt.address && <Text size="xs" c="dimmed" mt={2} truncate>{apt.address}</Text>}
                </Box>
                <Text size="sm" fw={600} style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {apt.totalHouseholds.toLocaleString()}
                  <Text span size="xs" fw={500} c="dimmed" ml={2}>세대</Text>
                </Text>
              </Group>
            ))}
          </ScrollArea.Autosize>
        </Paper>
      )}
      <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
        총 {baseAd.apartments.length.toLocaleString()}곳 · {baseAd.totalHouseholds.toLocaleString()}세대
      </Text>
      {changedSinceApply && (
        <Text size="xs" c="red">신청 당시와 아파트가 달라졌어요 (금액은 신청 당시 기준입니다).</Text>
      )}
    </Stack>
  );
}

export function SoloPopupFormView({ soloId }: SoloPopupFormViewProps): React.ReactElement {
  const page = useSoloPopupForm(soloId);
  const router = useRouter();
  const { form, patch, isEdit, contentOnly } = page;
  // 브라우저 기본 파일 칸("Choose Files") 대신 버튼으로 파일 선택창을 연다
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (page.loading) {
    return <DetailSkeleton sections={5} />;
  }

  if (page.loadError) {
    return (
      <PageShell>
        <Text size="sm" c="red">{page.loadError}</Text>
        <Group>
          <Button variant="default" component={Link} href={LIST_PATH} leftSection={<ArrowLeft size={16} />}>
            목록으로
          </Button>
        </Group>
      </PageShell>
    );
  }

  const periodMax = form.periodUnit === 'month' ? SOLO_MAX_MONTHS : SOLO_MAX_WEEKS;
  const countOptions = Array.from({ length: periodMax }, (_, i) => i + 1);

  const setBullet = (index: number, value: string) =>
    patch({ bulletLines: form.bulletLines.map((l, i) => (i === index ? value : l)) });

  return (
    <PageShell>
      <HeaderTitle
        title={isEdit ? '단독 팝업 광고 수정' : '단독 팝업 광고 대리 등록'}
        onBack={() => router.push(isEdit ? `${LIST_PATH}/${soloId}` : LIST_PATH)}
      />
      <Text size="sm" c="dimmed">
        {contentOnly
          ? '광고중인 단독 팝업의 내용을 고칩니다. 저장하면 앱에 바로 반영됩니다.'
          : isEdit
            ? '결제 전 단독 팝업의 내용과 승인 조건을 고칩니다.'
            : '운영 중인 기본 광고에 단독 팝업을 대신 등록합니다.'}
      </Text>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">파트너 · 기본 광고</Title>
        <Stack gap="lg">
          {isEdit ? (
            <Text size="sm" c="dimmed">
              파트너·기본 광고는 수정할 수 없습니다 (노출 아파트와 금액이 달라지기 때문입니다).
            </Text>
          ) : (
            <>
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  파트너 <Text span c="red">*</Text>
                </Text>
                <Box>
                  <PartnerCombobox
                    className={FIELD_WIDTH}
                    partners={page.partners.map((p) => ({ id: p.id, businessName: p.businessName, description: p.description }))}
                    value={form.partnerId}
                    onChange={page.selectPartner}
                  />
                </Box>
              </Stack>
              {form.partnerId &&
                (page.partnerBaseAds.length > 0 ? (
                  <Select
                    className={FIELD_WIDTH}
                    label="연결할 기본 광고"
                    withAsterisk
                    placeholder="단독 팝업을 연결할 기본 광고 선택"
                    data={page.partnerBaseAds.map((ad) => ({
                      value: ad.id,
                      label: `${ad.title ?? '(제목 없음)'} · ${ad.totalHouseholds.toLocaleString()}세대`,
                    }))}
                    value={form.baseAdId || null}
                    onChange={(v) => {
                      if (v === null) return;
                      patch({ baseAdId: v });
                    }}
                    allowDeselect={false}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    이 파트너에게는 단독 팝업을 등록할 수 있는 광고가 없습니다. 운영 중(결제 완료)이고
                    진행 중인 단독 팝업이 없는 광고만 고를 수 있습니다.
                  </Text>
                ))}
            </>
          )}
          {page.selectedBaseAd && <BaseAdApartments baseAd={page.selectedBaseAd} changedSinceApply={page.apartmentsChangedSinceApply} />}
        </Stack>
      </Paper>

      {(form.baseAdId || isEdit) && (
        <>
          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">팝업 내용</Title>
            <Stack gap="lg">
              <Stack gap={4} className={FIELD_WIDTH}>
                <TextInput
                  label="제목"
                  withAsterisk
                  value={form.title}
                  maxLength={SOLO_TITLE_MAX}
                  onChange={(e) => patch({ title: e.target.value })}
                />
                <Text size="xs" c="dimmed" ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{form.title.length}/{SOLO_TITLE_MAX}</Text>
              </Stack>

              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  이미지 <Text span c="red">*</Text>{' '}
                  <Text span size="xs" fw={500} c="dimmed">
                    최대 {SOLO_IMAGE_MAX_COUNT}장 · 문을 열 때마다 1장이 무작위로 노출됩니다 · 사진을 고르면 한 장씩 원하는 위치를 잘라 1080×1080으로 저장합니다
                  </Text>
                </Text>
                <SoloImageSortableList images={form.images} onRemove={page.removeImage} onReorder={page.reorderImages} />
                {form.images.length > 1 && (
                  <Text size="xs" c="dimmed">사진을 끌어서 순서를 바꿀 수 있어요.</Text>
                )}
                <SoloImageCropDialog
                  file={page.cropState.file}
                  title={page.cropState.title}
                  onApply={page.applyCrop}
                  onCancel={page.cancelCrop}
                />
                {form.images.length < SOLO_IMAGE_MAX_COUNT && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        if (files.length) page.pickImages(files);
                      }}
                    />
                    <Group>
                      <Button type="button" variant="default" onClick={() => fileInputRef.current?.click()}>
                        이미지를 선택해주세요
                      </Button>
                    </Group>
                  </>
                )}
              </Stack>

              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  문구 <Text span c="red">*</Text>{' '}
                  <Text span size="xs" fw={500} c="dimmed">
                    {form.contentType === 'bullets'
                      ? `글머리표 1~${SOLO_BULLET_MAX_LINES}줄, 줄당 ${SOLO_BULLET_MAX_LENGTH}자`
                      : `최대 ${SOLO_TEXT_MAX_LINES}줄, ${SOLO_TEXT_MAX_LENGTH}자 (줄바꿈 제외)`}
                  </Text>
                </Text>
                <Group gap="xs">
                  {(Object.keys(CONTENT_TYPE_LABEL) as SoloContentType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="xs"
                      variant={form.contentType === type ? 'filled' : 'default'}
                      onClick={() => patch({ contentType: type })}
                    >
                      {CONTENT_TYPE_LABEL[type]}
                    </Button>
                  ))}
                </Group>
                {form.contentType === 'text' ? (
                  <Stack gap={4} className={LONG_FIELD_WIDTH}>
                    <Textarea
                      minRows={3}
                      autosize
                      value={form.bodyText}
                      placeholder={`최대 ${SOLO_TEXT_MAX_LINES}줄, ${SOLO_TEXT_MAX_LENGTH}자까지`}
                      onChange={(e) => {
                        // 줄 수 초과 입력은 받지 않는다 (글자수는 카운터·검증으로 안내)
                        if (e.target.value.split('\n').length > SOLO_TEXT_MAX_LINES) return;
                        patch({ bodyText: e.target.value });
                      }}
                    />
                    <Text size="xs" c="dimmed" ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {soloTextLength(form.bodyText)}/{SOLO_TEXT_MAX_LENGTH}
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap="sm" className={LONG_FIELD_WIDTH}>
                    {form.bulletLines.map((line, i) => (
                      <Group key={i} align="flex-start" gap="xs" wrap="nowrap">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <TextInput
                            value={line}
                            maxLength={SOLO_BULLET_MAX_LENGTH}
                            onChange={(e) => setBullet(i, e.target.value)}
                          />
                          <Text size="xs" c="dimmed" ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {line.length}/{SOLO_BULLET_MAX_LENGTH}
                          </Text>
                        </Stack>
                        {/* 1줄일 때도 자리를 비워 둬 줄이 늘어도 입력칸 폭이 변하지 않게 한다 */}
                        <Button
                          variant="subtle"
                          color="gray"
                          style={{ visibility: form.bulletLines.length > 1 ? 'visible' : 'hidden' }}
                          tabIndex={form.bulletLines.length > 1 ? 0 : -1}
                          onClick={() => patch({ bulletLines: form.bulletLines.filter((_, idx) => idx !== i) })}
                        >
                          삭제
                        </Button>
                      </Group>
                    ))}
                    {form.bulletLines.length < SOLO_BULLET_MAX_LINES && (
                      <Group>
                        <Button variant="default" size="xs" onClick={() => patch({ bulletLines: [...form.bulletLines, ''] })}>
                          줄 추가
                        </Button>
                      </Group>
                    )}
                  </Stack>
                )}
              </Stack>

              <Stack gap={6}>
                <Stack gap={4} className={FIELD_WIDTH}>
                  <TextInput
                    label="버튼 문구"
                    value={form.detailButtonLabel}
                    maxLength={SOLO_BUTTON_LABEL_MAX}
                    placeholder="자세히 보기"
                    onChange={(e) => patch({ detailButtonLabel: e.target.value })}
                  />
                  <Text size="xs" c="dimmed" ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{form.detailButtonLabel.length}/{SOLO_BUTTON_LABEL_MAX}</Text>
                </Stack>
                <Text size="sm" c="dimmed">
                  버튼은 1개로 고정됩니다. 비워 두면 &apos;자세히 보기&apos;로 표시됩니다. 링크는 등록 후 상세 화면에서 넣을 수 있고, 비워 두면 연결된 기본 광고 상세로 이동합니다.
                </Text>
              </Stack>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">노출 기간 · 승인 조건</Title>
            <Stack gap="lg">
              {contentOnly ? (
                <Paper withBorder radius="md" p="sm" bg="var(--app-bg-muted)">
                  <Text size="sm" c="dimmed">
                    광고중에는 이미 결제된 금액의 근거라 기간·할인율을 바꿀 수 없습니다. 기간·금액은 변경되지 않습니다.
                  </Text>
                </Paper>
              ) : (
                <>
                  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" className={LONG_FIELD_WIDTH}>
                    <Select
                      label="기간 단위"
                      data={[
                        { value: 'week', label: '주' },
                        { value: 'month', label: '개월 (1개월 = 4주)' },
                      ]}
                      value={form.periodUnit}
                      onChange={(v) => {
                        if (v === null) return;
                        page.changeUnit(v as 'week' | 'month');
                      }}
                      allowDeselect={false}
                    />
                    <Select
                      label={form.periodUnit === 'month' ? '개월 수' : '주 수'}
                      data={countOptions.map((n) => ({
                        value: String(n),
                        label: `${n}${form.periodUnit === 'month' ? '개월' : '주'}`,
                      }))}
                      value={String(form.periodCount)}
                      onChange={(v) => {
                        if (v === null) return;
                        patch({ periodCount: Number(v) });
                      }}
                      allowDeselect={false}
                    />
                    <TextInput
                      label="할인율 (%)"
                      type="number"
                      min={0}
                      max={100}
                      value={form.discountRate || ''}
                      onChange={(e) => patch({ discountRate: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                    />
                  </SimpleGrid>
                  {page.canStartImmediately && (
                    <Paper component="label" withBorder radius="md" p="sm" bg="var(--app-bg-muted)" className={LONG_FIELD_WIDTH} style={{ cursor: 'pointer' }}>
                      {/* 원래처럼 상자 전체(설명 포함)를 눌러도 체크된다 */}
                      <Group gap="sm" align="flex-start" wrap="nowrap">
                        <Checkbox
                          checked={form.startImmediately}
                          onChange={(e) => patch({ startImmediately: e.currentTarget.checked })}
                          mt={2}
                        />
                        <div>
                          <Text size="sm" fw={500}>결제 없이 바로 광고 시작</Text>
                          <Text size="xs" c="dimmed" mt={2}>
                            할인율 100%일 때만 선택할 수 있습니다. 파트너 결제를 건너뛰고 지금 바로 노출이 시작되며, 종료일은 기간에 맞춰 자동으로 정해집니다.
                          </Text>
                        </div>
                      </Group>
                    </Paper>
                  )}
                  <Paper withBorder radius="md" p="sm" bg="var(--app-bg-muted)" className={LONG_FIELD_WIDTH}>
                    <Stack gap={4}>
                      <Text size="sm">
                        결제 예정 금액(미리보기){' '}
                        <Text span fw={700}>
                          {(page.discountedTotalAmount ?? page.totalAmount).toLocaleString()}원
                        </Text>
                        {page.discountedTotalAmount !== null && (
                          <Text span c="dimmed" td="line-through" ml="xs" inherit>{page.totalAmount.toLocaleString()}원</Text>
                        )}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {(page.selectedBaseAd?.totalHouseholds ?? 0).toLocaleString()}세대 × {page.pricePerWeek.toLocaleString()}원 ×{' '}
                        {page.weeks}주{form.discountRate > 0 && ` · ${form.discountRate}% 할인`} — 확정 금액은 저장 시 서버가 계산합니다.
                      </Text>
                    </Stack>
                  </Paper>
                </>
              )}
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Stack gap={4} mb="md">
              <Title order={4}>관리 정보</Title>
              <Text size="sm" c="dimmed">내부용 정보입니다. 파트너에게는 보이지 않습니다.</Text>
            </Stack>
            <Stack gap="lg">
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  영업 담당자 <Text span size="xs" fw={500} c="dimmed">(선택)</Text>
                </Text>
                <SalesRepSelect className={FIELD_WIDTH} value={form.salesRepId} onChange={(salesRepId) => patch({ salesRepId })} />
              </Stack>
              <Textarea
                className={FIELD_WIDTH}
                label={
                  <>
                    관리 메모 <Text span size="xs" fw={500} c="dimmed">(선택)</Text>
                  </>
                }
                minRows={3}
                autosize
                value={form.adminMemo}
                onChange={(e) => patch({ adminMemo: e.target.value })}
              />
            </Stack>
          </Paper>
        </>
      )}

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="center" gap="sm">
          <Box>
            {page.periodErr && <Text size="sm" c="red">{page.periodErr}</Text>}
          </Box>
          <Button size="md" disabled={!page.canSubmit} onClick={page.submit}>
            {page.submitting
              ? isEdit ? '수정 중...' : '등록 중...'
              : form.startImmediately && page.canStartImmediately ? (isEdit ? '수정 후 바로 시작' : '단독 팝업 등록 후 바로 시작') : isEdit ? '수정 저장' : '단독 팝업 등록 (결제 대기 상태)'}
          </Button>
        </Group>
      </Paper>

      <Modal
        closeOnClickOutside={false}
        withCloseButton={false}
        opened={page.staleNotice !== null}
        onClose={() => page.closeStaleNotice()}
        title="광고 상태가 바뀌었어요"
      >
        <Text size="sm" c="dimmed">
          {page.staleNotice?.contentSaved
            ? '내용은 저장됐어요. 그 사이 결제되었거나 상태가 바뀌어 바로 시작하지 못했어요. 새로고침 후 다시 확인해 주세요.'
            : '수정 화면을 연 사이에 결제되었거나 상태가 바뀌어 저장하지 않았어요. 새로고침 후 다시 확인해 주세요.'}
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => page.closeStaleNotice()}>닫기</Button>
          {/* AlertDialogAction과 동일하게 클릭 후 다이얼로그를 닫는다 */}
          <Button
            onClick={() => {
              window.location.reload();
              page.closeStaleNotice();
            }}
          >
            새로고침
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
