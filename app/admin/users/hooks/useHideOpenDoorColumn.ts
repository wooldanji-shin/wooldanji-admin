import { useEffect, useState } from 'react';

/**
 * 문 연 횟수 컬럼 숨김 설정 (localStorage 동기화).
 * 기존 페이지와 동일하게 값을 읽기만 하고 화면에서는 쓰지 않는다.
 */
export function useHideOpenDoorColumn(): void {
  const [, setHideOpenDoorColumn] = useState(false);

  // localStorage에서 문 연 횟수 컬럼 숨김 설정 불러오기
  useEffect(() => {
    const stored = localStorage.getItem('hideOpenDoorColumn');
    if (stored !== null) {
      setHideOpenDoorColumn(stored === 'true');
    }

    // storage 이벤트 리스너로 다른 페이지에서 변경 시 동기화
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'hideOpenDoorColumn') {
        setHideOpenDoorColumn(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
