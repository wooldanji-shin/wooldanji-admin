'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import { Select, TextInput } from '@mantine/core';
import { Search } from 'lucide-react';
import { DataToolbar } from '@/components/data-toolbar';
import type { Apartment } from '../types';

interface ManagersToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  apartments: Apartment[];
  filterApartment: string;
  onFilterApartmentChange: (value: string) => void;
}

/** 검색 + 아파트 필터 카드 */
export const ManagersToolbar = memo(function ManagersToolbar({
  searchQuery,
  onSearchChange: setSearchQuery,
  apartments,
  filterApartment,
  onFilterApartmentChange: setFilterApartment,
}: ManagersToolbarProps): ReactElement {
  return (
    <DataToolbar>
      <TextInput
        placeholder='이름, 이메일, 전화번호로 검색...'
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        leftSection={<Search size={16} />}
        w={{ base: '100%', sm: 320 }}
      />
      <Select
        placeholder='아파트 선택'
        data={[
          { value: 'all', label: '전체 아파트' },
          ...apartments.map((apt) => ({ value: apt.id, label: apt.name })),
        ]}
        value={filterApartment}
        onChange={(v) => {
          if (v === null) return;
          setFilterApartment(v);
        }}
        allowDeselect={false}
        w={{ base: '100%', sm: 180 }}
      />
    </DataToolbar>
  );
});
