import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-2 py-10' : 'gap-3 py-16',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
        )}
      >
        <Icon className={size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'} />
      </div>
      <div className="max-w-md">
        <p
          className={cn(
            'font-semibold text-foreground',
            size === 'sm' ? 'text-sm' : 'text-base'
          )}
        >
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
