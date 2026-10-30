import type { ReactNode } from 'react';
import { Group, Stack, Text, Title } from '@mantine/core';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard outer container for admin pages. Provides consistent padding
 * and vertical rhythm.
 */
export function PageShell({ children, className }: PageShellProps): React.ReactElement {
  return (
    <Stack gap="lg" p={{ base: 'md', md: 'xl' }} className={className}>
      {children}
    </Stack>
  );
}

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between" align="flex-end" gap="md" className={className}>
      {children}
    </Group>
  );
}

interface PageHeaderTitleProps {
  title: string;
  description?: string;
  className?: string;
}

export function PageHeaderTitle({
  title,
  description,
  className,
}: PageHeaderTitleProps): React.ReactElement {
  return (
    <Stack gap={4} miw={0} className={className}>
      <Title order={1} fz="1.375rem" fw={600} lineClamp={1}>
        {title}
      </Title>
      {description && <Text c="dimmed">{description}</Text>}
    </Stack>
  );
}

interface PageHeaderActionsProps {
  children: ReactNode;
  className?: string;
}

export function PageHeaderActions({
  children,
  className,
}: PageHeaderActionsProps): React.ReactElement {
  return (
    <Group gap="xs" className={className}>
      {children}
    </Group>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export function PageContent({ children, className }: PageContentProps): React.ReactElement {
  return (
    <Stack gap="lg" className={className}>
      {children}
    </Stack>
  );
}
