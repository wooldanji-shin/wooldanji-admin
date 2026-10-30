import { useCallback, useEffect, useState } from 'react';
import type { UseHideClickCountsReturn } from '../types';

/** 클릭수 컬럼 숨김 상태 (localStorage에서 읽어옴 - ads 페이지와 공유) */
export function useHideClickCounts(): UseHideClickCountsReturn {
  const [hideClickCounts, setHideClickCounts] = useState(false);

  // localStorage에서 hideClickColumn 값 읽어오기
  useEffect(() => {
    const stored = localStorage.getItem('hideClickColumn');
    setHideClickCounts(stored === 'true');

    // 다른 탭에서 변경 시 동기화
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'hideClickColumn') {
        setHideClickCounts(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 클릭수 숨김 토글 (ads 페이지와 같은 localStorage 키에 저장)
  const handleHideClickCountsChange = useCallback((checked: boolean): void => {
    setHideClickCounts(checked);
    try {
      localStorage.setItem('hideClickColumn', String(checked));
    } catch {
      // localStorage 접근 불가(시크릿 모드 등) 시 현재 화면 상태만 유지
    }
  }, []);

  return { hideClickCounts, handleHideClickCountsChange };
}
