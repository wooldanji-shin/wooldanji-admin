import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

const accentStyles: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success-foreground',
  warning: 'bg-warning/10 text-warning-foreground',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info-foreground',
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
  const trendClass =
    computedTrend === 'up'
      ? 'text-success-foreground bg-success/10'
      : computedTrend === 'down'
        ? 'text-destructive bg-destructive/10'
        : 'text-muted-foreground bg-muted';

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-border/70 shadow-card transition-all duration-200 ease-spring hover:-translate-y-0.5 hover:shadow-card-hover',
        className
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {loading ? <span className="text-muted-foreground">···</span> : value}
            </p>
          </div>
          {Icon && (
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                accentStyles[accent]
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        {(typeof delta === 'number' || deltaLabel || hint) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {typeof delta === 'number' && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
                  trendClass
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {(deltaLabel || hint) && <span>{deltaLabel ?? hint}</span>}
          </div>
        )}
        {footer && <div className="pt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
}
