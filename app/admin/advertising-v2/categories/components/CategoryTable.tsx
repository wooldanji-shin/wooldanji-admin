'use client';

import React, { memo } from 'react';
import { Box, Paper, Table } from '@mantine/core';
import { TableSkeleton } from '@/components/skeletons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableCategoryRow } from './SortableCategoryRow';
import { SubCategoryTable } from './SubCategoryTable';
import type { AdCategoryV2, AdSubCategoryV2 } from '../types';

// useSensor는 options 객체가 바뀌면 센서를 새로 만든다 → 모듈 상수로 두어 sensors 배열을 안정적으로 유지
const _KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
};

interface CategoryTableProps {
  categories: AdCategoryV2[];
  loading: boolean;
  selectedCategoryId: string | null;
  subCategories: AdSubCategoryV2[];
  subLoading: boolean;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (category: AdCategoryV2) => void;
  onDelete: (category: AdCategoryV2) => void;
  onSelect: (category: AdCategoryV2) => void;
  onAddSub: (category: AdCategoryV2) => void;
  onSubDragEnd: (event: DragEndEvent) => void;
  onSubEdit: (sub: AdSubCategoryV2) => void;
  onSubDelete: (sub: AdSubCategoryV2) => void;
}

// 카테고리 표 (드래그 정렬) + 펼친 카테고리의 서브카테고리 표
// memo: 다이얼로그 입력처럼 목록과 무관한 상태 변경에는 다시 렌더링하지 않는다
function CategoryTableBase({
  categories,
  loading,
  selectedCategoryId,
  subCategories,
  subLoading,
  onDragEnd,
  onEdit,
  onDelete,
  onSelect,
  onAddSub,
  onSubDragEnd,
  onSubEdit,
  onSubDelete,
}: CategoryTableProps): React.JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, _KEYBOARD_SENSOR_OPTIONS)
  );

  return (
    <Paper withBorder radius="md">
      <Table.ScrollContainer minWidth={720}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={128}>순서</Table.Th>
                <Table.Th>카테고리명</Table.Th>
                <Table.Th>소개내용</Table.Th>
                <Table.Th ta="center">기본광고</Table.Th>
                <Table.Th ta="center">프리미엄</Table.Th>
                <Table.Th>상태</Table.Th>
                <Table.Th ta="right">작업</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={7} p={0}>
                    <TableSkeleton rows={8} columns={7} showHeader={false} />
                  </Table.Td>
                </Table.Tr>
              ) : categories.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} ta="center" py={48} c="dimmed">
                    카테고리가 없습니다.
                  </Table.Td>
                </Table.Tr>
              ) : (
                <SortableContext
                  items={categories.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categories.map((category) => (
                    <React.Fragment key={category.id}>
                      <SortableCategoryRow
                        category={category}
                        isSelected={selectedCategoryId === category.id}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onSelect={onSelect}
                        onAddSub={onAddSub}
                      />
                      {selectedCategoryId === category.id && (
                        <Table.Tr>
                          <Table.Td colSpan={7} p={0}>
                            <Box bg="var(--app-bg-muted)" px="md" py="sm">
                              <SubCategoryTable
                                sensors={sensors}
                                subCategories={subCategories}
                                subLoading={subLoading}
                                onDragEnd={onSubDragEnd}
                                onEdit={onSubEdit}
                                onDelete={onSubDelete}
                              />
                            </Box>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </React.Fragment>
                  ))}
                </SortableContext>
              )}
            </Table.Tbody>
          </Table>
        </DndContext>
      </Table.ScrollContainer>
    </Paper>
  );
}

export const CategoryTable = memo(CategoryTableBase);
