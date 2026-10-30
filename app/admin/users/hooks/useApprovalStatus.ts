import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';
import type { ApprovalStatusAction, UseApprovalStatusDeps, UseApprovalStatusReturn } from '../types';

/** 표에서 바로 하는 승인 / 승인 취소 */
export function useApprovalStatus({ fetchUsers }: UseApprovalStatusDeps): UseApprovalStatusReturn {
  // 요청 중인 회원 id — 표에서 해당 행의 버튼을 막는 데 쓴다
  const [processingUserIds, setProcessingUserIds] = useState<ReadonlySet<string>>(() => new Set());
  // 같은 회원 중복 요청 차단용 (state는 다음 렌더까지 반영이 늦어 빠른 연속 클릭을 못 막으므로 ref로 즉시 확인)
  const inFlightRef = useRef<Set<string>>(new Set());

  const release = useCallback((userId: string): void => {
    inFlightRef.current.delete(userId);
    setProcessingUserIds(new Set(inFlightRef.current));
  }, []);

  // 표(memo)에 넘기는 핸들러라 참조를 고정한다 — 기존처럼 현재 fetchUsers로 목록을 갱신
  const handleApprovalStatusChange = useCallback(async (userId: string, status: ApprovalStatusAction): Promise<void> => {
    if (inFlightRef.current.has(userId)) return;
    inFlightRef.current.add(userId);
    setProcessingUserIds(new Set(inFlightRef.current));

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
      // 목록 갱신 — 갱신된 상태가 표에 보일 때까지 버튼을 막아 둔다 (fetchUsers는 내부에서 오류를 처리함)
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      toast.error(networkFailedMessage('승인 상태를 바꾸지 못했습니다.'));
    } finally {
      // 성공·실패·네트워크 오류 모든 경로에서 해제
      release(userId);
    }
  }, [fetchUsers, release]);

  return { processingUserIds, handleApprovalStatusChange };
}
