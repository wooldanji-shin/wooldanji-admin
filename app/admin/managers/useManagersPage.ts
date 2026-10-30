import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthUser } from '@/components/auth-user-context';
import { useManagersFetch } from './hooks/useManagersFetch';
import { useManagerActions } from './hooks/useManagerActions';
import { useSuspendDialog } from './hooks/useSuspendDialog';
import { useDeleteDialog } from './hooks/useDeleteDialog';
import { useScopeDialog } from './hooks/useScopeDialog';
import { useDetailDialog } from './hooks/useDetailDialog';
import type { Manager, UseManagersPageReturn } from './types';

export function useManagersPage(): UseManagersPageReturn {
  const supabase = createClient();
  // AuthGuard가 한 번 확인한 권한 — 목록·아파트 조회마다 user_roles를 다시 조회하지 않는다
  const authUser = useAuthUser();

  // 입력창 값(바로 반영)과 서버 검색어(500ms 디바운스)를 분리 — 타이핑마다 목록을 다시 조회하지 않는다
  const [searchInput, setSearchInputState] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout>(null);

  const setSearchInput = useCallback((value: string): void => {
    setSearchInputState(value);

    // 이전 타이머 취소
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 디바운스 적용 (500ms)
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(value);
    }, 500);
  }, []);

  // 언마운트시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);
  // 필터용 상태
  const [filterApartment, setFilterApartment] = useState<string>('all');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Compose sub-hooks (later hooks depend on fetchManagers)
  const fetchHook = useManagersFetch({ supabase, roles: authUser.roles, searchQuery });
  const { fetchManagers } = fetchHook;
  const actions = useManagerActions({ fetchManagers });
  const suspend = useSuspendDialog({ fetchManagers });
  const remove = useDeleteDialog({ fetchManagers });
  const scope = useScopeDialog({ supabase, fetchManagers });
  const detail = useDetailDialog({ supabase, fetchManagers });

  // 다이얼로그 입력 때마다 새 배열이 생기지 않도록 memo — 표(React.memo)가 다시 그려지지 않는다
  // 화면 필터는 입력값을 바로 써서 타이핑 중에도 결과가 즉시 좁혀진다
  const filteredManagers = useMemo<Manager[]>(() => fetchHook.managers.filter((manager) => {
    // 검색 필터
    const matchesSearch =
      manager.name?.toLowerCase().includes(searchInput.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchInput.toLowerCase()) ||
      manager.phoneNumber?.includes(searchInput);

    // 아파트 필터
    const matchesApartment =
      filterApartment === 'all' ||
      manager.admin_scopes?.some(scope => scope.apartmentId === filterApartment);

    return matchesSearch && matchesApartment;
  }), [fetchHook.managers, searchInput, filterApartment]);

  return {
    fetch: fetchHook,
    actions,
    suspend,
    remove,
    scope,
    detail,
    filteredManagers,
    searchInput,
    setSearchInput,
    filterApartment,
    setFilterApartment,
    imagePreview,
    setImagePreview,
  };
}
