'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
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
import { AdImagePicker } from '@/components/ad-image-picker';
import { CtaButtonsCard } from '@/components/ad-cta-buttons-card';
import {
  MAX_AD_IMAGES,
  PREMIUM_MAX_WEEKS,
  PREMIUM_MIN_WEEKS,
} from '@/lib/ads/constants';
import { usePremiumForm } from './usePremiumForm';

const LINK_FIELDS = [
  { key: 'naverMapUrl', label: '네이버 지도', placeholder: 'https://naver.me/...' },
  { key: 'blogUrl', label: '블로그', placeholder: 'https://blog.naver.com/...' },
  { key: 'youtubeUrl', label: '유튜브', placeholder: 'https://youtube.com/...' },
  { key: 'instagramUrl', label: '인스타그램', placeholder: 'https://instagram.com/...' },
  { key: 'kakaoOpenChatUrl', label: '카카오 오픈채팅', placeholder: 'https://open.kakao.com/...' },
] as const;

const WEEK_OPTIONS = Array.from(
  { length: PREMIUM_MAX_WEEKS - PREMIUM_MIN_WEEKS + 1 },
  (_, i) => PREMIUM_MIN_WEEKS + i
);

interface PremiumFormViewProps {
  /** 주면 수정 모드로 동작한다 */
  premiumId?: string;
}

export function PremiumFormView({ premiumId }: PremiumFormViewProps): React.ReactElement {
  const page = usePremiumForm(premiumId);
  const router = useRouter();
  const {
    isEdit,
    contentOnly,
    loadError,
    form,
    patch,
    partnerBaseAds,
    selectedPartner,
    selectedBaseAd,
    totalHouseholds,
    totalAmount,
    discountedTotalAmount,
    loading,
    submitting,
    canSubmit,
  } = page;

  if (loading) {
    return <DetailSkeleton sections={5} />;
  }

  if (loadError) {
    return (
      <PageShell>
        <Text size="sm" c="red">{loadError}</Text>
        <Button
          variant="default"
          component={Link}
          href="/admin/advertising-v2/premium"
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
        title={isEdit ? '프리미엄 광고 수정' : '프리미엄 광고 대리 등록'}
        onBack={() => router.push(isEdit
          ? `/admin/advertising-v2/premium/${premiumId}`
          : '/admin/advertising-v2/premium')}
      />
      <Text size="sm" c="dimmed">
        {contentOnly
          ? '광고중인 프리미엄 광고의 내용을 고칩니다. 저장하면 앱에 바로 반영됩니다.'
          : isEdit
            ? '결제 전 프리미엄 광고의 내용과 승인 조건을 고칩니다.'
            : '운영 중인 기본 광고 위에 프리미엄 광고를 대신 등록합니다.'}
      </Text>

      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">파트너 · 기본 광고</Title>
        <Stack gap="sm">
          {isEdit ? (
            // 기본 광고를 바꾸면 노출 아파트와 금액이 통째로 달라진다 — 수정에서는 잠근다
            <Stack gap={4}>
              <Text fw={600}>
                {selectedPartner?.businessName ?? '-'}
              </Text>
              <Text size="sm" c="dimmed">
                기본 광고: {selectedBaseAd?.title ?? '-'}
              </Text>
            </Stack>
          ) : (
            <>
              <PartnerCombobox
                partners={page.partnerOptions}
                value={form.partnerId}
                onChange={page.selectPartner}
              />

              {form.partnerId && (
                partnerBaseAds.length > 0 ? (
                  <Select
                    w={{ base: '100%', md: 420 }}
                    placeholder="프리미엄을 얹을 기본 광고 선택"
                    data={partnerBaseAds.map((ad) => ({
                      value: ad.id,
                      label: `${ad.title ?? '(제목 없음)'} · ${ad.totalHouseholds.toLocaleString()}세대`,
                    }))}
                    value={form.baseAdId || null}
                    onChange={(v) => {
                      if (v === null) return;
                      page.selectBaseAd(v);
                    }}
                    allowDeselect={false}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    이 파트너에게는 프리미엄을 등록할 수 있는 광고가 없습니다.
                    운영 중(결제 완료)이고 진행 중인 프리미엄이 없는 광고만 고를 수 있습니다.
                  </Text>
                )
              )}
            </>
          )}

          {selectedBaseAd && (
            <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
              <Stack gap={4}>
                <Text size="sm">
                  카테고리 {selectedBaseAd.categoryName ?? '-'} · 노출 아파트{' '}
                  {selectedBaseAd.apartments.length}곳 · 총{' '}
                  <strong>{totalHouseholds.toLocaleString()}세대</strong>
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedBaseAd.apartments.map((a) => a.name).join(', ')}
                </Text>
                <Text size="sm" c="dimmed">
                  노출 아파트는 기본 광고를 그대로 따릅니다.
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>

      {form.baseAdId && (
        <>
          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">광고 내용</Title>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                기본 광고 내용을 그대로 가져왔습니다. 프리미엄에만 다르게 넣고 싶으면 고치세요.
              </Text>
              <TextInput
                label="제목"
                withAsterisk
                value={form.title}
                maxLength={30}
                onChange={(e) => patch({ title: e.target.value })}
              />
              <Textarea
                label="본문"
                minRows={6}
                autosize
                value={form.content}
                onChange={(e) => patch({ content: e.target.value })}
              />
              <Stack gap={6}>
                <Group justify="space-between">
                  <Input.Label required>이미지</Input.Label>
                  <Text size="sm" c="dimmed">
                    {form.images.length}/{MAX_AD_IMAGES}
                  </Text>
                </Group>
                <AdImagePicker
                  items={form.images}
                  onAdd={page.addImages}
                  onRemove={page.removeImage}
                  onReorder={page.reorderImages}
                />
                <Text size="xs" c="dimmed">
                  기본 광고에서 가져온 이미지는 목록에서 빼도 파일이 지워지지 않습니다
                  (기본 광고와 같은 파일을 씁니다).
                </Text>
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
            <Title order={4} mb="md">노출 기간 · 승인 조건</Title>
            <Stack gap="md">
              {/* 광고중에는 주수·할인율이 이미 받은 결제의 근거다 */}
              {contentOnly ? (
                <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
                  <Stack gap={4}>
                    <Text size="sm">
                      노출 {form.weeks}주
                      {form.discountRate > 0 && ` · 할인 ${form.discountRate}%`}
                    </Text>
                    <Text size="sm" c="dimmed">
                      광고중에는 이미 결제된 금액의 근거라 바꿀 수 없습니다.
                    </Text>
                  </Stack>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Select
                    label="노출 주수"
                    data={WEEK_OPTIONS.map((week) => ({
                      value: String(week),
                      label: `${week}주`,
                    }))}
                    value={String(form.weeks)}
                    onChange={(v) => {
                      if (v === null) return;
                      patch({ weeks: Number(v) });
                    }}
                    allowDeselect={false}
                  />
                  <TextInput
                    label="할인율 (%)"
                    type="number"
                    min={0}
                    max={100}
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
                </SimpleGrid>
              )}
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
        </>
      )}

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" gap="sm">
          <Stack gap={2}>
            <Text size="sm">
              {contentOnly ? '결제 완료 금액' : '결제 예정 금액'}{' '}
              <Text span fw={700}>
                {(discountedTotalAmount ?? totalAmount).toLocaleString()}원
              </Text>
              {discountedTotalAmount !== null && (
                <Text span inherit c="dimmed" td="line-through" ml="xs">
                  {totalAmount.toLocaleString()}원
                </Text>
              )}
            </Text>
            <Text size="sm" c="dimmed">
              {totalHouseholds.toLocaleString()}세대 × {page.pricePerWeek.toLocaleString()}원 ×{' '}
              {form.weeks}주
              {form.discountRate > 0 && ` · ${form.discountRate}% 할인`}
            </Text>
            {page.ctaError && (
              <Text size="sm" c="red" mt={4}>{page.ctaError}</Text>
            )}
          </Stack>
          <Button size="md" disabled={!canSubmit} onClick={page.submit}>
            {submitting
              ? (isEdit ? '수정 중...' : '등록 중...')
              : (isEdit ? '수정 저장' : '프리미엄 등록 (결제 대기 상태)')}
          </Button>
        </Group>
      </Paper>
    </PageShell>
  );
}
