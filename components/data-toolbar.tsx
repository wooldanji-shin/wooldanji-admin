'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function DataToolbar({ children, className }: DataToolbarProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border/60 px-6 py-3 sm:flex-row sm:items-center sm:gap-2',
        className
      )}
    >
      {children}
    </div>
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
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="검색어 지우기"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
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
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
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
    <div className={cn('flex flex-wrap items-center gap-2 sm:ml-auto', className)}>
      {children}
    </div>
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
    <div
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-md border border-dashed bg-card px-4 text-sm font-medium transition-colors',
        active
          ? 'border-border bg-accent/60 text-foreground'
          : 'border-border text-muted-foreground hover:border-border/80 hover:bg-accent/40 hover:text-foreground',
        className
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5"
      >
        {Icon ? (
          <Icon className="h-3.5 w-3.5" />
        ) : (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              active ? 'bg-primary' : 'bg-muted-foreground/40'
            )}
            aria-hidden
          />
        )}
        <span>{label}</span>
        {active && value && (
          <>
            <span className="text-border" aria-hidden>
              |
            </span>
            <span className="max-w-[140px] truncate text-foreground">{value}</span>
          </>
        )}
      </button>
      {active && onClear && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mr-1 ml-0.5 h-4 w-4 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={`${label} 필터 지우기`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
