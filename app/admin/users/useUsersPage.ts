import { createClient } from '@/lib/supabase/client';
import { useAuthUser } from '@/components/auth-user-context';
import { ITEMS_PER_PAGE } from './constants';
import type { UseUsersPageReturn } from './types';
import { useImagePreview } from './hooks/useImagePreview';
import { useHideOpenDoorColumn } from './hooks/useHideOpenDoorColumn';
import { useUsersFilters } from './hooks/useUsersFilters';
import { useFilterOptions } from './hooks/useFilterOptions';
import { useUsersFetch } from './hooks/useUsersFetch';
import { useApprovalStatus } from './hooks/useApprovalStatus';
import { useSuspendDialog } from './hooks/useSuspendDialog';
import { useDetailDialog } from './hooks/useDetailDialog';
import { useUsersExport } from './hooks/useUsersExport';

export function useUsersPage(): UseUsersPageReturn {
  // createBrowserClient는 브라우저에서 싱글턴이라 매 렌더 같은 참조 (기존과 동일하게 본문에서 호출)
  const supabase = createClient();
  // AuthGuard가 한 번 확인한 로그인 사용자 — 역할/ID를 다시 조회하지 않고 여기서 읽는다
  const { id: authUserId, roles: authRoles } = useAuthUser();
  const isManager = authRoles.includes('MANAGER');

  // 훅 순서 = 기존 effect 순서 (ESC → localStorage → 검색어 초기화 → 아파트 → 동 → 회원 목록)
  const imagePreview = useImagePreview();
  useHideOpenDoorColumn();
  const filters = useUsersFilters();
  const options = useFilterOptions({
    supabase,
    isManager,
    authUserId,
    selectedApartment: filters.selectedApartment,
  });

  // 선택된 동의 동 번호 (buildings 배열 자체를 deps에 넣으면 참조만 바뀌어도 fetch가 다시 돌아서 숫자만 뽑아 쓴다)
  const selectedBuildingNumber = options.buildings.find(b => b.id === filters.selectedBuilding)?.buildingNumber;

  const list = useUsersFetch({
    supabase,
    isManager,
    authUserId,
    searchQuery: filters.searchQuery,
    currentPage: filters.currentPage,
    selectedApartment: filters.selectedApartment,
    selectedBuilding: filters.selectedBuilding,
    selectedBuildingNumber,
    selectedRegistrationType: filters.selectedRegistrationType,
  });

  const approval = useApprovalStatus({ fetchUsers: list.fetchUsers });
  const suspend = useSuspendDialog({ fetchUsers: list.fetchUsers });
  const detail = useDetailDialog({ supabase, fetchUsers: list.fetchUsers });
  const exportCsv = useUsersExport({ supabase, isManager, authUserId });

  const totalPages = Math.ceil(list.totalCount / ITEMS_PER_PAGE);

  return {
    filters,
    options,
    list,
    imagePreview,
    approval,
    suspend,
    detail,
    exportCsv,
    totalPages,
  };
}
