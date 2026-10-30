import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';

export interface UseColorSchemeToggleReturn {
  colorScheme: 'light' | 'dark';
  toggleColorScheme: () => void;
}

export function useColorSchemeToggle(): UseColorSchemeToggleReturn {
  const { setColorScheme } = useMantineColorScheme();
  // 'auto'일 때도 실제 적용된 값(light/dark)을 기준으로 토글한다
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  const toggleColorScheme = (): void => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  };

  return { colorScheme, toggleColorScheme };
}
