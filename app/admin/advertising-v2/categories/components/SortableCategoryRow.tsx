'use client';

import React, { memo } from 'react';
import { ActionIcon, Badge, Group, Table, Text } from '@mantine/core';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AdCategoryV2 } from '../types';

// 소개내용 20자 초과 시 말줄임
const _NOTE_TRUNCATE_LENGTH = 20;

interface SortableCategoryRowProps {
  category: AdCategoryV2;
  isSelected: boolean;
  onEdit: (category: AdCategoryV2) => void;
  onDelete: (category: AdCategoryV2) => void;
  onSelect: (category: AdCategoryV2) => void;
  onAddSub: (category: AdCategoryV2) => void;
}

// 드래그 가능한 카테고리 테이블 행
function SortableCategoryRowBase({
  category,
  isSelected,
  onEdit,
  onDelete,
  onSelect,
  onAddSub,
}: SortableCategoryRowProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // note 20자 말줄임
  const truncatedNote = category.note
    ? category.note.length > _NOTE_TRUNCATE_LENGTH
      ? `${category.note.slice(0, _NOTE_TRUNCATE_LENGTH)}...`
      : category.note
    : '-';

  return (
    <Table.Tr
      ref={setNodeRef}
      style={{ ...style, cursor: 'pointer' }}
      {...attributes}
      bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
      onClick={() => onSelect(category)}
    >
      {/* 드래그 핸들 + 순서 */}
      <Table.Td>
        <Group
          gap="xs"
          wrap="nowrap"
          className="cursor-grab active:cursor-grabbing"
          {...listeners}
        >
          <GripVertical size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm" fw={500}>{category.orderIndex}</Text>
        </Group>
      </Table.Td>

      {/* 카테고리명 + 아이콘 */}
      <Table.Td fw={500}>
        <Group gap="xs" wrap="nowrap">
          {category.iconUrl && (
            <img
              src={category.iconUrl}
              alt={`${category.categoryName} 아이콘`}
              className="object-contain"
              style={{ width: 24, height: 24 }}
            />
          )}
          {category.categoryName}
        </Group>
      </Table.Td>

      {/* 소개내용 (20자 말줄임) */}
      <Table.Td c="dimmed" maw={200}>
        {truncatedNote}
      </Table.Td>

      {/* 기본광고 수 */}
      <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {category.basicAdCount > 0 ? category.basicAdCount : (
          <Text span size="sm" c="dimmed">-</Text>
        )}
      </Table.Td>

      {/* 프리미엄광고 수 */}
      <Table.Td ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {category.premiumAdCount > 0 ? category.premiumAdCount : (
          <Text span size="sm" c="dimmed">-</Text>
        )}
      </Table.Td>

      {/* 활성 여부 */}
      <Table.Td>
        {category.isActive ? (
          <Badge variant="light" color="green">활성</Badge>
        ) : (
          <Badge variant="light" color="gray">비활성</Badge>
        )}
      </Table.Td>

      {/* 작업 버튼 */}
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              onAddSub(category);
            }}
            title="서브카테고리 추가"
            aria-label="서브카테고리 추가"
          >
            <Plus size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(category);
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
              onDelete(category);
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

// useSortable은 DndContext 컨텍스트를 구독하므로 memo해도 드래그 중 위치 갱신은 그대로 동작한다
export const SortableCategoryRow = memo(SortableCategoryRowBase);
