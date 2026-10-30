import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  AdCategoryV2,
  AdSubCategoryV2,
  InvalidateLookup,
  SupabaseClient,
  UseSubCategoriesFetchReturn,
} from '../types';

interface UseSubCategoriesFetchDeps {
  supabase: SupabaseClient;
  invalidateLookup: InvalidateLookup;
}

// 펼친 카테고리(선택) + 그 서브카테고리 목록
export function useSubCategoriesFetch({
  supabase,
  invalidateLookup,
}: UseSubCategoriesFetchDeps): UseSubCategoriesFetchReturn {
  const [selectedCategory, setSelectedCategory] = useState<AdCategoryV2 | null>(null);
  const [subCategories, setSubCategories] = useState<AdSubCategoryV2[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // 서브카테고리 목록 조회
  const fetchSubCategories = useCallback(async (categoryId: string): Promise<void> => {
    invalidateLookup('adCategories');
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
  }, [supabase, invalidateLookup]);

  // 카테고리 행 클릭 → 같은 카테고리면 닫기, 다른 카테고리면 펼치기
  const handleCategorySelect = useCallback((category: AdCategoryV2): void => {
    if (selectedCategory?.id === category.id) {
      setSelectedCategory(null);
      setSubCategories([]);
    } else {
      setSelectedCategory(category);
      fetchSubCategories(category.id);
    }
  }, [fetchSubCategories, selectedCategory]);

  return {
    selectedCategory,
    setSelectedCategory,
    subCategories,
    setSubCategories,
    subLoading,
    fetchSubCategories,
    handleCategorySelect,
  };
}
