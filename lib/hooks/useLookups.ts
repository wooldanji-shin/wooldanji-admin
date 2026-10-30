'use client';

// 여러 화면이 필터·선택 목록으로 함께 쓰는 "거의 안 바뀌는" 목록.
// 한 번 받아 두고 몇 분 동안 다시 요청하지 않는다. 관리 화면에서 값을 바꾸면 invalidateLookup으로 바로 비운다.
// 금액 계산에 쓰는 단가(ad_pricing_v2)는 오래된 값이면 청구 금액이 틀어지므로 여기 두지 않는다.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { SalesRep } from '@/lib/ads/sales-reps';

const LOOKUP_STALE_TIME = 5 * 60 * 1000;

export const LOOKUP_KEYS = {
  apartments: ['lookup', 'apartments'],
  adCategories: ['lookup', 'ad-categories'],
  salesReps: ['lookup', 'sales-reps'],
} as const;

export type LookupName = keyof typeof LOOKUP_KEYS;

export interface ApartmentLookup {
  id: string;
  name: string;
}

export interface AdSubCategoryLookup {
  id: string;
  subCategoryName: string;
  isActive: boolean | null;
  orderIndex: number | null;
}

export interface AdCategoryLookup {
  id: string;
  categoryName: string;
  /** DB 순서 그대로 (정렬·활성 필터는 쓰는 곳에서) */
  subCategories: AdSubCategoryLookup[];
}

// Database 타입이 클라이언트 버전과 맞지 않아 테이블이 never로 추론된다 — 스키마 타입을 벗겨 쓴다
function client(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

async function fetchApartmentLookup(): Promise<ApartmentLookup[]> {
  const { data, error } = await client().from('apartments').select('id, name').order('name');
  if (error) throw error;
  return (data ?? []) as ApartmentLookup[];
}

async function fetchAdCategoryLookup(): Promise<AdCategoryLookup[]> {
  const { data, error } = await client()
    .from('ad_categories_v2')
    .select('id, categoryName, ad_sub_categories_v2(id, subCategoryName, isActive, orderIndex)')
    .order('categoryName');
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    categoryName: string;
    ad_sub_categories_v2: AdSubCategoryLookup[] | null;
  }[]).map((c) => ({ id: c.id, categoryName: c.categoryName, subCategories: c.ad_sub_categories_v2 ?? [] }));
}

async function fetchSalesRepLookup(): Promise<SalesRep[]> {
  const { data, error } = await client().from('sales_reps').select('id, name, isActive, createdAt').order('name');
  if (error) throw error;
  return (data ?? []) as SalesRep[];
}

/** 아파트 전체 목록 (id, 이름) — 이름순 */
export function useApartmentLookup(): ApartmentLookup[] {
  const { data } = useQuery({
    queryKey: LOOKUP_KEYS.apartments,
    queryFn: fetchApartmentLookup,
    staleTime: LOOKUP_STALE_TIME,
  });
  return data ?? EMPTY;
}

/** 광고 카테고리 전체 + 서브카테고리 — 카테고리 이름순 */
export function useAdCategoryLookup(): AdCategoryLookup[] {
  const { data } = useQuery({
    queryKey: LOOKUP_KEYS.adCategories,
    queryFn: fetchAdCategoryLookup,
    staleTime: LOOKUP_STALE_TIME,
  });
  return data ?? EMPTY;
}

/** 영업 담당자 전체 (비활성 포함) — 이름순. 활성만 필요하면 쓰는 곳에서 거른다 */
export function useSalesRepLookup(): SalesRep[] {
  const { data } = useQuery({
    queryKey: LOOKUP_KEYS.salesReps,
    queryFn: fetchSalesRepLookup,
    staleTime: LOOKUP_STALE_TIME,
  });
  return data ?? EMPTY;
}

/** 관리 화면에서 목록을 바꾼 뒤 호출 — 다음에 쓰는 화면이 새로 받아 온다 */
export function useInvalidateLookup(): (name: LookupName) => void {
  const queryClient = useQueryClient();
  // 같은 함수를 계속 돌려줘서 useCallback 의존성에 넣어도 다시 실행되지 않는다
  return useCallback(
    (name: LookupName): void => {
      queryClient.invalidateQueries({ queryKey: LOOKUP_KEYS[name] });
    },
    [queryClient]
  );
}

// 데이터가 없을 때 매 렌더마다 새 배열을 만들면 useMemo/useEffect가 계속 다시 돈다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY: any[] = [];
