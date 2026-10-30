import type { Dispatch, SetStateAction } from 'react';
import type { createClient } from '@/supabase';
import type { LinkableAd } from './LinkedAdPicker';

// --------------- Supabase Client ---------------

export type SupabaseClient = ReturnType<typeof createClient>;

// --------------- Constants ---------------

export const BUCKET_NAME = 'home-content';
export const BANNERS_FOLDER = 'banners';

// --------------- Domain Models ---------------

export interface Banner {
  id: string;
  imageUrl: string;
  additionalImageUrl: string | null;
  linkUrl: string | null;
  isActive: boolean;
  isGlobal: boolean;
  createdAt: string;
  createdBy: string | null;
  startDate: string | null;
  endDate: string | null;
  clickCount: number;
  adClickCount: number;
  description: string | null;
  isDirectLink: boolean;
  /** normal(기본) / ajl(아정당 — 링크 2개 중 선택 후 인앱 웹뷰) / ad(연결된 광고 상세로 이동) */
  bannerType: 'normal' | 'ajl' | 'ad';
  secondLinkUrl: string | null;
  linkedAdId: string | null;
  linkedPremiumAdId: string | null;
  user?: {
    id: string;
    name: string;
  } | null;
  home_banner_apartments?: {
    apartmentId: string;
    apartments: {
      id: string;
      name: string;
    };
  }[];
}

export interface BannerForm {
  linkUrl: string;
  isDirectLink: boolean;
  isAjl: boolean;
  secondLinkUrl: string;
  /** 광고 연결 배너 — 탭하면 앱이 연결된 광고 상세로 바로 이동 */
  isAdLink: boolean;
  linkedAdId: string | null;
  linkedPremiumAdId: string | null;
  imageUrl: string;
  additionalImageUrl: string;
  isActive: boolean;
  isGlobal: boolean;
  selectedApartments: string[];
  startDate: string;
  endDate: string;
  description: string;
}

export interface Apartment {
  id: string;
  name: string;
  address: string;
}

/** 새 배너 / 초기화 시 폼 기본값 — 호출할 때마다 새 객체를 만든다 */
export function createEmptyBannerForm(): BannerForm {
  return {
    linkUrl: '',
    isDirectLink: false,
    isAjl: false,
    secondLinkUrl: '',
    isAdLink: false,
    linkedAdId: null,
    linkedPremiumAdId: null,
    imageUrl: '',
    additionalImageUrl: '',
    isActive: true,
    isGlobal: false,
    selectedApartments: [],
    startDate: '',
    endDate: '',
    description: '',
  };
}

// --------------- Hook Return Types ---------------

export interface UseHideClickCountsReturn {
  hideClickCounts: boolean;
  handleHideClickCountsChange: (checked: boolean) => void;
}

export interface UseBannersFetchReturn {
  banners: Banner[];
  setBanners: Dispatch<SetStateAction<Banner[]>>;
  apartments: Apartment[];
  loading: boolean;
  currentUserId: string | null;
  isSuperAdmin: boolean;
  isManager: boolean;
  loadBanners: () => Promise<void>;
  canEditBanner: (banner: Banner) => boolean;
  canDeleteBanner: (banner: Banner) => boolean;
}

/** 등록/수정 다이얼로그 — 함께 바뀌는 값들이라 하나의 reducer로 관리한다 */
export interface BannerDialogState {
  opened: boolean;
  editingBanner: Banner | null;
  form: BannerForm;
  apartmentSearch: string;
  // 연결한 광고 — 배너 대상 아파트를 이 광고의 노출 아파트 안으로 제한한다
  linkedAd: LinkableAd | null;
  saving: boolean;
  /** 수정 다이얼로그를 열 때의 대상 아파트 — 아파트 연결 저장 실패 시 복구용 */
  originalApartmentIds: string[];
}

export type BannerFormUpdate = BannerForm | ((prev: BannerForm) => BannerForm);

export interface UseBannerDialogReturn {
  opened: boolean;
  editingBanner: Banner | null;
  form: BannerForm;
  apartmentSearch: string;
  saving: boolean;
  selectableApartments: Apartment[];
  /** useState의 setForm과 같은 API — 객체 또는 updater 함수 */
  setForm: (value: BannerFormUpdate) => void;
  setApartmentSearch: (value: string) => void;
  /** Modal onClose — 닫기만 하고 폼은 그대로 둔다 */
  closeDialog: () => void;
  resetForm: () => void;
  handleAddNew: () => void;
  handleEdit: (banner: Banner) => Promise<void>;
  handleSelectLinkedAd: (ad: LinkableAd | null) => void;
  handleSave: () => Promise<void>;
}

export interface ResetClickDialogState {
  opened: boolean;
  banner: Banner | null;
}

export interface UseBannerActionsReturn {
  togglingId: string | null;
  handleToggleActive: (id: string, isActive: boolean) => Promise<void>;
  /** 삭제 처리 중인 배너 id — 해당 행 삭제 버튼을 잠근다 */
  deletingId: string | null;
  handleDelete: (id: string) => Promise<void>;
  resetClick: ResetClickDialogState;
  /** 클릭수 초기화 처리 중 */
  resetting: boolean;
  openResetClick: (banner: Banner) => void;
  /** Modal onClose — 닫기만 한다 (배너는 유지) */
  closeResetClick: () => void;
  /** 취소 버튼 — 닫고 배너도 비운다 */
  cancelResetClick: () => void;
  handleResetClickCount: () => Promise<void>;
}

export interface UseBannersPageReturn {
  fetch: UseBannersFetchReturn;
  dialog: UseBannerDialogReturn;
  actions: UseBannerActionsReturn;
  clickCounts: UseHideClickCountsReturn;
}
