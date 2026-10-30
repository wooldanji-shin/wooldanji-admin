'use client';

import { memo } from 'react';
import type { ChangeEvent } from 'react';
import { Button, Group, Modal, Text, Textarea } from '@mantine/core';
import type { UserFullDetails } from '@/lib/supabase/types';

interface SuspendDialogProps {
  opened: boolean;
  suspendingUser: UserFullDetails | null;
  suspensionReason: string;
  processing: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/** 승인 보류 다이얼로그 */
export const SuspendDialog = memo(function SuspendDialog({
  opened,
  suspendingUser,
  suspensionReason,
  processing,
  onReasonChange,
  onClose,
  onConfirm,
}: SuspendDialogProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title='승인 보류'
      // 보류 요청 중에는 닫지 못하게 막는다
      closeOnClickOutside={!processing}
      closeOnEscape={!processing}
      closeButtonProps={{ disabled: processing }}
    >
      <Text size='sm' c='dimmed'>
        <strong>{suspendingUser?.name || suspendingUser?.email}</strong>님의 승인을 보류하시겠습니까?
        <br />
        보류 사유를 입력해주세요. 사용자는 이 사유를 확인할 수 있습니다.
      </Text>
      <Textarea
        mt='md'
        minRows={4}
        autosize
        placeholder='보류 사유를 입력해주세요...'
        value={suspensionReason}
        disabled={processing}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onReasonChange(e.target.value)}
      />
      <Group justify='flex-end' mt='lg'>
        <Button variant='default' onClick={onClose} disabled={processing}>
          취소
        </Button>
        <Button color='yellow' onClick={onConfirm} loading={processing}>
          승인 보류
        </Button>
      </Group>
    </Modal>
  );
});
