'use client';

import { useMemo } from 'react';
import { Select, Text, type ComboboxItem, type OptionsFilter } from '@mantine/core';

export interface PartnerOption {
  id: string;
  businessName: string;
  /** 상호명이 같은 파트너를 구분하기 위한 부가 정보 (대표자·전화번호 등) */
  description?: string | null;
  /** 계정 이메일 — 부가 정보 아래 줄에 표시 */
  email?: string | null;
}

interface PartnerComboboxProps {
  partners: PartnerOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** 입력창에 덧붙일 클래스 (예: 폭 변경) */
  className?: string;
}

export function PartnerCombobox({
  partners,
  value,
  onChange,
  placeholder = '파트너 선택',
  className,
}: PartnerComboboxProps): React.ReactElement {
  const partnerById = useMemo<Map<string, PartnerOption>>(
    () => new Map(partners.map((p) => [p.id, p])),
    [partners]
  );

  // 화면에 보이는 항목은 모두 검색되게 한다 (상호명·대표자·전화번호·이메일)
  const filter: OptionsFilter = ({ options, search }) => {
    const query = search.toLowerCase().trim();
    if (!query) return options;
    return (options as ComboboxItem[]).filter((option) => {
      const partner = partnerById.get(option.value);
      if (!partner) return false;
      return [partner.businessName, partner.description ?? '', partner.email ?? '']
        .some((text) => text.toLowerCase().includes(query));
    });
  };

  return (
    <Select
      searchable
      clearable
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      nothingFoundMessage="검색 결과가 없습니다."
      // value는 id라 상호명이 같은 파트너가 있어도 서로 구분된다
      data={partners.map((p) => ({ value: p.id, label: p.businessName }))}
      filter={filter}
      renderOption={({ option }) => {
        const partner = partnerById.get(option.value);
        return (
          <div style={{ minWidth: 0 }}>
            <Text size="sm" truncate>{option.label}</Text>
            {partner?.description && (
              <Text size="xs" c="dimmed" truncate>{partner.description}</Text>
            )}
            {partner?.email && (
              <Text size="xs" c="dimmed" truncate>{partner.email}</Text>
            )}
          </div>
        );
      }}
      w={className ? undefined : 200}
      className={className}
      // 상호명 아래 대표자·전화번호가 잘리지 않을 만큼 넓힌다
      comboboxProps={{ width: 340, position: 'bottom-start' }}
    />
  );
}
