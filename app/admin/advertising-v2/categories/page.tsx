'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { PageShell } from '@/components/page-shell';
import { TableSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';
import { deleteFileFromStorage } from '@/lib/utils/storage';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 소개내용 20자 초과 시 말줄임
const _NOTE_TRUNCATE_LENGTH = 20;

interface AdCategoryV2 {
  id: string;
  categoryName: string;
  iconUrl: string | null;
  note: string | null;
  isActive: boolean;
  orderIndex: number;
  basicAdCount: number;
  premiumAdCount: number;
}

interface AdSubCategoryV2 {
  id: string;
  categoryId: string;
  subCategoryName: string;
  isActive: boolean;
  orderIndex: number;
}

// 드래그 가능한 카테고리 테이블 행
function SortableRow({
  category,
  isSelected,
  onEdit,
  onDelete,
  onSelect,
  onAddSub,
}: {
  category: AdCategoryV2;
  isSelected: boolean;
  onEdit: (category: AdCategoryV2) => void;
  onDelete: (category: AdCategoryV2) => void;
  onSelect: (category: AdCategoryV2) => void;
  onAddSub: (category: AdCategoryV2) => void;
}) {
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

// 드래그 가능한 서브카테고리 테이블 행
function SortableSubRow({
  sub,
  onEdit,
  onDelete,
}: {
  sub: AdSubCategoryV2;
  onEdit: (sub: AdSubCategoryV2) => void;
  onDelete: (sub: AdSubCategoryV2) => void;
}) {
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

// 폼 초기값
const _INITIAL_FORM = {
  categoryName: '',
  iconUrl: '',
  note: '',
  isActive: true,
  orderIndex: 1,
};

export default function AdCategoriesV2Page() {
  const supabase = createClient();

  const [categories, setCategories] = useState<AdCategoryV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdCategoryV2 | null>(null);
  const [uploadedIconUrl, setUploadedIconUrl] = useState('');
  const [form, setForm] = useState(_INITIAL_FORM);
  const [orderIndexError, setOrderIndexError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<AdCategoryV2 | null>(null);
  const [categoryDeleting, setCategoryDeleting] = useState(false);

  // 서브카테고리 state
  const [selectedCategory, setSelectedCategory] = useState<AdCategoryV2 | null>(null);
  const [subCategories, setSubCategories] = useState<AdSubCategoryV2[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<AdSubCategoryV2 | null>(null);
  const [subForm, setSubForm] = useState({ subCategoryName: '', isActive: true });
  const [deleteSubDialog, setDeleteSubDialog] = useState(false);
  const [deletingSubCategory, setDeletingSubCategory] = useState<AdSubCategoryV2 | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [subDeleting, setSubDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 카테고리 목록 조회
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: adCounts }] = await Promise.all([
        (supabase as any)
          .from('ad_categories_v2')
          .select('*')
          .order('orderIndex', { ascending: true }),
        supabase.rpc('get_category_ad_counts'),
      ]);
      if (error) throw error;

      const countMap = new Map<string, { basic: number; premium: number }>(
        (adCounts || []).map((r: { category_id: string; basic_ad_count: number; premium_ad_count: number }) => [
          r.category_id,
          { basic: r.basic_ad_count, premium: r.premium_ad_count },
        ])
      );

      const merged = (data ?? []).map((c: AdCategoryV2) => {
        const counts = countMap.get(c.id) ?? { basic: 0, premium: 0 };
        return { ...c, basicAdCount: counts.basic, premiumAdCount: counts.premium };
      });

      setCategories(merged);
    } catch (err) {
      console.error('카테고리 목록 조회 실패:', err);
      toast.error('카테고리 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 서브카테고리 목록 조회
  const fetchSubCategories = useCallback(async (categoryId: string) => {
    setSubLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('ad_sub_categories_v2')
        .select('*')
        .eq('categoryId', categoryId)
        .order('orderIndex', { ascending: true });
      if (error) throw error;
      setSubCategories(data ?? []);
    } catch (err) {
      console.error('서브카테고리 목록 조회 실패:', err);
      toast.error('서브카테고리 목록을 불러오는데 실패했습니다.');
    } finally {
      setSubLoading(false);
    }
  }, [supabase]);

  // 카테고리 행 클릭 → 같은 카테고리면 닫기, 다른 카테고리면 펼치기
  const handleCategorySelect = useCallback((category: AdCategoryV2) => {
    if (selectedCategory?.id === category.id) {
      setSelectedCategory(null);
      setSubCategories([]);
    } else {
      setSelectedCategory(category);
      fetchSubCategories(category.id);
    }
  }, [fetchSubCategories, selectedCategory]);

  // 서브카테고리 추가 버튼 클릭
  const handleAddSubClick = (category: AdCategoryV2) => {
    if (selectedCategory?.id !== category.id) {
      setSelectedCategory(category);
      fetchSubCategories(category.id);
    }
    setEditingSubCategory(null);
    setSubForm({ subCategoryName: '', isActive: true });
    setIsSubDialogOpen(true);
  };

  // 서브카테고리 수정 시작
  const handleSubEditClick = (sub: AdSubCategoryV2) => {
    setEditingSubCategory(sub);
    setSubForm({ subCategoryName: sub.subCategoryName, isActive: sub.isActive });
    setIsSubDialogOpen(true);
  };

  // 서브카테고리 저장 (생성/수정)
  const handleSubSave = async () => {
    if (!subForm.subCategoryName.trim()) {
      toast.error('서브카테고리 이름을 입력해주세요.');
      return;
    }
    setSubSaving(true);
    try {
      if (editingSubCategory) {
        const { error } = await (supabase as any)
          .from('ad_sub_categories_v2')
          .update({
            subCategoryName: subForm.subCategoryName.trim(),
            isActive: subForm.isActive,
          })
          .eq('id', editingSubCategory.id);
        if (error) throw error;
        toast.success('서브카테고리가 수정되었습니다.');
      } else {
        const nextOrderIndex = subCategories.length > 0
          ? Math.max(...subCategories.map((s) => s.orderIndex)) + 1
          : 1;
        const { error } = await (supabase as any)
          .from('ad_sub_categories_v2')
          .insert({
            categoryId: selectedCategory!.id,
            subCategoryName: subForm.subCategoryName.trim(),
            isActive: subForm.isActive,
            orderIndex: nextOrderIndex,
          });
        if (error) throw error;
        toast.success('서브카테고리가 추가되었습니다.');
      }
      setIsSubDialogOpen(false);
      setEditingSubCategory(null);
      if (selectedCategory) fetchSubCategories(selectedCategory.id);
    } catch (err: any) {
      console.error('서브카테고리 저장 실패:', err);
      toast.error(err.message || '서브카테고리 저장에 실패했습니다.');
    } finally {
      setSubSaving(false);
    }
  };

  // 서브카테고리 삭제 클릭
  const handleSubDeleteClick = (sub: AdSubCategoryV2) => {
    setDeletingSubCategory(sub);
    setDeleteSubDialog(true);
  };

  // 서브카테고리 삭제 실행
  const handleSubDeleteConfirm = async () => {
    if (!deletingSubCategory) return;
    setSubDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('ad_sub_categories_v2')
        .delete()
        .eq('id', deletingSubCategory.id);
      if (error) throw error;
      toast.success('서브카테고리가 삭제되었습니다.');
      setDeleteSubDialog(false);
      setDeletingSubCategory(null);
      if (selectedCategory) fetchSubCategories(selectedCategory.id);
    } catch (err: any) {
      console.error('서브카테고리 삭제 실패:', err);
      const isFkViolation = err?.code === '23503' || err?.message?.includes('foreign key');
      toast.error(
        isFkViolation
          ? '이 서브카테고리를 선택한 광고가 있어 삭제할 수 없습니다.'
          : err.message || '서브카테고리 삭제에 실패했습니다.'
      );
    } finally {
      setSubDeleting(false);
    }
  };

  // 서브카테고리 드래그앤드랍 순서 변경
  const handleSubDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subCategories.findIndex((s) => s.id === active.id);
    const newIndex = subCategories.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(subCategories, oldIndex, newIndex).map(
      (s, idx) => ({ ...s, orderIndex: idx + 1 })
    );

    setSubCategories(reordered);

    try {
      await Promise.all(
        reordered.map((s, idx) =>
          (supabase as any)
            .from('ad_sub_categories_v2')
            .update({ orderIndex: -(idx + 1) })
            .eq('id', s.id)
        )
      );
      await Promise.all(
        reordered.map((s) =>
          (supabase as any)
            .from('ad_sub_categories_v2')
            .update({ orderIndex: s.orderIndex })
            .eq('id', s.id)
        )
      );
    } catch (err) {
      console.error('서브카테고리 순서 변경 실패:', err);
      toast.error('순서 변경에 실패했습니다.');
      if (selectedCategory) fetchSubCategories(selectedCategory.id);
    }
  };

  // orderIndex 중복 체크 (자기 자신 제외)
  const checkOrderIndexDuplicate = (orderIndex: number, excludeId?: string) => {
    return categories.some(
      (c) => c.orderIndex === orderIndex && c.id !== excludeId
    );
  };

  // 폼 필드 변경 헬퍼
  const handleFormChange = (field: keyof typeof _INITIAL_FORM, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // orderIndex 변경 + 중복 검증
  const handleOrderIndexChange = (value: number) => {
    handleFormChange('orderIndex', value);
    if (checkOrderIndexDuplicate(value, editingCategory?.id)) {
      setOrderIndexError('순서가 중복됩니다');
    } else {
      setOrderIndexError(null);
    }
  };

  // 저장 (생성/수정)
  const handleSave = async () => {
    if (!form.categoryName.trim()) {
      toast.error('카테고리 이름을 입력해주세요.');
      return;
    }
    if (checkOrderIndexDuplicate(form.orderIndex, editingCategory?.id)) {
      setOrderIndexError('순서가 중복됩니다');
      return;
    }
    setOrderIndexError(null);

    try {
      const payload = {
        categoryName: form.categoryName.trim(),
        iconUrl: form.iconUrl || null,
        note: form.note.trim() || null,
        isActive: form.isActive,
        orderIndex: form.orderIndex,
      };

      if (editingCategory) {
        // 수정 (ad_categories_v2 미타입 테이블 any 캐스팅)
        const { error } = await (supabase as any)
          .from('ad_categories_v2')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) throw error;
        toast.success('카테고리가 수정되었습니다.');
      } else {
        // 생성
        const { error } = await (supabase as any)
          .from('ad_categories_v2')
          .insert(payload);
        if (error) throw error;
        toast.success('카테고리가 추가되었습니다.');
      }

      setUploadedIconUrl('');
      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (err: any) {
      console.error('카테고리 저장 실패:', err);
      toast.error(err.message || '카테고리 저장에 실패했습니다.');
    }
  };

  // 삭제 확인 클릭
  const handleDeleteClick = (category: AdCategoryV2) => {
    setDeletingCategory(category);
    setDeleteDialog(true);
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;

    setCategoryDeleting(true);
    try {
      // Storage 아이콘 파일 삭제 (있는 경우)
      if (deletingCategory.iconUrl) {
        await deleteFileFromStorage(deletingCategory.iconUrl);
      }

      const { error } = await (supabase as any)
        .from('ad_categories_v2')
        .delete()
        .eq('id', deletingCategory.id);
      if (error) throw error;

      toast.success('카테고리가 삭제되었습니다.');
      setDeleteDialog(false);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err: any) {
      console.error('카테고리 삭제 실패:', err);
      toast.error(err.message || '카테고리 삭제에 실패했습니다.');
    } finally {
      setCategoryDeleting(false);
    }
  };

  // 수정 시작
  const handleEditClick = (category: AdCategoryV2) => {
    setEditingCategory(category);
    setUploadedIconUrl('');
    setForm({
      categoryName: category.categoryName,
      iconUrl: category.iconUrl ?? '',
      note: category.note ?? '',
      isActive: category.isActive,
      orderIndex: category.orderIndex,
    });
    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingCategory(null);
    setUploadedIconUrl('');
    setOrderIndexError(null);
    setForm({
      ..._INITIAL_FORM,
      orderIndex: categories.length + 1,
    });
  };

  // 다이얼로그 닫기 — 업로드만 하고 저장 안 한 이미지 정리
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      if (
        uploadedIconUrl &&
        uploadedIconUrl !== (editingCategory?.iconUrl ?? '')
      ) {
        try {
          const path = new URL(uploadedIconUrl).pathname.split('/').slice(2).join('/');
          await supabase.storage
            .from(path.split('/')[0])
            .remove([path.split('/').slice(1).join('/')]);
        } catch (err) {
          console.error('임시 업로드 파일 삭제 실패:', err);
        }
      }
      resetForm();
    }
    setIsDialogOpen(open);
  };

  // 드래그&드롭 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex).map(
      (c, idx) => ({ ...c, orderIndex: idx + 1 })
    );

    // 낙관적 UI 업데이트
    setCategories(reordered);

    try {
      // 1단계: 음수 임시값으로 중복 방지 후 최종 값 적용 (ad_categories_v2 미타입 테이블 any 캐스팅)
      await Promise.all(
        reordered.map((c, idx) =>
          (supabase as any)
            .from('ad_categories_v2')
            .update({ orderIndex: -(idx + 1) })
            .eq('id', c.id)
        )
      );
      await Promise.all(
        reordered.map((c) =>
          (supabase as any)
            .from('ad_categories_v2')
            .update({ orderIndex: c.orderIndex })
            .eq('id', c.id)
        )
      );
    } catch (err) {
      console.error('순서 변경 실패:', err);
      toast.error('순서 변경에 실패했습니다.');
      fetchCategories();
    }
  };

  return (
    <PageShell>
      <AdminHeader title="카테고리 관리 v2" />

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          드래그하여 순서 변경, 클릭하여 서브카테고리 펼치기
        </Text>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          leftSection={<Plus size={16} />}
        >
          카테고리 추가
        </Button>
      </Group>

      <Paper withBorder radius="md">
        <Table.ScrollContainer minWidth={720}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
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
                        <SortableRow
                          category={category}
                          isSelected={selectedCategory?.id === category.id}
                          onEdit={handleEditClick}
                          onDelete={handleDeleteClick}
                          onSelect={handleCategorySelect}
                          onAddSub={handleAddSubClick}
                        />
                        {selectedCategory?.id === category.id && (
                          <Table.Tr>
                            <Table.Td colSpan={7} p={0}>
                              <Box bg="var(--app-bg-muted)" px="md" py="sm">
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={handleSubDragEnd}
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
                                              onEdit={handleSubEditClick}
                                              onDelete={handleSubDeleteClick}
                                            />
                                          ))}
                                        </SortableContext>
                                      )}
                                    </Table.Tbody>
                                  </Table>
                                </DndContext>
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

      {/* 생성/수정 다이얼로그 */}
      <Modal
        opened={isDialogOpen}
        onClose={() => handleDialogClose(false)}
        title={editingCategory ? '카테고리 수정' : '카테고리 추가'}
        size={540}
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
            onChange={(e) => handleFormChange('categoryName', e.target.value)}
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
                handleFormChange('iconUrl', url ?? '');
                setUploadedIconUrl(url ?? '');
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
            onChange={(e) => handleFormChange('note', e.target.value)}
            placeholder="카테고리에 대한 간단한 소개를 입력하세요."
            rows={3}
          />

          {/* 표시 순서 */}
          <TextInput
            id="orderIndex"
            label="표시 순서 *"
            type="number"
            value={form.orderIndex}
            onChange={(e) => handleOrderIndexChange(parseInt(e.target.value) || 0)}
            placeholder="1"
            error={orderIndexError}
          />

          {/* 활성화 */}
          <Checkbox
            id="isActive"
            label="활성화"
            checked={form.isActive}
            onChange={(e) => handleFormChange('isActive', e.currentTarget.checked)}
          />
        </Stack>

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => handleDialogClose(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!!orderIndexError}>
            {editingCategory ? '수정' : '생성'}
          </Button>
        </Group>
      </Modal>

      {/* 서브카테고리 수정 다이얼로그 */}
      <Modal
        opened={isSubDialogOpen}
        onClose={() => {
          setEditingSubCategory(null);
          setIsSubDialogOpen(false);
        }}
        title={editingSubCategory ? '서브카테고리 수정' : '서브카테고리 추가'}
        size={400}
        closeOnClickOutside={!subSaving}
        closeOnEscape={!subSaving}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {editingSubCategory ? '서브카테고리 정보를 수정합니다.' : `${selectedCategory?.categoryName}에 서브카테고리를 추가합니다.`}
          </Text>
          <TextInput
            id="subCategoryName"
            label="서브카테고리 이름 *"
            value={subForm.subCategoryName}
            onChange={(e) => setSubForm((prev) => ({ ...prev, subCategoryName: e.target.value }))}
            placeholder="서브카테고리 이름"
          />
          <Checkbox
            id="subIsActive"
            label="활성화"
            checked={subForm.isActive}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setSubForm((prev) => ({ ...prev, isActive: checked }));
            }}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setIsSubDialogOpen(false)} disabled={subSaving}>
            취소
          </Button>
          <Button onClick={handleSubSave} disabled={subSaving}>
            {subSaving ? '저장 중...' : editingSubCategory ? '수정' : '추가'}
          </Button>
        </Group>
      </Modal>

      {/* 서브카테고리 삭제 확인 다이얼로그 */}
      <Modal opened={deleteSubDialog} onClose={() => setDeleteSubDialog(false)} title="서브카테고리 삭제" closeOnClickOutside={!subDeleting} closeOnEscape={!subDeleting}>
        <Text size="sm" c="dimmed">
          정말로 <Text span fw={700} inherit>{deletingSubCategory?.subCategoryName}</Text> 서브카테고리를
          삭제하시겠습니까?
          <br />이 작업은 되돌릴 수 없습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteSubDialog(false)} disabled={subDeleting}>
            취소
          </Button>
          <Button color="red" onClick={handleSubDeleteConfirm} disabled={subDeleting}>
            {subDeleting ? '삭제 중...' : '삭제'}
          </Button>
        </Group>
      </Modal>

      {/* 삭제 확인 다이얼로그 */}
      <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title="카테고리 삭제" closeOnClickOutside={!categoryDeleting} closeOnEscape={!categoryDeleting}>
        <Text size="sm" c="dimmed">
          정말로 <Text span fw={700} inherit>{deletingCategory?.categoryName}</Text> 카테고리를
          삭제하시겠습니까?
          <br />이 작업은 되돌릴 수 없습니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteDialog(false)} disabled={categoryDeleting}>
            취소
          </Button>
          <Button color="red" onClick={handleDeleteConfirm} disabled={categoryDeleting}>
            {categoryDeleting ? '삭제 중...' : '삭제'}
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
