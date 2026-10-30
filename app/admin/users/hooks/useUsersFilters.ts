import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UseUsersFiltersReturn } from '../types';

/** 검색어·필터·페이지 — URL search params와 동기화 */
export function useUsersFilters(): UseUsersFiltersReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout>(null);

  const searchQuery = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');
  const selectedApartment = searchParams.get('apartment') || '';
  const selectedBuilding = searchParams.get('building') || '';
  const selectedRegistrationType = searchParams.get('type') || '';

  // 초기 로드시 URL의 검색어를 input에 설정
  useEffect(() => {
    setSearchInput(searchQuery);
  }, []);

  // 마지막으로 알려진 URL params.
  // - URL이 바뀌면(필터 변경 반영, 뒤로/앞으로 가기) 그 값으로 맞춘다
  // - push 직후 URL이 아직 반영되기 전에도 다음 push가 방금 바꾼 값을 잃지 않도록 push할 때 바로 갱신한다
  // 디바운스된 검색 push가 입력 시점이 아닌 "실행 시점"의 params를 기준으로 URL을 만들게 하려는 용도
  const latestParamsRef = useRef<URLSearchParams>(new URLSearchParams(searchParams.toString()));

  useEffect(() => {
    latestParamsRef.current = new URLSearchParams(searchParams.toString());
  }, [searchParams]);

  // useCallback은 참조를 고정해 메모된 필터 카드/표가 다시 그려지지 않게 하는 용도
  const updateSearchParams = useCallback((params: Record<string, string>): void => {
    const current = new URLSearchParams(latestParamsRef.current.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });

    latestParamsRef.current = current;
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`/admin/users${query}`);
  }, [router]);

  const handleSearch = useCallback((value: string): void => {
    setSearchInput(value);

    // 이전 타이머 취소
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 디바운스 적용 (500ms)
    debounceTimer.current = setTimeout(() => {
      updateSearchParams({ search: value, page: '1' });
    }, 500);
  }, [updateSearchParams]);

  // 컴포넌트 언마운트시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handlePageChange = useCallback((newPage: number): void => {
    updateSearchParams({ page: newPage.toString() });
  }, [updateSearchParams]);

  const handleApartmentChange = useCallback((value: string): void => {
    const apartmentValue = value === 'all' ? '' : value;
    updateSearchParams({ apartment: apartmentValue, building: '', page: '1' });
  }, [updateSearchParams]);

  const handleBuildingChange = useCallback((value: string): void => {
    const buildingValue = value === 'all' ? '' : value;
    updateSearchParams({ building: buildingValue, page: '1' });
  }, [updateSearchParams]);

  const handleRegistrationTypeChange = useCallback((value: string): void => {
    const typeValue = value === 'all' ? '' : value;
    updateSearchParams({ type: typeValue, page: '1' });
  }, [updateSearchParams]);

  return {
    searchInput,
    searchQuery,
    currentPage,
    selectedApartment,
    selectedBuilding,
    selectedRegistrationType,
    handleSearch,
    handlePageChange,
    handleApartmentChange,
    handleBuildingChange,
    handleRegistrationTypeChange,
  };
}
