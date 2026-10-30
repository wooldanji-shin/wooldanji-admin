import type { ReactElement } from 'react';
import { Badge, Group, Text } from '@mantine/core';
import { Building2, Home, Layers } from 'lucide-react';
import { formatLineRange } from '@/lib/utils/line';
import type { AdminScope } from '../types';

// 관리 범위 표시
export function getScopeDisplay(scopes?: AdminScope[]): ReactElement {
  if (!scopes || scopes.length === 0) {
    return <Badge variant="light" color="gray">미지정</Badge>;
  }

  const scope = scopes[0];
  const apartment = scope.apartments;
  const building = scope.apartment_buildings;
  const line = scope.apartment_lines;

  if (scope.scopeLevel === 'APARTMENT' && apartment) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Building2 size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm">{apartment.name} 전체</Text>
      </Group>
    );
  } else if (scope.scopeLevel === 'BUILDING' && apartment && building) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Home size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm">{apartment.name} {building.buildingNumber}동</Text>
      </Group>
    );
  } else if (scope.scopeLevel === 'LINE' && apartment && building && line) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Layers size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm">{apartment.name} {building.buildingNumber}동 {formatLineRange(line.line)}라인</Text>
      </Group>
    );
  }

  return <Badge variant="light" color="gray">미지정</Badge>;
}

export function getApprovalBadge(status: string | null): ReactElement {
  switch (status) {
    case 'approve':
      return <Badge variant="light" color="green">승인</Badge>;
    case 'pending':
      return <Badge variant="light" color="yellow">대기</Badge>;
    case 'suspended':
      return <Badge variant="light" color="orange">보류</Badge>;
    case 'inactive':
      return <Badge variant="light" color="gray">비활성</Badge>;
    default:
      return <Badge variant="light" color="gray">-</Badge>;
  }
}

export function getRegisterMethodBadge(method: string | null | undefined): ReactElement | null {
  switch (method?.toLowerCase()) {
    case 'google':
      return <Badge variant="light" color="red" size="sm">Google</Badge>;
    case 'kakao':
      return <Badge variant="light" color="yellow" size="sm">Kakao</Badge>;
    case 'local':
      return <Badge variant="light" color="blue" size="sm">Email</Badge>;
    default:
      return null;
  }
}
