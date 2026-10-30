'use client';

import React, { memo } from 'react';
import { ActionIcon, Badge, Group, Skeleton, Table, Text } from '@mantine/core';
import { Edit, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AdSubCategoryV2 } from '../types';

interface SortableSubRowProps {
  sub: AdSubCategoryV2;
  onEdit: (sub: AdSubCategoryV2) => void;
  onDelete: (sub: AdSubCategoryV2) => void;
}

// 드래그 가능한 서브카테고리 테이블 행
function SortableSubRowBase({
  sub,
  onEdit,
  onDelete,
}: SortableSubRowProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Table.Tr
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <Table.Td>
        <Group
          gap="xs"
          wrap="nowrap"
          className="cursor-grab active:cursor-grabbing"
          {...listeners}
        >
          <GripVertical size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm" fw={500}>{sub.orderIndex}</Text>
        </Group>
      </Table.Td>
      <Table.Td fw={500}>{sub.subCategoryName}</Table.Td>
      <Table.Td>
        {sub.isActive ? (
          <Badge variant="light" color="green">활성</Badge>
        ) : (
          <Badge variant="light" color="gray">비활성</Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(sub);
            }}
            aria-label="수정"
          >
            <Edit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(sub);
            }}
            aria-label="삭제"
          >
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

const SortableSubRow = memo(SortableSubRowBase);

interface SubCategoryTableProps {
  sensors: SensorDescriptor<SensorOptions>[];
  subCategories: AdSubCategoryV2[];
  subLoading: boolean;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (sub: AdSubCategoryV2) => void;
  onDelete: (sub: AdSubCategoryV2) => void;
}

// 펼친 카테고리 아래 서브카테고리 표 (자체 DndContext)
function SubCategoryTableBase({
  sensors,
  subCategories,
  subLoading,
  onDragEnd,
  onEdit,
  onDelete,
}: SubCategoryTableProps): React.JSX.Element {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <Table verticalSpacing={6} horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={128}>순서</Table.Th>
            <Table.Th>서브카테고리명</Table.Th>
            <Table.Th>상태</Table.Th>
            <Table.Th ta="right">작업</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {subLoading ? (
            <Table.Tr>
              <Table.Td colSpan={4} py="lg">
                <Skeleton h={16} w="50%" mx="auto" />
              </Table.Td>
            </Table.Tr>
          ) : subCategories.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={4} ta="center" py="lg" c="dimmed">
                서브카테고리가 없습니다.
              </Table.Td>
            </Table.Tr>
          ) : (
            <SortableContext
              items={subCategories.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {subCategories.map((sub) => (
                <SortableSubRow
                  key={sub.id}
                  sub={sub}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </SortableContext>
          )}
        </Table.Tbody>
      </Table>
    </DndContext>
  );
}

export const SubCategoryTable = memo(SubCategoryTableBase);
