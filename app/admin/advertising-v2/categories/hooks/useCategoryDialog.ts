import { useReducer, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type {
  AdCategoryV2,
  CategoryDialogState,
  CategoryForm,
  SupabaseClient,
  UseCategoryDialogReturn,
} from '../types';

// 폼 초기값
const _INITIAL_FORM: CategoryForm = {
  categoryName: '',
  iconUrl: '',
  note: '',
  isActive: true,
  orderIndex: 1,
};

const _INITIAL_STATE: CategoryDialogState = {
  isOpen: false,
  editingCategory: null,
  uploadedIconUrl: '',
  form: _INITIAL_FORM,
  orderIndexError: null,
  saving: false,
};

type CategoryDialogAction =
  | { type: 'SET_OPEN'; open: boolean }
  | { type: 'SET_FIELD'; field: keyof CategoryForm; value: string | number | boolean }
  | { type: 'SET_ORDER_INDEX_ERROR'; error: string | null }
  | { type: 'SET_UPLOADED_ICON_URL'; url: string }
  | { type: 'START_EDIT'; category: AdCategoryV2 }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'RESET'; orderIndex: number };

function categoryDialogReducer(
  state: CategoryDialogState,
  action: CategoryDialogAction
): CategoryDialogState {
  switch (action.type) {
    case 'SET_OPEN':
      return { ...state, isOpen: action.open };
    case 'SET_FIELD':
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case 'SET_ORDER_INDEX_ERROR':
      return { ...state, orderIndexError: action.error };
    case 'SET_UPLOADED_ICON_URL':
      return { ...state, uploadedIconUrl: action.url };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    // 수정 시작 (orderIndexError는 건드리지 않음 — 기존 동작 그대로)
    case 'START_EDIT':
      return {
        ...state,
        editingCategory: action.category,
        uploadedIconUrl: '',
        form: {
          categoryName: action.category.categoryName,
          iconUrl: action.category.iconUrl ?? '',
          note: action.category.note ?? '',
          isActive: action.category.isActive,
          orderIndex: action.category.orderIndex,
        },
        isOpen: true,
      };
    // 폼 초기화 (열림 상태는 그대로)
    case 'RESET':
      return {
        ...state,
        editingCategory: null,
        uploadedIconUrl: '',
        orderIndexError: null,
        form: { ..._INITIAL_FORM, orderIndex: action.orderIndex },
      };
    default:
      return state;
  }
}

interface UseCategoryDialogDeps {
  supabase: SupabaseClient;
  categories: AdCategoryV2[];
  fetchCategories: () => Promise<void>;
}

export function useCategoryDialog({
  supabase,
  categories,
  fetchCategories,
}: UseCategoryDialogDeps): UseCategoryDialogReturn {
  const [state, dispatch] = useReducer(categoryDialogReducer, _INITIAL_STATE);
  const { form, editingCategory, uploadedIconUrl } = state;
  // 더블클릭 등으로 리렌더 전에 handleSave가 다시 호출되는 경우까지 막기 위한 동기 가드
  const savingRef = useRef<boolean>(false);

  // orderIndex 중복 체크 (자기 자신 제외)
  const checkOrderIndexDuplicate = useCallback((orderIndex: number, excludeId?: string): boolean => {
    return categories.some(
      (c) => c.orderIndex === orderIndex && c.id !== excludeId
    );
  }, [categories]);

  // 폼 필드 변경 헬퍼
  const handleFormChange = useCallback((field: keyof CategoryForm, value: string | number | boolean): void => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const setUploadedIconUrl = useCallback((url: string): void => {
    dispatch({ type: 'SET_UPLOADED_ICON_URL', url });
  }, []);

  // orderIndex 변경 + 중복 검증
  const handleOrderIndexChange = useCallback((value: number): void => {
    handleFormChange('orderIndex', value);
    if (checkOrderIndexDuplicate(value, editingCategory?.id)) {
      dispatch({ type: 'SET_ORDER_INDEX_ERROR', error: '순서가 중복됩니다' });
    } else {
      dispatch({ type: 'SET_ORDER_INDEX_ERROR', error: null });
    }
  }, [handleFormChange, checkOrderIndexDuplicate, editingCategory]);

  // 폼 초기화
  const resetForm = useCallback((): void => {
    dispatch({ type: 'RESET', orderIndex: categories.length + 1 });
  }, [categories]);

  // 추가 버튼 — 폼 초기화 후 열기
  const openDialog = useCallback((): void => {
    resetForm();
    dispatch({ type: 'SET_OPEN', open: true });
  }, [resetForm]);

  // 저장 (생성/수정)
  const handleSave = useCallback(async (): Promise<void> => {
    // 저장 진행 중이면 무시 (중복 생성 방지)
    if (savingRef.current) return;
    if (!form.categoryName.trim()) {
      toast.error('카테고리 이름을 입력해주세요.');
      return;
    }
    if (checkOrderIndexDuplicate(form.orderIndex, editingCategory?.id)) {
      dispatch({ type: 'SET_ORDER_INDEX_ERROR', error: '순서가 중복됩니다' });
      return;
    }
    dispatch({ type: 'SET_ORDER_INDEX_ERROR', error: null });

    savingRef.current = true;
    dispatch({ type: 'SET_SAVING', saving: true });
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

      dispatch({ type: 'SET_UPLOADED_ICON_URL', url: '' });
      dispatch({ type: 'SET_OPEN', open: false });
      resetForm();
      fetchCategories();
    } catch (err: any) {
      console.error('카테고리 저장 실패:', err);
      toast.error(err.message || '카테고리 저장에 실패했습니다.');
    } finally {
      // 성공/실패 모두 저장 중 상태 해제
      savingRef.current = false;
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  }, [form, editingCategory, checkOrderIndexDuplicate, supabase, resetForm, fetchCategories]);

  // 수정 시작
  const handleEditClick = useCallback((category: AdCategoryV2): void => {
    dispatch({ type: 'START_EDIT', category });
  }, []);

  // 다이얼로그 닫기 — 업로드만 하고 저장 안 한 이미지 정리
  const handleDialogClose = useCallback(async (open: boolean): Promise<void> => {
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
    dispatch({ type: 'SET_OPEN', open });
  }, [uploadedIconUrl, editingCategory, supabase, resetForm]);

  return {
    state,
    handleFormChange,
    handleOrderIndexChange,
    setUploadedIconUrl,
    handleSave,
    handleEditClick,
    resetForm,
    openDialog,
    handleDialogClose,
  };
}
