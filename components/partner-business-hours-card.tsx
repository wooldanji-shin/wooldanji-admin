'use client';

import { Clock } from 'lucide-react';
import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { DAY_OF_WEEK_LABEL, type PartnerBusinessHour } from '@/lib/types/partner';

interface HoursGroup {
  /** 예: '월–토', '일' */
  label: string;
  hour: PartnerBusinessHour;
}

function sameHours(a: PartnerBusinessHour, b: PartnerBusinessHour): boolean {
  return (
    a.isClosed === b.isClosed &&
    a.openTime === b.openTime &&
    a.closeTime === b.closeTime &&
    a.breakStartTime === b.breakStartTime &&
    a.breakEndTime === b.breakEndTime &&
    a.lastOrderTime === b.lastOrderTime
  );
}

/** 연달아 같은 시간인 요일을 '월–토'처럼 한 줄로 묶는다 (표시용) */
function groupSameHours(hours: PartnerBusinessHour[]): HoursGroup[] {
  const groups: { days: PartnerBusinessHour[] }[] = [];
  hours.forEach((hour) => {
    const last = groups[groups.length - 1];
    if (last && sameHours(last.days[0], hour)) last.days.push(hour);
    else groups.push({ days: [hour] });
  });
  return groups.map(({ days }) => {
    const first = DAY_OF_WEEK_LABEL[days[0].dayOfWeek];
    const lastDay = DAY_OF_WEEK_LABEL[days[days.length - 1].dayOfWeek];
    return { label: days.length > 1 ? `${first}–${lastDay}` : first, hour: days[0] };
  });
}

interface PartnerBusinessHoursCardProps {
  businessHours: PartnerBusinessHour[];
  /** partner_users.businessHoursNote — 파트너가 자유롭게 적은 안내 문구 */
  businessHoursNote?: string | null;
  loading?: boolean;
}

export function PartnerBusinessHoursCard({
  businessHours,
  businessHoursNote,
  loading = false,
}: PartnerBusinessHoursCardProps): React.ReactElement {
  const hasHours = businessHours.length > 0;

  return (
    <Paper withBorder radius="md" p="lg" h="100%">
      <Group gap="xs" mb="sm">
        <Clock size={16} color="var(--mantine-color-dimmed)" />
        <Title order={5}>영업시간</Title>
      </Group>
      {loading ? (
        <Text size="sm" c="dimmed" py="xs">불러오는 중...</Text>
      ) : !hasHours ? (
        <Text size="sm" c="dimmed" py="xs">등록된 영업시간이 없습니다.</Text>
      ) : (
        <Stack gap={0}>
          {groupSameHours(businessHours).map(({ label, hour }, idx) => (
            // 같은 시간인 요일은 한 줄로: 요일 · 영업시간 · (브레이크·라스트오더는 작게)
            <Group
              key={hour.dayOfWeek}
              gap="sm"
              wrap="nowrap"
              align="baseline"
              py={8}
              style={idx > 0 ? { borderTop: '1px solid var(--app-divider)' } : undefined}
            >
              <Text size="sm" fw={600} w={48} style={{ flexShrink: 0 }}>
                {label}
              </Text>
              {hour.isClosed ? (
                <Text size="sm" c="dimmed">
                  휴무
                </Text>
              ) : (
                <Stack gap={2}>
                  <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {hour.openTime && hour.closeTime
                      ? `${hour.openTime} – ${hour.closeTime}`
                      : '-'}
                  </Text>
                  {/* 브레이크타임·라스트오더는 입력한 파트너가 적어 등록된 경우에만 표기 */}
                  {hour.breakStartTime && hour.breakEndTime && (
                    <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      브레이크 {hour.breakStartTime}–{hour.breakEndTime}
                    </Text>
                  )}
                  {hour.lastOrderTime && (
                    <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      라스트오더 {hour.lastOrderTime}
                    </Text>
                  )}
                </Stack>
              )}
            </Group>
          ))}
        </Stack>
      )}

      {businessHoursNote && (
        <Paper bg="var(--app-bg-muted)" radius="sm" px="sm" py="xs" mt="sm">
          <Text size="xs" fw={500} c="dimmed">파트너 안내 문구</Text>
          <Text size="sm" mt={2} style={{ whiteSpace: 'pre-wrap' }}>{businessHoursNote}</Text>
        </Paper>
      )}
    </Paper>
  );
}
