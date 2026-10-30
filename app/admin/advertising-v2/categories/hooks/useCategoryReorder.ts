import type React from 'react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type {
  AdCategoryV2,
  AdSubCategoryV2,
  SupabaseClient,
  UseCategoryReorderReturn,
} from '../types';

interface UseCategoryReorderDeps {
  supabase: SupabaseClient;
  categories: AdCategoryV2[];
  setCategories: React.Dispatch<React.SetStateAction<AdCategoryV2[]>>;
  fetchCategories: () => Promise<void>;
  selectedCategory: AdCategoryV2 | null;
  subCategories: AdSubCategoryV2[];
  setSubCategories: React.Dispatch<React.SetStateAction<AdSubCategoryV2[]>>;
  fetchSubCategories: (categoryId: string) => Promise<void>;
}

// 카테고리 / 서브카테고리 드래그앤드랍 순서 변경
export function useCategoryReorder({
  supabase,
  categories,
  setCategories,
  fetchCategories,
  selectedCategory,
  subCategories,
  setSubCategories,
  fetchSubCategories,
}: UseCategoryReorderDeps): UseCategoryReorderReturn {
  // 드래그&드롭 순서 변경
  const handleDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
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
  }, [categories, setCategories, supabase, fetchCategories]);

  // 서브카테고리 드래그앤드랍 순서 변경
  const handleSubDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
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
  }, [subCategories, setSubCategories, supabase, selectedCategory, fetchSubCategories]);

  return { handleDragEnd, handleSubDragEnd };
}
