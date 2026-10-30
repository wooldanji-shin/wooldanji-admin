import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Badge, Group, Paper, Stack, Text, ThemeIcon, type MantineColor } from '@mantine/core';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<LucideProps>;
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  loading?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  className?: string;
  footer?: ReactNode;
}

const ACCENT_COLOR: Record<NonNullable<StatCardProps['accent']>, MantineColor> = {
  primary: 'blue',
  success: 'green',
  warning: 'yellow',
  destructive: 'red',
  info: 'cyan',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  hint,
  loading,
  trend,
  accent = 'primary',
  className,
  footer,
}: StatCardProps): React.ReactElement {
  const computedTrend: StatCardProps['trend'] =
    trend ??
    (typeof delta === 'number'
      ? delta > 0
        ? 'up'
        : delta < 0
          ? 'down'
          : 'neutral'
      : undefined);

  const TrendIcon =
    computedTrend === 'up' ? ArrowUp : computedTrend === 'down' ? ArrowDown : Minus;
  const trendColor: MantineColor =
    computedTrend === 'up' ? 'green' : computedTrend === 'down' ? 'red' : 'gray';

  return (
    <Paper withBorder radius="md" p="md" className={className}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} miw={0} style={{ flex: 1 }}>
            <Text size="sm" c="dimmed" fw={500}>
              {label}
            </Text>
            <Text
              fz={{ base: '1.375rem', sm: '1.625rem' }}
              fw={700}
              lh={1.2}
              style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
            >
              {loading ? <Text span c="dimmed" inherit>···</Text> : value}
            </Text>
          </Stack>
          {Icon && (
            <ThemeIcon variant="light" color={ACCENT_COLOR[accent]} size="lg" radius="md">
              <Icon size={18} />
            </ThemeIcon>
          )}
        </Group>
        {(typeof delta === 'number' || deltaLabel || hint) && (
          <Group gap="xs">
            {typeof delta === 'number' && (
              <Badge
                variant="light"
                color={trendColor}
                radius="sm"
                leftSection={<TrendIcon size={12} />}
              >
                {Math.abs(delta).toFixed(1)}%
              </Badge>
            )}
            {(deltaLabel || hint) && (
              <Text size="xs" c="dimmed">
                {deltaLabel ?? hint}
              </Text>
            )}
          </Group>
        )}
        {footer && <div>{footer}</div>}
      </Stack>
    </Paper>
  );
}
