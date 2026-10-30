'use client';

import {
  AlertCircle,
  Building2,
  ClipboardList,
  ExternalLink,
  Pencil,
  Phone,
  User,
} from 'lucide-react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { BIZ_CALL_DUPLICATE_MESSAGE } from '@/lib/biz-call';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { StatusBadge, type AdStatus } from '@/components/status-badge';
import { usePartnerDetailPage } from './usePartnerDetailPage';

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Group
      wrap="nowrap"
      align="flex-start"
      gap="sm"
      py={10}
      className="border-b last:border-b-0"
      style={{ borderColor: 'var(--app-divider)' }}
    >
      <Text size="sm" fw={500} c="dimmed" w={160} pt={2} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Box fz="sm" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </Box>
    </Group>
  );
}

/** 편집 모드면 입력창, 아니면 저장된 값을 그대로 보여준다 */
function EditableRow({
  label,
  editing,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <InfoRow label={label}>
      {editing ? (
        <TextInput
          size="sm"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        children
      )}
    </InfoRow>
  );
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const page = usePartnerDetailPage(params);

  if (page.loading) {
    return <DetailSkeleton sections={4} />;
  }

  if (!page.partner) {
    return (
      <PageShell>
        <AdminHeader title="파트너 상세" />
        <Center py={80}>
          <Stack align="center" gap="xs" c="dimmed">
            <AlertCircle size={32} />
            <Text c="dimmed">파트너 정보를 찾을 수 없습니다.</Text>
          </Stack>
        </Center>
      </PageShell>
    );
  }

  const { partner, adHistory, analyticsToggling, handleToggleAnalytics } = page;
  const { editing, draft, patchDraft, saving, canSave } = page;

  return (
    <PageShell>
      <HeaderTitle title="파트너 상세" onBack={page.handleBack} />
      <Group justify="flex-end">
        {editing ? (
          <Group gap="xs">
            <Button variant="default" onClick={page.cancelEdit} disabled={saving}>
              취소
            </Button>
            <Button onClick={page.handleSave} disabled={!canSave}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Group>
        ) : (
          <Button
            variant="default"
            leftSection={<Pencil size={16} />}
            onClick={page.startEdit}
          >
            정보 수정
          </Button>
        )}
      </Group>

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align="flex-start">
        {/* ── 좌측 ── */}
        <Stack gap="lg" w="100%" style={{ flex: 1, minWidth: 0 }}>
          {/* 기본 정보 */}
          <Paper withBorder radius="md" p="lg">
            <Group gap="xs" mb="sm">
              <User size={16} color="var(--mantine-color-dimmed)" />
              <Title order={4}>기본 정보</Title>
            </Group>
            <EditableRow
              label="상호명"
              editing={editing}
              value={draft.businessName}
              onChange={(v) => patchDraft({ businessName: v })}
            >
              {partner.businessName}
            </EditableRow>
            <EditableRow
              label="대표자명"
              editing={editing}
              value={draft.representativeName}
              onChange={(v) => patchDraft({ representativeName: v })}
            >
              {partner.representativeName}
            </EditableRow>
            <InfoRow label="카테고리">
              {editing ? (
                <Select
                  w={220}
                  placeholder="카테고리 선택"
                  data={page.categories.map((cat) => ({
                    value: cat.id,
                    label: cat.categoryName,
                  }))}
                  value={draft.categoryId || null}
                  onChange={(v) => {
                    if (v === null) return;
                    patchDraft({ categoryId: v });
                  }}
                  allowDeselect={false}
                />
              ) : (
                partner.categoryName ?? '-'
              )}
            </InfoRow>
            <EditableRow
              label="광고표시용 전화"
              editing={editing}
              value={draft.displayPhoneNumber}
              onChange={(v) => patchDraft({ displayPhoneNumber: v })}
            >
              {partner.displayPhoneNumber ? (
                <Group gap={6} wrap="nowrap" display="inline-flex">
                  <Phone size={14} color="var(--mantine-color-dimmed)" />
                  {partner.displayPhoneNumber}
                </Group>
              ) : (
                '-'
              )}
            </EditableRow>
            <EditableRow
              label="연락처"
              editing={editing}
              value={draft.phoneNumber}
              onChange={(v) => patchDraft({ phoneNumber: v })}
            >
              {partner.phoneNumber ? (
                <Group gap={6} wrap="nowrap" display="inline-flex">
                  <Phone size={14} color="var(--mantine-color-dimmed)" />
                  {partner.phoneNumber}
                </Group>
              ) : (
                '-'
              )}
            </EditableRow>
            <InfoRow label="비즈콜 번호">
              {editing ? (
                <TextInput
                  size="sm"
                  value={draft.bizCallNumber}
                  placeholder="050-0000-0000 (비우면 대표번호 노출)"
                  onChange={(e) => patchDraft({ bizCallNumber: e.target.value })}
                  error={
                    page.bizCallDuplicateName
                      ? `${BIZ_CALL_DUPLICATE_MESSAGE} (${page.bizCallDuplicateName})`
                      : undefined
                  }
                />
              ) : (
                partner.bizCallNumber ?? '-'
              )}
            </InfoRow>
            <InfoRow label="가입일">
              {new Date(partner.createdAt).toLocaleDateString('ko-KR')}
            </InfoRow>
            <InfoRow label="마케팅 동의">
              {partner.marketingAgreed ? (
                <Badge variant="light" color="green">동의</Badge>
              ) : (
                <Text span size="sm" c="dimmed">미동의</Text>
              )}
            </InfoRow>
            <InfoRow label="광고 분석 열람">
              <Checkbox
                id="analyticsEnabled"
                checked={partner.analyticsEnabled}
                disabled={analyticsToggling}
                onChange={() => handleToggleAnalytics()}
                label={partner.analyticsEnabled ? '허용됨' : '비허용'}
              />
            </InfoRow>
          </Paper>

          {/* 사업자 정보 */}
          <Paper withBorder radius="md" p="lg">
            <Group gap="xs" mb="sm">
              <Building2 size={16} color="var(--mantine-color-dimmed)" />
              <Title order={4}>사업자 정보</Title>
            </Group>
            <EditableRow
              label="사업자등록번호"
              editing={editing}
              value={draft.businessRegistrationNumber}
              onChange={(v) => patchDraft({ businessRegistrationNumber: v })}
            >
              {partner.businessRegistrationNumber ?? '-'}
            </EditableRow>
            <InfoRow label="사업장 주소">
              {editing ? (
                <Stack gap={6}>
                  <TextInput
                    size="sm"
                    value={draft.businessAddress}
                    placeholder="도로명 주소"
                    onChange={(e) => patchDraft({ businessAddress: e.target.value })}
                  />
                  <TextInput
                    size="sm"
                    value={draft.businessDetailAddress}
                    placeholder="상세 주소"
                    onChange={(e) => patchDraft({ businessDetailAddress: e.target.value })}
                  />
                </Stack>
              ) : partner.businessAddress ? (
                <span>
                  {partner.businessAddress}
                  {partner.businessDetailAddress && (
                    <Text span size="sm" c="dimmed">
                      {' '}
                      {partner.businessDetailAddress}
                    </Text>
                  )}
                </span>
              ) : (
                '-'
              )}
            </InfoRow>
            {/* 영업시간은 별도 테이블(business_hours)이라 파트너 앱에서만 고친다 */}
            <InfoRow label="영업시간">{partner.businessHoursNote ?? '-'}</InfoRow>
            <EditableRow
              label="주차 정보"
              editing={editing}
              value={draft.parkingInfo}
              onChange={(v) => patchDraft({ parkingInfo: v })}
            >
              {partner.parkingInfo ?? '-'}
            </EditableRow>
            <EditableRow
              label="오시는길"
              editing={editing}
              value={draft.directionsInfo}
              onChange={(v) => patchDraft({ directionsInfo: v })}
            >
              {partner.directionsInfo ?? '-'}
            </EditableRow>
            {partner.businessRegistrationImageUrl && (
              <Box mt="sm">
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  사업자등록증
                </Text>
                <Anchor
                  href={partner.businessRegistrationImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  size="sm"
                >
                  <Group gap={6} wrap="nowrap" display="inline-flex">
                    <ExternalLink size={14} />
                    이미지 보기
                  </Group>
                </Anchor>
              </Box>
            )}
          </Paper>

          {/* 광고 이력 */}
          <Paper withBorder radius="md" p="lg">
            <Group gap="xs" mb="sm">
              <ClipboardList size={16} color="var(--mantine-color-dimmed)" />
              <Title order={4}>광고 신청 이력</Title>
              <Text size="sm" c="dimmed" ml="auto">
                {adHistory.length}건
              </Text>
            </Group>
            {adHistory.length === 0 ? (
              <Text size="sm" c="dimmed">
                광고 신청 이력이 없습니다.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={480}>
                <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>광고 제목</Table.Th>
                      <Table.Th>구분</Table.Th>
                      <Table.Th>광고 상태</Table.Th>
                      <Table.Th>신청일</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {adHistory.map((ad) => (
                      <Table.Tr
                        key={ad.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => page.handleAdClick(ad.id)}
                      >
                        <Table.Td fw={500}>{ad.title ?? '(제목 없음)'}</Table.Td>
                        <Table.Td>
                          {ad.isFirstAdApplication ? (
                            <Badge variant="light" color="blue">
                              첫광고
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">일반</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge.Ad status={ad.adStatus as AdStatus} />
                        </Table.Td>
                        <Table.Td c="dimmed">
                          {ad.submittedAt
                            ? new Date(ad.submittedAt).toLocaleDateString('ko-KR')
                            : new Date(ad.createdAt).toLocaleDateString('ko-KR')}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        </Stack>

        {/* ── 우측 요약 ── */}
        <Box
          component="aside"
          w={{ base: '100%', lg: 340 }}
          pos={{ base: 'static', lg: 'sticky' }}
          top={24}
          style={{ flexShrink: 0 }}
        >
          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="sm">요약</Title>
            <Stack gap={10}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">광고 이력</Text>
                {partner.hasHadRunningAd ? (
                  <Badge variant="light" color="blue">진행 이력 있음</Badge>
                ) : (
                  <Text size="sm" c="dimmed">없음</Text>
                )}
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">총 신청 건수</Text>
                <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {adHistory.length}건
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">진행중</Text>
                <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {adHistory.filter((a) => a.adStatus === 'running').length}건
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">승인 대기</Text>
                <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {adHistory.filter((a) => a.adStatus === 'pending').length}건
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">종료</Text>
                <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {adHistory.filter((a) => a.adStatus === 'ended').length}건
                </Text>
              </Group>
            </Stack>
          </Paper>
        </Box>
      </Flex>
    </PageShell>
  );
}
