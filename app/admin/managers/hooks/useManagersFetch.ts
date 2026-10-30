import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { getSessionUser } from '@/lib/auth';
import type {
  Apartment,
  Manager,
  UseManagersFetchDeps,
  UseManagersFetchReturn,
} from '../types';

/** 관리자 목록 + 아파트 목록 조회 (관리자 목록은 디바운스된 검색어로 조회, 아파트 목록은 처음 한 번만 조회) */
export function useManagersFetch({ supabase, roles, searchQuery }: UseManagersFetchDeps): UseManagersFetchReturn {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState<Apartment[]>([]);

  // 관리자 목록 조회
  const fetchManagers = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      // 현재 사용자 역할 확인
      const isManager = roles.includes('MANAGER');

      let managerApartmentIds: string[] = [];

      // MANAGER인 경우 자신이 관리하는 아파트 ID 가져오기
      if (isManager) {
        const { data: { user } } = await getSessionUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            managerApartmentIds = managerApartments.map((ma: any) => ma.apartmentId);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setManagers([]);
            setLoading(false);
            return;
          }
        }
      }

      let query = supabase
        .from('user')
        .select(`
          *,
          user_roles!inner(role),
          admin_scopes(
            id,
            scopeLevel,
            apartmentId,
            buildingId,
            lineId,
            apartments:apartmentId(id, name, address),
            apartment_buildings:buildingId(id, buildingNumber),
            apartment_lines:lineId(id, line)
          )
        `)
        .eq('user_roles.role', 'APT_ADMIN')
        .order('createdAt', { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // MANAGER인 경우 자신이 관리하는 아파트의 관리자들만 필터링
      let filteredData = data || [];
      if (isManager && managerApartmentIds.length > 0) {
        filteredData = filteredData.filter(manager => {
          // admin_scopes 중 하나라도 관리하는 아파트에 속하면 포함
          return manager.admin_scopes?.some(scope =>
            scope.apartmentId && managerApartmentIds.includes(scope.apartmentId)
          );
        });
      }

      setManagers(filteredData);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
      toast.error('관리자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, supabase, roles]);

  // 아파트 목록 조회 (처음 한 번)
  const fetchApartments = async (): Promise<void> => {
    try {
      const isManager = roles.includes('MANAGER');

      let query = supabase
        .from('apartments')
        .select('*')
        .order('name');

      // MANAGER인 경우 자신이 관리하는 아파트만 조회
      if (isManager) {
        const { data: { user } } = await getSessionUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            const apartmentIds = managerApartments.map((ma: any) => ma.apartmentId);
            query = query.in('id', apartmentIds);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setApartments([]);
            return;
          }
        }
      }

      const { data } = await query;
      setApartments(data || []);
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
      setApartments([]);
    }
  };

  // 검색어(디바운스됨)가 바뀌면 관리자 목록만 다시 조회
  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  // 아파트 목록은 검색과 무관 — 마운트 시 한 번만 조회
  useEffect(() => {
    fetchApartments();
  }, []);

  return useMemo<UseManagersFetchReturn>(
    () => ({ managers, loading, apartments, fetchManagers }),
    [managers, loading, apartments, fetchManagers],
  );
}
