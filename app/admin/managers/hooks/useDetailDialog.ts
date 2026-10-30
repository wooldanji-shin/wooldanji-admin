import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  EditForm,
  Manager,
  UseDetailDialogDeps,
  UseDetailDialogReturn,
} from '../types';

interface DetailState {
  opened: boolean;
  manager: Manager | null;
  editForm: EditForm;
}

type DetailAction =
  | { type: 'open'; manager: Manager }
  | { type: 'close' }
  | { type: 'setField'; key: string; value: unknown };

const initialState: DetailState = { opened: false, manager: null, editForm: {} };

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'open': {
      const { manager } = action;
      return {
        opened: true,
        manager,
        editForm: {
          name: manager.name || '',
          email: manager.email || '',
          phoneNumber: manager.phoneNumber || '',
          birthDay: manager.birthDay || '',
          openDoorCount: manager.openDoorCount || 0,
          address: manager.address || '',
          regionSido: manager.regionSido || '',
          regionSigungu: manager.regionSigungu || '',
          regionDong: manager.regionDong || '',
          approvalStatus: manager.approvalStatus || 'pending',
        },
      };
    }
    case 'close':
      // 닫기/저장 성공: 열림만 끈다 (대상·폼은 그대로 — 기존 동작)
      return { ...state, opened: false };
    case 'setField':
      return { ...state, editForm: { ...state.editForm, [action.key]: action.value } };
  }
}

/** 관리자 상세 정보 다이얼로그 (열림·대상·폼은 reducer, 저장 중 여부는 별도 state) */
export function useDetailDialog({ supabase, fetchManagers }: UseDetailDialogDeps): UseDetailDialogReturn {
  const [state, dispatch] = useReducer(detailReducer, initialState);
  const [saving, setSaving] = useState(false);
  // 같은 틱의 중복 클릭 차단용 (saving state는 다음 렌더에 반영되므로)
  const savingRef = useRef(false);

  const detailManager = state.manager;
  const editForm = state.editForm;

  // 상세보기 클릭
  const open = useCallback((manager: Manager): void => {
    dispatch({ type: 'open', manager });
  }, []);

  const close = useCallback((): void => {
    // 저장 중에는 닫지 않는다
    if (savingRef.current) return;
    dispatch({ type: 'close' });
  }, []);

  const setField = useCallback((key: string, value: unknown): void => {
    dispatch({ type: 'setField', key, value });
  }, []);

  // 상세정보 저장
  const save = useCallback(async (): Promise<void> => {
    if (!detailManager || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user')
        .update({
          name: editForm.name,
          phoneNumber: editForm.phoneNumber,
          birthDay: editForm.birthDay || null,
          openDoorCount: parseInt(editForm.openDoorCount) || 0,
        })
        .eq('id', detailManager.id);

      if (error) throw error;

      toast.success('관리자 정보가 수정되었습니다.');
      dispatch({ type: 'close' });
      fetchManagers();
    } catch (err) {
      console.error('Failed to update manager:', err);
      toast.error('관리자 정보 수정에 실패했습니다.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [detailManager, editForm, supabase, fetchManagers]);

  return useMemo<UseDetailDialogReturn>(
    () => ({
      opened: state.opened,
      manager: state.manager,
      editForm: state.editForm,
      saving,
      setField,
      open,
      close,
      save,
    }),
    [state, saving, setField, open, close, save],
  );
}
