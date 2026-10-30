'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import type { UseDeleteDialogReturn } from '../types';

interface DeleteDialogProps {
  dialog: UseDeleteDialogReturn;
}

/** 관리자 삭제 확인 */
export const DeleteDialog = memo(function DeleteDialog({ dialog }: DeleteDialogProps): ReactElement {
  const deletingManager = dialog.manager;

  return (
    <Modal
      opened={dialog.opened}
      onClose={dialog.close}
      title='관리자 삭제'
      closeOnClickOutside={!dialog.processing}
      closeOnEscape={!dialog.processing}
      withCloseButton={!dialog.processing}
    >
      <Text size='sm' c='dimmed'>
        정말로 <strong>{deletingManager?.name || deletingManager?.email}</strong>님을 삭제하시겠습니까?
        <br />
        이 작업은 되돌릴 수 없으며, 해당 관리자의 모든 데이터가 삭제됩니다.
      </Text>
      <Group justify='flex-end' mt='lg'>
        <Button variant='default' onClick={dialog.close} disabled={dialog.processing}>
          취소
        </Button>
        <Button color='red' onClick={dialog.confirm} loading={dialog.processing}>
          삭제
        </Button>
      </Group>
    </Modal>
  );
});
