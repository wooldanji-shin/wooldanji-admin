'use client';

import React, { memo } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import type { AdCategoryV2, AdSubCategoryV2, DeleteDialogState } from '../types';

interface SubCategoryDeleteModalProps {
  state: DeleteDialogState<AdSubCategoryV2>;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// 서브카테고리 삭제 확인 다이얼로그
function SubCategoryDeleteModalBase({
  state,
  onClose,
  onConfirm,
}: SubCategoryDeleteModalProps): React.JSX.Element {
  const { opened: deleteSubDialog, target: deletingSubCategory, processing: subDeleting } = state;

  return (
    <Modal
      opened={deleteSubDialog}
      onClose={() => {
        // 삭제 중에는 닫기 차단 (X 포함)
        if (!subDeleting) onClose();
      }}
      title="서브카테고리 삭제"
      closeOnClickOutside={!subDeleting}
      closeOnEscape={!subDeleting}
      closeButtonProps={{ disabled: subDeleting }}
    >
      <Text size="sm" c="dimmed">
        정말로 <Text span fw={700} inherit>{deletingSubCategory?.subCategoryName}</Text> 서브카테고리를
        삭제하시겠습니까?
        <br />이 작업은 되돌릴 수 없습니다.
      </Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={subDeleting}>
          취소
        </Button>
        <Button color="red" onClick={onConfirm} disabled={subDeleting}>
          {subDeleting ? '삭제 중...' : '삭제'}
        </Button>
      </Group>
    </Modal>
  );
}

export const SubCategoryDeleteModal = memo(SubCategoryDeleteModalBase);

interface CategoryDeleteModalProps {
  state: DeleteDialogState<AdCategoryV2>;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// 카테고리 삭제 확인 다이얼로그
function CategoryDeleteModalBase({
  state,
  onClose,
  onConfirm,
}: CategoryDeleteModalProps): React.JSX.Element {
  const { opened: deleteDialog, target: deletingCategory, processing: categoryDeleting } = state;

  return (
    <Modal
      opened={deleteDialog}
      onClose={() => {
        // 삭제 중에는 닫기 차단 (X 포함)
        if (!categoryDeleting) onClose();
      }}
      title="카테고리 삭제"
      closeOnClickOutside={!categoryDeleting}
      closeOnEscape={!categoryDeleting}
      closeButtonProps={{ disabled: categoryDeleting }}
    >
      <Text size="sm" c="dimmed">
        정말로 <Text span fw={700} inherit>{deletingCategory?.categoryName}</Text> 카테고리를
        삭제하시겠습니까?
        <br />이 작업은 되돌릴 수 없습니다.
      </Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={categoryDeleting}>
          취소
        </Button>
        <Button color="red" onClick={onConfirm} disabled={categoryDeleting}>
          {categoryDeleting ? '삭제 중...' : '삭제'}
        </Button>
      </Group>
    </Modal>
  );
}

export const CategoryDeleteModal = memo(CategoryDeleteModalBase);
