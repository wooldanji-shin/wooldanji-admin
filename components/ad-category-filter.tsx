'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DataToolbarFilters } from '@/components/data-toolbar';

export interface CategoryFilterOption {
  id: string;
  categoryName: string;
}

export interface SubCategoryFilterOption {
  id: string;
  subCategoryName: string;
}

interface AdCategoryFilterProps {
  categories: CategoryFilterOption[];
  categoryFilter: string | null;
  onCategoryChange: (id: string | null) => void;
  /** 카테고리별 건수 — 버튼 옆 배지에 표시 */
  categoryCounts: Record<string, number>;
  /** 카테고리를 고르지 않았으면 빈 배열 */
  subCategories: SubCategoryFilterOption[];
  subCategoryFilter: string | null;
  onSubCategoryChange: (id: string | null) => void;
}

/** 기본광고·프리미엄 목록이 함께 쓰는 카테고리 / 서브카테고리 필터 */
export function AdCategoryFilter({
  categories,
  categoryFilter,
  onCategoryChange,
  categoryCounts,
  subCategories,
  subCategoryFilter,
  onSubCategoryChange,
}: AdCategoryFilterProps): React.ReactElement {
  return (
    <>
      {categories.length > 0 && (
        <DataToolbarFilters>
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
              categoryFilter === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
            )}
          >
            전체 카테고리
          </button>
          {categories.map((cat) => {
            const isActive = categoryFilter === cat.id;
            const count = categoryCounts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(isActive ? null : cat.id)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                )}
              >
                {cat.categoryName}
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-5 min-w-5 justify-center px-1.5 text-xs tabular-nums',
                    isActive && 'bg-primary-foreground/20 text-primary-foreground'
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </DataToolbarFilters>
      )}

      {/* 서브카테고리 필터 — 카테고리 선택 시 표시 */}
      {subCategories.length > 0 && (
        <DataToolbarFilters>
          <button
            type="button"
            onClick={() => onSubCategoryChange(null)}
            className={cn(
              'inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors',
              subCategoryFilter === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
            )}
          >
            전체
          </button>
          {subCategories.map((sub) => {
            const isActive = subCategoryFilter === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSubCategoryChange(isActive ? null : sub.id)}
                className={cn(
                  'inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                )}
              >
                {sub.subCategoryName}
              </button>
            );
          })}
        </DataToolbarFilters>
      )}
    </>
  );
}
