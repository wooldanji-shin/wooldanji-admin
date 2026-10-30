import { useEffect, useState } from 'react';

/** 상단 헤더에 페이지 제목을 넣을 자리(#app-header-title)를 찾는다 — 클라이언트에서만 존재 */
export function useHeaderSlot(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById('app-header-title'));
  }, []);

  return slot;
}
