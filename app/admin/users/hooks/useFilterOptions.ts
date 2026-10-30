import { useCallback, useEffect, useState } from 'react';
import type { Apartment, Building, UseFilterOptionsDeps, UseFilterOptionsReturn } from '../types';

/** 필터 선택지 — 아파트 목록, 선택된 아파트의 동 목록 */
export function useFilterOptions({
  supabase,
  isManager,
  authUserId,
  selectedApartment,
}: UseFilterOptionsDeps): UseFilterOptionsReturn {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);

  // 아파트 목록 로드
  const fetchApartments = useCallback(async (): Promise<void> => {
    try {
      let query = supabase
        .from('apartments')
        .select('id, name')
        .order('name');

      // 매니저인 경우 자신이 관리하는 아파트만 필터링 (역할은 AuthGuard가 확인한 값을 사용)
      if (isManager) {
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', authUserId);

        if (managerApartments && managerApartments.length > 0) {
          const apartmentIds = managerApartments.map(ma => ma.apartmentId);
          query = query.in('id', apartmentIds);
        } else {
          // 관리하는 아파트가 없으면 빈 결과
          setApartments([]);
          return;
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setApartments(data || []);
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
    }
  }, [supabase, isManager, authUserId]);

  // 선택된 아파트의 동 목록 로드
  const fetchBuildings = useCallback(async (): Promise<void> => {
    if (!selectedApartment) {
      setBuildings([]);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('apartment_buildings')
        .select('id, buildingNumber')
        .eq('apartmentId', selectedApartment)
        .order('buildingNumber');

      if (fetchError) throw fetchError;
      setBuildings(data || []);
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
      setBuildings([]);
    }
  }, [selectedApartment, supabase]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  return { apartments, buildings };
}
