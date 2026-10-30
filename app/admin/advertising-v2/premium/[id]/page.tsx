'use client';

import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { AutoApproveSwitch } from '@/components/auto-approve-switch';
import { PartnerBusinessHoursCard } from '@/components/partner-business-hours-card';
import { PartnerCouponsCard } from '@/components/partner-coupons-card';
import { AnalyticsPeriodSelect } from '@/components/analytics-period-select';
import { formatPeriodLabel } from '@/lib/ad-analytics-period';
import { formatAuthProviders } from '@/lib/utils/format';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  Group,
  Input,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  BarChart2,
  Building2,
  Check,
  ExternalLink,
  GitCompare,
  MapPin,
  Pencil,
  Tag,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SalesRepSelect } from '@/components/sales-rep-select';
import {
  StatusBadge as DomainStatusBadge,
  type PremiumStatus,
} from '@/components/status-badge';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { usePremiumDetailPage } from './usePremiumDetailPage';
import { NAVER_CLICK_KEY, ctaButtonLabel, ctaButtonsSummary, customCtaButtons, parseCtaButtons } from '@/lib/cta-button';

const FIELD_LABELS: Record<string, string> = {
  title: '제목',
  content: '본문',
  imageUrls: '이미지',
  naverMapUrl: '네이버 지도',
  blogUrl: '블로그',
  youtubeUrl: '유튜브',
  instagramUrl: '인스타그램',
  kakaoOpenChatUrl: '카카오 오픈채팅',
  baeminUrl: '배달의민족',
  coupangEatsUrl: '쿠팡이츠',
  ctaButtons: '하단 버튼',
};

function StatusBadge({ status }: { status: PremiumStatus }): React.ReactElement {
  return <DomainStatusBadge.Premium status={status} size="md" />;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box
      py={10}
      className='border-b last:border-0'
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 12,
        alignItems: 'start',
        borderColor: 'var(--app-divider)',
      }}
    >
      <Text size="sm" fw={500} c="dimmed" pt={2}>{label}</Text>
      <Text component="span" fw={500}>{children}</Text>
    </Box>
  );
}

export default function PremiumAdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = usePremiumDetailPage(params);
  const adImgLb = useImageLightbox(page.detail?.imageUrls ?? []);
  const pendingImgLb = useImageLightbox(
    Array.isArray((page.detail?.pendingChanges as { imageUrls?: string[] } | null)?.imageUrls)
      ? ((page.detail!.pendingChanges as { imageUrls?: string[] }).imageUrls ?? [])
      : []
  );

  if (page.loading) {
    return <DetailSkeleton sections={5} />;
  }

  if (!page.detail) {
    return (
      <PageShell>
        <AdminHeader title='프리미엄 광고 상세' />
        <Stack align="center" gap="xs" py={80}>
          <AlertCircle size={32} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed">프리미엄 광고 정보를 찾을 수 없습니다.</Text>
        </Stack>
      </PageShell>
    );
  }

  const { detail } = page;

  // 하단 버튼을 설정한 광고는 배달앱 링크를 아래 '하단 버튼' 항목에서 보여준다
  const socialLinks = [
    { label: '네이버 지도', url: detail.naverMapUrl },
    { label: '블로그', url: detail.blogUrl },
    { label: '유튜브', url: detail.youtubeUrl },
    { label: '인스타그램', url: detail.instagramUrl },
    { label: '카카오톡 오픈채팅', url: detail.kakaoOpenChatUrl },
    ...(detail.ctaButtons ? [] : [
      { label: '배달의민족', url: detail.baeminUrl },
      { label: '쿠팡이츠', url: detail.coupangEatsUrl },
    ]),
  ].filter((s) => s.url);

  return (
    <PageShell>
      <HeaderTitle
        title='프리미엄 광고 상세'
        onBack={() => router.push('/admin/advertising-v2/premium')}
      />

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align={{ base: 'stretch', lg: 'flex-start' }}>
        {/* ───────────────────── 좌측 메인 ───────────────────── */}
        <Stack gap="lg" miw={0} style={{ flex: 1 }}>
          {/* 1. 광고 본문 카드: 카테고리 → 이미지 → 제목 → 내용 → 링크 */}
          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              {/* 카테고리 태그 + 상태 뱃지 */}
              <Group justify="space-between" gap="xs">
                <Badge
                  variant="light"
                  color="blue"
                  size="lg"
                  radius="sm"
                  tt="none"
                  leftSection={<Tag size={14} />}
                >
                  {detail.category?.categoryName ?? '-'}
                  {detail.subCategoryNames.length > 0 && (
                    <>
                      <Text span inherit opacity={0.6} mx={4}>›</Text>
                      {detail.subCategoryNames.join(', ')}
                    </>
                  )}
                </Badge>
                <Group gap="xs">
                  {detail.modificationStatus === 'pending' && (
                    <Badge variant='light' color='violet' size='lg' radius='sm'>
                      수정 심사
                    </Badge>
                  )}
                </Group>
              </Group>
              {/* 이미지 */}
              {detail.imageUrls.length > 0 && (
                <Group gap="sm">
                  {detail.imageUrls.map((url, i) => (
                    <ImageThumbnail
                      key={i}
                      src={url}
                      alt={`광고 이미지 ${i + 1}`}
                      onClick={() => adImgLb.open(i)}
                    />
                  ))}
                </Group>
              )}
              {/* 제목 + 신청일시 */}
              <Stack gap={6}>
                <Group gap="xs">
                  <Title order={2} size="h3">
                    {detail.title ?? '(제목 없음)'}
                  </Title>
                  <StatusBadge status={detail.status} />
                </Group>
                <Text size="sm" c="dimmed">
                  신청일시: {new Date(detail.createdAt).toLocaleString('ko-KR')}
                </Text>
              </Stack>
              {/* 내용 */}
              {detail.content && (
                <>
                  <Divider />
                  <Text lh={1.7} style={{ whiteSpace: 'pre-wrap' }}>
                    {detail.content}
                  </Text>
                </>
              )}
              {/* 소셜 링크 */}
              {socialLinks.length > 0 && (
                <>
                  <Divider />
                  <Stack gap="xs">
                    <Group gap={6}>
                      <ExternalLink size={14} />
                      <Text size="sm" fw={500} c="dimmed">
                        소셜 링크
                      </Text>
                    </Group>
                    <Group gap="lg" style={{ rowGap: 6 }}>
                      {socialLinks.map((s) => (
                        <Anchor
                          key={s.label}
                          href={s.url!}
                          target='_blank'
                          rel='noreferrer'
                        >
                          <Group gap={6} wrap="nowrap">
                            <ExternalLink size={14} />
                            {s.label}
                          </Group>
                        </Anchor>
                      ))}
                    </Group>
                  </Stack>
                </>
              )}

              {/* 광고 하단에 노출되는 버튼 — 커스텀 버튼 이름은 심사 대상 */}
              {detail.ctaButtons && detail.ctaButtons.length > 0 && (
                <>
                  <Divider />
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="dimmed">
                      하단 버튼
                    </Text>
                    <Group gap="xs">
                      {detail.ctaButtons.map((b) => (
                        <Paper key={b.id} withBorder radius="sm" px="sm" py={4} bg="var(--mantine-color-default-hover)">
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm">{ctaButtonLabel(b)}</Text>
                            {b.url && (
                              <Anchor
                                href={b.url}
                                target='_blank'
                                rel='noreferrer'
                                display="inline-flex"
                              >
                                <ExternalLink size={14} />
                              </Anchor>
                            )}
                          </Group>
                        </Paper>
                      ))}
                    </Group>
                  </Stack>
                </>
              )}
            </Stack>
          </Paper>

          {/* 거절 사유 배너 */}
          {detail.rejectedReason && (
            <Alert color="red" variant="light" icon={<AlertCircle size={16} />} title="거절 사유">
              <Text style={{ whiteSpace: 'pre-wrap' }}>
                {detail.rejectedReason}
              </Text>
            </Alert>
          )}

          {/* 수정 거절 사유 배너 */}
          {detail.modificationRejectedReason && (
            <Alert color="orange" variant="light" icon={<AlertCircle size={16} />} title="수정 거절 사유">
              <Text style={{ whiteSpace: 'pre-wrap' }}>
                {detail.modificationRejectedReason}
              </Text>
            </Alert>
          )}

          {/* 수정 심사 비교 */}
          {detail.modificationStatus === 'pending' && detail.pendingChanges && (
            <Paper
              withBorder
              radius="md"
              p="lg"
              bg="var(--mantine-color-violet-light)"
              style={{ borderColor: 'var(--mantine-color-violet-3)' }}
            >
              <Stack gap="md">
                <Group gap="xs">
                  <GitCompare size={16} color="var(--mantine-color-violet-7)" />
                  <Title order={4} c="violet">
                    수정 내용 비교 (현재 → 수정 요청)
                  </Title>
                </Group>
                {Object.entries(detail.pendingChanges).map(([key, pendingValue]) => {
                  const label = FIELD_LABELS[key] ?? key;
                  const currentValue = (detail as unknown as Record<string, unknown>)[key];
                  const isChanged =
                    JSON.stringify(currentValue) !== JSON.stringify(pendingValue);
                  if (!isChanged) return null;

                  if (key === 'imageUrls') {
                    return (
                      <Stack key={key} gap="xs">
                        <Text size="sm" fw={500} c="dimmed">{label}</Text>
                        <SimpleGrid cols={2} spacing="md">
                          <Stack gap={6}>
                            <Text size="xs" c="dimmed">
                              현재 ({((currentValue as string[]) ?? []).length}장)
                            </Text>
                            <Group gap={6}>
                              {((currentValue as string[]) ?? []).map((url, i) => (
                                <ImageThumbnail
                                  key={i}
                                  src={url}
                                  alt=''
                                  className='h-24 w-24'
                                  onClick={() => adImgLb.open(i)}
                                />
                              ))}
                            </Group>
                          </Stack>
                          <Stack gap={6}>
                            <Text size="xs" fw={500} c="violet">
                              수정 요청 ({((pendingValue as string[]) ?? []).length}장)
                            </Text>
                            <Group gap={6}>
                              {((pendingValue as string[]) ?? []).map((url, i) => (
                                <Box
                                  key={i}
                                  style={{
                                    border: '2px solid var(--mantine-color-violet-3)',
                                    borderRadius: 'var(--mantine-radius-md)',
                                    display: 'inline-flex',
                                  }}
                                >
                                  <ImageThumbnail
                                    src={url}
                                    alt=''
                                    className='h-24 w-24'
                                    onClick={() => pendingImgLb.open(i)}
                                  />
                                </Box>
                              ))}
                            </Group>
                          </Stack>
                        </SimpleGrid>
                      </Stack>
                    );
                  }

                  // 하단 버튼은 배열이므로 라벨 요약으로 비교 표시
                  if (key === 'ctaButtons') {
                    return (
                      <CompareRow
                        key={key}
                        label={label}
                        current={ctaButtonsSummary(detail.ctaButtons)}
                        proposed={ctaButtonsSummary(parseCtaButtons(pendingValue))}
                      />
                    );
                  }

                  return (
                    <CompareRow
                      key={key}
                      label={label}
                      current={(currentValue as string | null) ?? '(없음)'}
                      proposed={(pendingValue as string | null) ?? '(없음)'}
                      multiline={key === 'content'}
                    />
                  );
                })}
              </Stack>
            </Paper>
          )}

          {/* 연장 이력 */}
          {page.extensions.length > 0 && (
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="sm">
                연장 이력 (총 {page.extensions.length}건)
              </Title>
              <Table.ScrollContainer minWidth={0} type="native">
                <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th fz="xs" c="dimmed">차수</Table.Th>
                      <Table.Th fz="xs" c="dimmed">결제일</Table.Th>
                      <Table.Th fz="xs" c="dimmed">주수</Table.Th>
                      <Table.Th fz="xs" c="dimmed" ta="right">결제 금액</Table.Th>
                      <Table.Th fz="xs" c="dimmed">광고 기간</Table.Th>
                      <Table.Th fz="xs" c="dimmed">영수증</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {page.extensions.map((ext, idx) => (
                      <Table.Tr key={ext.id}>
                        <Table.Td fw={500}>
                          {idx + 1}차
                        </Table.Td>
                        <Table.Td>
                          {ext.paidAt.toLocaleDateString('ko-KR')}
                        </Table.Td>
                        <Table.Td>{ext.weeks}주</Table.Td>
                        <Table.Td ta="right" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {ext.amount.toLocaleString()}원
                        </Table.Td>
                        <Table.Td fz="xs" c="dimmed">
                          {ext.periodStart.toLocaleDateString('ko-KR')} ~{' '}
                          {ext.periodEnd.toLocaleDateString('ko-KR')}
                        </Table.Td>
                        <Table.Td>
                          {ext.receiptUrl ? (
                            <Anchor
                              href={ext.receiptUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              size='xs'
                            >
                              <Group gap={4} wrap="nowrap">
                                <ExternalLink size={12} /> 보기
                              </Group>
                            </Anchor>
                          ) : (
                            <Text span size='xs' c='dimmed'>-</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          )}

          {/* 광고 통계 */}
          <Paper withBorder radius="md" p="lg">
            <Group justify="space-between" gap="xs" mb="md">
              <Group gap="xs">
                <BarChart2 size={16} color="var(--mantine-color-dimmed)" />
                <Title order={4}>광고 통계 {formatPeriodLabel(page.analyticsPeriod)}</Title>
              </Group>
              <AnalyticsPeriodSelect
                periods={page.analyticsPeriods}
                value={page.analyticsPeriod}
                onChange={page.setAnalyticsPeriod}
              />
            </Group>
            {(() => {
              const basic = page.analytics?.basic;
              const premium = page.analytics?.premium;
              const isFoodCategory = detail.category?.categoryName === '음식';
              // null인 열은 해당 광고에 없는 지표라 '-'로 표시한다
              const rows: { key: string; label: string; basic: number | null; premium: number | null }[] = [
                { key: 'impression', label: '카테고리 노출', basic: basic?.impressionCount ?? 0, premium: premium?.impressionCount ?? 0 },
                { key: 'home', label: '홈 노출수', basic: basic?.homeImpressionCount ?? 0, premium: null },
                { key: 'home-premium', label: '홈 프리미엄 노출수', basic: null, premium: premium?.homeImpressionCount ?? 0 },
                { key: 'dialog', label: '다이얼로그 노출수', basic: basic?.dialogImpressionCount ?? 0, premium: premium?.dialogImpressionCount ?? 0 },
                { key: 'click', label: '클릭수', basic: basic?.clickCount ?? 0, premium: premium?.clickCount ?? 0 },
                { key: 'phone', label: '전화 클릭', basic: basic?.phoneClickCount ?? 0, premium: premium?.phoneClickCount ?? 0 },
                { key: 'wish', label: '찜 수', basic: basic?.wishCount ?? 0, premium: premium?.wishCount ?? 0 },
                { key: 'naver-map', label: '네이버지도 클릭', basic: basic?.naverMapClickCount ?? 0, premium: premium?.naverMapClickCount ?? 0 },
                { key: 'blog', label: '블로그 클릭', basic: basic?.blogClickCount ?? 0, premium: premium?.blogClickCount ?? 0 },
                { key: 'youtube', label: '유튜브 클릭', basic: basic?.youtubeClickCount ?? 0, premium: premium?.youtubeClickCount ?? 0 },
                { key: 'instagram', label: '인스타그램 클릭', basic: basic?.instagramClickCount ?? 0, premium: premium?.instagramClickCount ?? 0 },
                { key: 'kakao-chat', label: '카카오채팅 클릭', basic: basic?.kakaoChatClickCount ?? 0, premium: premium?.kakaoChatClickCount ?? 0 },
                ...(isFoodCategory ? [
                  { key: 'baemin', label: '배민 클릭', basic: basic?.baeminClickCount ?? 0, premium: premium?.baeminClickCount ?? 0 },
                  { key: 'coupang-eats', label: '쿠팡이츠 클릭', basic: basic?.coupangEatsClickCount ?? 0, premium: premium?.coupangEatsClickCount ?? 0 },
                ] : []),
                // 네이버는 전용 집계 컬럼 없이 extraClickCounts에 고정 키로 쌓인다
                ...(detail.ctaButtons?.some((b) => b.type === 'naver') ? [
                  {
                    key: 'naver-booking',
                    label: 'N예약 클릭',
                    basic: basic?.extraClickCounts?.[NAVER_CLICK_KEY] ?? 0,
                    premium: premium?.extraClickCounts?.[NAVER_CLICK_KEY] ?? 0,
                  },
                ] : []),
                // 파트너가 직접 추가한 버튼 — 라벨을 그대로 항목명으로 사용
                ...customCtaButtons(detail.ctaButtons).map((b) => ({
                  // 파트너 버튼 이름이 기본 항목과 같을 수 있어(예: '블로그') key는 버튼 id로
                  key: `custom-${b.id}`,
                  label: `${ctaButtonLabel(b)} 클릭`,
                  basic: basic?.extraClickCounts?.[b.id] ?? 0,
                  premium: premium?.extraClickCounts?.[b.id] ?? 0,
                })),
              ];
              const cell = (v: number | null) =>
                v === null ? '-' : v.toLocaleString();

              return (
                <Box fz="sm">
                  <Box
                    pb={6}
                    fz="xs"
                    fw={500}
                    c="dimmed"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '9rem repeat(3, 1fr)',
                      columnGap: 12,
                      borderBottom: '1px solid var(--app-divider)',
                    }}
                  >
                    <span />
                    <Text span inherit ta="right">일반</Text>
                    <Text span inherit ta="right">프리미엄</Text>
                    <Text span inherit ta="right">합계</Text>
                  </Box>
                  <Stack gap={6} pt={6}>
                    {rows.flatMap((r) => {
                      const row = (
                        <Box
                          key={r.key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '9rem repeat(3, 1fr)',
                            alignItems: 'center',
                            columnGap: 12,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <Text span inherit c="dimmed">{r.label}</Text>
                          <Text span inherit ta="right">{cell(r.basic)}</Text>
                          <Text span inherit ta="right">{cell(r.premium)}</Text>
                          <Text span inherit ta="right" fw={500}>
                            {((r.basic ?? 0) + (r.premium ?? 0)).toLocaleString()}
                          </Text>
                        </Box>
                      );
                      if (r.label === '네이버지도 클릭') {
                        return [<Divider key={`${r.key}-hr`} my={4} />, row];
                      }
                      return [row];
                    })}
                  </Stack>
                </Box>
              );
            })()}
          </Paper>

          {/* 파트너 정보 */}
          <Paper withBorder radius="md" p="lg">
            <Group gap="xs" mb="xs">
              <Building2 size={16} color="var(--mantine-color-dimmed)" />
              <Title order={4}>파트너 정보</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing={0}>
              <InfoRow label='상호명'>{detail.partner?.businessName ?? '-'}</InfoRow>
              <InfoRow label='대표자명'>{detail.partner?.representativeName ?? '-'}</InfoRow>
              <InfoRow label='광고표시용 전화'>
                {detail.partner?.displayPhoneNumber ?? '-'}
              </InfoRow>
              <InfoRow label='비즈콜 번호'>{detail.partner?.bizCallNumber ?? '-'}</InfoRow>
              <InfoRow label='연락처'>{detail.partner?.phoneNumber ?? '-'}</InfoRow>
              <InfoRow label='사업자등록번호'>
                {detail.partner?.businessRegistrationNumber ?? '-'}
              </InfoRow>
              <InfoRow label='파트너 가입일'>
                {detail.partner?.createdAt
                  ? new Date(detail.partner.createdAt).toLocaleDateString('ko-KR')
                  : '-'}
              </InfoRow>
              {/* auth.users 기반 계정 정보 (관리자 API 경유 조회) */}
              <InfoRow label='로그인 이메일'>
                {page.partnerExtra.authInfo?.email ?? '-'}
              </InfoRow>
              <InfoRow label='로그인 방식'>
                {formatAuthProviders(page.partnerExtra.authInfo?.providers)}
              </InfoRow>
              <InfoRow label='최근 로그인'>
                {page.partnerExtra.authInfo?.lastSignInAt
                  ? new Date(page.partnerExtra.authInfo.lastSignInAt).toLocaleString('ko-KR')
                  : '-'}
              </InfoRow>
            </SimpleGrid>
            <InfoRow label='사업장 주소'>
              {detail.partner?.businessAddress ? (
                <span>
                  {detail.partner.businessAddress}
                  {detail.partner.businessDetailAddress && (
                    <Text span inherit c="dimmed">
                      {' '}
                      {detail.partner.businessDetailAddress}
                    </Text>
                  )}
                </span>
              ) : (
                '-'
              )}
            </InfoRow>
            <InfoRow label='주차 정보'>{detail.partner?.parkingInfo ?? '-'}</InfoRow>
            <InfoRow label='오시는길'>{detail.partner?.directionsInfo ?? '-'}</InfoRow>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing={0}>
              <InfoRow label='기본 광고 ID'>
                {detail.baseAdId ? (
                  <Text span size="sm" ff="monospace">{detail.baseAdId.slice(0, 8)}…</Text>
                ) : (
                  <Text span size="sm" c="dimmed">삭제된 기본 광고</Text>
                )}
              </InfoRow>
              <InfoRow label='영업 담당자'>{detail.salesRepName ?? '지정 안 함'}</InfoRow>
            </SimpleGrid>
          </Paper>

          {/* 파트너 영업시간 / 발급 쿠폰 */}
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <PartnerBusinessHoursCard
              businessHours={page.partnerExtra.businessHours}
              businessHoursNote={detail.partner?.businessHoursNote}
              loading={page.partnerExtra.loading}
            />
            <PartnerCouponsCard
              coupons={page.partnerExtra.coupons}
              loading={page.partnerExtra.loading}
            />
          </SimpleGrid>
        </Stack>

        {/* ───────────────────── 우측 Sticky 사이드바 ───────────────────── */}
        <Box component="aside" w={{ base: '100%', lg: 400 }} style={{ flexShrink: 0 }}>
          <Stack gap="md">
            {/* 결제/기간 요약 */}
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="sm">결제 정보</Title>
              <Stack gap="sm">
                {/* 광고 아파트 */}
                <Stack gap={6}>
                  <Group justify="space-between" gap="xs">
                    <Group gap={6}>
                      <Building2 size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm" fw={500} c="dimmed">
                        광고 아파트
                      </Text>
                    </Group>
                    <Text size="sm" fw={500} c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {detail.snapshotApartments.length}개 ·{' '}
                      {page.totalHouseholds.toLocaleString()}세대
                    </Text>
                  </Group>
                  {detail.snapshotApartments.length === 0 ? (
                    <Text size="sm" c="dimmed">아파트 정보 없음</Text>
                  ) : (
                    <Stack gap={0}>
                      {detail.snapshotApartments.map((apt, i) => (
                        <Group
                          key={i}
                          justify="space-between"
                          align="flex-start"
                          gap="sm"
                          wrap="nowrap"
                          py="xs"
                          style={{ borderTop: '1px solid var(--app-divider)' }}
                        >
                          <Box miw={0} style={{ flex: 1 }}>
                            <Text size="sm" fw={500} truncate>{apt.apartmentName}</Text>
                            <Group gap={4} mt={2} wrap="nowrap">
                              <MapPin size={12} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                              <Text size="xs" c="dimmed" truncate>{apt.address}</Text>
                            </Group>
                          </Box>
                          <Text size="sm" fw={600} style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {apt.totalHouseholds.toLocaleString()}
                            <Text span size="xs" fw={500} c="dimmed" ml={2}>
                              세대
                            </Text>
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>

                <Divider />

                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">광고 기간</Text>
                    <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {page.cumulativeWeeks}주
                      {page.extensionWeeks > 0 && (
                        <Text span size="xs" fw={500} c="dimmed" ml={4}>
                          (원 {detail.weeks}주 + 연장 {page.extensionWeeks}주)
                        </Text>
                      )}
                    </Text>
                  </Group>
                  {detail.startedAt && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">광고 시작일</Text>
                      <Text size="sm" fw={500}>
                        {new Date(detail.startedAt).toLocaleDateString('ko-KR')}
                      </Text>
                    </Group>
                  )}
                  {detail.endedAt && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">광고 종료일</Text>
                      <Text size="sm" fw={500}>
                        {new Date(detail.endedAt).toLocaleDateString('ko-KR')}
                      </Text>
                    </Group>
                  )}
                </Stack>

                <Divider />

                <Group justify="space-between" align="flex-start">
                  <Text fw={600}>결제 금액</Text>
                  <Stack gap={2} align="flex-end">
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600} c="blue" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {page.displayAmount != null
                          ? `${page.displayAmount.toLocaleString()}원`
                          : '-'}
                      </Text>
                      {(detail.approvedDiscountRate ?? 0) > 0 && (
                        <Badge variant="light" color="red" radius="sm">
                          {detail.approvedDiscountRate}%↓
                        </Badge>
                      )}
                    </Group>
                    {(detail.approvedDiscountRate ?? 0) > 0 && page.baseDisplayAmount != null && (
                      <Text size="xs" c="dimmed" td="line-through" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        정상가 {page.baseDisplayAmount.toLocaleString()}원
                      </Text>
                    )}
                  </Stack>
                </Group>
                {page.extensionAmount != null &&
                  page.extensionAmount > 0 &&
                  detail.totalAmount != null && (
                    <Text size="xs" c="dimmed" ta="right">
                      원 {detail.totalAmount.toLocaleString()}원 + 연장{' '}
                      {page.extensionAmount.toLocaleString()}원
                    </Text>
                  )}
              </Stack>
            </Paper>

            {/* 관리 — 상태별 작업·자동승인·삭제를 한 카드에 모은다 */}
            {(detail.status === 'pending' ||
              detail.status === 'running' ||
              (detail.status === 'approved' && detail.paymentStatus === 'unpaid') ||
              detail.modificationStatus === 'pending' ||
              detail.status !== 'draft') && (
              <Paper withBorder radius="md" p="lg">
                <Title order={4} mb="md">관리</Title>
                <Stack gap="lg">
                  {/* 액션 버튼 (pending 상태일 때만) */}
                  {detail.status === 'pending' && (
                    <Box>
                      <Stack gap="xs">
                        <Button
                          size='md'
                          fullWidth
                          color='blue'
                          leftSection={<Check size={16} />}
                          onClick={page.handleApprove}
                          disabled={page.processing}
                        >
                          승인하기
                        </Button>
                        <Button
                          variant='default'
                          size='md'
                          fullWidth
                          leftSection={<X size={16} />}
                          onClick={() => page.setRejectDialog(true)}
                          disabled={page.processing}
                        >
                          거절하기
                        </Button>
                      </Stack>
                    </Box>
                  )}

                  {/* 수정 심사 자동승인 — 광고중일 때만 의미가 있다 */}
                  {detail.status === 'running' && (
                    <Box>
                      <AutoApproveSwitch
                        id={detail.id}
                        checked={detail.autoApproveModification}
                        disabled={page.autoApproveToggling}
                        onChange={page.handleToggleAutoApprove}
                      />
                    </Box>
                  )}

                  {/* 광고중 수정 — 내용만 고칠 수 있고, 파트너 수정 심사 중이면 그쪽을 먼저 끝내야 한다 */}
                  {detail.status === 'running' && detail.modificationStatus !== 'pending' && (
                    <Box>
                      <Button
                        variant='default'
                        size='md'
                        fullWidth
                        leftSection={<Pencil size={16} />}
                        onClick={() => router.push(`/admin/advertising-v2/premium/${detail.id}/edit`)}
                        disabled={page.processing}
                      >
                        광고 내용 수정
                      </Button>
                    </Box>
                  )}

                  {/* 결제 전이라 내용·주수·금액을 고쳐도 결제 내역과 어긋나지 않는다 */}
                  {detail.status === 'approved' && detail.paymentStatus === 'unpaid' && (
                    <Box>
                      <Button
                        variant='default'
                        size='md'
                        fullWidth
                        leftSection={<Pencil size={16} />}
                        onClick={() => router.push(`/admin/advertising-v2/premium/${detail.id}/edit`)}
                        disabled={page.processing}
                      >
                        프리미엄 광고 수정
                      </Button>
                    </Box>
                  )}

                  {/* 수정 심사 액션 */}
                  {detail.modificationStatus === 'pending' && (
                    <Box>
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed">수정 내용을 검토해주세요.</Text>
                        <Button
                          size='md'
                          fullWidth
                          color='blue'
                          leftSection={<Check size={16} />}
                          onClick={page.handleApproveModification}
                          disabled={page.processing}
                        >
                          수정 승인
                        </Button>
                        <Button
                          variant='default'
                          size='md'
                          fullWidth
                          leftSection={<X size={16} />}
                          onClick={() => page.setModificationRejectDialog(true)}
                          disabled={page.processing}
                        >
                          수정 거절
                        </Button>
                      </Stack>
                    </Box>
                  )}

                  {/* 삭제 — 임시저장을 뺀 모든 상태 (기본 광고를 지우려면 프리미엄부터 지워야 한다) */}
                  {detail.status !== 'draft' && (
                    <Box>
                      <Button
                        variant='light'
                        color='red'
                        size='md'
                        fullWidth
                        leftSection={<X size={16} />}
                        onClick={() => page.setDeleteDialog(true)}
                        disabled={page.processing}
                      >
                        프리미엄 광고 삭제
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Paper>
            )}

            {/* 관리 메모 */}
            <Paper withBorder radius="md" p="lg">
              <Stack gap="sm">
                <div>
                  <Title order={4}>관리 메모</Title>
                  <Text size="xs" c="dimmed">내부용 · 파트너에게 공개되지 않습니다</Text>
                </div>
                <Textarea
                  minRows={4}
                  autosize
                  placeholder='이 광고에 대한 내부 메모를 남겨주세요...'
                  maxLength={500}
                  value={page.adminMemo}
                  onChange={(e) => page.setAdminMemo(e.target.value)}
                />
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">{page.adminMemo.length}/500</Text>
                  <Button
                    size='xs'
                    variant='default'
                    onClick={page.handleUpdateMemo}
                    disabled={page.processing || page.savingMemo}
                  >
                    {page.savingMemo ? '저장 중...' : '저장'}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Flex>

      {/* 삭제 확인 */}
      <Modal
        opened={page.deleteDialog}
        onClose={() => page.setDeleteDialog(false)}
        title='프리미엄 광고 삭제'
        size='md'
      >
        <Text size="sm" c="dimmed">
          이 프리미엄 광고를 삭제합니다. 프리미엄 결제 이력과 분석 데이터가 함께 삭제되며 되돌릴 수 없습니다.
          {detail.status === 'running' &&
            ' 진행 중인 광고라 앱 노출이 즉시 중단되며, 이미 결제한 금액은 환불되지 않습니다.'}
          {' '}파트너에게 알림은 가지 않습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant='default' onClick={() => page.setDeleteDialog(false)} disabled={page.processing}>
            취소
          </Button>
          <Button color='red' onClick={page.confirmDeleteFirstStep} disabled={page.processing}>
            삭제
          </Button>
        </Group>
      </Modal>

      {/* 삭제 최종 확인 — 되돌릴 수 없어 한 번 더 묻는다 */}
      <Modal
        opened={page.deleteFinalDialog}
        onClose={() => page.setDeleteFinalDialog(false)}
        title='정말 삭제할까요?'
        size='md'
      >
        <Text size="sm" c="dimmed">
          &lsquo;{detail.title || '제목 없음'}&rsquo; 프리미엄 광고와 결제 이력이 영구 삭제됩니다.
          삭제한 뒤에는 복구할 수 없습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant='default' onClick={() => page.setDeleteFinalDialog(false)} disabled={page.processing}>
            취소
          </Button>
          <Button color='red' onClick={page.handleDelete} disabled={page.processing}>
            {page.processing ? '처리 중...' : '영구 삭제'}
          </Button>
        </Group>
      </Modal>

      {/* 거절 다이얼로그 */}
      <Modal
        opened={page.rejectDialog}
        onClose={() => page.setRejectDialog(false)}
        title='프리미엄 광고 거절'
        size='md'
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            거절 사유를 입력해주세요. 파트너가 이 사유를 확인할 수 있습니다.
          </Text>
          <Textarea
            minRows={5}
            autosize
            placeholder='거절 사유를 입력해주세요...'
            value={page.rejectReason}
            onChange={(e) => page.setRejectReason(e.target.value)}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button
            variant='default'
            onClick={() => page.setRejectDialog(false)}
            disabled={page.processing}
          >
            취소
          </Button>
          <Button
            color='red'
            onClick={page.handleReject}
            disabled={page.processing}
          >
            {page.processing ? '처리 중...' : '거절'}
          </Button>
        </Group>
      </Modal>

      {/* 승인 다이얼로그 */}
      <Modal
        opened={page.approveDialog}
        onClose={() => page.setApproveDialog(false)}
        title='프리미엄 광고 승인'
        size='md'
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            할인율을 입력하면 파트너에게 할인된 금액으로 결제 요청됩니다.
          </Text>
          <Input.Wrapper label='영업 담당자 (선택)'>
            <SalesRepSelect value={page.salesRepId} onChange={page.setSalesRepId} />
          </Input.Wrapper>
          <TextInput
            label='할인율 (%)'
            type='number'
            min={0}
            max={100}
            placeholder='0 (할인 없음)'
            value={page.discountRate || ''}
            onChange={(e) => {
              const val = e.target.value;
              page.setDiscountRate(
                val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0))
              );
            }}
          />
          {page.detail?.totalAmount != null && page.discountRate > 0 && (
            <Paper radius="md" p="sm" bg="var(--mantine-color-default-hover)">
              <Text size="sm">
                <Text span inherit c="dimmed">할인 후 결제금액: </Text>
                <Text span inherit fw={600}>
                  {(
                    Math.round(
                      (page.detail.totalAmount * (100 - page.discountRate)) / 100 / 10
                    ) * 10
                  ).toLocaleString()}
                  원
                </Text>
                <Text span inherit c="dimmed" ml={4}>
                  (정상가 {page.detail.totalAmount.toLocaleString()}원)
                </Text>
              </Text>
            </Paper>
          )}
          {/* 광고 분석 열람 권한 부여 */}
          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-blue-light)">
            <Checkbox
              checked={page.grantAnalytics}
              disabled={detail.partner?.analyticsEnabled}
              onChange={(e) => page.setGrantAnalytics(!!e.currentTarget.checked)}
              label='광고 분석 열람 권한 부여'
              description={
                detail.partner?.analyticsEnabled
                  ? '이미 분석 열람 권한이 허용된 파트너입니다.'
                  : '승인 시 파트너가 앱에서 광고 통계를 열람할 수 있습니다.'
              }
              styles={{ label: { fontWeight: 600 } }}
            />
          </Paper>
          <Stack gap={4}>
            <Textarea
              label={
                <>
                  관리 메모{' '}
                  <Text span inherit fw={500} c="dimmed">(내부용, 파트너 비공개)</Text>
                </>
              }
              minRows={3}
              autosize
              placeholder='승인 관련 내부 메모를 남겨주세요...'
              maxLength={500}
              value={page.adminMemo}
              onChange={(e) => page.setAdminMemo(e.target.value)}
            />
            <Text ta="right" size="xs" c="dimmed">{page.adminMemo.length}/500</Text>
          </Stack>
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant='default' onClick={() => page.setApproveDialog(false)} disabled={page.processing}>
            취소
          </Button>
          <Button onClick={page.handleApproveConfirm} disabled={page.processing}>
            {page.processing ? '처리 중...' : '승인 확정'}
          </Button>
        </Group>
      </Modal>

      {/* 수정 거절 다이얼로그 */}
      <Modal
        opened={page.modificationRejectDialog}
        onClose={() => page.setModificationRejectDialog(false)}
        title='수정 내용 거절'
        size='md'
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            거절 사유를 입력해주세요. 파트너가 앱에서 이 사유를 확인할 수 있습니다.
          </Text>
          <Textarea
            minRows={5}
            autosize
            placeholder='거절 사유를 입력해주세요...'
            value={page.modificationRejectReason}
            onChange={(e) => page.setModificationRejectReason(e.target.value)}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button
            variant='default'
            onClick={() => page.setModificationRejectDialog(false)}
            disabled={page.processing}
          >
            취소
          </Button>
          <Button
            color='red'
            onClick={page.handleRejectModification}
            disabled={page.processing}
          >
            {page.processing ? '처리 중...' : '거절'}
          </Button>
        </Group>
      </Modal>

      <ImageLightbox {...adImgLb.props} />
      <ImageLightbox {...pendingImgLb.props} />
    </PageShell>
  );
}

// ── 비교 행 컴포넌트 ───────────────────────────────────────────
function CompareRow({
  label,
  current,
  proposed,
  multiline = false,
}: {
  label: string;
  current: string;
  proposed: string;
  multiline?: boolean;
}): React.ReactElement {
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500} c="dimmed">{label}</Text>
      <SimpleGrid cols={2} spacing="sm">
        <Paper radius="md" p="sm" bg="var(--mantine-color-default-hover)">
          <Text size="xs" c="dimmed" mb={4}>현재</Text>
          <Text size="sm" style={multiline ? { whiteSpace: 'pre-wrap' } : undefined}>
            {current}
          </Text>
        </Paper>
        <Paper
          radius="md"
          p="sm"
          bg="var(--mantine-color-body)"
          style={{ border: '1px solid var(--mantine-color-violet-3)' }}
        >
          <Text size="xs" c="violet" fw={500} mb={4}>수정 요청</Text>
          <Text size="sm" fw={500} style={multiline ? { whiteSpace: 'pre-wrap' } : undefined}>
            {proposed}
          </Text>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

