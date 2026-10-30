import type { createClient } from '@/lib/supabase/client';

// --------------- Supabase Client ---------------

export type SupabaseClient = ReturnType<typeof createClient>;

// --------------- Domain Models ---------------

export interface Manager {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  approvalStatus: 'pending' | 'approve' | null;
  createdAt: string;
  confirmImageUrl?: string;
  registerMethod?: string | null;
  openDoorCount?: number;
  birthDay?: string;
  address?: string;
  regionSido?: string;
  regionSigungu?: string;
  regionDong?: string;
  user_roles?: { role: string }[];
  admin_scopes?: AdminScope[];
}

export type ScopeLevel = 'APARTMENT' | 'BUILDING' | 'LINE';

export interface AdminScope {
  id: string;
  scopeLevel: ScopeLevel;
  apartmentId: string | null;
  buildingId: string | null;
  lineId: string | null;
  apartments?: { id: string; name: string; address: string };
  apartment_buildings?: { id: string; buildingNumber: number };
  apartment_lines?: { id: string; line: number[] };
}

export interface Apartment {
  id: string;
  name: string;
  address: string;
}

export interface Building {
  id: string;
  buildingNumber: number;
  apartmentId: string;
}

export interface Line {
  id: string;
  line: number[];
  buildingId: string;
}

export type ApprovalStatus = 'approve' | 'pending';

/** 상세 다이얼로그 편집 폼 (기존과 동일하게 느슨한 타입 유지) */
export type EditForm = Record<string, any>;

// --------------- Hook Deps ---------------

export interface UseManagersFetchDeps {
  supabase: SupabaseClient;
  /** AuthGuard가 한 번 확인한 권한 (useAuthUser().roles) */
  roles: string[];
  searchQuery: string;
}

export interface UseManagerActionsDeps {
  fetchManagers: () => Promise<void>;
}

export interface UseSuspendDialogDeps {
  fetchManagers: () => Promise<void>;
}

export interface UseDeleteDialogDeps {
  fetchManagers: () => Promise<void>;
}

export interface UseScopeDialogDeps {
  supabase: SupabaseClient;
  fetchManagers: () => Promise<void>;
}

export interface UseDetailDialogDeps {
  supabase: SupabaseClient;
  fetchManagers: () => Promise<void>;
}

// --------------- Hook Returns ---------------

export interface UseManagersFetchReturn {
  managers: Manager[];
  loading: boolean;
  apartments: Apartment[];
  fetchManagers: () => Promise<void>;
}

export interface UseManagerActionsReturn {
  handleApprovalStatusChange: (userId: string, status: ApprovalStatus) => Promise<void>;
  /** 승인 상태 변경 요청이 진행 중인 관리자 id 목록 (중복 실행 방지) */
  processingUserIds: string[];
}

export interface UseSuspendDialogReturn {
  opened: boolean;
  manager: Manager | null;
  reason: string;
  /** 보류 요청 진행 중 (버튼 비활성·닫기 막음) */
  processing: boolean;
  setReason: (reason: string) => void;
  open: (manager: Manager) => void;
  close: () => void;
  confirm: () => Promise<void>;
}

export interface UseDeleteDialogReturn {
  opened: boolean;
  manager: Manager | null;
  /** 삭제 요청 진행 중 (버튼 비활성·닫기 막음) */
  processing: boolean;
  open: (manager: Manager) => void;
  close: () => void;
  confirm: () => Promise<void>;
}

export interface UseScopeDialogReturn {
  opened: boolean;
  manager: Manager | null;
  scopeLevel: ScopeLevel;
  selectedApartment: string;
  selectedBuilding: string;
  selectedLine: string;
  buildings: Building[];
  lines: Line[];
  /** 저장 진행 중 (버튼 비활성·닫기 막음) */
  saving: boolean;
  setScopeLevel: (scopeLevel: ScopeLevel) => void;
  setSelectedApartment: (apartmentId: string) => void;
  setSelectedBuilding: (buildingId: string) => void;
  setSelectedLine: (lineId: string) => void;
  open: (manager: Manager) => void;
  close: () => void;
  save: () => Promise<void>;
}

export interface UseDetailDialogReturn {
  opened: boolean;
  manager: Manager | null;
  editForm: EditForm;
  saving: boolean;
  setField: (key: string, value: unknown) => void;
  open: (manager: Manager) => void;
  close: () => void;
  save: () => Promise<void>;
}

export interface UseManagersPageReturn {
  fetch: UseManagersFetchReturn;
  actions: UseManagerActionsReturn;
  suspend: UseSuspendDialogReturn;
  remove: UseDeleteDialogReturn;
  scope: UseScopeDialogReturn;
  detail: UseDetailDialogReturn;
  filteredManagers: Manager[];
  /** 검색 입력값 (바로 반영 — 화면 필터용) */
  searchInput: string;
  /** 입력 후 500ms 뒤 서버 검색어 반영 */
  setSearchInput: (value: string) => void;
  filterApartment: string;
  setFilterApartment: (value: string) => void;
  imagePreview: string | null;
  setImagePreview: (url: string | null) => void;
}
