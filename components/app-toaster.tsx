'use client';

import { useComputedColorScheme } from '@mantine/core';
import { Toaster } from 'sonner';

/** sonner 토스트도 현재 라이트/다크 모드를 따라간다 */
export function AppToaster(): React.ReactElement {
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return <Toaster position="top-right" richColors closeButton theme={colorScheme} />;
}
