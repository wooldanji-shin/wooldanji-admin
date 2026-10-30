import type React from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { createClient } from '@/lib/supabase/client';
import type { LookupName } from '@/lib/hooks/useLookups';

export type SupabaseClient = ReturnType<typeof createClient>;
export type InvalidateLookup = (name: LookupName) => void;

// --------------- Domain ---------------

export interface AdCategoryV2 {
  id: string;
  categoryName: string;
  iconUrl: string | null;
  note: string | null;
  isActive: boolean;
  orderIndex: number;
  basicAdCount: number;
  premiumAdCount: number;
}

export interface AdSubCategoryV2 {
  id: string;
  categoryId: string;
  subCategoryName: string;
  isActive: boolean;
  orderIndex: number;
}

export interface CategoryForm {
  categoryName: string;
  iconUrl: string;
  note: string;
  isActive: boolean;
  orderIndex: number;
}

export interface SubCategoryForm {
  subCategoryName: string;
  isActive: boolean;
}

// --------------- Reducer state ---------------

// 카테고리 생성/수정 다이얼로그 — 열림/수정 대상/폼/업로드 아이콘/순서 오류/저장 중 상태가 함께 바뀐다
export interface CategoryDialogState {
  isOpen: boolean;
  editingCategory: AdCategoryV2 | null;
  uploadedIconUrl: string;
  form: CategoryForm;
  orderIndexError: string | null;
  // 저장(생성/수정) 요청 진행 중 — 중복 저장 방지 + 닫기 차단
  saving: boolean;
}

// 서브카테고리 생성/수정 다이얼로그 — 열림/수정 대상/폼/저장 중 상태가 함께 바뀐다
export interface SubCategoryDialogState {
  isOpen: boolean;
  editingSubCategory: AdSubCategoryV2 | null;
  form: SubCategoryForm;
  saving: boolean;
}

// 삭제 확인 다이얼로그 — 열림/삭제 대상/처리 중 상태가 함께 바뀐다
export interface DeleteDialogState<T> {
  opened: boolean;
  target: T | null;
  processing: boolean;
}

// --------------- Hook returns ---------------

export interface UseCategoriesFetchReturn {
  categories: AdCategoryV2[];
  setCategories: React.Dispatch<React.SetStateAction<AdCategoryV2[]>>;
  loading: boolean;
  fetchCategories: () => Promise<void>;
}

export interface UseSubCategoriesFetchReturn {
  selectedCategory: AdCategoryV2 | null;
  setSelectedCategory: React.Dispatch<React.SetStateAction<AdCategoryV2 | null>>;
  subCategories: AdSubCategoryV2[];
  setSubCategories: React.Dispatch<React.SetStateAction<AdSubCategoryV2[]>>;
  subLoading: boolean;
  fetchSubCategories: (categoryId: string) => Promise<void>;
  handleCategorySelect: (category: AdCategoryV2) => void;
}

export interface UseCategoryDialogReturn {
  state: CategoryDialogState;
  handleFormChange: (field: keyof CategoryForm, value: string | number | boolean) => void;
  handleOrderIndexChange: (value: number) => void;
  setUploadedIconUrl: (url: string) => void;
  handleSave: () => Promise<void>;
  handleEditClick: (category: AdCategoryV2) => void;
  resetForm: () => void;
  openDialog: () => void;
  handleDialogClose: (open: boolean) => Promise<void>;
}

export interface UseCategoryDeleteReturn {
  state: DeleteDialogState<AdCategoryV2>;
  handleDeleteClick: (category: AdCategoryV2) => void;
  handleDeleteConfirm: () => Promise<void>;
  closeDeleteDialog: () => void;
}

export interface UseSubCategoryDialogReturn {
  state: SubCategoryDialogState;
  handleAddSubClick: (category: AdCategoryV2) => void;
  handleSubEditClick: (sub: AdSubCategoryV2) => void;
  handleSubSave: () => Promise<void>;
  setSubCategoryName: (name: string) => void;
  setSubIsActive: (isActive: boolean) => void;
  // 모달 onClose(X/ESC/바깥 클릭) — 수정 대상까지 비운다
  dismissSubDialog: () => void;
  // 취소 버튼 — 열림만 닫는다
  closeSubDialog: () => void;
}

export interface UseSubCategoryDeleteReturn {
  state: DeleteDialogState<AdSubCategoryV2>;
  handleSubDeleteClick: (sub: AdSubCategoryV2) => void;
  handleSubDeleteConfirm: () => Promise<void>;
  closeSubDeleteDialog: () => void;
}

export interface UseCategoryReorderReturn {
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  handleSubDragEnd: (event: DragEndEvent) => Promise<void>;
}

export interface UseCategoriesPageReturn {
  fetch: UseCategoriesFetchReturn;
  sub: UseSubCategoriesFetchReturn;
  categoryDialog: UseCategoryDialogReturn;
  categoryDelete: UseCategoryDeleteReturn;
  subDialog: UseSubCategoryDialogReturn;
  subDelete: UseSubCategoryDeleteReturn;
  reorder: UseCategoryReorderReturn;
}
