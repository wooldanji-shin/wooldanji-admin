import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  AdminScope,
  Building,
  Line,
  Manager,
  ScopeLevel,
  UseScopeDialogDeps,
  UseScopeDialogReturn,
} from '../types';

interface ScopeState {
  opened: boolean;
  manager: Manager | null;
  scopeLevel: ScopeLevel;
  selectedApartment: string;
  selectedBuilding: string;
  selectedLine: string;
}

type ScopeAction =
  | { type: 'open'; manager: Manager }
  | { type: 'close' }
  | { type: 'setScopeLevel'; scopeLevel: ScopeLevel }
  | { type: 'setApartment'; apartmentId: string }
  | { type: 'setBuilding'; buildingId: string }
  | { type: 'setLine'; lineId: string };

const initialState: ScopeState = {
  opened: false,
  manager: null,
  scopeLevel: 'APARTMENT',
  selectedApartment: '',
  selectedBuilding: '',
  selectedLine: '',
};

function scopeReducer(state: ScopeState, action: ScopeAction): ScopeState {
  switch (action.type) {
    case 'open': {
      const { manager } = action;
      const scope = manager.admin_scopes?.[0];

      // 이 관리자의 기존 권한만으로 초기화 — 없는 값은 비운다 (이전에 연 관리자의 선택이 남지 않게)
      return {
        opened: true,
        manager,
        scopeLevel: scope?.scopeLevel ?? 'APARTMENT',
        selectedApartment: scope?.apartmentId ?? '',
        selectedBuilding: scope?.buildingId ?? '',
        selectedLine: scope?.lineId ?? '',
      };
    }
    case 'close':
      // 닫기/저장 성공: 열림만 끈다 (선택값은 그대로 — 기존 동작)
      return { ...state, opened: false };
    case 'setScopeLevel':
      return { ...state, scopeLevel: action.scopeLevel };
    case 'setApartment':
      // 아파트가 바뀌면 다른 아파트의 동·라인이 남지 않도록 비운다
      if (action.apartmentId === state.selectedApartment) return state;
      return { ...state, selectedApartment: action.apartmentId, selectedBuilding: '', selectedLine: '' };
    case 'setBuilding':
      // 동이 바뀌면 다른 동의 라인이 남지 않도록 비운다
      if (action.buildingId === state.selectedBuilding) return state;
      return { ...state, selectedBuilding: action.buildingId, selectedLine: '' };
    case 'setLine':
      return { ...state, selectedLine: action.lineId };
  }
}

/** 관리 범위 설정 다이얼로그 (열림·대상·레벨·아파트/동/라인 선택은 reducer, 동/라인 목록은 별도 조회 state) */
export function useScopeDialog({ supabase, fetchManagers }: UseScopeDialogDeps): UseScopeDialogReturn {
  const [state, dispatch] = useReducer(scopeReducer, initialState);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  // 저장 중 — ref는 같은 틱의 중복 클릭 차단용, state는 버튼·닫기 표시용
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const selectedManager = state.manager;
  const { scopeLevel, selectedApartment, selectedBuilding, selectedLine } = state;

  // 아파트가 바뀌면 이전 동·라인 목록을 비우고 동 목록을 다시 조회
  useEffect(() => {
    setBuildings([]);
    setLines([]);
    if (!selectedApartment) return;

    // 늦게 도착한 이전 아파트 응답은 버린다
    let ignore = false;
    (async (): Promise<void> => {
      const { data } = await supabase
        .from('apartment_buildings')
        .select('*')
        .eq('apartmentId', selectedApartment)
        .order('buildingNumber');
      if (!ignore) setBuildings(data || []);
    })();
    return () => {
      ignore = true;
    };
  }, [selectedApartment]);

  // 동이 바뀌면 이전 라인 목록을 비우고 라인 목록을 다시 조회
  useEffect(() => {
    setLines([]);
    if (!selectedBuilding) return;

    // 늦게 도착한 이전 동 응답은 버린다
    let ignore = false;
    (async (): Promise<void> => {
      const { data } = await supabase
        .from('apartment_lines')
        .select('*')
        .eq('buildingId', selectedBuilding);
      if (!ignore) setLines(data || []);
    })();
    return () => {
      ignore = true;
    };
  }, [selectedBuilding]);

  // 권한 편집 모달 열기
  const open = useCallback((manager: Manager): void => {
    dispatch({ type: 'open', manager });
  }, []);

  const close = useCallback((): void => {
    // 저장 중에는 닫지 않는다
    if (savingRef.current) return;
    dispatch({ type: 'close' });
  }, []);

  const setScopeLevel = useCallback((value: ScopeLevel): void => {
    dispatch({ type: 'setScopeLevel', scopeLevel: value });
  }, []);

  const setSelectedApartment = useCallback((apartmentId: string): void => {
    dispatch({ type: 'setApartment', apartmentId });
  }, []);

  const setSelectedBuilding = useCallback((buildingId: string): void => {
    dispatch({ type: 'setBuilding', buildingId });
  }, []);

  const setSelectedLine = useCallback((lineId: string): void => {
    dispatch({ type: 'setLine', lineId });
  }, []);

  // 권한 저장 (기존 삭제 → 새 권한 추가, 추가 실패 시 기존 권한 복구)
  const save = useCallback(async (): Promise<void> => {
    if (!selectedManager || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    // 복구용: 편집 중인 관리자의 기존 권한
    const previousScopes: AdminScope[] = selectedManager.admin_scopes ?? [];
    let deleted = false;

    // 기존 권한 다시 넣기 — 성공 여부 반환 (되돌릴 것이 없으면 성공)
    const restorePreviousScopes = async (): Promise<boolean> => {
      if (previousScopes.length === 0) return true;
      // 원래 id 그대로 다시 넣는다 (createdAt은 조회하지 않으므로 현재 시각으로 들어간다)
      const restoreRows: any = previousScopes.map((scope) => ({
        id: scope.id,
        userId: selectedManager.id,
        scopeLevel: scope.scopeLevel,
        apartmentId: scope.apartmentId,
        buildingId: scope.buildingId,
        lineId: scope.lineId,
      }));
      try {
        const { error: restoreError } = await supabase
          .from('admin_scopes')
          .insert(restoreRows);
        if (restoreError) throw restoreError;
        return true;
      } catch (restoreErr) {
        console.error('Failed to restore previous scope:', restoreErr);
        return false;
      }
    };

    // 추가 실패 후 처리: 복구하고 결과에 맞는 안내
    const handleInsertFailure = async (): Promise<void> => {
      if (previousScopes.length === 0) {
        toast.error('권한 저장에 실패했습니다.');
        return;
      }
      const restored = await restorePreviousScopes();
      if (restored) {
        toast.error('관리 범위 저장에 실패했습니다. 이전 범위로 되돌렸습니다.');
      } else {
        toast.error('관리 범위 저장과 복구에 모두 실패했습니다. 목록을 새로고침해 확인해 주세요.');
        // 관리 범위가 비었을 수 있으니 목록을 실제 상태로 갱신
        fetchManagers();
      }
    };

    try {
      // 기존 권한 삭제
      const { error: deleteError } = await supabase
        .from('admin_scopes')
        .delete()
        .eq('userId', selectedManager.id);

      if (deleteError) {
        // 삭제 실패: 아무것도 바뀌지 않았으니 여기서 멈춘다
        console.error('Failed to delete previous scope:', deleteError);
        toast.error('기존 관리 범위를 지우지 못해 저장하지 않았습니다.');
        return;
      }
      deleted = true;

      // 새 권한 추가
      const scopeData: any = {
        userId: selectedManager.id,
        scopeLevel: scopeLevel,
        apartmentId: selectedApartment || null,
        buildingId: null,
        lineId: null,
      };

      if (scopeLevel === 'BUILDING' && selectedBuilding) {
        scopeData.buildingId = selectedBuilding;
      } else if (scopeLevel === 'LINE' && selectedLine) {
        scopeData.lineId = selectedLine;
        scopeData.buildingId = selectedBuilding;
      }

      const { error } = await supabase
        .from('admin_scopes')
        .insert(scopeData);

      if (error) {
        console.error('Failed to save scope:', error);
        await handleInsertFailure();
        return;
      }

      toast.success('권한이 저장되었습니다.');
      dispatch({ type: 'close' });
      fetchManagers();
    } catch (err) {
      console.error('Failed to save scope:', err);
      if (deleted) {
        // 삭제 후 추가 단계에서 예외 — 기존 권한 복구 시도
        await handleInsertFailure();
      } else {
        toast.error('권한 저장에 실패했습니다.');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [selectedManager, scopeLevel, selectedApartment, selectedBuilding, selectedLine, supabase, fetchManagers]);

  return useMemo<UseScopeDialogReturn>(
    () => ({
      opened: state.opened,
      manager: state.manager,
      scopeLevel: state.scopeLevel,
      selectedApartment: state.selectedApartment,
      selectedBuilding: state.selectedBuilding,
      selectedLine: state.selectedLine,
      buildings,
      lines,
      saving,
      setScopeLevel,
      setSelectedApartment,
      setSelectedBuilding,
      setSelectedLine,
      open,
      close,
      save,
    }),
    [state, buildings, lines, saving, setScopeLevel, setSelectedApartment, setSelectedBuilding, setSelectedLine, open, close, save],
  );
}
