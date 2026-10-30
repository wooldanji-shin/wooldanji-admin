'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import {
  Button,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { READONLY_INPUT_STYLES } from '@/components/readonly-input-styles';
import { getScopeDisplay } from './manager-display';
import type { UseDetailDialogReturn } from '../types';

interface DetailDialogProps {
  dialog: UseDetailDialogReturn;
}

/** 관리자 상세 정보 확인·수정 */
export const DetailDialog = memo(function DetailDialog({ dialog }: DetailDialogProps): ReactElement {
  const { editForm, manager: detailManager, saving, setField } = dialog;

  return (
    <Modal
      opened={dialog.opened}
      onClose={dialog.close}
      title='관리자 상세 정보'
      size={600}
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
    >
      <Text size='sm' c='dimmed'>
        관리자 정보를 확인하고 수정할 수 있습니다.
      </Text>

      <SimpleGrid cols={2} spacing='md' mt='md'>
        <TextInput
          label='이름'
          value={editForm.name}
          onChange={(e) => setField('name', e.target.value)}
        />
        <TextInput
          label='이메일'
          value={editForm.email}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          label='전화번호'
          value={editForm.phoneNumber}
          onChange={(e) => setField('phoneNumber', e.target.value)}
        />
        <TextInput
          label='생년월일'
          value={editForm.birthDay}
          onChange={(e) => setField('birthDay', e.target.value)}
          placeholder='YYYY-MM-DD'
        />

        {/* 관리 범위 */}
        <Stack gap={4} style={{ gridColumn: 'span 2' }}>
          <Text size='sm' fw={500}>관리 범위</Text>
          <Paper bg='var(--app-bg-muted)' p='sm' radius='sm'>
            {detailManager && getScopeDisplay(detailManager.admin_scopes)}
          </Paper>
        </Stack>

        {/* 지역 정보 */}
        <TextInput
          label='주소'
          value={editForm.address}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          label='시/도'
          value={editForm.regionSido}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          label='시/군/구'
          value={editForm.regionSigungu}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          label='읍/면/동'
          value={editForm.regionDong}
          disabled
          styles={READONLY_INPUT_STYLES}
        />

        {/* 상태 정보 */}
        <Select
          label='승인상태'
          data={[
            { value: 'pending', label: '대기' },
            { value: 'approve', label: '승인' },
            { value: 'suspended', label: '보류' },
            { value: 'inactive', label: '비활성' },
          ]}
          value={editForm.approvalStatus || null}
          allowDeselect={false}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          label='문 연 횟수'
          type='number'
          value={editForm.openDoorCount}
          onChange={(e) => setField('openDoorCount', e.target.value)}
        />
      </SimpleGrid>

      <Group justify='flex-end' mt='lg'>
        <Button variant='default' onClick={dialog.close} disabled={saving}>
          취소
        </Button>
        <Button onClick={dialog.save} loading={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </Group>
    </Modal>
  );
});
