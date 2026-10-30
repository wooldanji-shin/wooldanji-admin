import type { Dispatch, SetStateAction } from 'react';
import type { createClient } from '@/lib/supabase/client';
import type { UserFullDetails } from '@/lib/supabase/types';

// --------------- Supabase Client ---------------

export type SupabaseClient = ReturnType<typeof createClient>;

// --------------- Domain Models ---------------

export type Apartment = {
  id: string;
  name: string;
};

export type Building = {
  id: string;
  buildingNumber: number;
};

// 전체보기/수정 폼 (기존과 같은 느슨한 형태 유지)
export type EditForm = Record<string, any>;

export type ApprovalStatusAction = 'approve' | 'pending';

// --------------- useImagePreview ---------------

export interface UseImagePreviewReturn {
  imagePreview: string | null;
  setImagePreview: Dispatch<SetStateAction<string | null>>;
  closeImagePreview: () => void;
}

// --------------- useUsersFilters ---------------

export interface UseUsersFiltersReturn {
  searchInput: string;
  searchQuery: string;
  currentPage: number;
  selectedApartment: string;
  selectedBuilding: string;
  selectedRegistrationType: string;
  handleSearch: (value: string) => void;
  handlePageChange: (newPage: number) => void;
  handleApartmentChange: (value: string) => void;
  handleBuildingChange: (value: string) => void;
  handleRegistrationTypeChange: (value: string) => void;
}

// --------------- useFilterOptions ---------------

export interface UseFilterOptionsDeps {
  supabase: SupabaseClient;
  isManager: boolean;
  authUserId: string;
  selectedApartment: string;
}

export interface UseFilterOptionsReturn {
  apartments: Apartment[];
  buildings: Building[];
}

// --------------- useUsersFetch ---------------

export interface UseUsersFetchDeps {
  supabase: SupabaseClient;
  isManager: boolean;
  authUserId: string;
  // 모두 원시값으로 받는다 (객체를 넘기면 매 렌더 fetchUsers가 새로 만들어져 요청이 반복됨)
  searchQuery: string;
  currentPage: number;
  selectedApartment: string;
  selectedBuilding: string;
  selectedBuildingNumber: number | undefined;
  selectedRegistrationType: string;
}

export interface UseUsersFetchReturn {
  users: UserFullDetails[];
  partnerUserIds: Set<string>;
  loading: boolean;
  initialLoading: boolean;
  totalCount: number;
  fetchUsers: () => Promise<void>;
}

// --------------- useApprovalStatus ---------------

export interface UseApprovalStatusDeps {
  fetchUsers: () => Promise<void>;
}

export interface UseApprovalStatusReturn {
  // 승인/승인 취소 요청이 진행 중인 회원 id
  processingUserIds: ReadonlySet<string>;
  handleApprovalStatusChange: (userId: string, status: ApprovalStatusAction) => Promise<void>;
}

// --------------- useSuspendDialog ---------------

export interface SuspendDialogState {
  opened: boolean;
  user: UserFullDetails | null;
  reason: string;
  // 보류 요청(PUT) 진행 중 — 이동안은 닫기·재요청을 막는다
  processing: boolean;
}

export type SuspendDialogAction =
  | { type: 'open'; user: UserFullDetails }
  | { type: 'close' }
  | { type: 'setReason'; reason: string }
  | { type: 'processingStart' }
  | { type: 'processingEnd' }
  | { type: 'reset' };

export interface UseSuspendDialogDeps {
  fetchUsers: () => Promise<void>;
}

export interface UseSuspendDialogReturn {
  opened: boolean;
  suspendingUser: UserFullDetails | null;
  suspensionReason: string;
  processing: boolean;
  handleSuspendClick: (user: UserFullDetails) => void;
  setSuspensionReason: (reason: string) => void;
  close: () => void;
  handleSuspendConfirm: () => Promise<void>;
}

// --------------- useDetailDialog ---------------

export interface DetailDialogState {
  opened: boolean;
  user: UserFullDetails | null;
  editForm: EditForm;
}

export type DetailDialogAction =
  | { type: 'open'; user: UserFullDetails; editForm: EditForm }
  | { type: 'close' }
  | { type: 'setField'; field: string; value: string }
  | { type: 'saved' };

export interface UseDetailDialogDeps {
  supabase: SupabaseClient;
  fetchUsers: () => Promise<void>;
}

export interface UseDetailDialogReturn {
  opened: boolean;
  detailUser: UserFullDetails | null;
  editForm: EditForm;
  saving: boolean;
  handleDetailClick: (user: UserFullDetails) => void;
  setField: (field: string, value: string) => void;
  close: () => void;
  handleDetailSave: () => Promise<void>;
}

// --------------- useUsersExport ---------------

export interface UseUsersExportDeps {
  supabase: SupabaseClient;
  isManager: boolean;
  authUserId: string;
}

export interface UseUsersExportReturn {
  exporting: boolean;
  handleExportCSV: () => Promise<void>;
}

// --------------- useUsersPage ---------------

export interface UseUsersPageReturn {
  filters: UseUsersFiltersReturn;
  options: UseFilterOptionsReturn;
  list: UseUsersFetchReturn;
  imagePreview: UseImagePreviewReturn;
  approval: UseApprovalStatusReturn;
  suspend: UseSuspendDialogReturn;
  detail: UseDetailDialogReturn;
  exportCsv: UseUsersExportReturn;
  totalPages: number;
}
