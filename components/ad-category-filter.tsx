'use client';

import { FilterChips, FilterRow } from '@/components/filter-chips';

/** '전체' 칩의 값 — 실제로는 선택 해제(null)를 뜻한다 */
const ALL = '__all__';

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
        <FilterRow label="카테고리">
          <FilterChips
            options={[
              { value: ALL, label: '전체 카테고리' },
              ...categories.map((cat) => ({
                value: cat.id,
                label: cat.categoryName,
                count: categoryCounts[cat.id] ?? 0,
              })),
            ]}
            value={categoryFilter ?? ALL}
            onChange={(v) => {
              if (v === ALL) return onCategoryChange(null);
              onCategoryChange(categoryFilter === v ? null : v);
            }}
          />
        </FilterRow>
      )}

      {/* 서브카테고리 필터 — 카테고리 선택 시 표시 */}
      {subCategories.length > 0 && (
        <FilterRow label="세부 카테고리">
          <FilterChips
            options={[
              { value: ALL, label: '전체' },
              ...subCategories.map((sub) => ({ value: sub.id, label: sub.subCategoryName })),
            ]}
            value={subCategoryFilter ?? ALL}
            onChange={(v) => {
              if (v === ALL) return onSubCategoryChange(null);
              onSubCategoryChange(subCategoryFilter === v ? null : v);
            }}
          />
        </FilterRow>
      )}
    </>
  );
}
