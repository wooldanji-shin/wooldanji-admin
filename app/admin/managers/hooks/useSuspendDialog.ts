import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import type { Manager, UseSuspendDialogDeps, UseSuspendDialogReturn } from '../types';

interface SuspendState {
  opened: boolean;
  manager: Manager | null;
  reason: string;
}

type SuspendAction =
  | { type: 'open'; manager: Manager }
  | { type: 'setReason'; reason: string }
  | { type: 'close' }
  | { type: 'reset' };

const initialState: SuspendState = { opened: false, manager: null, reason: '' };

function suspendReducer(state: SuspendState, action: SuspendAction): SuspendState {
  switch (action.type) {
    case 'open':
      // handleSuspendClick: 대상 지정 → 사유 초기화 → 열기
      return { opened: true, manager: action.manager, reason: '' };
    case 'setReason':
      return { ...state, reason: action.reason };
    case 'close':
      // 취소/닫기: 열림만 끈다 (대상·사유는 그대로 — 기존 동작)
      return { ...state, opened: false };
    case 'reset':
      // 보류 성공: 닫기 + 대상·사유 초기화
      return initialState;
  }
}

/** 승인 보류 다이얼로그 (열림·대상·사유가 함께 바뀌므로 reducer) */
export function useSuspendDialog({ fetchManagers }: UseSuspendDialogDeps): UseSuspendDialogReturn {
  const [state, dispatch] = useReducer(suspendReducer, initialState);
  const suspendingManager = state.manager;
  const suspensionReason = state.reason;
  // 요청 중 — ref는 같은 틱의 중복 클릭 차단용, state는 버튼·닫기 표시용
  const processingRef = useRef(false);
  const [processing, setProcessing] = useState(false);

  const open = useCallback((manager: Manager): void => {
    dispatch({ type: 'open', manager });
  }, []);

  const close = useCallback((): void => {
    // 처리 중에는 닫지 않는다
    if (processingRef.current) return;
    dispatch({ type: 'close' });
  }, []);

  const setReason = useCallback((reason: string): void => {
    dispatch({ type: 'setReason', reason });
  }, []);

  const confirm = useCallback(async (): Promise<void> => {
    if (!suspendingManager || processingRef.current) return;

    if (!suspensionReason.trim()) {
      toast.error('보류 사유를 입력해주세요.');
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    try {
      const response = await fetch(`/api/users/${suspendingManager.id}/suspend`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspensionReason: suspensionReason.trim() }),
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '승인 보류 처리 중 문제가 생겼습니다. 목록을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('관리자가 승인 보류 처리되었습니다.');
      dispatch({ type: 'reset' });
      fetchManagers();
    } catch (err) {
      console.error('Failed to suspend manager:', err);
      toast.error(networkFailedMessage('승인 보류 처리를 하지 못했습니다.'));
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [suspendingManager, suspensionReason, fetchManagers]);

  return useMemo<UseSuspendDialogReturn>(
    () => ({
      opened: state.opened,
      manager: state.manager,
      reason: state.reason,
      processing,
      setReason,
      open,
      close,
      confirm,
    }),
    [state, processing, setReason, open, close, confirm],
  );
}
