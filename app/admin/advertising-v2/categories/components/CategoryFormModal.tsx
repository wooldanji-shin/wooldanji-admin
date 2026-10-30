'use client';

import React, { memo } from 'react';
import {
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { ImageUpload } from '@/components/image-upload';
import type { CategoryDialogState, CategoryForm } from '../types';

interface CategoryFormModalProps {
  state: CategoryDialogState;
  onClose: (open: boolean) => Promise<void>;
  onFormChange: (field: keyof CategoryForm, value: string | number | boolean) => void;
  onOrderIndexChange: (value: number) => void;
  onUploadedIconUrlChange: (url: string) => void;
  onSave: () => Promise<void>;
}

// 카테고리 생성/수정 다이얼로그
function CategoryFormModalBase({
  state,
  onClose,
  onFormChange,
  onOrderIndexChange,
  onUploadedIconUrlChange,
  onSave,
}: CategoryFormModalProps): React.JSX.Element {
  const { isOpen, editingCategory, form, orderIndexError, saving } = state;

  return (
    <Modal
      opened={isOpen}
      onClose={() => {
        // 저장 중에는 닫기 차단
        if (!saving) onClose(false);
      }}
      title={editingCategory ? '카테고리 수정' : '카테고리 추가'}
      size={540}
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      closeButtonProps={{ disabled: saving }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          광고 카테고리 v2 정보를 입력합니다.
        </Text>

        {/* 카테고리명 */}
        <TextInput
          id="categoryName"
          label="카테고리 이름 *"
          value={form.categoryName}
          onChange={(e) => onFormChange('categoryName', e.target.value)}
          placeholder="필라테스, 영어학원 등"
        />

        {/* 아이콘 업로드 */}
        <Stack gap={6}>
          <Text size="sm" fw={500}>아이콘</Text>
          <ImageUpload
            bucket="advertisements"
            storagePath="categories-v2/icons"
            value={form.iconUrl || ''}
            onChange={(url) => {
              onFormChange('iconUrl', url ?? '');
              onUploadedIconUrlChange(url ?? '');
            }}
            accept="image/png,image/svg+xml"
            maxSizeMB={2}
            description="PNG 또는 SVG 파일, 최대 2MB"
          />
        </Stack>

        {/* 소개내용 (note) */}
        <Textarea
          id="note"
          label="소개내용"
          value={form.note}
          onChange={(e) => onFormChange('note', e.target.value)}
          placeholder="카테고리에 대한 간단한 소개를 입력하세요."
          rows={3}
        />

        {/* 표시 순서 */}
        <TextInput
          id="orderIndex"
          label="표시 순서 *"
          type="number"
          value={form.orderIndex}
          onChange={(e) => onOrderIndexChange(parseInt(e.target.value) || 0)}
          placeholder="1"
          error={orderIndexError}
        />

        {/* 활성화 */}
        <Checkbox
          id="isActive"
          label="활성화"
          checked={form.isActive}
          onChange={(e) => onFormChange('isActive', e.currentTarget.checked)}
        />
      </Stack>

      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => onClose(false)} disabled={saving}>
          취소
        </Button>
        <Button onClick={onSave} disabled={!!orderIndexError} loading={saving}>
          {editingCategory ? '수정' : '생성'}
        </Button>
      </Group>
    </Modal>
  );
}

export const CategoryFormModal = memo(CategoryFormModalBase);
