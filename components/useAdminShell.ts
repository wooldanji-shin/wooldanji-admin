import { useCallback, useState } from 'react';
import { useHotkeys, useMediaQuery } from '@mantine/hooks';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
/** AppShell navbar breakpoint('sm' = 48em = 768px)와 같은 값 */
const MOBILE_QUERY = '(max-width: 48em)';

export interface UseAdminShellReturn {
  isMobile: boolean;
  mobileOpened: boolean;
  /** 데스크톱에서 false면 아이콘만 보이는 좁은 사이드바 */
  desktopOpened: boolean;
  toggleMobile: () => void;
  toggleDesktop: () => void;
  closeMobile: () => void;
}

export function useAdminShell(defaultDesktopOpened: boolean): UseAdminShellReturn {
  const isMobile = useMediaQuery(MOBILE_QUERY) ?? false;
  const [mobileOpened, setMobileOpened] = useState<boolean>(false);
  const [desktopOpened, setDesktopOpened] = useState<boolean>(defaultDesktopOpened);

  const toggleMobile = useCallback((): void => setMobileOpened((prev) => !prev), []);
  const closeMobile = useCallback((): void => setMobileOpened(false), []);

  // 데스크톱 사이드바 열림 상태는 쿠키에 저장 (app/admin/layout.tsx에서 초기값으로 읽음)
  const toggleDesktop = useCallback((): void => {
    setDesktopOpened((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      return next;
    });
  }, []);

  // Cmd/Ctrl+B로 사이드바 토글, 모바일에서는 Esc로 닫기
  useHotkeys([
    ['mod+B', () => (isMobile ? toggleMobile() : toggleDesktop())],
    ['Escape', closeMobile],
  ], []); // 기존 사이드바처럼 입력창 안에서도 동작

  return { isMobile, mobileOpened, desktopOpened, toggleMobile, toggleDesktop, closeMobile };
}
