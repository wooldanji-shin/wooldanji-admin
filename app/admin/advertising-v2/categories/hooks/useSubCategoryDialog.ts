import type React from 'react';
import { useReducer, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  AdCategoryV2,
  AdSubCategoryV2,
  SubCategoryDialogState,
  SupabaseClient,
  UseSubCategoryDialogReturn,
} from '../types';

const _INITIAL_STATE: SubCategoryDialogState = {
  isOpen: false,
  editingSubCategory: null,
  form: { subCategoryName: '', isActive: true },
  saving: false,
};

type SubCategoryDialogAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN_EDIT'; sub: AdSubCategoryV2 }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_ACTIVE'; isActive: boolean }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'CLOSE' }
  | { type: 'DISMISS' };

function subCategoryDialogReducer(
  state: SubCategoryDialogState,
  action: SubCategoryDialogAction
): SubCategoryDialogState {
  switch (action.type) {
    // 추가: 수정 대상 비우기 + 빈 폼 + 열기
    case 'OPEN_CREATE':
      return {
        ...state,
        editingSubCategory: null,
        form: { subCategoryName: '', isActive: true },
        isOpen: true,
      };
    // 수정: 대상 지정 + 폼 채우기 + 열기
    case 'OPEN_EDIT':
      return {
        ...state,
        editingSubCategory: action.sub,
        form: { subCategoryName: action.sub.subCategoryName, isActive: action.sub.isActive },
        isOpen: true,
      };
    case 'SET_NAME':
      return { ...state, form: { ...state.form, subCategoryName: action.name } };
    case 'SET_ACTIVE':
      return { ...state, form: { ...state.form, isActive: action.isActive } };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    // 취소 버튼: 열림만 끈다
    case 'CLOSE':
      return { ...state, isOpen: false };
    // 모달 onClose / 저장 성공: 수정 대상 비우기 + 닫기
    case 'DISMISS':
      return { ...state, editingSubCategory: null, isOpen: false };
    default:
      return state;
  }
}

interface UseSubCategoryDialogDeps {
  supabase: SupabaseClient;
  selectedCategory: AdCategoryV2 | null;
  setSelectedCategory: React.Dispatch<React.SetStateAction<AdCategoryV2 | null>>;
  subCategories: AdSubCategoryV2[];
  fetchSubCategories: (categoryId: string) => Promise<void>;
}

export function useSubCategoryDialog({
  supabase,
  selectedCategory,
  setSelectedCategory,
  subCategories,
  fetchSubCategories,
}: UseSubCategoryDialogDeps): UseSubCategoryDialogReturn {
  const [state, dispatch] = useReducer(subCategoryDialogReducer, _INITIAL_STATE);
  const { form: subForm, editingSubCategory } = state;

  // 서브카테고리 추가 버튼 클릭
  const handleAddSubClick = useCallback((category: AdCategoryV2): void => {
    if (selectedCategory?.id !== category.id) {
      setSelectedCategory(category);
      fetchSubCategories(category.id);
    }
    dispatch({ type: 'OPEN_CREATE' });
  }, [selectedCategory, setSelectedCategory, fetchSubCategories]);

  // 서브카테고리 수정 시작
  const handleSubEditClick = useCallback((sub: AdSubCategoryV2): void => {
    dispatch({ type: 'OPEN_EDIT', sub });
  }, []);

  const setSubCategoryName = useCallback((name: string): void => {
    dispatch({ type: 'SET_NAME', name });
  }, []);

  const setSubIsActive = useCallback((isActive: boolean): void => {
    dispatch({ type: 'SET_ACTIVE', isActive });
  }, []);

  const dismissSubDialog = useCallback((): void => {
    dispatch({ type: 'DISMISS' });
  }, []);

  const closeSubDialog = useCallback((): void => {
    dispatch({ type: 'CLOSE' });
  }, []);

  // 서브카테고리 저장 (생성/수정)
  const handleSubSave = useCallback(async (): Promise<void> => {
    if (!subForm.subCategoryName.trim()) {
      toast.error('서브카테고리 이름을 입력해주세요.');
      return;
    }
    dispatch({ type: 'SET_SAVING', saving: true });
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
      dispatch({ type: 'DISMISS' });
      if (selectedCategory) fetchSubCategories(selectedCategory.id);
    } catch (err: any) {
      console.error('서브카테고리 저장 실패:', err);
      toast.error(err.message || '서브카테고리 저장에 실패했습니다.');
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  }, [subForm, editingSubCategory, subCategories, selectedCategory, supabase, fetchSubCategories]);

  return {
    state,
    handleAddSubClick,
    handleSubEditClick,
    handleSubSave,
    setSubCategoryName,
    setSubIsActive,
    dismissSubDialog,
    closeSubDialog,
  };
}
