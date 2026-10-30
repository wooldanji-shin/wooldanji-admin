'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageContent, PageHeader, PageHeaderActions, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { InlineLoadingSkeleton } from '@/components/skeletons';
import { confirmModal } from '@/components/confirm-modal';
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { FillerImageDialog } from './FillerImageDialog';
import { TIME_SLOTS, useFillerImagesPage, type FillerImage } from './useFillerImagesPage';

const SLOT_SHORT_LABEL = Object.fromEntries(TIME_SLOTS.map((s) => [s.value, s.label.split(' ')[0]]));
/** 카드에 바로 보여줄 아파트 이름 수 (나머지는 +N) */
const VISIBLE_APARTMENTS = 3;

function ApartmentsText({ image }: { image: FillerImage }): React.ReactElement {
  if (image.isAllApartments) return <span>전체 단지</span>;
  const names = image.apartments.map((a) => a.name);
  const rest = names.length - VISIBLE_APARTMENTS;
  return (
    <span>
      {names.slice(0, VISIBLE_APARTMENTS).join(', ')}
      {rest > 0 && ` 외 ${rest}곳`}
    </span>
  );
}

function FillerImageCard({
  image,
  onEdit,
  onToggle,
  onDelete,
}: {
  image: FillerImage;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Paper withBorder radius="md" p="md">
      <Group align="stretch" gap="md" wrap="nowrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt="채움 이미지"
          className="object-contain"
          style={{
            width: 90,
            height: 160,
            flexShrink: 0,
            borderRadius: 'var(--mantine-radius-md)',
            border: '1px solid var(--app-divider)',
            background: 'var(--app-bg-muted)',
          }}
        />
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap={4}>
            {image.timeSlots.map((slot) => (
              <Badge key={slot} variant="light" color="gray">
                {SLOT_SHORT_LABEL[slot]}
              </Badge>
            ))}
          </Group>
          <Text size="sm" component="div">
            <ApartmentsText image={image} />
          </Text>
          <Text size="sm" c="dimmed">
            노출 누적 {image.totalImpressions.toLocaleString()} · 오늘 {image.todayImpressions.toLocaleString()}
          </Text>
          <Group gap="sm" mt="auto">
            <Switch
              checked={image.isActive}
              onChange={(e) => onToggle(e.currentTarget.checked)}
              label={image.isActive ? '사용 중' : '사용 안 함'}
            />
            <Button variant="default" size="xs" onClick={onEdit}>
              수정
            </Button>
            <Button variant="light" color="red" size="xs" onClick={onDelete}>
              삭제
            </Button>
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}

export default function DoorFillerImagesPage(): React.ReactElement {
  const page = useFillerImagesPage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FillerImage | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (image: FillerImage) => {
    setEditing(image);
    setDialogOpen(true);
  };
  const confirmDelete = async (image: FillerImage): Promise<void> => {
    if (
      !(await confirmModal({
        title: '채움 이미지 삭제',
        message: '이 채움 이미지를 삭제할까요? 노출 기록도 함께 삭제됩니다.',
        confirmLabel: '삭제',
        danger: true,
      }))
    )
      return;
    page.remove(image);
  };

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="문열림 채움 이미지"
          description="단독 팝업 광고를 먼저 채우고, '팝업 최대 장수'보다 적으면 남은 자리를 이 이미지들이 채웁니다. 보여주는 순서는 광고와 섞여 랜덤입니다. 시간대·아파트 조건에 맞는 것 중 랜덤으로 나갑니다. (팝업 모드가 '단독 팝업'일 때만 노출)"
        />
        <PageHeaderActions>
          <Button onClick={openCreate} leftSection={<Plus size={16} />}>
            이미지 등록
          </Button>
        </PageHeaderActions>
      </PageHeader>
      <PageContent>
        {page.loading ? (
          <InlineLoadingSkeleton />
        ) : page.images.length === 0 ? (
          <Text py={80} ta="center" c="dimmed">
            등록된 채움 이미지가 없습니다.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {page.images.map((image) => (
              <FillerImageCard
                key={image.id}
                image={image}
                onEdit={() => openEdit(image)}
                onToggle={(v) => page.toggleActive(image, v)}
                onDelete={() => confirmDelete(image)}
              />
            ))}
          </SimpleGrid>
        )}
      </PageContent>
      <FillerImageDialog
        open={dialogOpen}
        image={editing}
        apartments={page.apartments}
        saving={page.saving}
        onClose={() => setDialogOpen(false)}
        onSave={(input) => page.save(input, editing)}
      />
    </PageShell>
  );
}
