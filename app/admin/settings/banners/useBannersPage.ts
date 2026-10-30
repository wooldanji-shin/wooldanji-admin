import { createClient } from '@/supabase';
import { useBannersFetch } from './hooks/useBannersFetch';
import { useBannerDialog } from './hooks/useBannerDialog';
import { useBannerActions } from './hooks/useBannerActions';
import { useHideClickCounts } from './hooks/useHideClickCounts';
import type { UseBannersPageReturn } from './types';

/** 배너 관리 페이지 — 하위 훅을 조합한다 */
export function useBannersPage(): UseBannersPageReturn {
  const supabase = createClient();

  const clickCounts = useHideClickCounts();
  const fetchHook = useBannersFetch(supabase);
  const dialog = useBannerDialog({
    supabase,
    apartments: fetchHook.apartments,
    currentUserId: fetchHook.currentUserId,
    isManager: fetchHook.isManager,
    canEditBanner: fetchHook.canEditBanner,
    loadBanners: fetchHook.loadBanners,
  });
  const actions = useBannerActions({
    supabase,
    banners: fetchHook.banners,
    setBanners: fetchHook.setBanners,
    canEditBanner: fetchHook.canEditBanner,
    canDeleteBanner: fetchHook.canDeleteBanner,
    loadBanners: fetchHook.loadBanners,
  });

  return { fetch: fetchHook, dialog, actions, clickCounts };
}
