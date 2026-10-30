import { useCallback, useReducer, useState } from 'react';
import { toast } from 'sonner';
import type { UserFullDetails } from '@/lib/supabase/types';
import type {
  DetailDialogAction,
  DetailDialogState,
  EditForm,
  UseDetailDialogDeps,
  UseDetailDialogReturn,
} from '../types';

const initialState: DetailDialogState = { opened: false, user: null, editForm: {} };

// 열기/대상 회원/폼이 함께 바뀌어서 reducer로 묶는다.
// close는 열림만 끄고(대상·폼 유지), saved는 열림을 끄고 대상만 비운다 (폼은 기존처럼 그대로 둔다)
function detailDialogReducer(state: DetailDialogState, action: DetailDialogAction): DetailDialogState {
  switch (action.type) {
    case 'open':
      return { opened: true, user: action.user, editForm: action.editForm };
    case 'close':
      return { ...state, opened: false };
    case 'setField':
      return { ...state, editForm: { ...state.editForm, [action.field]: action.value } };
    case 'saved':
      return { ...state, opened: false, user: null };
    default:
      return state;
  }
}

// 호수에서 라인 추출 (끝 2자리)
const getLineFromUnit = (unit: number): number => {
  return unit % 100;
};

/** 회원 전체보기/수정 다이얼로그 */
export function useDetailDialog({ supabase, fetchUsers }: UseDetailDialogDeps): UseDetailDialogReturn {
  const [state, dispatch] = useReducer(detailDialogReducer, initialState);
  const [saving, setSaving] = useState(false);
  const detailUser = state.user;
  const editForm = state.editForm;

  // 전체보기 다이얼로그 열기 — 표(memo)에 넘기는 핸들러라 참조를 고정한다
  const handleDetailClick = useCallback((user: UserFullDetails): void => {
    const nextForm: EditForm = {
      name: user.name || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      detailAddress: user.detailAddress || '',
      birthDay: user.birthDay || '',
      buildingNumber: user.buildingNumber || '',
      unit: user.unit || '',
      approvalStatus: user.approvalStatus || 'pending',
      registrationType: user.registrationType || '',
      premium: user.premium || false,
      premiumExpiryDate: user.premiumExpiryDate ? user.premiumExpiryDate.split('T')[0] : '',
      openDoorCount: user.openDoorCount || 0,
      shareUserCount: user.shareUserCount || 0,
      rssLevel: user.rssLevel || 0,
      suspensionReason: user.suspensionReason || '',
      regionSido: user.regionSido || '',
      regionSigungu: user.regionSigungu || '',
      regionDong: user.regionDong || '',
    };
    dispatch({ type: 'open', user, editForm: nextForm });
  }, []);

  const setField = useCallback((field: string, value: string): void => {
    dispatch({ type: 'setField', field, value });
  }, []);

  const close = useCallback((): void => {
    dispatch({ type: 'close' });
  }, []);

  // 전체보기 저장
  // memo된 다이얼로그가 무관한 렌더(검색 입력 등)에 다시 그려지지 않도록 참조 고정 — deps는 본문이 읽는 값 전부
  const handleDetailSave = useCallback(async (): Promise<void> => {
    if (!detailUser) return;

    setSaving(true);
    try {
      const newUnit = editForm.unit ? parseInt(editForm.unit) : null;
      const newBuildingNumber = editForm.buildingNumber ? parseInt(editForm.buildingNumber) : null;

      // 호수가 변경되었고, 아파트 회원인 경우 라인 검증
      if (newUnit && detailUser.apartmentId && newBuildingNumber) {
        const lineFromUnit = getLineFromUnit(newUnit);

        // 해당 아파트의 동 정보 조회
        const { data: buildingData } = await supabase
          .from('apartment_buildings')
          .select('id')
          .eq('apartmentId', detailUser.apartmentId)
          .eq('buildingNumber', newBuildingNumber)
          .single();

        if (buildingData) {
          // 해당 동의 라인 정보 조회
          const { data: linesData } = await supabase
            .from('apartment_lines')
            .select('line')
            .eq('buildingId', buildingData.id);

          if (linesData && linesData.length > 0) {
            // 모든 라인 배열에서 해당 라인이 있는지 확인
            const allLines = linesData.flatMap((l: { line: number[] }) => l.line);
            if (!allLines.includes(lineFromUnit)) {
              toast.error('해당 호수는 등록할 수 없습니다.');
              setSaving(false);
              return;
            }
          }
        }
      }

      const updateData: Record<string, any> = {
        name: editForm.name || null,
        phoneNumber: editForm.phoneNumber || null,
        birthDay: editForm.birthDay || null,
        buildingNumber: newBuildingNumber,
        unit: newUnit,
        openDoorCount: parseInt(editForm.openDoorCount) || 0,
        rssLevel: parseInt(editForm.rssLevel) || 0,
      };

      const { error } = await supabase
        .from('user')
        .update(updateData)
        .eq('id', detailUser.id);

      if (error) throw error;

      toast.success('회원 정보가 수정되었습니다.');
      dispatch({ type: 'saved' });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error('회원 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [detailUser, editForm, supabase, fetchUsers]);

  return {
    opened: state.opened,
    detailUser,
    editForm,
    saving,
    handleDetailClick,
    setField,
    close,
    handleDetailSave,
  };
}
