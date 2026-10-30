'use client';

import { Select } from '@mantine/core';

export interface ApartmentOption {
  id: string;
  name: string;
}

interface ApartmentComboboxProps {
  apartments: ApartmentOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function ApartmentCombobox({
  apartments,
  value,
  onChange,
  placeholder = '아파트 선택',
}: ApartmentComboboxProps): React.ReactElement {
  return (
    <Select
      searchable
      clearable
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      nothingFoundMessage="검색 결과가 없습니다."
      data={apartments.map((apt) => ({ value: apt.id, label: apt.name }))}
      w={200}
      comboboxProps={{ width: 240, position: 'bottom-start' }}
    />
  );
}
