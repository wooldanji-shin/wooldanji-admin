'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { findBizCallDuplicate } from '@/lib/biz-call';

/**
 * 입력 중인 비즈콜 번호를 다른 파트너가 이미 쓰는지 확인한다.
 *
 * 타이핑이 멈춘 뒤에만 조회한다. 조회 실패는 통과로 두고 저장 API가 최종 차단한다.
 * 반환값은 중복 파트너의 상호명 (없으면 null).
 */
export function useBizCallDuplicate(
  value: string,
  excludePartnerId: string | null
): string | null {
  const debouncedValue = useDebounce(value, 400);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    findBizCallDuplicate(createClient(), debouncedValue, excludePartnerId)
      .then((owner) => {
        if (!canceled) setDuplicateName(owner?.businessName ?? null);
      })
      .catch(() => {
        if (!canceled) setDuplicateName(null);
      });

    return () => {
      canceled = true;
    };
  }, [debouncedValue, excludePartnerId]);

  return duplicateName;
}
