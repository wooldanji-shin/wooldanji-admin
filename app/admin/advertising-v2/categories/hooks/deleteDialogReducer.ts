import type { DeleteDialogState } from '../types';

export type DeleteDialogAction<T> =
  | { type: 'OPEN'; target: T }
  | { type: 'CLOSE' }
  | { type: 'SET_PROCESSING'; processing: boolean }
  | { type: 'DONE' };

export function createInitialDeleteDialogState<T>(): DeleteDialogState<T> {
  return { opened: false, target: null, processing: false };
}

// 삭제 확인 다이얼로그 공용 리듀서
export function deleteDialogReducer<T>(
  state: DeleteDialogState<T>,
  action: DeleteDialogAction<T>
): DeleteDialogState<T> {
  switch (action.type) {
    // 삭제 클릭: 대상 지정 + 열기
    case 'OPEN':
      return { ...state, target: action.target, opened: true };
    // 취소/닫기: 열림만 끈다 (대상은 유지 — 닫히는 동안 문구 유지)
    case 'CLOSE':
      return { ...state, opened: false };
    case 'SET_PROCESSING':
      return { ...state, processing: action.processing };
    // 삭제 성공: 닫기 + 대상 비우기
    case 'DONE':
      return { ...state, opened: false, target: null };
    default:
      return state;
  }
}
