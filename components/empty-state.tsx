import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Stack, Text, ThemeIcon } from '@mantine/core';

interface EmptyStateProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps): React.ReactElement {
  const isSmall = size === 'sm';
  return (
    <Stack
      align="center"
      justify="center"
      ta="center"
      gap={isSmall ? 'xs' : 'sm'}
      py={isSmall ? 40 : 64}
      className={className}
    >
      <ThemeIcon variant="light" color="gray" radius="xl" size={isSmall ? 40 : 48}>
        <Icon size={isSmall ? 20 : 24} />
      </ThemeIcon>
      <Stack gap={4} maw={448} align="center">
        <Text fw={600} size={isSmall ? 'sm' : 'md'}>
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </Stack>
  );
}
