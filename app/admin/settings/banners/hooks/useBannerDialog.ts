import { useCallback, useReducer, useRef } from 'react';
import { toast } from 'sonner';
import type { LinkableAd } from '../LinkedAdPicker';
import {
  createEmptyBannerForm,
  type Apartment,
  type Banner,
  type BannerDialogState,
  type BannerForm,
  type BannerFormUpdate,
  type SupabaseClient,
  type UseBannerDialogReturn,
} from '../types';

interface UseBannerDialogDeps {
  supabase: SupabaseClient;
  apartments: Apartment[];
  currentUserId: string | null;
  isManager: boolean;
  canEditBanner: (banner: Banner) => boolean;
  loadBanners: () => Promise<void>;
}

type BannerDialogAction =
  | { type: 'openNew' }
  | { type: 'openEdit'; banner: Banner; form: BannerForm; originalApartmentIds: string[] }
  | { type: 'close' }
  | { type: 'reset' }
  | { type: 'setForm'; value: BannerFormUpdate }
  | { type: 'setApartmentSearch'; value: string }
  | { type: 'selectLinkedAd'; ad: LinkableAd | null }
  | { type: 'setSaving'; value: boolean };

function createInitialState(): BannerDialogState {
  return {
    opened: false,
    editingBanner: null,
    form: createEmptyBannerForm(),
    apartmentSearch: '',
    linkedAd: null,
    saving: false,
    originalApartmentIds: [],
  };
}

function bannerDialogReducer(state: BannerDialogState, action: BannerDialogAction): BannerDialogState {
  switch (action.type) {
    // handleAddNew
    case 'openNew':
      return {
        ...state,
        editingBanner: null,
        apartmentSearch: '',
        linkedAd: null,
        form: createEmptyBannerForm(),
        originalApartmentIds: [],
        opened: true,
      };
    // handleEdit
    case 'openEdit':
      return {
        ...state,
        editingBanner: action.banner,
        apartmentSearch: '',
        linkedAd: null,
        form: action.form,
        originalApartmentIds: action.originalApartmentIds,
        opened: true,
      };
    // setDialogOpen(false)
    case 'close':
      return { ...state, opened: false };
    // resetForm
    case 'reset':
      return {
        ...state,
        form: createEmptyBannerForm(),
        editingBanner: null,
        apartmentSearch: '',
        linkedAd: null,
        originalApartmentIds: [],
      };
    case 'setForm':
      return {
        ...state,
        form: typeof action.value === 'function' ? action.value(state.form) : action.value,
      };
    case 'setApartmentSearch':
      return { ...state, apartmentSearch: action.value };
    // 광고를 고르면 배너 대상 아파트에서 그 광고가 노출되지 않는 곳을 뺀다
    case 'selectLinkedAd': {
      const ad = action.ad;
      if (!ad) return { ...state, linkedAd: null };
      const prev = state.form;
      return {
        ...state,
        linkedAd: ad,
        form: {
          ...prev,
          linkedAdId: ad.kind === 'base' ? ad.id : null,
          linkedPremiumAdId: ad.kind === 'premium' ? ad.id : null,
          selectedApartments: prev.selectedApartments.filter((aptId) => ad.apartmentIds.includes(aptId)),
        },
      };
    }
    case 'setSaving':
      return { ...state, saving: action.value };
    default:
      return state;
  }
}

/** 배너 등록/수정 다이얼로그 — 열기/닫기, 폼, 광고 연결, 저장 */
export function useBannerDialog({
  supabase,
  apartments,
  currentUserId,
  isManager,
  canEditBanner,
  loadBanners,
}: UseBannerDialogDeps): UseBannerDialogReturn {
  const [state, dispatch] = useReducer(bannerDialogReducer, undefined, createInitialState);
  const { opened, editingBanner, form, apartmentSearch, linkedAd, saving, originalApartmentIds } = state;
  // 저장 중복 실행 방지 — 리렌더 전에 들어온 두 번째 클릭도 막는다
  const savingRef = useRef(false);

  const setForm = useCallback((value: BannerFormUpdate): void => {
    dispatch({ type: 'setForm', value });
  }, []);

  const setApartmentSearch = useCallback((value: string): void => {
    dispatch({ type: 'setApartmentSearch', value });
  }, []);

  const closeDialog = useCallback((): void => {
    dispatch({ type: 'close' });
  }, []);

  const resetForm = useCallback((): void => {
    dispatch({ type: 'reset' });
  }, []);

  const handleAddNew = useCallback((): void => {
    dispatch({ type: 'openNew' });
  }, []);

  const handleEdit = useCallback(async (banner: Banner): Promise<void> => {
    if (!canEditBanner(banner)) {
      toast.error('이 배너를 수정할 권한이 없습니다.');
      return;
    }

    // 연결된 아파트 ID 조회
    const { data: apartmentData } = await supabase
      .from('home_banner_apartments')
      .select('apartmentId')
      .eq('bannerId', banner.id);

    const selectedApts = apartmentData?.map(a => a.apartmentId) || [];

    dispatch({
      type: 'openEdit',
      banner,
      // 아파트 연결 저장 실패 시 되돌릴 원래 목록
      originalApartmentIds: selectedApts,
      form: {
        linkUrl: banner.linkUrl || '',
        isDirectLink: banner.isDirectLink ?? false,
        isAjl: banner.bannerType === 'ajl',
        secondLinkUrl: banner.secondLinkUrl || '',
        isAdLink: banner.bannerType === 'ad',
        linkedAdId: banner.linkedAdId ?? null,
        linkedPremiumAdId: banner.linkedPremiumAdId ?? null,
        imageUrl: banner.imageUrl,
        additionalImageUrl: banner.additionalImageUrl || '',
        isActive: banner.isActive,
        isGlobal: banner.isGlobal,
        selectedApartments: selectedApts,
        startDate: banner.startDate ? banner.startDate.split('T')[0] : '',
        endDate: banner.endDate ? banner.endDate.split('T')[0] : '',
        description: banner.description || '',
      },
    });
  }, [supabase, canEditBanner]);

  const fetchPremiumBaseAdId = async (premiumAdId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('premium_advertisements_v2')
      .select('baseAdId')
      .eq('id', premiumAdId)
      .maybeSingle();
    return (data as { baseAdId: string | null } | null)?.baseAdId ?? null;
  };

  /**
   * 광고 연결 배너 검증 — 문제가 있으면 메시지, 없으면 null.
   * 노출 아파트는 저장 시점에 DB에서 다시 읽는다 (폼을 연 뒤 광고의 아파트가 바뀌었을 수 있다).
   */
  const validateAdLink = async (): Promise<string | null> => {
    if (!form.linkedAdId && !form.linkedPremiumAdId) {
      return '연결할 광고를 선택해주세요.';
    }
    if (form.isGlobal) {
      return '광고 연결 배너는 전체 대상으로 등록할 수 없습니다. 광고가 노출 중인 아파트를 선택해주세요.';
    }
    // 내린 배너는 연결 광고가 종료됐어도 저장할 수 있어야 한다
    if (!form.isActive) return null;
    if (!linkedAd) {
      return '연결된 광고가 노출 중이 아닙니다. 다른 광고를 연결하거나 배너를 비활성화해주세요.';
    }

    const baseAdId = form.linkedAdId ?? (await fetchPremiumBaseAdId(form.linkedPremiumAdId!));
    if (!baseAdId) return '연결한 프리미엄 광고의 기본 광고를 찾을 수 없습니다.';

    const { data: adApartments } = await supabase
      .from('advertisement_apartments_v2')
      .select('apartmentId')
      .eq('advertisementId', baseAdId);
    const exposed = new Set((adApartments ?? []).map((a: { apartmentId: string }) => a.apartmentId));
    const outside = form.selectedApartments.filter((aptId) => !exposed.has(aptId));
    if (outside.length > 0) {
      return `광고가 노출되지 않는 아파트 ${outside.length}곳이 선택되어 있습니다. 광고 노출 아파트 안에서만 선택해주세요.`;
    }
    return null;
  };

  // 광고를 고르면 배너 대상 아파트에서 그 광고가 노출되지 않는 곳을 뺀다
  const handleSelectLinkedAd = useCallback((ad: LinkableAd | null): void => {
    dispatch({ type: 'selectLinkedAd', ad });
  }, []);

  // 광고 연결 배너는 연결 광고의 노출 아파트만 대상 후보로 보여준다
  const selectableApartments = form.isAdLink
    ? apartments.filter((apt) => linkedAd?.apartmentIds.includes(apt.id))
    : apartments;

  /** 배너의 아파트 연결 추가 — 실패하면 에러를 돌려준다 */
  const insertBannerApartments = async (bannerId: string, apartmentIds: string[]): Promise<unknown> => {
    if (apartmentIds.length === 0) return null;
    const { error } = await supabase
      .from('home_banner_apartments')
      .insert(
        apartmentIds.map(aptId => ({
          bannerId,
          apartmentId: aptId,
        }))
      );
    return error;
  };

  const handleSave = async (): Promise<void> => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      dispatch({ type: 'setSaving', value: true });

      // 이미지는 필수
      if (!form.imageUrl) {
        toast.error('배너 이미지를 업로드해주세요.');
        return;
      }

      // isGlobal이 false면 아파트 선택 필수
      if (!form.isGlobal && form.selectedApartments.length === 0) {
        toast.error('전체 대상이 아닌 경우 최소 하나의 아파트를 선택해야 합니다.');
        return;
      }

      // isGlobal이 false면 게시기간 필수
      if (!form.isGlobal && (!form.startDate || !form.endDate)) {
        toast.error('게시 기간을 설정해주세요.');
        return;
      }

      // 매니저는 isGlobal 사용 불가
      if (isManager && form.isGlobal) {
        toast.error('매니저는 전체 대상 배너를 등록할 수 없습니다.');
        return;
      }

      const linkUrl = form.linkUrl.trim() || null;
      const secondLinkUrl = form.secondLinkUrl.trim() || null;

      // 아정당 배너는 두 상담 링크가 모두 있어야 앱에서 선택지가 성립한다
      if (form.isAjl && (!linkUrl || !secondLinkUrl)) {
        toast.error('아정당 배너는 인터넷 가입 상담·가전 렌탈 상담 링크를 모두 입력해야 합니다.');
        return;
      }

      if (form.isAdLink) {
        const adLinkError = await validateAdLink();
        if (adLinkError) {
          toast.error(adLinkError);
          return;
        }
      }

      const bannerData = {
        imageUrl: form.imageUrl,
        additionalImageUrl: form.additionalImageUrl.trim() || null,
        linkUrl,
        // 아정당·광고 연결 배너는 앱이 자체 동작을 하므로 바로 이동 옵션과 함께 쓰지 않는다
        isDirectLink: linkUrl && !form.isAjl && !form.isAdLink ? form.isDirectLink : false,
        bannerType: form.isAjl ? 'ajl' : form.isAdLink ? 'ad' : 'normal',
        secondLinkUrl: form.isAjl ? secondLinkUrl : null,
        linkedAdId: form.isAdLink ? form.linkedAdId : null,
        linkedPremiumAdId: form.isAdLink ? form.linkedPremiumAdId : null,
        isActive: form.isActive,
        isGlobal: form.isGlobal,
        createdBy: editingBanner ? editingBanner.createdBy : currentUserId,
        startDate: form.isGlobal ? null : (form.startDate ? new Date(form.startDate + 'T00:00:00').toISOString() : null),
        endDate: form.isGlobal ? null : (form.endDate ? new Date(form.endDate + 'T23:59:59').toISOString() : null),
        description: form.description.trim() || null,
      };

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from('home_banners')
          .update(bannerData)
          .eq('id', editingBanner.id);

        if (updateError) throw updateError;

        // 기존 아파트 연결 삭제
        const { error: unlinkError } = await supabase
          .from('home_banner_apartments')
          .delete()
          .eq('bannerId', editingBanner.id);

        // 삭제 실패 — 기존 연결은 그대로 남아 있다. 다이얼로그를 열어둬 다시 저장할 수 있게 한다
        if (unlinkError) {
          console.error('Error unlinking banner apartments:', unlinkError);
          toast.error('대상 아파트 변경에 실패했습니다. 다시 저장해주세요.');
          await loadBanners();
          return;
        }

        // 새 아파트 연결 추가 (isGlobal이 false인 경우만)
        if (!form.isGlobal && form.selectedApartments.length > 0) {
          const linkError = await insertBannerApartments(editingBanner.id, form.selectedApartments);
          if (linkError) {
            console.error('Error linking banner apartments:', linkError);
            // 연결이 모두 지워진 상태 — 다이얼로그를 열 때의 연결로 되돌린다
            const restoreError = await insertBannerApartments(editingBanner.id, originalApartmentIds);
            if (restoreError) {
              console.error('Error restoring banner apartments:', restoreError);
              toast.error('대상 아파트 저장과 복구에 실패했습니다. 대상 아파트를 다시 선택해 저장해주세요.');
            } else {
              toast.error('대상 아파트 저장에 실패해 이전 대상으로 되돌렸습니다. 다시 저장해주세요.');
            }
            await loadBanners();
            return;
          }
        }

        toast.success('배너가 수정되었습니다.');
      } else {
        const { data: newBanner, error: insertError } = await supabase
          .from('home_banners')
          .insert(bannerData)
          .select()
          .single();

        if (insertError) throw insertError;

        // 아파트 연결 추가 (isGlobal이 false인 경우만)
        if (!form.isGlobal && form.selectedApartments.length > 0 && newBanner) {
          const linkError = await insertBannerApartments(newBanner.id, form.selectedApartments);
          if (linkError) {
            console.error('Error linking banner apartments:', linkError);
            // 배너는 이미 등록됐다 — 다시 저장하면 중복 등록되므로 다이얼로그를 닫고 수정으로 안내한다
            toast.error('배너는 등록됐지만 대상 아파트가 저장되지 않았습니다. 수정에서 다시 선택해주세요.');
            await loadBanners();
            closeDialog();
            resetForm();
            return;
          }
        }

        toast.success('배너가 등록되었습니다.');
      }

      await loadBanners();
      closeDialog();
      resetForm();
    } catch (err) {
      console.error('Error saving banner:', err);
      toast.error('배너 저장 중 오류가 발생했습니다.');
    } finally {
      savingRef.current = false;
      dispatch({ type: 'setSaving', value: false });
    }
  };

  return {
    opened,
    editingBanner,
    form,
    apartmentSearch,
    saving,
    selectableApartments,
    setForm,
    setApartmentSearch,
    closeDialog,
    resetForm,
    handleAddNew,
    handleEdit,
    handleSelectLinkedAd,
    handleSave,
  };
}
