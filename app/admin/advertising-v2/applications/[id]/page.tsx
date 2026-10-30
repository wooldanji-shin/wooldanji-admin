'use client';

import { AdminHeader } from '@/components/admin-header';
import { SalesRepSelect } from '@/components/sales-rep-select';
import { PartnerBusinessHoursCard } from '@/components/partner-business-hours-card';
import { PartnerCouponsCard } from '@/components/partner-coupons-card';
import { AnalyticsPeriodSelect } from '@/components/analytics-period-select';
import { formatPeriodLabel } from '@/lib/ad-analytics-period';
import { formatAuthProviders, formatBizCallNumber } from '@/lib/utils/format';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
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
  Select,
  SimpleGrid,
  Stack,
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
  ChevronLeft,
  ExternalLink,
  GitCompare,
  MapPin,
  Pencil,
  Phone,
  Tag,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useApplicationDetailPage } from './useApplicationDetailPage';
import { NAVER_CLICK_KEY, ctaButtonLabel, ctaButtonsSummary, customCtaButtons, parseCtaButtons } from '@/lib/cta-button';

import { AutoApproveSwitch } from '@/components/auto-approve-switch';
import { HeaderTitle } from '@/components/header-title';
import { StatusBadge as DomainStatusBadge, type AdStatus, type ModificationStatus } from '@/components/status-badge';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';

function StatusBadge({ status }: { status: string }): React.ReactElement {
  return <DomainStatusBadge.Ad status={status as AdStatus} size="md" />;
}

function ModificationBadge({ status }: { status: string | null }): React.ReactElement | null {
  return <DomainStatusBadge.Modification status={status as ModificationStatus} size="md" />;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
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

export default function AdApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = useApplicationDetailPage(params);
  const adImgLb = useImageLightbox(page.detail?.imageUrls ?? []);
  const pendingImgLb = useImageLightbox(page.detail?.pendingChanges?.imageUrls ?? []);

  if (page.loading) {
    return <DetailSkeleton sections={5} />;
  }

  if (!page.detail) {
    return (
      <PageShell>
        <AdminHeader title='광고 신청 상세' />
        <Stack align="center" gap="xs" py={80}>
          <AlertCircle size={32} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed">광고 신청 정보를 찾을 수 없습니다.</Text>
        </Stack>
      </PageShell>
    );
  }

  const { detail } = page;
  const effectiveDiscountRate = detail.approvedDiscountRate ?? detail.defaultDiscountRate;
  const effectiveMonthlyAmount = detail.approvedMonthlyAmount
    ?? Math.round((page.monthlyAmount * (1 - effectiveDiscountRate / 100)) / 10) * 10;

  const approveCategoryData = page.allCategories.find(c => c.id === page.approveCategory);

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
        title='광고 신청 상세'
        onBack={() => router.push('/admin/advertising-v2/applications')}
      />

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align={{ base: 'stretch', lg: 'flex-start' }}>
        {/* ───────────────────── 좌측 메인 ───────────────────── */}
        <Stack gap="lg" miw={0} style={{ flex: 1 }}>
          {/* 1. 광고 본문 카드: 카테고리 → 이미지 → 제목 → 내용 → 링크 */}
          <Paper withBorder radius="md" p="lg">
            {/* PC: 이미지 왼쪽 · 내용 오른쪽 / 휴대폰: 위아래 */}
            <Flex direction={{ base: 'column', md: 'row' }} gap="lg" align="flex-start">
            {detail.imageUrls.length > 0 && (
              <Group gap="sm" w={{ md: 180 }} style={{ flexShrink: 0 }}>
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
            <Stack gap="md" miw={0} style={{ flex: 1 }} w="100%">
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
                  <ModificationBadge status={detail.modificationStatus} />
                  {detail.subscriptionStatus === 'cancel_pending' ? (
                    <Badge variant='light' color='red' size='lg' radius='sm'>
                      광고중단예정
                    </Badge>
                  ) : (
                    detail.adStatus === 'pending' &&
                    detail.isFirstAd && (
                      <Badge variant='light' color='blue' size='lg' radius='sm'>
                        첫광고
                      </Badge>
                    )
                  )}
                </Group>
              </Group>
              {/* 제목 + 신청일시 */}
              <Stack gap={6}>
                <Group gap="xs">
                  <Title order={2} size="h3">{detail.title}</Title>
                  <StatusBadge status={detail.adStatus} />
                  {detail.adStatus === 'running' && detail.freeMonths > 0 && (
                    <DomainStatusBadge variant='free' size='md'>
                      무료체험
                    </DomainStatusBadge>
                  )}
                </Group>
                {detail.submittedAt && (
                  <Text size="sm" c="dimmed">
                    신청일시: {new Date(detail.submittedAt).toLocaleString('ko-KR')}
                  </Text>
                )}
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
            </Flex>
          </Paper>

          {/* 거절 사유 배너 */}
          {detail.rejectReason && (
            <Alert color="red" variant="light" icon={<AlertCircle size={16} />} title="거절 사유">
              <Text style={{ whiteSpace: 'pre-wrap' }}>{detail.rejectReason}</Text>
            </Alert>
          )}

          {/* 수정 심사 섹션 */}
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
                {/* 제목 비교 */}
                {detail.pendingChanges.title !== undefined && detail.pendingChanges.title !== detail.title && (
                  <CompareRow
                    label='광고 제목'
                    current={detail.title}
                    proposed={detail.pendingChanges.title ?? ''}
                  />
                )}
                {/* 내용 비교 */}
                {detail.pendingChanges.content !== undefined && detail.pendingChanges.content !== detail.content && (
                  <CompareRow
                    label='광고 내용'
                    current={detail.content ?? '(없음)'}
                    proposed={detail.pendingChanges.content ?? '(없음)'}
                    multiline
                  />
                )}
                {/* 카테고리 비교 */}
                {detail.pendingChanges.resolvedCategoryName && (
                  <CompareRow
                    label='카테고리'
                    current={detail.category?.categoryName ?? '-'}
                    proposed={detail.pendingChanges.resolvedCategoryName}
                  />
                )}
                {detail.pendingChanges.resolvedSubCategoryNames && detail.pendingChanges.resolvedSubCategoryNames.length > 0 && (
                  <CompareRow
                    label='서브카테고리'
                    current={detail.subCategoryNames.join(', ') || '-'}
                    proposed={detail.pendingChanges.resolvedSubCategoryNames.join(', ')}
                  />
                )}
                {/* SNS 링크 비교 */}
                {(['naverMapUrl', 'blogUrl', 'youtubeUrl', 'instagramUrl', 'kakaoOpenChatUrl', 'baeminUrl', 'coupangEatsUrl'] as const).map((key) => {
                  const labelMap: Record<string, string> = { naverMapUrl: '네이버 지도', blogUrl: '블로그', youtubeUrl: '유튜브', instagramUrl: '인스타그램', kakaoOpenChatUrl: '카카오톡 오픈채팅', baeminUrl: '배달의민족', coupangEatsUrl: '쿠팡이츠' };
                  const proposed = (detail.pendingChanges as any)?.[key] as string | null | undefined;
                  const current = (detail as any)[key] as string | null;
                  if (proposed === undefined || proposed === current) return null;
                  return (
                    <CompareRow
                      key={key}
                      label={labelMap[key]}
                      current={current ?? '(없음)'}
                      proposed={proposed ?? '(없음)'}
                    />
                  );
                })}
                {/* 하단 버튼 비교 — 커스텀 버튼 이름도 심사 대상이므로 반드시 노출 */}
                {(() => {
                  const proposedRaw = (detail.pendingChanges as any)?.ctaButtons;
                  if (proposedRaw === undefined) return null;
                  const proposed = ctaButtonsSummary(parseCtaButtons(proposedRaw));
                  const current = ctaButtonsSummary(detail.ctaButtons);
                  if (proposed === current) return null;
                  return (
                    <CompareRow
                      label='하단 버튼'
                      current={current}
                      proposed={proposed}
                    />
                  );
                })()}
                {/* 아파트 비교 */}
                {detail.pendingChanges.resolvedApartments && detail.pendingChanges.resolvedApartments.length > 0 && (() => {
                  const discountRate = detail.approvedDiscountRate ?? detail.defaultDiscountRate;
                  const calcFee = (apts: typeof detail.apartments) => {
                    const total = apts.reduce((s, a) => s + a.totalHouseholds, 0);
                    const original = Math.round(total * detail.pricePerHousehold / 10) * 10;
                    return Math.round(original * (100 - discountRate) / 100 / 10) * 10;
                  };
                  const currentFee = detail.approvedMonthlyAmount ?? calcFee(detail.apartments);
                  const newFee = calcFee(detail.pendingChanges!.resolvedApartments!);
                  const diff = newFee - currentFee;
                  return (
                    <Stack gap="xs">
                      <Text size="sm" fw={500} c="dimmed">신청 아파트</Text>
                      <SimpleGrid cols={2} spacing="md">
                        <Stack gap={6}>
                          <Text size="xs" c="dimmed">현재 ({detail.apartments.length}개)</Text>
                          {detail.apartments.map((apt) => (
                            <Paper key={apt.apartmentId} withBorder radius="sm" p="xs">
                              <Group gap={6} align="flex-start" wrap="nowrap">
                                <Building2 size={14} color="var(--mantine-color-dimmed)" style={{ marginTop: 2, flexShrink: 0 }} />
                                <div>
                                  <Text size="sm" fw={500}>{apt.apartmentName}</Text>
                                  <Text size="xs" c="dimmed">{apt.totalHouseholds.toLocaleString()}세대</Text>
                                </div>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                        <Stack gap={6}>
                          <Text size="xs" c="violet" fw={500}>수정 요청 ({detail.pendingChanges!.resolvedApartments!.length}개)</Text>
                          {detail.pendingChanges!.resolvedApartments!.map((apt) => (
                            <Paper
                              key={apt.apartmentId}
                              radius="sm"
                              p="xs"
                              style={{ border: '2px solid var(--mantine-color-violet-3)' }}
                            >
                              <Group gap={6} align="flex-start" wrap="nowrap">
                                <Building2 size={14} color="var(--mantine-color-violet-5)" style={{ marginTop: 2, flexShrink: 0 }} />
                                <div>
                                  <Text size="sm" fw={500}>{apt.apartmentName}</Text>
                                  <Text size="xs" c="dimmed">{apt.totalHouseholds.toLocaleString()}세대</Text>
                                </div>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>
                      </SimpleGrid>
                      {/* 월 금액 변경 */}
                      <Paper withBorder radius="md" p="sm" mt={4}>
                        <Group justify="space-between" gap="xs">
                          <Text size="sm" fw={500} c="dimmed">월 금액 변경</Text>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" fw={600}>{currentFee.toLocaleString()}원</Text>
                            <Text size="sm" fw={600} c="dimmed">→</Text>
                            <Text size="sm" fw={600} c="violet">{newFee.toLocaleString()}원</Text>
                            {diff !== 0 && (
                              <Badge variant="light" color={diff > 0 ? 'red' : 'blue'} radius="sm">
                                {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}원
                              </Badge>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                      {diff > 0 && (
                        <Text size="xs" c="dimmed">
                          * 승인 시 남은 구독 기간 일할 계산하여 차액이 확정됩니다.
                        </Text>
                      )}
                    </Stack>
                  );
                })()}
                {/* 이미지 비교 */}
                {detail.pendingChanges.imageUrls && (
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="dimmed">이미지</Text>
                    <SimpleGrid cols={2} spacing="md">
                      <Stack gap={6}>
                        <Text size="xs" c="dimmed">현재 ({detail.imageUrls.length}장)</Text>
                        <Group gap={6}>
                          {detail.imageUrls.map((url, i) => (
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
                        <Text size="xs" fw={500} c="violet">수정 요청 ({detail.pendingChanges.imageUrls.length}장)</Text>
                        <Group gap={6}>
                          {detail.pendingChanges.imageUrls.map((url, i) => (
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
                )}
              </Stack>
            </Paper>
          )}

          {/* 아파트 변경 차액 결제 대기 카드 */}
          {detail.apartmentChangeStatus === 'pending_payment' && (
            <Paper
              withBorder
              radius="md"
              p="lg"
              bg="var(--mantine-color-orange-light)"
              style={{ borderColor: 'var(--mantine-color-orange-3)' }}
            >
              <Stack gap="sm">
                <Title order={4} c="orange">차액 결제 대기 중</Title>
                <Text size="sm" c="orange">
                  아파트 변경 승인이 완료되었습니다. 파트너가 아래 금액을 결제해야 변경이 적용됩니다.
                </Text>
                <Paper withBorder radius="md" p="sm">
                  <Group justify="space-between" gap="xs">
                    <Text size="sm" fw={500} c="dimmed">파트너 청구 차액 (일할 계산)</Text>
                    <Text fw={700} c="orange">
                      결제 시점에 자동 산출
                    </Text>
                  </Group>
                </Paper>
              </Stack>
            </Paper>
          )}

          {/* 수정 거절 사유 배너 */}
          {detail.modificationRejectedReason && (
            <Alert color="orange" variant="light" icon={<AlertCircle size={16} />} title="수정 거절 사유">
              <Text style={{ whiteSpace: 'pre-wrap' }}>{detail.modificationRejectedReason}</Text>
            </Alert>
          )}

          {/* 3. 파트너 정보 (전체 폭, 모든 필드) */}
          <Paper withBorder radius="md" p="lg">
            <Group gap="xs" mb="xs">
              <User size={16} color="var(--mantine-color-dimmed)" />
              <Title order={4}>파트너 정보</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing={0}>
              <InfoRow label='상호명'>{detail.partner?.businessName ?? '-'}</InfoRow>
              <InfoRow label='대표자명'>{detail.partner?.representativeName ?? '-'}</InfoRow>
              <InfoRow label='광고표시용 전화'>
                {detail.partner?.displayPhoneNumber ? (
                  <Group component="span" gap={6} wrap="nowrap" display="inline-flex">
                    <Phone size={14} color="var(--mantine-color-dimmed)" />
                    {detail.partner.displayPhoneNumber}
                  </Group>
                ) : (
                  '-'
                )}
              </InfoRow>
              <InfoRow label='비즈콜 번호'>
                {detail.partner?.bizCallNumber ? (
                  <Group component="span" gap={6} wrap="nowrap" display="inline-flex">
                    <Phone size={14} color="var(--mantine-color-dimmed)" />
                    {detail.partner.bizCallNumber}
                  </Group>
                ) : (
                  '-'
                )}
              </InfoRow>
              <InfoRow label='연락처'>
                {detail.partner?.phoneNumber ? (
                  <Group component="span" gap={6} wrap="nowrap" display="inline-flex">
                    <Phone size={14} color="var(--mantine-color-dimmed)" />
                    {detail.partner.phoneNumber}
                  </Group>
                ) : (
                  '-'
                )}
              </InfoRow>
              <InfoRow label='사업자등록번호'>{detail.partner?.businessRegistrationNumber ?? '-'}</InfoRow>
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
                    <Text span inherit c="dimmed"> {detail.partner.businessDetailAddress}</Text>
                  )}
                </span>
              ) : (
                '-'
              )}
            </InfoRow>
            <InfoRow label='주차 정보'>{detail.partner?.parkingInfo ?? '-'}</InfoRow>
            <InfoRow label='오시는길'>{detail.partner?.directionsInfo ?? '-'}</InfoRow>
          </Paper>

          {/* 3-1. 파트너 영업시간 / 발급 쿠폰 */}
          {/* 영업시간·쿠폰 카드는 높이를 맞춘다 */}
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

          {/* 4. 광고 통계 */}
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
              const a = page.analytics;
              const fmt = (n: number) => n.toLocaleString();
              const isFoodCategory = detail.category?.categoryName === '음식';
              const rows: { key: string; label: string; value: number }[] = [
                { key: 'impression', label: '카테고리 노출', value: a?.impressionCount ?? 0 },
                { key: 'home', label: '홈 노출수', value: a?.homeImpressionCount ?? 0 },
                { key: 'dialog', label: '다이얼로그 노출수', value: a?.dialogImpressionCount ?? 0 },
                { key: 'click', label: '클릭수', value: a?.clickCount ?? 0 },
                { key: 'phone', label: '전화 클릭', value: a?.phoneClickCount ?? 0 },
                { key: 'wish', label: '찜 수', value: a?.wishCount ?? 0 },
                { key: 'naver-map', label: '네이버지도 클릭', value: a?.naverMapClickCount ?? 0 },
                { key: 'blog', label: '블로그 클릭', value: a?.blogClickCount ?? 0 },
                { key: 'youtube', label: '유튜브 클릭', value: a?.youtubeClickCount ?? 0 },
                { key: 'instagram', label: '인스타그램 클릭', value: a?.instagramClickCount ?? 0 },
                { key: 'kakao-chat', label: '카카오채팅 클릭', value: a?.kakaoChatClickCount ?? 0 },
                ...(isFoodCategory ? [
                  { key: 'baemin', label: '배민 클릭', value: a?.baeminClickCount ?? 0 },
                  { key: 'coupang-eats', label: '쿠팡이츠 클릭', value: a?.coupangEatsClickCount ?? 0 },
                ] : []),
                // 네이버는 전용 집계 컬럼 없이 extraClickCounts에 고정 키로 쌓인다
                ...(detail.ctaButtons?.some((b) => b.type === 'naver') ? [
                  { key: 'naver-booking', label: 'N예약 클릭', value: a?.extraClickCounts?.[NAVER_CLICK_KEY] ?? 0 },
                ] : []),
                // 파트너가 직접 추가한 버튼 — 라벨을 그대로 항목명으로 사용
                ...customCtaButtons(detail.ctaButtons).map((b) => ({
                  // 파트너 버튼 이름이 기본 항목과 같을 수 있어(예: '블로그') key는 버튼 id로
                  key: `custom-${b.id}`,
                  label: `${ctaButtonLabel(b)} 클릭 (직접 추가)`,
                  value: a?.extraClickCounts?.[b.id] ?? 0,
                })),
              ];
              // 노출·반응 지표와 링크·버튼 클릭 지표를 나눠 타일로 보여준다
              const splitAt = rows.findIndex((r) => r.key === 'naver-map');
              const groups = [
                { title: '노출·반응', items: splitAt < 0 ? rows : rows.slice(0, splitAt) },
                { title: '링크·버튼 클릭', items: splitAt < 0 ? [] : rows.slice(splitAt) },
              ].filter((g) => g.items.length > 0);
              return (
                <Stack gap="md">
                  {groups.map((g) => (
                    <Stack key={g.title} gap="xs">
                      <Text size="sm" fw={600} c="dimmed">{g.title}</Text>
                      <SimpleGrid cols={{ base: 2, sm: 3, xl: 4 }} spacing="sm">
                        {g.items.map(({ key, label, value }) => (
                          <Paper
                            key={key}
                            withBorder={false}
                            radius="md"
                            p="sm"
                            bg="var(--app-bg-muted)"
                            style={{ boxShadow: 'none' }}
                          >
                            <Text size="xs" c="dimmed" lineClamp={2}>{label}</Text>
                            <Text fz="lg" fw={700} mt={2} style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(value)}
                            </Text>
                          </Paper>
                        ))}
                      </SimpleGrid>
                    </Stack>
                  ))}
                </Stack>
              );
            })()}
          </Paper>

        </Stack>
        {/* ───────────────────── 우측 Sticky 사이드바 ───────────────────── */}
        <Box component="aside" w={{ base: '100%', lg: 400 }} style={{ flexShrink: 0 }}>
          <Stack gap="md">
            {/* 결제 요약 */}
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="sm">결제 정보</Title>
              <Stack gap="sm">
                {/* 신청 아파트 리스트 (선택 세대수 위) */}
                <Stack gap={6}>
                  <Group justify="space-between" gap="xs">
                    <Group gap={6}>
                      <Building2 size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm" fw={500} c="dimmed">
                        신청 아파트
                      </Text>
                    </Group>
                    <Text size="sm" fw={500} c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {detail.apartments.length}개 · {page.totalHouseholds.toLocaleString()}세대
                    </Text>
                  </Group>
                  {detail.apartments.length === 0 ? (
                    <Text size="sm" c="dimmed">아파트 정보 없음</Text>
                  ) : (
                    <Stack gap={0}>
                      {detail.apartments.map((apt) => (
                        <Group
                          key={apt.apartmentId}
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
                            <Text span size="xs" fw={500} c="dimmed" ml={2}>세대</Text>
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>

                <Divider />

                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">선택 세대수</Text>
                    <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>{page.totalHouseholds.toLocaleString()}세대</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">월 정상가</Text>
                    <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>{page.monthlyAmount.toLocaleString()}원</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">기본 할인율</Text>
                    <Text size="sm" fw={500} c="green">{effectiveDiscountRate}%</Text>
                  </Group>
                </Stack>
                <Divider />
                <Group justify="space-between">
                  <Text fw={600}>월 결제 예정금액</Text>
                  <Text fw={600} c="blue" style={{ fontVariantNumeric: 'tabular-nums' }}>{effectiveMonthlyAmount.toLocaleString()}원</Text>
                </Group>
                {(detail.freeEndDate || detail.nextBillingDate) && (
                  <>
                    <Divider />
                    <Stack gap={6}>
                      {detail.freeEndDate && (() => {
                        const d = new Date(detail.freeEndDate);
                        d.setDate(d.getDate() - 1);
                        return (
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">무료기간 종료일</Text>
                            <Text size="sm" fw={500}>{d.toLocaleDateString('ko-KR')}</Text>
                          </Group>
                        );
                      })()}
                      {detail.nextBillingDate && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">다음 결제일</Text>
                          <Text size="sm" fw={500}>{new Date(detail.nextBillingDate).toLocaleDateString('ko-KR')}</Text>
                        </Group>
                      )}
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>

            {/* 관리 — 상태별 작업·자동승인·영업 담당자를 한 카드에 모은다 */}
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">관리</Title>
              <Stack gap="lg">
                {/* 수정 심사 자동승인 — 광고중일 때만 의미가 있다 */}
                {detail.adStatus === 'running' && (
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
                {detail.adStatus === 'running' && detail.modificationStatus !== 'pending' && (
                  <Box>
                    <Button
                      variant='default'
                      size='md'
                      fullWidth
                      leftSection={<Pencil size={16} />}
                      onClick={() => router.push(`/admin/advertising-v2/applications/${detail.id}/edit`)}
                      disabled={page.processing}
                    >
                      광고 내용 수정
                    </Button>
                  </Box>
                )}

                {/* 액션 버튼 */}
                {(detail.adStatus === 'pending' || detail.adStatus === 'approved') && (
                  <Box>
                    <Stack gap="xs">
                      {detail.adStatus === 'pending' && (
                        <Button
                          size='md'
                          fullWidth
                          color="blue"
                          leftSection={<Check size={16} />}
                          onClick={() => page.setApproveDialog(true)}
                          disabled={page.processing}
                        >
                          승인하기
                        </Button>
                      )}
                      {/* 결제 전이라 내용·금액을 고쳐도 청구와 어긋나지 않는다 */}
                      {detail.adStatus === 'approved' && detail.paymentStatus === 'unpaid' && (
                        <Button
                          variant='default'
                          size='md'
                          fullWidth
                          leftSection={<Pencil size={16} />}
                          onClick={() => router.push(`/admin/advertising-v2/applications/${detail.id}/edit`)}
                          disabled={page.processing}
                        >
                          광고 수정
                        </Button>
                      )}
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

                {/* 무료 전환 · 삭제 — 광고중·종료됨 모두 */}
                {(detail.adStatus === 'running' || detail.adStatus === 'ended') && (
                  <Box>
                    <Stack gap="xs">
                      {!(detail.adStatus === 'running' && detail.approvedDiscountRate === 100) && (
                        <Button
                          variant='default'
                          size='md'
                          fullWidth
                          leftSection={<Tag size={16} />}
                          onClick={() => page.setConvertFreeDialog(true)}
                          disabled={page.processing}
                        >
                          {detail.adStatus === 'ended' ? '무료 광고로 다시 시작' : '무료 광고로 전환'}
                        </Button>
                      )}
                      <Button
                        variant='light'
                        color='red'
                        size='md'
                        fullWidth
                        leftSection={<X size={16} />}
                        onClick={() => page.setDeleteDialog(true)}
                        disabled={page.processing || page.linkedPremiums.length > 0}
                      >
                        광고 삭제
                      </Button>
                      {/* 프리미엄은 노출 아파트·카테고리를 기본 광고에서 가져오므로 프리미엄부터 지워야 한다 */}
                      {page.linkedPremiums.length > 0 && (
                        <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
                          <Stack gap={4}>
                            <Text size="sm">연결된 프리미엄 광고를 먼저 삭제해야 합니다.</Text>
                            {page.linkedPremiums.map((premium) => (
                              <Anchor
                                key={premium.id}
                                component='button'
                                type='button'
                                size='sm'
                                ta='left'
                                onClick={() => router.push(`/admin/advertising-v2/premium/${premium.id}`)}
                              >
                                {premium.title || '제목 없음'} 프리미엄 광고로 이동
                              </Anchor>
                            ))}
                          </Stack>
                        </Paper>
                      )}
                    </Stack>
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
                        color="blue"
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

                {/* 영업 담당자 */}
                <Box>
                  <Group justify="space-between">
                    <Text size="sm" fw={500} c="dimmed">영업 담당자</Text>
                    <Text fw={500}>
                      {detail.salesRepName ?? '지정 안 함'}
                    </Text>
                  </Group>
                </Box>
              </Stack>
            </Paper>

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

      {/* 승인 다이얼로그 */}
      {/* 입력 항목이 많아 작은 화면에서 잘리므로 내용 영역을 스크롤 가능하게 둔다 */}
      <Modal
        opened={page.approveDialog}
        onClose={() => page.setApproveDialog(false)}
        title='광고 신청 승인'
        size='md'
      >
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            <Text span inherit fw={700} c="var(--mantine-color-text)">{detail.partner?.businessName}</Text>의 광고 신청을 승인합니다.
          </Text>
          {/* 비첫광고 안내 배너 + 예외 적용 체크박스 */}
          {!detail.isFirstAd && (
            <Alert color="yellow" variant="light" icon={<AlertCircle size={16} />} p="sm">
              <Stack gap="xs">
                <Text size="sm">
                  이 파트너는 이미 광고를 운영한 이력이 있습니다.
                </Text>
                <Checkbox
                  checked={page.overrideEnabled}
                  onChange={(e) => page.setOverrideEnabled(e.target.checked)}
                  label='예외 적용 (파트너 협의 완료)'
                  styles={{ label: { fontWeight: 500 } }}
                />
              </Stack>
            </Alert>
          )}
          {/* 카테고리 변경 (선택사항) */}
          <Stack gap="xs">
            <Select
              label={
                <>
                  카테고리 <Text span size="sm" fw={500} c="dimmed">(변경 시에만 수정)</Text>
                </>
              }
              placeholder='카테고리 선택'
              data={page.allCategories.map((cat) => ({ value: cat.id, label: cat.categoryName }))}
              value={page.approveCategory || null}
              onChange={(v) => {
                if (v === null) return;
                page.handleApproveCategoryChange(v);
              }}
              allowDeselect={false}
            />
            {approveCategoryData && approveCategoryData.subCategories.length > 0 && (
              <Stack gap={6}>
                <Text size="sm" fw={500} c="dimmed">서브카테고리</Text>
                <Group gap="sm">
                  {approveCategoryData.subCategories.map((sub) => (
                    <Checkbox
                      key={sub.id}
                      label={sub.subCategoryName}
                      checked={page.approveSubCategoryIds.includes(sub.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        page.setApproveSubCategoryIds(
                          checked
                            ? [...page.approveSubCategoryIds, sub.id]
                            : page.approveSubCategoryIds.filter((id) => id !== sub.id)
                        );
                      }}
                    />
                  ))}
                </Group>
              </Stack>
            )}
          </Stack>
          <Stack gap={6}>
            <TextInput
              label='무료 개월 수'
              type='number'
              min={0}
              max={24}
              placeholder='0'
              disabled={!detail.isFirstAd && !page.overrideEnabled}
              value={page.freeMonths || ''}
              onChange={(e) => {
                const val = e.target.value;
                page.setFreeMonths(val === '' ? 0 : Math.min(24, Math.max(0, parseInt(val) || 0)));
              }}
            />
            {(detail.isFirstAd || page.overrideEnabled) && (
              <Text size="sm" c="dimmed">
                무료 기간: <strong>{page.freeMonths}개월</strong>
              </Text>
            )}
          </Stack>
          <Stack gap={6}>
            <TextInput
              label={page.overrideEnabled ? '예외 결제 할인율 (%)' : '첫 결제 할인율 (%)'}
              type='number'
              min={0}
              max={100}
              placeholder='0'
              disabled={!detail.isFirstAd && !page.overrideEnabled}
              value={page.discountRate || ''}
              onChange={(e) => {
                const val = e.target.value;
                page.setDiscountRate(val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0)));
              }}
            />
            {(detail.isFirstAd || page.overrideEnabled) && (
              <Text size="sm" c="dimmed">
                적용 후 월 결제금액:{' '}
                <strong>
                  {(Math.round((page.monthlyAmount * (1 - page.discountRate / 100)) / 10) * 10).toLocaleString()}원
                </strong>
              </Text>
            )}
          </Stack>
          {/* 받을 돈이 0원일 때만 카드 없이 개시할 수 있다 — 등록·수정 폼과 같은 조건 */}
          {(detail.isFirstAd || page.overrideEnabled) && page.discountRate === 100 && (
            <Paper component="label" withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)" style={{ cursor: 'pointer' }}>
              {/* 원래처럼 상자 전체(설명 포함)를 눌러도 체크된다 */}
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Checkbox
                  checked={page.startImmediately}
                  onChange={(e) => page.setStartImmediately(e.currentTarget.checked)}
                  mt={2}
                />
                <div>
                  <Text size="sm" fw={500}>카드 등록 없이 바로 광고 시작</Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    승인과 동시에 노출됩니다. 파트너 결제를 건너뛰고 정기결제는 돌지 않습니다.
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
          {/* 광고 분석 열람 권한 부여 */}
          <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-blue-light)">
            <Checkbox
              checked={page.grantAnalytics}
              disabled={detail.partnerAnalyticsEnabled}
              onChange={(e) => page.setGrantAnalytics(!!e.currentTarget.checked)}
              label='광고 분석 열람 권한 부여'
              description={
                detail.partnerAnalyticsEnabled
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
                  파트너 할인관련 안내 문구 <Text span size="sm" fw={500} c="dimmed">(파트너에게 표시, 선택)</Text>
                </>
              }
              minRows={3}
              autosize
              placeholder='예: 개업 축하 혜택으로 함께합니다 / 신규 상권 지원 등'
              maxLength={100}
              value={page.discountNote}
              onChange={(e) => page.setDiscountNote(e.target.value)}
            />
            <Text size="xs" c="dimmed" ta="right">
              {page.discountNote.length}/100
            </Text>
          </Stack>
          <Stack gap={6}>
            <TextInput
              label={
                <>
                  비즈콜 번호 <Text span size="sm" fw={500} c="dimmed">(안심번호, 선택)</Text>
                </>
              }
              placeholder='예: 0507-1234-5678'
              inputMode='numeric'
              value={page.bizCallNumber}
              onChange={(e) => page.setBizCallNumber(formatBizCallNumber(e.target.value))}
            />
            {page.bizCallDuplicateName ? (
              <Text size="xs" c="red">
                이미 다른 파트너({page.bizCallDuplicateName})가 사용 중인 번호입니다.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                입력하면 앱 광고 상세에서 이 번호가 노출됩니다. 비워두면 기존 대표번호(
                {detail.partner?.displayPhoneNumber || '미등록'})가 그대로 노출됩니다.
              </Text>
            )}
          </Stack>
          <Input.Wrapper
            label={
              <>
                영업 담당자 <Text span size="sm" fw={500} c="dimmed">(선택)</Text>
              </>
            }
          >
            <SalesRepSelect value={page.salesRepId} onChange={page.setSalesRepId} />
          </Input.Wrapper>
          <Stack gap={4}>
            <Textarea
              label={
                <>
                  관리 메모 <Text span size="sm" fw={500} c="dimmed">(내부용, 파트너 비공개)</Text>
                </>
              }
              minRows={3}
              autosize
              placeholder='승인 관련 내부 메모를 남겨주세요...'
              maxLength={500}
              value={page.adminMemo}
              onChange={(e) => page.setAdminMemo(e.target.value)}
            />
            <Text size="xs" c="dimmed" ta="right">{page.adminMemo.length}/500</Text>
          </Stack>
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button
            variant='default'
            onClick={() => page.setApproveDialog(false)}
            disabled={page.processing}
          >
            취소
          </Button>
          <Button
            color="blue"
            onClick={page.handleApprove}
            disabled={page.processing || !!page.bizCallDuplicateName}
          >
            {page.processing ? '처리 중...' : '승인'}
          </Button>
        </Group>
      </Modal>

      {/* 거절 다이얼로그 */}
      <Modal
        opened={page.rejectDialog}
        onClose={() => page.setRejectDialog(false)}
        title='광고 신청 거절'
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

      <ImageLightbox {...adImgLb.props} />
      <ImageLightbox {...pendingImgLb.props} />

      {/* 무료 전환 확인 */}
      <Modal
        opened={page.convertFreeDialog}
        onClose={() => page.setConvertFreeDialog(false)}
        title={detail.adStatus === 'ended' ? '무료 광고로 다시 시작' : '무료 광고로 전환'}
        size='md'
      >
        <Text size="sm" c="dimmed">
          {detail.adStatus === 'ended'
            ? '종료된 광고를 100% 할인으로 다시 시작합니다. 파트너 결제 없이 바로 노출되고 정기결제는 돌지 않습니다.'
            : '이 광고를 100% 할인으로 전환합니다. 다음 결제일부터 청구되지 않습니다.'}
          {detail.subscriptionStatus === 'cancel_pending' && ' 해지 예약은 그대로 유지됩니다.'}
          {' '}파트너에게 알림은 가지 않습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button
            variant='default'
            onClick={() => page.setConvertFreeDialog(false)}
            disabled={page.processing}
          >
            취소
          </Button>
          <Button onClick={page.handleConvertFree} disabled={page.processing}>
            {page.processing ? '처리 중...' : '전환'}
          </Button>
        </Group>
      </Modal>

      {/* 삭제 확인 */}
      <Modal
        opened={page.deleteDialog}
        onClose={() => page.setDeleteDialog(false)}
        title='광고 삭제'
        size='md'
      >
        <Text size="sm" c="dimmed">
          이 광고를 삭제합니다. 연결된 노출 아파트, 구독, 결제 이력이 함께 삭제되며 되돌릴 수 없습니다.
          {detail.adStatus === 'running' &&
            ' 광고중인 광고라 앱 노출과 정기결제가 즉시 중단되며, 이미 결제한 금액은 환불되지 않습니다.'}
          {' '}파트너에게 알림은 가지 않습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button
            variant='default'
            onClick={() => page.setDeleteDialog(false)}
            disabled={page.processing}
          >
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
          &lsquo;{detail.title || '제목 없음'}&rsquo; 광고와 구독·결제 이력이 영구 삭제됩니다.
          삭제한 뒤에는 복구할 수 없습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button
            variant='default'
            onClick={() => page.setDeleteFinalDialog(false)}
            disabled={page.processing}
          >
            취소
          </Button>
          <Button color='red' onClick={page.handleDelete} disabled={page.processing}>
            {page.processing ? '처리 중...' : '영구 삭제'}
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
}) {
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500} c="dimmed">{label}</Text>
      <SimpleGrid cols={2} spacing="sm">
        <Paper radius="md" p="sm" bg="var(--mantine-color-default-hover)">
          <Text size="xs" c="dimmed" mb={4}>현재</Text>
          <Text size="sm" style={multiline ? { whiteSpace: 'pre-wrap' } : undefined}>{current}</Text>
        </Paper>
        <Paper
          radius="md"
          p="sm"
          bg="var(--mantine-color-body)"
          style={{ border: '1px solid var(--mantine-color-violet-3)' }}
        >
          <Text size="xs" c="violet" fw={500} mb={4}>수정 요청</Text>
          <Text size="sm" fw={500} style={multiline ? { whiteSpace: 'pre-wrap' } : undefined}>{proposed}</Text>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
