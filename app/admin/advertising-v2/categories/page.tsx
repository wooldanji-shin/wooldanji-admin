'use client';

import React from 'react';
import { AdminHeader } from '@/components/admin-header';
import { PageShell } from '@/components/page-shell';
import { Button, Group, Text } from '@mantine/core';
import { Plus } from 'lucide-react';
import { useCategoriesPage } from './useCategoriesPage';
import { CategoryTable } from './components/CategoryTable';
import { CategoryFormModal } from './components/CategoryFormModal';
import { SubCategoryFormModal } from './components/SubCategoryFormModal';
import { CategoryDeleteModal, SubCategoryDeleteModal } from './components/DeleteConfirmModals';

export default function AdCategoriesV2Page(): React.JSX.Element {
  const page = useCategoriesPage();
  const { fetch, sub, categoryDialog, categoryDelete, subDialog, subDelete, reorder } = page;

  return (
    <PageShell>
      <AdminHeader title="카테고리 관리 v2" />

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          드래그하여 순서 변경, 클릭하여 서브카테고리 펼치기
        </Text>
        <Button
          onClick={categoryDialog.openDialog}
          leftSection={<Plus size={16} />}
        >
          카테고리 추가
        </Button>
      </Group>

      <CategoryTable
        categories={fetch.categories}
        loading={fetch.loading}
        selectedCategoryId={sub.selectedCategory?.id ?? null}
        subCategories={sub.subCategories}
        subLoading={sub.subLoading}
        onDragEnd={reorder.handleDragEnd}
        onEdit={categoryDialog.handleEditClick}
        onDelete={categoryDelete.handleDeleteClick}
        onSelect={sub.handleCategorySelect}
        onAddSub={subDialog.handleAddSubClick}
        onSubDragEnd={reorder.handleSubDragEnd}
        onSubEdit={subDialog.handleSubEditClick}
        onSubDelete={subDelete.handleSubDeleteClick}
      />

      {/* 생성/수정 다이얼로그 */}
      <CategoryFormModal
        state={categoryDialog.state}
        onClose={categoryDialog.handleDialogClose}
        onFormChange={categoryDialog.handleFormChange}
        onOrderIndexChange={categoryDialog.handleOrderIndexChange}
        onUploadedIconUrlChange={categoryDialog.setUploadedIconUrl}
        onSave={categoryDialog.handleSave}
      />

      {/* 서브카테고리 수정 다이얼로그 */}
      <SubCategoryFormModal
        state={subDialog.state}
        selectedCategoryName={sub.selectedCategory?.categoryName}
        onDismiss={subDialog.dismissSubDialog}
        onCancel={subDialog.closeSubDialog}
        onNameChange={subDialog.setSubCategoryName}
        onActiveChange={subDialog.setSubIsActive}
        onSave={subDialog.handleSubSave}
      />

      {/* 서브카테고리 삭제 확인 다이얼로그 */}
      <SubCategoryDeleteModal
        state={subDelete.state}
        onClose={subDelete.closeSubDeleteDialog}
        onConfirm={subDelete.handleSubDeleteConfirm}
      />

      {/* 삭제 확인 다이얼로그 */}
      <CategoryDeleteModal
        state={categoryDelete.state}
        onClose={categoryDelete.closeDeleteDialog}
        onConfirm={categoryDelete.handleDeleteConfirm}
      />
    </PageShell>
  );
}
