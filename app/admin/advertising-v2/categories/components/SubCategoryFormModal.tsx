'use client';

import React, { memo } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import type { SubCategoryDialogState } from '../types';

interface SubCategoryFormModalProps {
  state: SubCategoryDialogState;
  selectedCategoryName: string | undefined;
  onDismiss: () => void;
  onCancel: () => void;
  onNameChange: (name: string) => void;
  onActiveChange: (isActive: boolean) => void;
  onSave: () => Promise<void>;
}

// 서브카테고리 생성/수정 다이얼로그
function SubCategoryFormModalBase({
  state,
  selectedCategoryName,
  onDismiss,
  onCancel,
  onNameChange,
  onActiveChange,
  onSave,
}: SubCategoryFormModalProps): React.JSX.Element {
  const { isOpen, editingSubCategory, form: subForm, saving: subSaving } = state;

  return (
    <Modal
      opened={isOpen}
      onClose={() => {
        // 저장 중에는 닫기 차단 (X 포함)
        if (!subSaving) onDismiss();
      }}
      title={editingSubCategory ? '서브카테고리 수정' : '서브카테고리 추가'}
      size={400}
      closeOnClickOutside={!subSaving}
      closeOnEscape={!subSaving}
      closeButtonProps={{ disabled: subSaving }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {editingSubCategory ? '서브카테고리 정보를 수정합니다.' : `${selectedCategoryName}에 서브카테고리를 추가합니다.`}
        </Text>
        <TextInput
          id="subCategoryName"
          label="서브카테고리 이름 *"
          value={subForm.subCategoryName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="서브카테고리 이름"
        />
        <Checkbox
          id="subIsActive"
          label="활성화"
          checked={subForm.isActive}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            onActiveChange(checked);
          }}
        />
      </Stack>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onCancel} disabled={subSaving}>
          취소
        </Button>
        <Button onClick={onSave} disabled={subSaving}>
          {subSaving ? '저장 중...' : editingSubCategory ? '수정' : '추가'}
        </Button>
      </Group>
    </Modal>
  );
}

export const SubCategoryFormModal = memo(SubCategoryFormModalBase);
