'use client';

import { ActionIcon, Box, Tooltip } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';
import { useColorSchemeToggle } from '@/components/useColorSchemeToggle';

export function ColorSchemeToggle(): React.ReactElement {
  const { toggleColorScheme } = useColorSchemeToggle();

  // 아이콘은 CSS(lightHidden/darkHidden)로 전환해 SSR hydration 불일치를 피한다
  return (
    <Tooltip label="라이트/다크 모드 전환">
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        onClick={toggleColorScheme}
        aria-label="라이트/다크 모드 전환"
      >
        <Box component="span" darkHidden style={{ lineHeight: 0 }}>
          <Moon size={18} strokeWidth={1.75} />
        </Box>
        <Box component="span" lightHidden style={{ lineHeight: 0 }}>
          <Sun size={18} strokeWidth={1.75} />
        </Box>
      </ActionIcon>
    </Tooltip>
  );
}
