'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { ActionIcon, Group, Title } from '@mantine/core';
import { useHeaderSlot } from '@/components/useHeaderSlot';

interface HeaderTitleProps {
  title: ReactNode;
  /** 있으면 제목 왼쪽에 뒤로가기 버튼을 둔다 */
  onBack?: () => void;
  backLabel?: string;
}

/**
 * 상세 페이지 제목을 본문 대신 상단 헤더(브레드크럼 자리)에 표시한다.
 * 본문 위쪽 공간을 아끼기 위해 상세·수정 페이지에서 쓴다.
 */
export function HeaderTitle({ title, onBack, backLabel = '뒤로가기' }: HeaderTitleProps): React.ReactElement | null {
  const slot = useHeaderSlot();
  if (!slot) return null;

  return createPortal(
    <Group gap={4} wrap="nowrap" miw={0}>
      {onBack && (
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={onBack} aria-label={backLabel}>
          <ChevronLeft size={22} />
        </ActionIcon>
      )}
      <Title order={1} fz="1.25rem" fw={700} lineClamp={1}>
        {title}
      </Title>
    </Group>,
    slot
  );
}
