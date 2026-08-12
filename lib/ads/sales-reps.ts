// 영업 담당자 — 광고 승인·대리 등록 화면이 공유한다.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface SalesRep {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface FetchOptions {
  /**
   * 비활성이어도 목록에 남길 담당자 id — 이미 지정돼 있던 담당자가
   * 승인 화면을 다시 열었을 때 사라지지 않게 한다.
   */
  includeId?: string | null;
  /** 비활성 담당자도 모두 포함 (목록 필터용) */
  includeInactive?: boolean;
}

/** 선택 목록에 쓸 담당자 조회 — 기본은 활성 담당자만 */
export async function fetchSelectableSalesReps(
  { includeId, includeInactive }: FetchOptions = {}
): Promise<SalesRep[]> {
  // Database 타입이 클라이언트 버전과 맞지 않아 테이블이 never로 추론된다 — 스키마 타입을 벗겨 쓴다
  const supabase = createClient() as unknown as SupabaseClient;
  const { data } = await supabase
    .from('sales_reps')
    .select('id, name, isActive, createdAt')
    .order('name');

  const reps = (data ?? []) as SalesRep[];
  if (includeInactive) return reps;

  return reps.filter((rep) => rep.isActive || rep.id === includeId);
}
