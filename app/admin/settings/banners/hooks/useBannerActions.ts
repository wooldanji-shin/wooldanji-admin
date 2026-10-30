import { useCallback, useReducer, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { confirmModal } from '@/components/confirm-modal';
import { deleteFileFromStorage } from '@/lib/utils/storage';
import type {
  Banner,
  ResetClickDialogState,
  SupabaseClient,
  UseBannerActionsReturn,
} from '../types';

interface UseBannerActionsDeps {
  supabase: SupabaseClient;
  banners: Banner[];
  setBanners: Dispatch<SetStateAction<Banner[]>>;
  canEditBanner: (banner: Banner) => boolean;
  canDeleteBanner: (banner: Banner) => boolean;
  loadBanners: () => Promise<void>;
}

type ResetClickAction =
  | { type: 'open'; banner: Banner }
  | { type: 'close' }
  | { type: 'cancel' };

const INITIAL_RESET_CLICK: ResetClickDialogState = { opened: false, banner: null };

function resetClickReducer(state: ResetClickDialogState, action: ResetClickAction): ResetClickDialogState {
  switch (action.type) {
    // setResetClickBanner(b); setResetClickDialogOpen(true);
    case 'open':
      return { opened: true, banner: action.banner };
    // setResetClickDialogOpen(false)
    case 'close':
      return { ...state, opened: false };
    // setResetClickDialogOpen(false); setResetClickBanner(null);
    case 'cancel':
      return { opened: false, banner: null };
    default:
      return state;
  }
}

/** 목록 행 액션 — 활성화 토글, 삭제, 클릭수 초기화 */
export function useBannerActions({
  supabase,
  banners,
  setBanners,
  canEditBanner,
  canDeleteBanner,
  loadBanners,
}: UseBannerActionsDeps): UseBannerActionsReturn {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetClick, dispatchResetClick] = useReducer(resetClickReducer, INITIAL_RESET_CLICK);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  // 중복 실행 방지 — 리렌더 전에 들어온 두 번째 요청도 막는다
  const deletingIdsRef = useRef<Set<string>>(new Set());
  const resettingRef = useRef(false);

  const handleToggleActive = useCallback(async (id: string, isActive: boolean): Promise<void> => {
    const banner = banners.find(b => b.id === id);
    if (!banner || !canEditBanner(banner)) {
      toast.error('이 배너를 수정할 권한이 없습니다.');
      return;
    }

    setTogglingId(id);
    try {
      const { error: updateError } = await supabase
        .from('home_banners')
        .update({ isActive })
        .eq('id', id);

      if (updateError) throw updateError;

      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive } : b))
      );

      toast.success('활성화 상태가 변경되었습니다.');
    } catch (err) {
      console.error('Error toggling active:', err);
      toast.error('활성화 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setTogglingId(null);
    }
  }, [banners, canEditBanner, supabase, setBanners]);

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const banner = banners.find(b => b.id === id);
    if (!banner || !canDeleteBanner(banner)) {
      toast.error('이 배너를 삭제할 권한이 없습니다.');
      return;
    }

    if (!(await confirmModal({ title: '배너 삭제', message: '이 배너를 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) {
      return;
    }

    // 같은 배너를 이미 삭제 중이면 무시
    if (deletingIdsRef.current.has(id)) return;
    deletingIdsRef.current.add(id);
    setDeletingId(id);

    try {
      // 배너 이미지 스토리지에서 삭제
      if (banner.imageUrl) {
        await deleteFileFromStorage(banner.imageUrl);
      }
      if (banner.additionalImageUrl) {
        await deleteFileFromStorage(banner.additionalImageUrl);
      }

      // 연결된 아파트 먼저 삭제 (CASCADE로 자동 삭제되지만 명시적으로)
      await supabase
        .from('home_banner_apartments')
        .delete()
        .eq('bannerId', id);

      const { error: deleteError } = await supabase
        .from('home_banners')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('배너가 삭제되었습니다.');
      await loadBanners();
    } catch (err) {
      console.error('Error deleting banner:', err);
      toast.error('배너 삭제 중 오류가 발생했습니다.');
    } finally {
      deletingIdsRef.current.delete(id);
      setDeletingId((prev) => (prev === id ? null : prev));
    }
  }, [banners, canDeleteBanner, supabase, loadBanners]);

  const openResetClick = useCallback((banner: Banner): void => {
    dispatchResetClick({ type: 'open', banner });
  }, []);

  const closeResetClick = useCallback((): void => {
    dispatchResetClick({ type: 'close' });
  }, []);

  const cancelResetClick = useCallback((): void => {
    dispatchResetClick({ type: 'cancel' });
  }, []);

  // 클릭수 초기화
  const resetClickBanner = resetClick.banner;
  const handleResetClickCount = useCallback(async (): Promise<void> => {
    if (!resetClickBanner || resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);

    try {
      const { error } = await supabase
        .from('home_banners')
        .update({ clickCount: 0, adClickCount: 0 })
        .eq('id', resetClickBanner.id);

      if (error) throw error;

      toast.success('클릭수가 초기화되었습니다.');
      await loadBanners();
      dispatchResetClick({ type: 'cancel' });
    } catch (err) {
      console.error('Error resetting click count:', err);
      toast.error('클릭수 초기화에 실패했습니다.');
    } finally {
      resettingRef.current = false;
      setResetting(false);
    }
  }, [resetClickBanner, supabase, loadBanners]);

  return {
    togglingId,
    handleToggleActive,
    deletingId,
    handleDelete,
    resetClick,
    resetting,
    openResetClick,
    closeResetClick,
    cancelResetClick,
    handleResetClickCount,
  };
}
