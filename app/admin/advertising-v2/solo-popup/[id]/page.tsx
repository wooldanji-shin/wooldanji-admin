'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { AutoApproveSwitch } from '@/components/auto-approve-switch';
import { StatusBadge } from '@/components/status-badge';
import { SalesRepSelect } from '@/components/sales-rep-select';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Group,
  List,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { CONTENT_TYPE_LABEL, periodLabel } from '@/lib/ads/solo-popup';
import { useSoloPopupDetailPage, type SoloPopupDetail } from './useSoloPopupDetailPage';

const LIST_PATH = '/admin/advertising-v2/solo-popup';
const formatDateTime = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('ko-KR') : '-');

function InfoRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box
      className="border-b last:border-b-0"
      py={10}
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        alignItems: 'start',
        gap: 12,
        borderColor: 'var(--app-divider)',
      }}
    >
      <Text size="sm" fw={500} c="dimmed" pt={2}>
        {label}
      </Text>
      <Text component="div" fw={500}>
        {children}
      </Text>
    </Box>
  );
}

function ContentCard({ title, c, buttonLabel }: { title: string; buttonLabel?: string | null; c: Pick<SoloPopupDetail, 'title' | 'imageUrls' | 'bulletLines' | 'contentType' | 'buttonMode' | 'buttons'> }): React.ReactElement {
  return (
    <Paper withBorder radius="md" p="lg">
      <Title order={4} mb="md">
        {title}
      </Title>
      {/* 휴대폰에서는 이미지 아래로 내용이 내려온다 */}
      <Flex direction={{ base: 'column', sm: 'row' }} align="flex-start" gap="lg">
        <Group gap={6} w={160} align="flex-start" style={{ flexShrink: 0 }}>
          {c.imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`팝업 이미지 ${i + 1}`}
              className="object-cover"
              style={{
                width: c.imageUrls.length === 1 ? 160 : 77,
                aspectRatio: '1 / 1',
                borderRadius: 'var(--mantine-radius-md)',
                border: '1px solid var(--app-divider)',
              }}
            />
          ))}
        </Group>
        <Box style={{ flex: 1 }} w="100%" miw={0}>
          <InfoRow label="제목">{c.title}</InfoRow>
          <InfoRow label={`문구 (${CONTENT_TYPE_LABEL[c.contentType ?? 'bullets']})`}>
            {c.contentType === 'text' ? (
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{c.bulletLines.join('\n')}</Text>
            ) : (
              <List size="sm">
                {c.bulletLines.map((l, i) => <List.Item key={i}>{l}</List.Item>)}
              </List>
            )}
          </InfoRow>
          <InfoRow label="버튼">&apos;{buttonLabel || '자세히 보기'}&apos; 1개 (아래 링크가 있으면 외부 브라우저, 없으면 기본 광고 상세)</InfoRow>
        </Box>
      </Flex>
    </Paper>
  );
}

export default function SoloPopupDetailPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const page = useSoloPopupDetailPage(params);
  const router = useRouter();
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'approveMod' | 'rejectMod' | 'stop' | 'delete' | null>(null);
  const [discountRate, setDiscountRate] = useState(0);
  const [startImmediately, setStartImmediately] = useState(false);
  const [memo, setMemo] = useState<string | null>(null);
  const [detailLink, setDetailLink] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState<string | null>(null);
  const [salesRepId, setSalesRepId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (page.loading) {
    return <DetailSkeleton sections={5} />;
  }
  if (!page.detail) {
    return (
      <PageShell>
        <AdminHeader title="단독 팝업 광고 상세" />
        <Stack align="center" gap="xs" py={80} c="dimmed">
          <AlertCircle size={32} />
          <Text>단독 팝업 광고 정보를 찾을 수 없습니다.</Text>
        </Stack>
      </PageShell>
    );
  }

  const { detail, payments, stats, processing } = page;
  const memoValue = memo ?? detail.adminMemo ?? '';
  const detailLinkValue = detailLink ?? detail.detailLinkUrl ?? '';
  const buttonLabelValue = buttonLabel ?? detail.detailButtonLabel ?? '';
  const isPending = detail.status === 'pending';
  const hasModification = detail.status === 'running' && detail.modificationStatus === 'pending';
  const canEdit =
    (detail.status === 'approved' && detail.paymentStatus === 'unpaid') ||
    (detail.status === 'running' && !hasModification);
  // null 과 '' 는 같은 "링크 없음"으로 보고, 실제로 바뀔 때만 변경 카드를 보여준다
  const linkChanged =
    hasModification &&
    !!detail.pendingChanges &&
    'detailLinkUrl' in detail.pendingChanges &&
    (detail.pendingChanges.detailLinkUrl?.trim() || null) !== (detail.detailLinkUrl?.trim() || null);
  const hasDiscount = (detail.approvedDiscountRate ?? 0) > 0;
  // 체크박스는 할인율 100%일 때만 보이므로, 숨겨진 뒤 남은 값이 전송되지 않게 한다
  const canStartImmediately = discountRate === 100;
  const closeDialog = () => { setDialog(null); setReason(''); setStartImmediately(false); };

  const submitApprove = () => {
    const start = canStartImmediately && startImmediately;
    return page.runAction(
      'approve',
      { discountRate, adminMemo: memoValue, salesRepId, startImmediately: start },
      start ? '승인하고 바로 시작했습니다.' : '승인했습니다.'
    );
  };

  const submitDialog = async () => {
    const ok =
      dialog === 'approve'
        ? await submitApprove()
        : dialog === 'reject'
          ? await page.runAction('reject', { reason }, '거절했습니다.')
          : dialog === 'approveMod'
            ? await page.runAction('approve-modification', {}, '수정을 승인했습니다.')
          : dialog === 'rejectMod'
            ? await page.runAction('reject-modification', { reason }, '수정을 거절했습니다.')
            : dialog === 'stop'
              ? await page.runAction('stop', {}, '광고를 중단했습니다.')
              : await page.runAction('delete', {}, '삭제했습니다.');
    if (ok) closeDialog();
  };

  return (
    <PageShell>
      <HeaderTitle title="단독 팝업 광고 상세" onBack={() => router.push(LIST_PATH)} />

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align={{ base: 'stretch', lg: 'flex-start' }}>
        <Stack gap="lg" miw={0} style={{ flex: 1 }}>
          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">신청 정보</Title>
            <InfoRow label="업체명">{detail.partnerBusinessName}</InfoRow>
            <InfoRow label="기본 광고">{detail.baseAdTitle ?? '(기본 광고 삭제됨)'}</InfoRow>
            <InfoRow label="상태">
              <Group gap="xs">
                <StatusBadge.Premium status={detail.status} size="md" />
                <StatusBadge variant={detail.paymentStatus === 'paid' ? 'success' : 'pending'}>
                  {detail.paymentStatus === 'paid' ? '결제완료' : '미결제'}
                </StatusBadge>
                {hasModification && <StatusBadge variant="primary">수정 심사</StatusBadge>}
              </Group>
            </InfoRow>
            {detail.rejectedReason && <InfoRow label="거절 사유">{detail.rejectedReason}</InfoRow>}
            {detail.modificationRejectedReason && <InfoRow label="수정 거절 사유">{detail.modificationRejectedReason}</InfoRow>}
            <InfoRow label="신청 기간">{periodLabel(detail.periodUnit, detail.periodCount)}</InfoRow>
            <InfoRow label="금액">
              {hasDiscount && <Text span c="dimmed" td="line-through" mr="xs" inherit>{detail.totalAmount.toLocaleString()}원</Text>}
              {(hasDiscount ? (detail.discountedTotalAmount ?? detail.totalAmount) : detail.totalAmount).toLocaleString()}원
              {hasDiscount && ` (${detail.approvedDiscountRate}% 할인)`}
            </InfoRow>
            <InfoRow label="게재 기간">{formatDateTime(detail.startedAt)} ~ {formatDateTime(detail.endedAt)}</InfoRow>
            <InfoRow label="노출 아파트">
              <Stack gap={2}>
                {detail.snapshotApartments.map((a, i) => (
                  <Text key={i} size="sm">{a.apartmentName} ({a.totalHouseholds.toLocaleString()}세대)</Text>
                ))}
              </Stack>
            </InfoRow>
            <InfoRow label="신청일">{formatDateTime(detail.createdAt)}</InfoRow>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">통계</Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              {[
                { key: 'popup-impressions', label: '문열림 팝업 노출', value: stats.impressions.toLocaleString(), sub: null },
                {
                  key: 'popup-clicks',
                  label: '문열림 팝업 클릭',
                  value: (stats.primaryClicks + stats.secondaryClicks).toLocaleString(),
                  sub: detail.buttonMode === 'split' ? `버튼1 ${stats.primaryClicks} / 버튼2 ${stats.secondaryClicks}` : null,
                },
                { key: 'home-impressions', label: '홈 추천 노출', value: stats.homeImpressions.toLocaleString(), sub: null },
                { key: 'home-clicks', label: '홈 추천 클릭', value: stats.homeClicks.toLocaleString(), sub: null },
              ].map((t) => (
                <Paper key={t.key} withBorder={false} radius="md" p="sm" bg="var(--app-bg-muted)" style={{ boxShadow: 'none' }}>
                  <Text size="xs" c="dimmed">{t.label}</Text>
                  <Text fz="lg" fw={700} mt={2} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.value}</Text>
                  {t.sub && <Text size="xs" c="dimmed">{t.sub}</Text>}
                </Paper>
              ))}
            </SimpleGrid>
          </Paper>

          <ContentCard title="팝업 내용" c={detail} buttonLabel={detail.detailButtonLabel} />
          {hasModification && detail.pendingChanges && (
            <ContentCard title="수정 요청 내용 (승인 시 반영)" c={{ ...detail, ...detail.pendingChanges, imageUrls: detail.pendingChanges.imageUrls ?? (detail.pendingChanges.imageUrl ? [detail.pendingChanges.imageUrl] : detail.imageUrls) }} buttonLabel={'detailButtonLabel' in detail.pendingChanges ? detail.pendingChanges.detailButtonLabel : detail.detailButtonLabel} />
          )}
          {linkChanged && detail.pendingChanges && (
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">자세히 보기 링크 변경 (승인 시 반영)</Title>
              <InfoRow label="변경 전">{detail.detailLinkUrl || '링크 없음 (기본 광고 상세로 이동)'}</InfoRow>
              <InfoRow label="변경 후">{detail.pendingChanges.detailLinkUrl || '링크 없음 (기본 광고 상세로 이동)'}</InfoRow>
            </Paper>
          )}

          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">자세히 보기 링크</Title>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                버튼 방식이 &apos;자세히 보기&apos;일 때 사용됩니다. 링크가 있으면 외부 브라우저로 열리고, 비워 두면 연결된 기본 광고 상세로 이동합니다.
              </Text>
              <TextInput
                placeholder="https://"
                value={detailLinkValue}
                onChange={(e) => setDetailLink(e.target.value)}
              />
              <TextInput
                label={
                  <>
                    버튼 이름{' '}
                    <Text span size="xs" fw={500} c="dimmed">
                      {buttonLabelValue.length}/10 · 비워 두면 &apos;자세히 보기&apos;
                    </Text>
                  </>
                }
                placeholder="자세히 보기"
                maxLength={10}
                value={buttonLabelValue}
                onChange={(e) => setButtonLabel(e.target.value)}
              />
              <Group>
                <Button variant="default" onClick={() => page.saveDetailLink(detailLinkValue, buttonLabelValue)}>저장</Button>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">결제 내역</Title>
            {payments.length === 0 ? (
              <Text size="sm" c="dimmed">결제 내역이 없습니다.</Text>
            ) : (
              payments.map((p) => (
                <InfoRow key={p.id} label={formatDateTime(p.paymentDate)}>
                  {p.amount.toLocaleString()}원 · {p.paymentType === 'solo_popup_extension' ? '연장' : '최초'}
                  {p.periodWeeks ? ` · ${p.periodWeeks}주` : ''} · {p.status}
                </InfoRow>
              ))
            )}
          </Paper>
        </Stack>

        {/* 우측: 상태별 작업·자동승인·메모 */}
        <Box component="aside" w={{ base: '100%', lg: 400 }} style={{ flexShrink: 0 }}>
          <Stack gap="md">
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">관리</Title>
              <Stack gap="lg">
                {/* 수정 심사 자동승인 — 광고중일 때만 의미가 있다 */}
                {detail.status === 'running' && (
                  <AutoApproveSwitch
                    id={detail.id}
                    checked={detail.autoApproveModification}
                    disabled={page.autoApproveToggling}
                    onChange={page.handleToggleAutoApprove}
                  />
                )}
                <Stack gap="xs">
                  {isPending && (
                    <>
                      <Button fullWidth onClick={() => setDialog('approve')} disabled={processing}>승인</Button>
                      <Button fullWidth variant="default" onClick={() => setDialog('reject')} disabled={processing}>거절</Button>
                    </>
                  )}
                  {hasModification && (
                    <>
                      <Button fullWidth onClick={() => setDialog('approveMod')} disabled={processing}>수정 승인</Button>
                      <Button fullWidth variant="default" onClick={() => setDialog('rejectMod')} disabled={processing}>수정 거절</Button>
                    </>
                  )}
                  {canEdit && (
                    <Button fullWidth variant="default" component={Link} href={`${LIST_PATH}/${detail.id}/edit`}>
                      수정
                    </Button>
                  )}
                  {detail.status === 'running' && (
                    <Button fullWidth variant="default" onClick={() => setDialog('stop')} disabled={processing}>중단</Button>
                  )}
                  <Button fullWidth variant="light" color="red" onClick={() => setDialog('delete')} disabled={processing}>삭제</Button>
                </Stack>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">관리 메모</Title>
              <Stack gap="sm">
                <Textarea minRows={3} autosize value={memoValue} onChange={(e) => setMemo(e.target.value)} />
                <Group>
                  <Button variant="default" onClick={() => page.saveMemo(memoValue)}>메모 저장</Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Flex>

      <Modal
        opened={dialog !== null}
        onClose={closeDialog}
        title={{ approve: '신청 승인', reject: '신청 거절', approveMod: '수정 승인', rejectMod: '수정 거절', stop: '광고 중단', delete: '광고 삭제', '': '' }[dialog ?? '']}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {dialog === 'delete'
              ? '삭제하면 노출이 즉시 멈추고 통계가 함께 삭제됩니다. 결제 이력은 보존되며 환불은 되지 않습니다.'
              : dialog === 'stop'
                ? '지금 종료 처리됩니다. 노출이 즉시 멈추고 환불은 없으며 통계와 결제 이력은 남습니다. 파트너에게 종료 알림이 전달됩니다.'
                : dialog === 'approve'
                  ? '할인율을 입력하면 결제 금액에 반영됩니다.'
                  : dialog === 'approveMod'
                    ? '수정 요청 내용을 승인하면 광고에 바로 반영됩니다.'
                    : '사유는 파트너에게 알림으로 전달됩니다.'}
          </Text>
          {dialog === 'approve' && (
            <Stack gap="sm">
              <TextInput
                label="할인율 (%)"
                type="number"
                min={0}
                max={100}
                value={discountRate || ''}
                onChange={(e) => setDiscountRate(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              />
              {canStartImmediately && (
                <Paper component="label" withBorder radius="md" p="sm" bg="var(--app-bg-muted)" style={{ cursor: 'pointer' }}>
                  {/* 원래처럼 상자 전체(설명 포함)를 눌러도 체크된다 */}
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <Checkbox
                      checked={startImmediately}
                      onChange={(e) => setStartImmediately(e.currentTarget.checked)}
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
              <Stack gap={4}>
                <Text size="sm" fw={500}>영업 담당자 (선택)</Text>
                <SalesRepSelect value={salesRepId} onChange={setSalesRepId} />
              </Stack>
            </Stack>
          )}
          {(dialog === 'reject' || dialog === 'rejectMod') && (
            <Textarea placeholder="거절 사유" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeDialog}>취소</Button>
          <Button
            color={dialog === 'delete' ? 'red' : undefined}
            disabled={processing || ((dialog === 'reject' || dialog === 'rejectMod') && !reason.trim())}
            onClick={submitDialog}
          >
            확인
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
