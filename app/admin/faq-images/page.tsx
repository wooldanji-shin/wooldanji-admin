'use client';

import { useEffect, useState } from 'react';
import { PageContent, PageHeader, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { InlineLoadingSkeleton } from '@/components/skeletons';
import { confirmModal } from '@/components/confirm-modal';
import { Button, Group, Input, Modal, Paper, Stack, Text } from '@mantine/core';
import { ACCEPTED_TYPES, FAQ_SLOTS, useFaqImagesPage, type FaqImage, type FaqSlot } from './useFaqImagesPage';

function FaqImageRow({
  slot,
  image,
  saving,
  onReplace,
  onDelete,
}: {
  slot: FaqSlot;
  image: FaqImage | undefined;
  saving: boolean;
  onReplace: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="md" wrap="nowrap">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.imageUrl}
            alt={`${slot.label} FAQ 이미지`}
            className="object-contain"
            style={{
              width: 60,
              height: 90,
              flexShrink: 0,
              borderRadius: 'var(--mantine-radius-sm)',
              border: '1px solid var(--app-divider)',
              background: 'var(--app-bg-muted)',
            }}
          />
        )}
        <Stack gap={2} style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {slot.label}
          </Text>
          <Text size="sm" c="dimmed">
            {image
              ? `${image.width} × ${image.height}px · 등록 ${new Date(image.updatedAt).toLocaleString('ko-KR')}`
              : '기본 이미지 사용 중'}
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Button variant="default" size="xs" onClick={onReplace}>
            교체
          </Button>
          {image && (
            // 교체 중에 삭제하면 이전 경로만 지워져 새 파일이 고아로 남는다
            <Button variant="light" color="red" size="xs" onClick={onDelete} disabled={saving}>
              삭제
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}

function ReplaceDialog({
  slot,
  saving,
  onClose,
  onSave,
}: {
  slot: FaqSlot | null;
  saving: boolean;
  onClose: () => void;
  onSave: (slot: FaqSlot, file: File) => Promise<boolean>;
}): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 열 때마다 이전에 고른 파일을 비운다
  useEffect(() => {
    setFile(null);
    setPreviewUrl(null);
  }, [slot]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const submit = async () => {
    if (slot && file && (await onSave(slot, file))) onClose();
  };

  return (
    <Modal
      opened={slot !== null}
      onClose={onClose}
      title={`${slot?.label ?? ''} 이미지 교체`}
      size={480}
      closeOnEscape={!saving}
      closeOnClickOutside={!saving}
      withCloseButton={!saving}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          저장하면 이전 이미지는 삭제됩니다. 원본 그대로 올라가며 최대 10MB입니다.
        </Text>
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="새 이미지 미리보기"
            className="object-contain"
            style={{
              maxHeight: 360,
              maxWidth: '100%',
              alignSelf: 'flex-start',
              borderRadius: 'var(--mantine-radius-md)',
              border: '1px solid var(--app-divider)',
            }}
          />
        )}
        <Input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={onFileChange} />
      </Stack>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button onClick={submit} disabled={saving || !file}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </Group>
    </Modal>
  );
}

export default function FaqImagesPage(): React.ReactElement {
  const page = useFaqImagesPage();
  const [replacing, setReplacing] = useState<FaqSlot | null>(null);

  const confirmDelete = async (slot: FaqSlot): Promise<void> => {
    const confirmed = await confirmModal({
      title: `${slot.label} 이미지 삭제`,
      message: '올린 이미지를 삭제합니다. 앱에는 내장 기본 이미지가 표시됩니다.',
      confirmLabel: '삭제',
      danger: true,
    });
    if (confirmed) page.remove(slot);
  };

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="사용법·FAQ 이미지"
          description="앱의 '사용법 및 FAQ' 화면에 표시되는 이미지입니다. 기기 플랫폼에 맞는 이미지가 나갑니다."
        />
      </PageHeader>
      <PageContent>
        {page.loading ? (
          <InlineLoadingSkeleton />
        ) : (
          <Stack gap="sm">
            {FAQ_SLOTS.map((slot) => (
              <FaqImageRow
                key={slot.key}
                slot={slot}
                image={page.images[slot.key]}
                saving={page.saving}
                onReplace={() => setReplacing(slot)}
                onDelete={() => confirmDelete(slot)}
              />
            ))}
          </Stack>
        )}
      </PageContent>
      <ReplaceDialog slot={replacing} saving={page.saving} onClose={() => setReplacing(null)} onSave={page.replace} />
    </PageShell>
  );
}
