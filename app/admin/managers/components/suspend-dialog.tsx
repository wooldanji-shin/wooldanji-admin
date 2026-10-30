'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import { Button, Group, Modal, Text, Textarea } from '@mantine/core';
import type { UseSuspendDialogReturn } from '../types';

interface SuspendDialogProps {
  dialog: UseSuspendDialogReturn;
}

/** 승인 보류 확인 (사유 입력) */
export const SuspendDialog = memo(function SuspendDialog({ dialog }: SuspendDialogProps): ReactElement {
  const suspendingManager = dialog.manager;

  return (
    <Modal
      opened={dialog.opened}
      onClose={dialog.close}
      title='승인 보류'
      closeOnClickOutside={!dialog.processing}
      closeOnEscape={!dialog.processing}
      withCloseButton={!dialog.processing}
    >
      <Text size='sm' c='dimmed'>
        <strong>{suspendingManager?.name || suspendingManager?.email}</strong>님의 승인을 보류하시겠습니까?
        <br />
        보류 사유를 입력해주세요. 사용자는 이 사유를 확인할 수 있습니다.
      </Text>
      <Textarea
        mt='md'
        minRows={4}
        autosize
        placeholder='보류 사유를 입력해주세요...'
        value={dialog.reason}
        onChange={(e) => dialog.setReason(e.target.value)}
        disabled={dialog.processing}
      />
      <Group justify='flex-end' mt='lg'>
        <Button variant='default' onClick={dialog.close} disabled={dialog.processing}>
          취소
        </Button>
        <Button color='yellow' onClick={dialog.confirm} loading={dialog.processing}>
          승인 보류
        </Button>
      </Group>
    </Modal>
  );
});
