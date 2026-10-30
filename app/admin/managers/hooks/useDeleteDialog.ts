import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import type { Manager, UseDeleteDialogDeps, UseDeleteDialogReturn } from '../types';

interface DeleteState {
  opened: boolean;
  manager: Manager | null;
}

type DeleteAction =
  | { type: 'open'; manager: Manager }
  | { type: 'close' }
  | { type: 'reset' };

const initialState: DeleteState = { opened: false, manager: null };

function deleteReducer(state: DeleteState, action: DeleteAction): DeleteState {
  switch (action.type) {
    case 'open':
      return { opened: true, manager: action.manager };
    case 'close':
      // 취소/닫기: 열림만 끈다 (대상은 그대로 — 기존 동작)
      return { ...state, opened: false };
    case 'reset':
      // 삭제 성공: 닫기 + 대상 초기화
      return initialState;
  }
}

/** 관리자 삭제 확인 다이얼로그 (열림·대상이 함께 바뀌므로 reducer) */
export function useDeleteDialog({ fetchManagers }: UseDeleteDialogDeps): UseDeleteDialogReturn {
  const [state, dispatch] = useReducer(deleteReducer, initialState);
  const deletingManager = state.manager;
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

  const confirm = useCallback(async (): Promise<void> => {
    if (!deletingManager || processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);
    try {
      const response = await fetch(`/api/users/${deletingManager.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '관리자 삭제 처리 중 문제가 생겼습니다. 목록을 새로고침해 삭제 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('관리자가 삭제되었습니다.');
      dispatch({ type: 'reset' });
      fetchManagers();
    } catch (err) {
      console.error('Failed to delete manager:', err);
      toast.error(networkFailedMessage('관리자를 삭제하지 못했습니다.'));
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [deletingManager, fetchManagers]);

  return useMemo<UseDeleteDialogReturn>(
    () => ({ opened: state.opened, manager: state.manager, processing, open, close, confirm }),
    [state, processing, open, close, confirm],
  );
}
