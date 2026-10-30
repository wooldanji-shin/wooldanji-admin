import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { UserFullDetails } from '@/lib/supabase/types';
import { ITEMS_PER_PAGE } from '../constants';
import type { UseUsersFetchDeps, UseUsersFetchReturn } from '../types';

/** 회원 목록 조회 (검색·필터·페이지네이션, 매니저 범위 제한) */
export function useUsersFetch({
  supabase,
  isManager,
  authUserId,
  searchQuery,
  currentPage,
  selectedApartment,
  selectedBuilding,
  selectedBuildingNumber,
  selectedRegistrationType,
}: UseUsersFetchDeps): UseUsersFetchReturn {
  const [users, setUsers] = useState<UserFullDetails[]>([]);
  const [partnerUserIds, setPartnerUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  // fetchUsers 안에서 읽는 용도 (state를 deps에 넣으면 첫 로딩 완료 시 fetch가 한 번 더 돌아서 ref로 미러링)
  const initialLoadingRef = useRef<boolean>(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchUsers = useCallback(async (): Promise<void> => {
    // 초기 로딩이 아닌 경우 로딩 표시 안 함 (검색이나 페이지네이션)
    if (initialLoadingRef.current) {
      setLoading(true);
    }

    try {
      // 파트너 userId 목록 조회 (user ↔ partner_users 간 FK 없어서 별도 조회)
      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('userId');
      const partnerIds = (partnerData || []).map((p: any) => p.userId);
      setPartnerUserIds(new Set(partnerIds));

      let query = supabase
        .from('user')
        .select(`
          *,
          user_roles!inner(id, role, createdAt),
          apartments:apartmentId(id, name, address)
        `, { count: 'exact' })
        .eq('user_roles.role', 'APP_USER'); // APP_USER만 필터링

      // 매니저인 경우 자신이 관리하는 아파트의 회원만 필터링 (역할은 AuthGuard가 확인한 값을 사용)
      if (isManager) {
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', authUserId);

        if (managerApartments && managerApartments.length > 0) {
          const apartmentIds = managerApartments.map(ma => ma.apartmentId);
          query = query.in('apartmentId', apartmentIds);
        } else {
          // 관리하는 아파트가 없으면 빈 결과
          setUsers([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      // 검색 필터링
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%`);
      }

      // 아파트 필터링
      if (selectedApartment) {
        query = query.eq('apartmentId', selectedApartment);
      }

      // 동 필터링
      if (selectedBuilding) {
        const buildingNum = selectedBuildingNumber;
        if (buildingNum) {
          query = query.eq('buildingNumber', buildingNum);
        }
      }

      // 회원유형 필터링
      if (selectedRegistrationType === 'PARTNER') {
        if (partnerIds.length > 0) {
          query = query.in('id', partnerIds);
        } else {
          setUsers([]);
          setTotalCount(0);
          setLoading(false);
          setInitialLoading(false);
          initialLoadingRef.current = false;
          return;
        }
      } else if (selectedRegistrationType) {
        query = query.eq('registrationType', selectedRegistrationType);
      }

      // 페이지네이션
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error: fetchError, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('회원 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
      initialLoadingRef.current = false;
    }
  }, [searchQuery, currentPage, selectedApartment, selectedBuilding, selectedBuildingNumber, selectedRegistrationType, supabase, isManager, authUserId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, partnerUserIds, loading, initialLoading, totalCount, fetchUsers };
}
