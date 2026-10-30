import { useReducer, useCallback } from 'react';
import { toast } from 'sonner';
import {
  createInitialDeleteDialogState,
  deleteDialogReducer,
} from './deleteDialogReducer';
import type {
  AdCategoryV2,
  AdSubCategoryV2,
  DeleteDialogState,
  SupabaseClient,
  UseSubCategoryDeleteReturn,
} from '../types';

const _INITIAL_STATE: DeleteDialogState<AdSubCategoryV2> = createInitialDeleteDialogState<AdSubCategoryV2>();

interface UseSubCategoryDeleteDeps {
  supabase: SupabaseClient;
  selectedCategory: AdCategoryV2 | null;
  fetchSubCategories: (categoryId: string) => Promise<void>;
}

export function useSubCategoryDelete({
  supabase,
  selectedCategory,
  fetchSubCategories,
}: UseSubCategoryDeleteDeps): UseSubCategoryDeleteReturn {
  const [state, dispatch] = useReducer(
    deleteDialogReducer<AdSubCategoryV2>,
    _INITIAL_STATE
  );
  const deletingSubCategory = state.target;

  // 서브카테고리 삭제 클릭
  const handleSubDeleteClick = useCallback((sub: AdSubCategoryV2): void => {
    dispatch({ type: 'OPEN', target: sub });
  }, []);

  const closeSubDeleteDialog = useCallback((): void => {
    dispatch({ type: 'CLOSE' });
  }, []);

  // 서브카테고리 삭제 실행
  const handleSubDeleteConfirm = useCallback(async (): Promise<void> => {
    if (!deletingSubCategory) return;
    dispatch({ type: 'SET_PROCESSING', processing: true });
    try {
      const { error } = await (supabase as any)
        .from('ad_sub_categories_v2')
        .delete()
        .eq('id', deletingSubCategory.id);
      if (error) throw error;
      toast.success('서브카테고리가 삭제되었습니다.');
      dispatch({ type: 'DONE' });
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
      dispatch({ type: 'SET_PROCESSING', processing: false });
    }
  }, [deletingSubCategory, supabase, selectedCategory, fetchSubCategories]);

  return { state, handleSubDeleteClick, handleSubDeleteConfirm, closeSubDeleteDialog };
}
