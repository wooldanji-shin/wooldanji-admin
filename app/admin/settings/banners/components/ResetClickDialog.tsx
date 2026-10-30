'use client';

import { memo, type ReactElement } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import type { Banner } from '../types';

interface ResetClickDialogProps {
  opened: boolean;
  resetClickBanner: Banner | null;
  /** 초기화 처리 중 — 버튼을 잠그고 닫기를 막는다 */
  processing: boolean;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 클릭수 초기화 확인 다이얼로그 */
export const ResetClickDialog = memo(function ResetClickDialog({
  opened,
  resetClickBanner,
  processing,
  onClose,
  onCancel,
  onConfirm,
}: ResetClickDialogProps): ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!processing) onClose();
      }}
      closeOnClickOutside={!processing}
      closeOnEscape={!processing}
      withCloseButton={!processing}
      title={
        <Group component="span" gap="xs" display="inline-flex">
          <AlertCircle size={20} color="var(--mantine-color-blue-filled)" />
          클릭수 초기화
        </Group>
      }
    >
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          이 배너의 클릭수를 0으로 초기화하시겠습니까?
        </Text>
        <Text size="sm" c="blue">
          현재: 광고 클릭수 {resetClickBanner?.adClickCount?.toLocaleString() || '0'} / 클릭 수 {resetClickBanner?.clickCount?.toLocaleString() || '0'}
        </Text>
      </Stack>
      <Group justify="flex-end" mt="lg">
        <Button
          variant="default"
          onClick={() => {
            onCancel();
          }}
          disabled={processing}
        >
          취소
        </Button>
        <Button color="blue" onClick={onConfirm} loading={processing}>
          초기화
        </Button>
      </Group>
    </Modal>
  );
});
