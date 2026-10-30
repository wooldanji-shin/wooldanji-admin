import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getUserRoles, getSessionUser } from '@/lib/auth';
import type { Apartment, Banner, SupabaseClient, UseBannersFetchReturn } from '../types';

/** 사용자 권한 · 아파트 목록 · 배너 목록 조회와 권한 체크 */
export function useBannersFetch(supabase: SupabaseClient): UseBannersFetchReturn {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('REGION_ADMIN');
  const isManager = userRoles.includes('MANAGER');

  // 현재 사용자 정보 조회
  useEffect(() => {
    const fetchUserInfo = async (): Promise<void> => {
      const roles = await getUserRoles();
      setUserRoles(roles);

      const { data: { user } } = await getSessionUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUserInfo();
  }, [supabase]);

  // 아파트 목록 조회
  const fetchApartments = useCallback(async (): Promise<void> => {
    if (!currentUserId) return;

    try {
      if (isSuperAdmin) {
        const { data } = await supabase
          .from('apartments')
          .select('id, name, address')
          .order('name');
        setApartments(data || []);
      } else {
        // 매니저는 자신이 등록한 아파트만 조회
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId, apartments:apartmentId(id, name, address)')
          .eq('managerId', currentUserId);

        if (managerApartments) {
          const apts = managerApartments
            .filter((ma: any) => ma.apartments)
            .map((ma: any) => ma.apartments)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
          setApartments(apts);
        } else {
          setApartments([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
      setApartments([]);
    }
  }, [supabase, currentUserId, isSuperAdmin]);

  // 렌더 시점의 isManager/currentUserId를 쓰는 것은 기존과 같다. 핸들러를 안정적으로 넘기기 위해 useCallback으로 감쌌다.
  const loadBanners = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);

      let query = supabase
        .from('home_banners')
        .select(`
          *,
          home_banner_apartments(
            apartmentId,
            apartments:apartmentId(id, name)
          )
        `)
        .order('createdAt', { ascending: false });

      // 매니저는 자신이 등록한 배너만 조회
      if (isManager && currentUserId) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // 게시자 정보 가져오기
      const creatorIds = [...new Set((data || []).map(b => b.createdBy).filter(Boolean))];
      let usersMap: Record<string, { id: string; name: string }> = {};

      if (creatorIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user')
          .select('id, name')
          .in('id', creatorIds);

        if (usersData) {
          usersMap = usersData.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {} as Record<string, { id: string; name: string }>);
        }
      }

      // 배너에 user 정보 추가
      const bannersWithInfo = (data || []).map(banner => ({
        ...banner,
        user: banner.createdBy ? usersMap[banner.createdBy] || null : null,
      }));

      setBanners(bannersWithInfo);
    } catch (err) {
      console.error('Error loading banners:', err);
      toast.error('배너를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, isManager, currentUserId]);

  // 의존성 배열은 기존 페이지와 동일하게 유지한다 (loadBanners는 의도적으로 제외)
  useEffect(() => {
    if (currentUserId) {
      loadBanners();
      fetchApartments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, fetchApartments, isManager]);

  // 권한 체크 함수
  const canEditBanner = useCallback((banner: Banner): boolean => {
    if (isSuperAdmin) return true;
    if (isManager && banner.createdBy === currentUserId) return true;
    return false;
  }, [isSuperAdmin, isManager, currentUserId]);

  const canDeleteBanner = useCallback((banner: Banner): boolean => {
    if (isSuperAdmin) return true;
    if (isManager && banner.createdBy === currentUserId) return true;
    return false;
  }, [isSuperAdmin, isManager, currentUserId]);

  return {
    banners,
    setBanners,
    apartments,
    loading,
    currentUserId,
    isSuperAdmin,
    isManager,
    loadBanners,
    canEditBanner,
    canDeleteBanner,
  };
}
