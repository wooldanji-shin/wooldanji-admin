import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import type { ApprovalStatus, UseManagerActionsDeps, UseManagerActionsReturn } from '../types';

/** 승인 / 승인 취소 (표의 메뉴에서 바로 실행) */
export function useManagerActions({ fetchManagers }: UseManagerActionsDeps): UseManagerActionsReturn {
  // 요청 중인 관리자 — ref는 같은 틱의 중복 클릭 차단용, state는 버튼 표시용
  const processingRef = useRef<Set<string>>(new Set());
  const [processingUserIds, setProcessingUserIds] = useState<string[]>([]);

  // 승인 상태 변경
  const handleApprovalStatusChange = useCallback(async (userId: string, status: ApprovalStatus): Promise<void> => {
    if (processingRef.current.has(userId)) return;
    processingRef.current.add(userId);
    setProcessingUserIds(Array.from(processingRef.current));

    try {
      const response = await fetch(`/api/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? '승인 상태 변경 처리 중 문제가 생겼습니다. 목록을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('승인 상태가 변경되었습니다.');
      fetchManagers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error(networkFailedMessage('승인 상태를 바꾸지 못했습니다.'));
    } finally {
      processingRef.current.delete(userId);
      setProcessingUserIds(Array.from(processingRef.current));
    }
  }, [fetchManagers]);

  return useMemo<UseManagerActionsReturn>(
    () => ({ handleApprovalStatusChange, processingUserIds }),
    [handleApprovalStatusChange, processingUserIds],
  );
}
