'use client';

import { memo, type ReactElement } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  HoverCard,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  Edit,
  Trash2,
  Plus,
  Building2,
  Globe,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import Image from 'next/image';
import { TableSkeleton } from '@/components/skeletons';
import type { Banner } from '../types';

// 날짜 포맷 헬퍼 함수
const formatDisplayDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

interface BannerRowProps {
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onResetClick: (banner: Banner) => void;
  canEdit: boolean;
  canDelete: boolean;
  hideClickCounts: boolean;
  toggling: boolean;
  deleting: boolean;
}

const BannerRow = memo(function BannerRow({
  banner,
  onEdit,
  onDelete,
  onToggleActive,
  onResetClick,
  canEdit,
  canDelete,
  hideClickCounts,
  toggling,
  deleting,
}: BannerRowProps): ReactElement {
  return (
    <Table.Tr>
      <Table.Td>
        <Box
          pos="relative"
          w={128}
          h={80}
          bg="var(--app-bg-muted)"
          style={{ overflow: 'hidden', borderRadius: 'var(--mantine-radius-sm)' }}
        >
          <Image src={banner.imageUrl} alt="배너 이미지" fill className="object-cover" />
        </Box>
      </Table.Td>
      <Table.Td maw={320}>
        {banner.linkUrl ? (
          <Anchor
            href={banner.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            truncate
            display="block"
          >
            {banner.linkUrl}
          </Anchor>
        ) : (
          <Text size="sm" c="dimmed">
            링크 없음
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {banner.isGlobal ? (
          <Badge variant="filled" color="blue" leftSection={<Globe size={12} />}>
            전체
          </Badge>
        ) : (
          <HoverCard position="bottom" shadow="md" withinPortal>
            <HoverCard.Target>
              <Group gap={4} style={{ cursor: 'pointer' }}>
                {banner.home_banner_apartments?.slice(0, 2).map((hba) => (
                  <Badge
                    key={hba.apartmentId}
                    variant="light"
                    color="gray"
                    size="sm"
                    tt="none"
                    leftSection={<Building2 size={12} />}
                  >
                    {hba.apartments?.name}
                  </Badge>
                ))}
                {(banner.home_banner_apartments?.length || 0) > 2 && (
                  <Badge variant="light" color="gray" size="sm">
                    +{(banner.home_banner_apartments?.length || 0) - 2}
                  </Badge>
                )}
              </Group>
            </HoverCard.Target>
            <HoverCard.Dropdown p={0} maw={320}>
              <Stack gap={0}>
                <Text
                  fw={600}
                  px="sm"
                  py="xs"
                  style={{ borderBottom: '1px solid var(--app-divider)' }}
                >
                  타겟 아파트 ({banner.home_banner_apartments?.length || 0}개)
                </Text>
                {banner.home_banner_apartments?.map((hba, index) => (
                  <Text
                    key={hba.apartmentId}
                    px="sm"
                    py={6}
                    style={
                      index !== (banner.home_banner_apartments?.length || 0) - 1
                        ? { borderBottom: '1px solid var(--app-divider)' }
                        : undefined
                    }
                  >
                    {hba.apartments?.name}
                  </Text>
                ))}
              </Stack>
            </HoverCard.Dropdown>
          </HoverCard>
        )}
      </Table.Td>
      <Table.Td>
        {banner.isGlobal ? (
          <Text size="sm" c="dimmed">
            -
          </Text>
        ) : (
          <Stack gap={2}>
            <Group gap={4} wrap="nowrap">
              <Calendar size={12} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {formatDisplayDate(banner.startDate)}
              </Text>
            </Group>
            <Group gap={4} wrap="nowrap">
              <Calendar size={12} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {formatDisplayDate(banner.endDate)}
              </Text>
            </Group>
          </Stack>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm">{banner.user?.name || '-'}</Text>
      </Table.Td>
      <Table.Td maw={150}>
        {banner.description ? (
          <HoverCard position="bottom" shadow="md" withinPortal>
            <HoverCard.Target>
              <Text size="sm" truncate display="block" style={{ cursor: 'pointer' }}>
                {banner.description.length > 20 ? banner.description.substring(0, 20) + '...' : banner.description}
              </Text>
            </HoverCard.Target>
            <HoverCard.Dropdown maw={320}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {banner.description}
              </Text>
            </HoverCard.Dropdown>
          </HoverCard>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      {!hideClickCounts && (
        <>
          <Table.Td>
            <Text size="sm">{banner.adClickCount?.toLocaleString() || 0}</Text>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{banner.clickCount?.toLocaleString() || 0}</Text>
          </Table.Td>
        </>
      )}
      <Table.Td>
        <Switch
          checked={banner.isActive}
          onChange={(e) => onToggleActive(banner.id, e.currentTarget.checked)}
          disabled={!canEdit || toggling}
        />
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          {canEdit && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="수정"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(banner);
              }}
            >
              <Edit size={16} />
            </ActionIcon>
          )}
          {canEdit && (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onResetClick(banner);
              }}
              title="클릭수 초기화"
              aria-label="클릭수 초기화"
            >
              <RotateCcw size={16} />
            </ActionIcon>
          )}
          {canDelete && (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="삭제"
              loading={deleting}
              disabled={deleting}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(banner.id);
              }}
            >
              <Trash2 size={16} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
});

interface BannerListProps {
  banners: Banner[];
  loading: boolean;
  hideClickCounts: boolean;
  onHideClickCountsChange: (checked: boolean) => void;
  onAddNew: () => void;
  togglingId: string | null;
  deletingId: string | null;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onResetClick: (banner: Banner) => void;
  canEditBanner: (banner: Banner) => boolean;
  canDeleteBanner: (banner: Banner) => boolean;
}

/** 배너 목록 카드 — 다이얼로그 입력 중에는 props가 바뀌지 않아 다시 렌더링되지 않는다 */
export const BannerList = memo(function BannerList({
  banners,
  loading,
  hideClickCounts,
  onHideClickCountsChange,
  onAddNew,
  togglingId,
  deletingId,
  onEdit,
  onDelete,
  onToggleActive,
  onResetClick,
  canEditBanner,
  canDeleteBanner,
}: BannerListProps): ReactElement {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Title order={4}>배너 목록</Title>
          <Group gap="md">
            <Checkbox
              label="클릭수 숨기기"
              checked={hideClickCounts}
              onChange={(e) => onHideClickCountsChange(e.currentTarget.checked)}
            />
            <Button onClick={onAddNew} leftSection={<Plus size={16} />}>
              새 배너
            </Button>
          </Group>
        </Group>
        {loading ? (
          <TableSkeleton rows={8} columns={hideClickCounts ? 8 : 10} />
        ) : banners.length === 0 ? (
          <Text c="dimmed" ta="center" py={48}>
            등록된 배너가 없습니다.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={720} type="native">
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={128}>이미지</Table.Th>
                  <Table.Th w={128}>링크 URL</Table.Th>
                  <Table.Th w={128}>타겟</Table.Th>
                  <Table.Th w={112}>게시 기간</Table.Th>
                  <Table.Th w={80}>등록자</Table.Th>
                  <Table.Th w={128}>소개내용</Table.Th>
                  {!hideClickCounts && (
                    <>
                      <Table.Th w={96}>광고클릭수</Table.Th>
                      <Table.Th w={80}>클릭수</Table.Th>
                    </>
                  )}
                  <Table.Th w={80}>활성화</Table.Th>
                  <Table.Th w={96}>작업</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {banners.map((banner) => (
                  <BannerRow
                    key={banner.id}
                    banner={banner}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                    onResetClick={onResetClick}
                    canEdit={canEditBanner(banner)}
                    canDelete={canDeleteBanner(banner)}
                    hideClickCounts={hideClickCounts}
                    toggling={togglingId === banner.id}
                    deleting={deletingId === banner.id}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Paper>
  );
});
