'use client';

import { memo } from 'react';
import type { ChangeEvent } from 'react';
import { Button, Divider, Group, Modal, Select, SimpleGrid, Text, TextInput } from '@mantine/core';
import { Loader2 } from 'lucide-react';
import { READONLY_INPUT_STYLES } from '@/components/readonly-input-styles';
import type { UserFullDetails } from '@/lib/supabase/types';
import type { EditForm } from '../types';
import { formatDate } from '../utils';

interface UserDetailDialogProps {
  opened: boolean;
  detailUser: UserFullDetails | null;
  editForm: EditForm;
  saving: boolean;
  onFieldChange: (field: string, value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}

/** 회원 전체보기/수정 다이얼로그 */
export const UserDetailDialog = memo(function UserDetailDialog({
  opened,
  detailUser,
  editForm,
  saving,
  onFieldChange,
  onClose,
  onSave,
}: UserDetailDialogProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title='회원 전체보기'
      size='xl'
      // 저장 중에는 닫지 못하게 막는다
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      closeButtonProps={{ disabled: saving }}
    >
      <Text size='sm' c='dimmed'>
        회원 정보를 확인하고 수정할 수 있습니다.
      </Text>

      <SimpleGrid cols={2} spacing='md' mt='md'>
        {/* 기본 정보 */}
        <TextInput
          id='detail-name'
          label='이름'
          value={editForm.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('name', e.target.value)}
        />
        <TextInput
          id='detail-email'
          label='이메일'
          value={editForm.email}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          id='detail-phone'
          label='전화번호'
          value={editForm.phoneNumber}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('phoneNumber', e.target.value)}
        />
        <TextInput
          id='detail-birthday'
          label='생년월일'
          value={editForm.birthDay}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('birthDay', e.target.value)}
          placeholder='YYYY-MM-DD'
        />

        {/* 아파트 정보 */}
        <TextInput
          id='detail-apartment'
          label='아파트'
          value={detailUser?.apartments?.name || '-'}
          disabled
          styles={READONLY_INPUT_STYLES}
          style={{ gridColumn: 'span 2' }}
        />
        <TextInput
          id='detail-building'
          label='동'
          type='text'
          inputMode='numeric'
          value={editForm.buildingNumber}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('buildingNumber', e.target.value)}
        />
        <TextInput
          id='detail-unit'
          label='호'
          type='text'
          inputMode='numeric'
          value={editForm.unit}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('unit', e.target.value)}
        />

        {/* 지역 정보  */}
        <TextInput
          id='detail-address'
          label='주소'
          value={editForm.address}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          id='detail-sido'
          label='시/도'
          value={editForm.regionSido}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          id='detail-sigungu'
          label='시/군/구'
          value={editForm.regionSigungu}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <TextInput
          id='detail-dong'
          label='읍/면/동'
          value={editForm.regionDong}
          disabled
          styles={READONLY_INPUT_STYLES}
        />

        {/* 상태 정보  */}
        <Select
          id='detail-registrationType'
          label='회원유형'
          data={[
            { value: 'APARTMENT', label: '아파트' },
            { value: 'GENERAL', label: '일반' },
          ]}
          value={editForm.registrationType || null}
          allowDeselect={false}
          disabled
          styles={READONLY_INPUT_STYLES}
        />
        <Select
          id='detail-approvalStatus'
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

        {/* 카운트 정보 */}
        <TextInput
          id='detail-openDoorCount'
          label='문 연 횟수'
          type='text'
          inputMode='numeric'
          value={editForm.openDoorCount}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('openDoorCount', e.target.value)}
        />
        <TextInput
          id='detail-rssLevel'
          label='RSS 레벨'
          type='text'
          inputMode='numeric'
          value={editForm.rssLevel}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('rssLevel', e.target.value)}
        />
      </SimpleGrid>

      {/* 읽기 전용 정보 */}
      <Divider my='md' />
      <Text size='sm' c='dimmed' mb='xs'>읽기 전용 정보</Text>
      <SimpleGrid cols={2} spacing='md'>
        <Text size='sm'>
          <Text span c='dimmed' inherit>가입일: </Text>
          {detailUser?.createdAt ? formatDate(detailUser.createdAt) : '-'}
        </Text>
        <Text size='sm'>
          <Text span c='dimmed' inherit>플랫폼: </Text>
          {detailUser?.platform || '-'}
        </Text>
      </SimpleGrid>

      <Group justify='flex-end' mt='lg'>
        <Button variant='default' onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          leftSection={saving ? <Loader2 size={16} className='animate-spin' /> : undefined}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </Group>
    </Modal>
  );
});
