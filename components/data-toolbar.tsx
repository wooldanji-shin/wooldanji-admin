'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { CloseButton, Group, Text, TextInput, UnstyledButton } from '@mantine/core';

interface DataToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function DataToolbar({ children, className }: DataToolbarProps): React.ReactElement {
  return (
    <Group gap="sm" className={className}>
      {children}
    </Group>
  );
}

interface DataToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DataToolbarSearch({
  value,
  onChange,
  placeholder = '검색',
  className,
}: DataToolbarSearchProps): React.ReactElement {
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      leftSection={<Search size={16} />}
      rightSectionPointerEvents="all"
      rightSection={
        value ? (
          <CloseButton size="sm" onClick={() => onChange('')} aria-label="검색어 지우기" />
        ) : null
      }
      w={{ base: '100%', sm: 320 }}
      className={className}
    />
  );
}

interface DataToolbarFiltersProps {
  children: React.ReactNode;
  className?: string;
}

export function DataToolbarFilters({
  children,
  className,
}: DataToolbarFiltersProps): React.ReactElement {
  return (
    <Group gap="xs" className={className}>
      {children}
    </Group>
  );
}

interface DataToolbarActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function DataToolbarActions({
  children,
  className,
}: DataToolbarActionsProps): React.ReactElement {
  return (
    <Group gap="xs" ml={{ sm: 'auto' }} className={className}>
      {children}
    </Group>
  );
}

interface FilterChipProps {
  label: string;
  /** Display value when active. If provided, the chip shows in active state. */
  value?: string | null;
  /** Click handler to open the filter UI (popover/dropdown). */
  onClick?: () => void;
  /** Click handler to clear the filter; appears as an X when value is set. */
  onClear?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function FilterChip({
  label,
  value,
  onClick,
  onClear,
  icon: Icon,
  className,
}: FilterChipProps): React.ReactElement {
  const active = value !== null && value !== undefined && value !== '';
  return (
    <Group
      gap={6}
      h={36}
      px="sm"
      wrap="nowrap"
      className={className}
      style={{
        border: `1px ${active ? 'solid' : 'dashed'} var(--app-divider)`,
        borderRadius: 'var(--mantine-radius-default)',
        background: active ? 'var(--mantine-color-blue-light)' : 'var(--mantine-color-body)',
      }}
    >
      <UnstyledButton onClick={onClick}>
        <Group gap={6} wrap="nowrap">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <Text size="sm" fw={500} c={active ? undefined : 'dimmed'}>
            {label}
          </Text>
          {active && value && (
            <Text size="sm" fw={600} c="blue" maw={140} truncate>
              {value}
            </Text>
          )}
        </Group>
      </UnstyledButton>
      {active && onClear && (
        <CloseButton
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={`${label} 필터 지우기`}
        />
      )}
    </Group>
  );
}
