import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  AdCategoryV2,
  InvalidateLookup,
  SupabaseClient,
  UseCategoriesFetchReturn,
} from '../types';

interface UseCategoriesFetchDeps {
  supabase: SupabaseClient;
  invalidateLookup: InvalidateLookup;
}

export function useCategoriesFetch({
  supabase,
  invalidateLookup,
}: UseCategoriesFetchDeps): UseCategoriesFetchReturn {
  const [categories, setCategories] = useState<AdCategoryV2[]>([]);
  const [loading, setLoading] = useState(true);

  // 카테고리 목록 조회
  const fetchCategories = useCallback(async (): Promise<void> => {
    invalidateLookup('adCategories');
    setLoading(true);
    try {
      const [{ data, error }, { data: adCounts }] = await Promise.all([
        (supabase as any)
          .from('ad_categories_v2')
          .select('*')
          .order('orderIndex', { ascending: true }),
        supabase.rpc('get_category_ad_counts'),
      ]);
      if (error) throw error;

      const countMap = new Map<string, { basic: number; premium: number }>(
        (adCounts || []).map((r: { category_id: string; basic_ad_count: number; premium_ad_count: number }) => [
          r.category_id,
          { basic: r.basic_ad_count, premium: r.premium_ad_count },
        ])
      );

      const merged = (data ?? []).map((c: AdCategoryV2) => {
        const counts = countMap.get(c.id) ?? { basic: 0, premium: 0 };
        return { ...c, basicAdCount: counts.basic, premiumAdCount: counts.premium };
      });

      setCategories(merged);
    } catch (err) {
      console.error('카테고리 목록 조회 실패:', err);
      toast.error('카테고리 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, invalidateLookup]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, setCategories, loading, fetchCategories };
}
