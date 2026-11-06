import { Text } from '@mantine/core';

interface ApartmentCellProps {
  names: string[];
}

/** 목록 표의 아파트 셀 — 첫 아파트명 + "외 N곳", 마우스를 올리면 전체 이름 */
export function ApartmentCell({ names }: ApartmentCellProps): React.ReactElement {
  if (names.length === 0) return <Text span size="sm" c="dimmed">-</Text>;
  const [first, ...rest] = names;
  return (
    <Text span size="sm" title={names.join(', ')}>
      {first}
      {rest.length > 0 && ` 외 ${rest.length}곳`}
    </Text>
  );
}
