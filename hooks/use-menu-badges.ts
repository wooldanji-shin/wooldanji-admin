'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** 사이드바 배지를 다는 메뉴 — DB 함수 admin_menu_badge_keys()와 같은 목록이어야 한다 */
export type MenuBadgeKey =
  | 'users'
  | 'user_reconfirm'
  | 'inquiries'
  | 'partners'
  | 'partner_inquiries'
  | 'partner_events'
  | 'ad_applications'
  | 'premium_ads'
  | 'solo_popup_ads';

/** 새 데이터가 들어왔는지 다시 확인하는 간격 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * 관리자별 '마지막으로 본 뒤 새로 생긴 건수'.
 * 본 기록은 DB에 계정 단위로 저장돼 PC·폰 어디서 봐도 같다.
 * 현재 페이지가 배지 메뉴면 들어온 것으로 보고 0으로 만든다.
 */
export function useMenuBadges(
  enabled: boolean,
  currentKey: MenuBadgeKey | null
): Partial<Record<MenuBadgeKey, number>> {
  const supabase = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState<Partial<Record<MenuBadgeKey, number>>>({});
  const [initialized, setInitialized] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_admin_menu_badges');
    if (error) {
      console.error('[MenuBadges] 조회 실패:', error);
      return;
    }
    setCounts(
      Object.fromEntries(((data ?? []) as { menuKey: MenuBadgeKey; newCount: number }[]).map((r) => [r.menuKey, Number(r.newCount) || 0]))
    );
  }, [supabase]);

  // 처음 쓰는 관리자는 기록이 없어 과거 데이터가 전부 잡히지 않도록 지금부터 센다
  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('init_admin_menu_seen').then(({ error }: { error: unknown }) => {
      if (error) console.error('[MenuBadges] 초기화 실패:', error);
      setInitialized(true);
    });
  }, [enabled, supabase]);

  // 배지 메뉴 페이지에 들어오면 본 것으로 기록하고 다시 센다
  useEffect(() => {
    if (!enabled || !initialized) return;
    if (!currentKey) {
      refresh();
      return;
    }
    setCounts((prev) => ({ ...prev, [currentKey]: 0 }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('mark_admin_menu_seen', { p_menu_key: currentKey }).then(({ error }: { error: unknown }) => {
      if (error) console.error('[MenuBadges] 확인 기록 실패:', error);
      refresh();
    });
  }, [enabled, initialized, currentKey, supabase, refresh]);

  useEffect(() => {
    if (!enabled || !initialized) return;
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, initialized, refresh]);

  return counts;
}
