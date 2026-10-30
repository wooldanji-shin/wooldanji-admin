'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Input,
  Paper,
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
import { formatBizCallNumber } from '@/lib/utils/format';
import { MAX_AD_IMAGES } from '@/lib/ads/constants';
import { AdImagePicker } from '@/components/ad-image-picker';
import { CtaButtonsCard } from '@/components/ad-cta-buttons-card';
import { useAdForm } from './useAdForm';

// 배달앱 링크는 하단 버튼(CTA) 카드에서 관리한다
const LINK_FIELDS = [
  { key: 'naverMapUrl', label: '네이버 지도', placeholder: 'https://naver.me/...' },
  { key: 'blogUrl', label: '블로그', placeholder: 'https://blog.naver.com/...' },
  { key: 'youtubeUrl', label: '유튜브', placeholder: 'https://youtube.com/...' },
  { key: 'instagramUrl', label: '인스타그램', placeholder: 'https://instagram.com/...' },
  { key: 'kakaoOpenChatUrl', label: '카카오 오픈채팅', placeholder: 'https://open.kakao.com/...' },
] as const;

interface AdFormViewProps {
  /** 주면 수정 모드로 동작한다 */
  adId?: string;
}

export function AdFormView({ adId }: AdFormViewProps): React.ReactElement {
  const page = useAdForm(adId);
  const router = useRouter();
  const {
    isEdit,
    contentOnly,
    apartmentsEditable,
    apartmentLockReason,
    runningAmounts,
    loadError,
    form,
    patch,
    apartments,
    categories,
    subCategories,
    bizCallDuplicateName,
    selectedPartner,
    totalHouseholds,
    estimatedMonthlyAmount,
    isFirstAdExpected,
    benefitsApplied,
    loading,
    submitting,
    canSubmit,
  } = page;

  if (loading) {
    return <DetailSkeleton sections={7} />;
  }

  if (loadError) {
    return (
      <PageShell>
        <Text size="sm" c="red">{loadError}</Text>
        <Button
          variant="default"
          component={Link}
          href="/admin/advertising-v2/applications"
          leftSection={<ArrowLeft size={16} />}
          style={{ alignSelf: 'flex-start' }}
        >
          목록으로
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderTitle
        title={isEdit ? '광고 수정' : '광고 대리 등록'}
        onBack={() => router.push(isEdit
          ? `/admin/advertising-v2/applications/${adId}`
          : '/admin/advertising-v2/applications')}
      />
      <Text size="sm" c="dimmed">
        {contentOnly
          ? '광고중인 광고의 내용을 고칩니다. 저장하면 앱에 바로 반영됩니다.'
          : isEdit
            ? '결제 전 광고의 내용과 승인 조건을 고칩니다.'
            : '파트너를 대신해 광고를 작성하고 결제만 남은 상태로 만듭니다.'}
      </Text>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">파트너</Title>
        <Stack gap="sm">
          {isEdit ? (
            // 파트너를 바꾸는 건 사실상 다른 광고 — 수정에서는 잠근다
            <Text fw={600}>
              {selectedPartner?.businessName ?? '-'}
            </Text>
          ) : (
            <PartnerCombobox
              partners={page.partnerOptions}
              value={form.partnerId}
              onChange={page.selectPartner}
            />
          )}
          {selectedPartner && (
            <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
              <Stack gap={4}>
                <Text size="sm">
                  대표자 {selectedPartner.representativeName ?? '-'} · 전화{' '}
                  {selectedPartner.displayPhoneNumber ?? '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedPartner.businessAddress ?? '주소 미등록'}
                </Text>
                <Text size="sm" c={isFirstAdExpected ? 'green' : 'dimmed'}>
                  {isFirstAdExpected
                    ? '첫 광고 — 할인·무료기간 적용 가능'
                    : '첫 광고 아님 — 예외 적용을 켜야 할인·무료기간이 적용됩니다'}
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">카테고리</Title>
        <Stack gap="sm">
          <Select
            w={240}
            placeholder="카테고리 선택"
            data={categories.map((cat) => ({ value: cat.id, label: cat.categoryName }))}
            value={form.categoryId || null}
            onChange={(v) => {
              if (v === null) return;
              page.selectCategory(v);
            }}
            allowDeselect={false}
          />
          {subCategories.length > 0 && (
            <Group gap="sm">
              {subCategories.map((sub) => (
                <Checkbox
                  key={sub.id}
                  label={sub.subCategoryName}
                  checked={form.subCategoryIds.includes(sub.id)}
                  onChange={() => page.toggleSubCategory(sub.id)}
                />
              ))}
            </Group>
          )}
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">광고 내용</Title>
        <Stack gap="md">
          <TextInput
            label="제목"
            withAsterisk
            value={form.title}
            maxLength={30}
            placeholder="앱 광고 목록에 표시될 제목"
            onChange={(e) => patch({ title: e.target.value })}
          />
          <Textarea
            label="본문"
            minRows={6}
            autosize
            value={form.content}
            placeholder="가게 소개, 메뉴, 이벤트 등"
            onChange={(e) => patch({ content: e.target.value })}
          />
          <Stack gap={6}>
            <Group justify="space-between">
              <Input.Label required>이미지</Input.Label>
              <Text size="sm" c="dimmed">
                {form.images.length}/{MAX_AD_IMAGES}
              </Text>
            </Group>
            {form.partnerId ? (
              <AdImagePicker
                items={form.images}
                onAdd={page.addImages}
                onRemove={page.removeImage}
                onReorder={page.reorderImages}
              />
            ) : (
              <Text size="sm" c="dimmed">
                파트너를 먼저 선택해주세요. 이미지가 파트너 폴더에 저장됩니다.
              </Text>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">링크</Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {LINK_FIELDS.map((field) => (
            <TextInput
              key={field.key}
              label={field.label}
              value={form[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => patch({ [field.key]: e.target.value })}
            />
          ))}
        </SimpleGrid>
      </Paper>

      <CtaButtonsCard
        buttons={form.ctaButtons}
        deliveryAvailable={page.deliveryAvailable}
        onToggleType={page.toggleCtaType}
        onAddCustom={page.addCustomCta}
        onUpdate={page.updateCtaButton}
        onRemove={page.removeCtaButton}
      />

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">
          노출 아파트{' '}
          {apartmentsEditable
            ? <Text span inherit c="red">*</Text>
            : <Text span size="sm" fw={500} c="dimmed">(수정 불가)</Text>}
        </Title>
        <Stack gap="sm">
          {/* 광고중 광고는 구독 상태상 금액을 안전하게 바꿀 수 있을 때만 아파트를 연다 */}
          {!apartmentsEditable ? (
            <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {apartments
                    .filter((apt) => form.apartmentIds.includes(apt.id))
                    .map((apt) => apt.name)
                    .join(', ') || '-'}
                </Text>
                <Text size="sm">{apartmentLockReason}</Text>
              </Stack>
            </Paper>
          ) : (
            <>
            {contentOnly && (
              <Alert color="yellow" variant="light" p="sm">
                <Stack gap={4}>
                  <Text size="sm">노출 아파트를 바꾸면 저장 즉시 앱 노출이 바뀌고, 월 광고료는 다음 정기결제부터 새 금액으로 청구됩니다.</Text>
                  <Text size="sm">할인율·무료기간·다음 결제일은 그대로이며, 진행 중인 프리미엄 광고도 바뀐 아파트에 노출됩니다. 파트너에게 알림은 가지 않습니다.</Text>
                </Stack>
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="xs">
              {apartments.map((apt) => (
                <Paper
                  key={apt.id}
                  withBorder
                  radius="md"
                  p="xs"
                  component="label"
                  style={{ cursor: 'pointer' }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <Checkbox
                      checked={form.apartmentIds.includes(apt.id)}
                      onChange={() => page.toggleApartment(apt.id)}
                    />
                    <Text size="sm" truncate style={{ flex: 1, minWidth: 0 }}>{apt.name}</Text>
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {apt.totalHouseholds.toLocaleString()}세대
                    </Text>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
            </>
          )}
          <Text size="sm">
            선택 {form.apartmentIds.length}곳 · 총{' '}
            <strong>{totalHouseholds.toLocaleString()}세대</strong>
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">승인 조건</Title>
        <Stack gap="md">
          {/* 광고중에는 할인·무료기간이 이미 청구되고 있는 금액의 근거다 */}
          {contentOnly ? (
            <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
              <Stack gap={4}>
                <Text size="sm">
                  할인 {form.discountRate}% · 무료 {form.freeMonths}개월
                </Text>
                <Text size="sm" c="dimmed">
                  광고중에는 이미 청구 중인 금액의 근거라 바꿀 수 없습니다.
                </Text>
              </Stack>
            </Paper>
          ) : (
            <>
              {!isFirstAdExpected && (
                <Checkbox
                  checked={form.overrideEnabled}
                  onChange={(e) => patch({ overrideEnabled: e.currentTarget.checked })}
                  label="첫 광고가 아니지만 협의된 할인·무료기간을 예외 적용"
                />
              )}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <TextInput
                  label="할인율 (%)"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!benefitsApplied}
                  value={form.discountRate || ''}
                  onChange={(e) =>
                    patch({
                      discountRate: Math.min(
                        100,
                        Math.max(0, parseInt(e.target.value) || 0)
                      ),
                    })
                  }
                />
                <TextInput
                  label="무료 개월 수"
                  type="number"
                  min={0}
                  max={24}
                  disabled={!benefitsApplied}
                  value={form.freeMonths || ''}
                  onChange={(e) =>
                    patch({ freeMonths: Math.min(24, Math.max(0, parseInt(e.target.value) || 0)) })
                  }
                />
              </SimpleGrid>
              <Textarea
                label={
                  <>
                    파트너 할인관련 안내 문구{' '}
                    <Text span size="xs" fw={500} c="dimmed">
                      (파트너에게 표시)
                    </Text>
                  </>
                }
                minRows={3}
                autosize
                maxLength={100}
                placeholder="예: 개업 축하 혜택으로 함께합니다 / 신규 상권 지원 등"
                value={form.discountNote}
                onChange={(e) => patch({ discountNote: e.target.value })}
              />
              {/* 받을 돈이 0원일 때만 카드 없이 개시할 수 있다.
                  contentOnly(=광고중)는 이미 개시된 상태라 대상이 아니다 */}
              {!contentOnly && benefitsApplied && form.discountRate === 100 && (
                <Paper component="label" withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)" style={{ cursor: 'pointer' }}>
                  {/* 원래처럼 상자 전체(설명 포함)를 눌러도 체크된다 */}
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <Checkbox
                      checked={form.startImmediately}
                      onChange={(e) => patch({ startImmediately: e.currentTarget.checked })}
                      mt={2}
                    />
                    <div>
                      <Text size="sm" fw={500}>카드 등록 없이 바로 광고 시작</Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        파트너 결제를 건너뛰고 즉시 노출됩니다. 정기결제는 돌지 않으며
                        파트너 앱에는 &lsquo;광고중&rsquo;으로 표시됩니다.
                      </Text>
                    </div>
                  </Group>
                </Paper>
              )}
            </>
          )}
          <Stack gap={6}>
            <TextInput
              label={
                <>
                  비즈콜 번호{' '}
                  <Text span size="xs" fw={500} c="dimmed">
                    (안심번호, 선택)
                  </Text>
                </>
              }
              placeholder="예: 0507-1234-5678"
              inputMode="numeric"
              value={form.bizCallNumber}
              onChange={(e) => patch({ bizCallNumber: formatBizCallNumber(e.target.value) })}
            />
            {bizCallDuplicateName ? (
              <Text size="xs" c="red">
                이미 다른 파트너({bizCallDuplicateName})가 사용 중인 번호입니다.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                입력하면 앱 광고 상세에서 이 번호가 노출됩니다. 비워두면 기존 대표번호(
                {selectedPartner?.displayPhoneNumber || '미등록'})가 그대로 노출됩니다.
              </Text>
            )}
          </Stack>
          <Input.Wrapper
            label={
              <>
                영업 담당자{' '}
                <Text span size="xs" fw={500} c="dimmed">(선택)</Text>
              </>
            }
          >
            <SalesRepSelect
              className="w-[240px]"
              value={form.salesRepId}
              onChange={(salesRepId) => patch({ salesRepId })}
            />
          </Input.Wrapper>
          <Checkbox
            checked={form.grantAnalytics}
            onChange={(e) => patch({ grantAnalytics: e.currentTarget.checked })}
            label="광고 분석 권한 부여"
          />
          <Textarea
            label={
              <>
                관리 메모{' '}
                <Text span size="xs" fw={500} c="dimmed">
                  (내부용, 파트너 비공개)
                </Text>
              </>
            }
            minRows={3}
            autosize
            value={form.adminMemo}
            onChange={(e) => patch({ adminMemo: e.target.value })}
          />
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" gap="sm">
          <Stack gap={2}>
            {runningAmounts ? (
              <RunningAmountSummary amounts={runningAmounts} />
            ) : contentOnly ? (
              <Text size="sm" c="dimmed">현재 월 광고료 변동 없음</Text>
            ) : (
              <>
                <Text size="sm">
                  예상 월 광고료{' '}
                  <Text span fw={700}>
                    {estimatedMonthlyAmount.toLocaleString()}원
                  </Text>
                </Text>
                <Text size="sm" c="dimmed">
                  {totalHouseholds.toLocaleString()}세대 ×{' '}
                  {page.pricePerHousehold.toLocaleString()}원
                  {benefitsApplied && form.discountRate > 0 && ` · ${form.discountRate}% 할인`}
                  {benefitsApplied && form.freeMonths > 0 && ` · ${form.freeMonths}개월 무료`}
                </Text>
              </>
            )}
            {page.ctaError && (
              <Text size="sm" c="red" mt={4}>{page.ctaError}</Text>
            )}
          </Stack>
          <Button size="md" disabled={!canSubmit} onClick={page.submit}>
            {submitting
              ? (isEdit ? '수정 중...' : '등록 중...')
              : (isEdit ? '수정 저장' : '광고 등록 (결제 대기 상태)')}
          </Button>
        </Group>
      </Paper>
    </PageShell>
  );
}

/** 광고중 광고의 월 광고료 — 실제 청구액과, 아파트를 바꿨다면 다음 결제부터의 금액 */
function RunningAmountSummary({
  amounts,
}: {
  amounts: NonNullable<ReturnType<typeof useAdForm>['runningAmounts']>;
}) {
  const { currentMonthlyAmount, next } = amounts;
  return (
    <>
      <Text size="sm">
        현재 월 광고료{' '}
        <Text span fw={700}>{currentMonthlyAmount.toLocaleString()}원</Text>
        {next && (
          <>
            {' → '}
            <Text span fw={700} c="blue">
              {next.monthlyAmount.toLocaleString()}원
            </Text>
          </>
        )}
      </Text>
      <Text size="sm" c="dimmed">
        {next
          ? `다음 정기결제부터 청구 · 정상가 ${next.originalMonthlyAmount.toLocaleString()}원` +
            (next.method === 'proportional' ? ' · 기존 단가 유지(세대수 비율 조정)' : '')
          : '노출 아파트를 바꾸지 않으면 변동 없음'}
      </Text>
    </>
  );
}
