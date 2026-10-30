'use client';

import { createClient } from '@/lib/supabase/client';
import { useInvalidateLookup } from '@/lib/hooks/useLookups';
import { useCategoriesFetch } from './hooks/useCategoriesFetch';
import { useSubCategoriesFetch } from './hooks/useSubCategoriesFetch';
import { useCategoryDialog } from './hooks/useCategoryDialog';
import { useCategoryDelete } from './hooks/useCategoryDelete';
import { useSubCategoryDialog } from './hooks/useSubCategoryDialog';
import { useSubCategoryDelete } from './hooks/useSubCategoryDelete';
import { useCategoryReorder } from './hooks/useCategoryReorder';
import type { UseCategoriesPageReturn } from './types';

export function useCategoriesPage(): UseCategoriesPageReturn {
  const supabase = createClient();
  // 카테고리를 바꾸면 다른 화면의 카테고리 필터가 새 목록을 받도록 공용 캐시를 비운다
  const invalidateLookup = useInvalidateLookup();

  const fetchHook = useCategoriesFetch({ supabase, invalidateLookup });
  const subHook = useSubCategoriesFetch({ supabase, invalidateLookup });

  const categoryDialog = useCategoryDialog({
    supabase,
    categories: fetchHook.categories,
    fetchCategories: fetchHook.fetchCategories,
  });
  const categoryDelete = useCategoryDelete({
    supabase,
    fetchCategories: fetchHook.fetchCategories,
  });
  const subDialog = useSubCategoryDialog({
    supabase,
    selectedCategory: subHook.selectedCategory,
    setSelectedCategory: subHook.setSelectedCategory,
    subCategories: subHook.subCategories,
    fetchSubCategories: subHook.fetchSubCategories,
  });
  const subDelete = useSubCategoryDelete({
    supabase,
    selectedCategory: subHook.selectedCategory,
    fetchSubCategories: subHook.fetchSubCategories,
  });
  const reorder = useCategoryReorder({
    supabase,
    categories: fetchHook.categories,
    setCategories: fetchHook.setCategories,
    fetchCategories: fetchHook.fetchCategories,
    selectedCategory: subHook.selectedCategory,
    subCategories: subHook.subCategories,
    setSubCategories: subHook.setSubCategories,
    fetchSubCategories: subHook.fetchSubCategories,
  });

  return {
    fetch: fetchHook,
    sub: subHook,
    categoryDialog,
    categoryDelete,
    subDialog,
    subDelete,
    reorder,
  };
}
