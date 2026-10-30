import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  /** 확인 버튼 문구 (기본: 확인) */
  confirmLabel?: string;
  /** 삭제처럼 되돌릴 수 없는 작업이면 확인 버튼을 빨간색으로 */
  danger?: boolean;
}

/**
 * 브라우저 기본 confirm()을 대체하는 Mantine 확인 모달.
 * 확인을 누르면 true, 취소·ESC·바깥 클릭으로 닫으면 false로 resolve된다.
 */
export function confirmModal({
  title = '확인',
  message,
  confirmLabel = '확인',
  danger = false,
}: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (result: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    modals.openConfirmModal({
      title,
      centered: true,
      children: (
        <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
          {message}
        </Text>
      ),
      labels: { confirm: confirmLabel, cancel: '취소' },
      confirmProps: danger ? { color: 'red' } : undefined,
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}
