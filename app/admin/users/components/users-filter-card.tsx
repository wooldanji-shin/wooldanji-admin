'use client';

import { memo } from 'react';
import type { ChangeEvent } from 'react';
import { Select, TextInput } from '@mantine/core';
import { Search } from 'lucide-react';
import { DataToolbar } from '@/components/data-toolbar';
import type { Apartment, Building } from '../types';

interface UsersFilterCardProps {
  searchInput: string;
  apartments: Apartment[];
  buildings: Building[];
  selectedApartment: string;
  selectedBuilding: string;
  selectedRegistrationType: string;
  onSearch: (value: string) => void;
  onApartmentChange: (value: string) => void;
  onBuildingChange: (value: string) => void;
  onRegistrationTypeChange: (value: string) => void;
}

/** 검색 + 아파트/동/회원유형 필터 (다이얼로그 입력 등 무관한 상태 변경에는 다시 그리지 않는다) */
export const UsersFilterCard = memo(function UsersFilterCard({
  searchInput,
  apartments,
  buildings,
  selectedApartment,
  selectedBuilding,
  selectedRegistrationType,
  onSearch,
  onApartmentChange,
  onBuildingChange,
  onRegistrationTypeChange,
}: UsersFilterCardProps): React.ReactElement {
  return (
    <DataToolbar>
      <TextInput
        placeholder='이름, 이메일, 전화번호로 검색...'
        value={searchInput}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
        leftSection={<Search size={16} />}
        w={{ base: '100%', lg: 300 }}
      />

      <Select
        placeholder='아파트 선택'
        data={[
          { value: 'all', label: '전체 아파트' },
          ...apartments.map((apartment) => ({ value: apartment.id, label: apartment.name })),
        ]}
        value={selectedApartment || 'all'}
        onChange={(v: string | null) => {
          if (v === null) return;
          onApartmentChange(v);
        }}
        allowDeselect={false}
        w={{ base: '100%', lg: 200 }}
      />

      <Select
        placeholder='동 선택'
        data={[
          { value: 'all', label: '전체 동' },
          ...buildings.map((building) => ({ value: building.id, label: `${building.buildingNumber}동` })),
        ]}
        value={selectedBuilding || 'all'}
        onChange={(v: string | null) => {
          if (v === null) return;
          onBuildingChange(v);
        }}
        allowDeselect={false}
        disabled={!selectedApartment || selectedApartment === 'all'}
        w={{ base: '100%', lg: 150 }}
      />

      <Select
        placeholder='회원유형'
        data={[
          { value: 'all', label: '전체 유형' },
          { value: 'APARTMENT', label: '아파트' },
          { value: 'GENERAL', label: '일반' },
          { value: 'PARTNER', label: '파트너' },
        ]}
        value={selectedRegistrationType || 'all'}
        onChange={(v: string | null) => {
          if (v === null) return;
          onRegistrationTypeChange(v);
        }}
        allowDeselect={false}
        w={{ base: '100%', lg: 150 }}
      />

    </DataToolbar>
  );
});
