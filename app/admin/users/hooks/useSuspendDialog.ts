import { useCallback, useReducer } from 'react';
import { toast } from 'sonner';
import type { UserFullDetails } from '@/lib/supabase/types';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import type {
  SuspendDialogAction,
  SuspendDialogState,
  UseSuspendDialogDeps,
  UseSuspendDialogReturn,
} from '../types';

const initialState: SuspendDialogState = { opened: false, user: null, reason: '', processing: false };

// 열기/대상/사유가 함께 바뀌어서 reducer로 묶는다.
// close는 열림만 끄고 대상·사유는 남긴다 (닫히는 애니메이션 동안 이름이 유지되던 기존 동작 그대로)
// 처리 중(processing)에는 open/close를 무시해 요청 도중 다이얼로그가 닫히거나 대상이 바뀌지 않게 한다
function suspendDialogReducer(state: SuspendDialogState, action: SuspendDialogAction): SuspendDialogState {
  switch (action.type) {
    case 'open':
      if (state.processing) return state;
      return { opened: true, user: action.user, reason: '', processing: false };
    case 'close':
      if (state.processing) return state;
      return { ...state, opened: false };
    case 'setReason':
      return { ...state, reason: action.reason };
    case 'processingStart':
      return { ...state, processing: true };
    case 'processingEnd':
      return { ...state, processing: false };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

/** 승인 보류 다이얼로그 */
export function useSuspendDialog({ fetchUsers }: UseSuspendDialogDeps): UseSuspendDialogReturn {
  const [state, dispatch] = useReducer(suspendDialogReducer, initialState);
  const suspendingUser = state.user;
  const suspensionReason = state.reason;
  const processing = state.processing;

  // 표(memo)에 넘기는 핸들러 — dispatch만 쓰므로 참조가 바뀌지 않는다
  const handleSuspendClick = useCallback((user: UserFullDetails): void => {
    dispatch({ type: 'open', user });
  }, []);

  const setSuspensionReason = useCallback((reason: string): void => {
    dispatch({ type: 'setReason', reason });
  }, []);

  const close = useCallback((): void => {
    dispatch({ type: 'close' });
  }, []);

  // memo된 다이얼로그가 무관한 렌더(검색 입력 등)에 다시 그려지지 않도록 참조 고정 — deps는 본문이 읽는 값 전부
  const handleSuspendConfirm = useCallback(async (): Promise<void> => {
    if (!suspendingUser || processing) return;

    if (!suspensionReason.trim()) {
      toast.error('보류 사유를 입력해주세요.');
      return;
    }

    dispatch({ type: 'processingStart' });
    try {
      const response = await fetch(`/api/users/${suspendingUser.id}/suspend`, {
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

      toast.success('회원이 승인 보류 처리되었습니다.');
      dispatch({ type: 'reset' });
      fetchUsers();
    } catch (err) {
      console.error('Failed to suspend user:', err);
      toast.error(networkFailedMessage('승인 보류 처리를 하지 못했습니다.'));
    } finally {
      // 성공(reset 후)·실패·네트워크 오류 모든 경로에서 처리 중 상태를 푼다
      dispatch({ type: 'processingEnd' });
    }
  }, [suspendingUser, suspensionReason, processing, fetchUsers]);

  return {
    opened: state.opened,
    suspendingUser,
    suspensionReason,
    processing,
    handleSuspendClick,
    setSuspensionReason,
    close,
    handleSuspendConfirm,
  };
}
