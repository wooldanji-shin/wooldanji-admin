import { useReducer, useCallback } from 'react';
import { toast } from 'sonner';
import { deleteFileFromStorage } from '@/lib/utils/storage';
import {
  createInitialDeleteDialogState,
  deleteDialogReducer,
} from './deleteDialogReducer';
import type {
  AdCategoryV2,
  DeleteDialogState,
  SupabaseClient,
  UseCategoryDeleteReturn,
} from '../types';

const _INITIAL_STATE: DeleteDialogState<AdCategoryV2> = createInitialDeleteDialogState<AdCategoryV2>();

interface UseCategoryDeleteDeps {
  supabase: SupabaseClient;
  fetchCategories: () => Promise<void>;
}

export function useCategoryDelete({
  supabase,
  fetchCategories,
}: UseCategoryDeleteDeps): UseCategoryDeleteReturn {
  const [state, dispatch] = useReducer(
    deleteDialogReducer<AdCategoryV2>,
    _INITIAL_STATE
  );
  const deletingCategory = state.target;

  // 삭제 확인 클릭
  const handleDeleteClick = useCallback((category: AdCategoryV2): void => {
    dispatch({ type: 'OPEN', target: category });
  }, []);

  const closeDeleteDialog = useCallback((): void => {
    dispatch({ type: 'CLOSE' });
  }, []);

  // 삭제 실행
  const handleDeleteConfirm = useCallback(async (): Promise<void> => {
    if (!deletingCategory) return;

    dispatch({ type: 'SET_PROCESSING', processing: true });
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
      dispatch({ type: 'DONE' });
      fetchCategories();
    } catch (err: any) {
      console.error('카테고리 삭제 실패:', err);
      toast.error(err.message || '카테고리 삭제에 실패했습니다.');
    } finally {
      dispatch({ type: 'SET_PROCESSING', processing: false });
    }
  }, [deletingCategory, supabase, fetchCategories]);

  return { state, handleDeleteClick, handleDeleteConfirm, closeDeleteDialog };
}
