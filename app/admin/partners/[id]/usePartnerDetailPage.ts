'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useBizCallDuplicate } from '@/hooks/use-biz-call-duplicate';

export interface PartnerDetail {
  id: string;
  userId: string;
  businessName: string;
  representativeName: string;
  displayPhoneNumber: string | null;
  phoneNumber: string | null;
  businessAddress: string | null;
  businessDetailAddress: string | null;
  businessRegistrationNumber: string | null;
  businessRegistrationImageUrl: string | null;
  businessHoursNote: string | null;
  parkingInfo: string | null;
  directionsInfo: string | null;
  hasHadRunningAd: boolean;
  marketingAgreed: boolean;
  analyticsEnabled: boolean;
  createdAt: string;
  categoryId: string | null;
  categoryName: string | null;
  bizCallNumber: string | null;
}

export interface PartnerCategoryOption {
  id: string;
  categoryName: string;
}

/** 편집 가능한 partner_users 컬럼만 담는다 (영업시간은 별도 테이블이라 제외) */
export interface PartnerEditDraft {
  businessName: string;
  representativeName: string;
  displayPhoneNumber: string;
  phoneNumber: string;
  businessAddress: string;
  businessDetailAddress: string;
  businessRegistrationNumber: string;
  categoryId: string | null;
  parkingInfo: string;
  directionsInfo: string;
  bizCallNumber: string;
}

export interface AdHistoryItem {
  id: string;
  title: string | null;
  adStatus: string;
  paymentStatus: string;
  isFirstAdApplication: boolean | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface UsePartnerDetailPageReturn {
  partner: PartnerDetail | null;
  adHistory: AdHistoryItem[];
  loading: boolean;
  analyticsToggling: boolean;
  handleAdClick: (adId: string) => void;
  handleBack: () => void;
  handleToggleAnalytics: () => Promise<void>;
  // 정보 수정
  categories: PartnerCategoryOption[];
  editing: boolean;
  draft: PartnerEditDraft;
  patchDraft: (changes: Partial<PartnerEditDraft>) => void;
  /** 같은 비즈콜을 이미 쓰는 다른 파트너의 상호명 (중복 없으면 null) */
  bizCallDuplicateName: string | null;
  saving: boolean;
  canSave: boolean;
  startEdit: () => void;
  cancelEdit: () => void;
  handleSave: () => Promise<void>;
}

const EMPTY_DRAFT: PartnerEditDraft = {
  businessName: '',
  representativeName: '',
  displayPhoneNumber: '',
  phoneNumber: '',
  businessAddress: '',
  businessDetailAddress: '',
  businessRegistrationNumber: '',
  categoryId: null,
  parkingInfo: '',
  directionsInfo: '',
  bizCallNumber: '',
};

function toDraft(partner: PartnerDetail): PartnerEditDraft {
  return {
    businessName: partner.businessName ?? '',
    representativeName: partner.representativeName ?? '',
    displayPhoneNumber: partner.displayPhoneNumber ?? '',
    phoneNumber: partner.phoneNumber ?? '',
    businessAddress: partner.businessAddress ?? '',
    businessDetailAddress: partner.businessDetailAddress ?? '',
    businessRegistrationNumber: partner.businessRegistrationNumber ?? '',
    categoryId: partner.categoryId,
    parkingInfo: partner.parkingInfo ?? '',
    directionsInfo: partner.directionsInfo ?? '',
    bizCallNumber: partner.bizCallNumber ?? '',
  };
}

export function usePartnerDetailPage(
  params: Promise<{ id: string }>
): UsePartnerDetailPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [partnerId, setPartnerId] = useState<string>('');
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [adHistory, setAdHistory] = useState<AdHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsToggling, setAnalyticsToggling] = useState(false);
  const [categories, setCategories] = useState<PartnerCategoryOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PartnerEditDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const bizCallDuplicateName = useBizCallDuplicate(
    editing ? draft.bizCallNumber : '',
    partnerId || null
  );

  useEffect(() => {
    params.then((p) => setPartnerId(p.id));
  }, [params]);

  const fetchDetail = useCallback(async (): Promise<void> => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const { data: partnerData, error: partnerError } = await supabase
        .from('partner_users')
        .select(
          'id, userId, businessName, representativeName, displayPhoneNumber, phoneNumber, businessAddress, businessDetailAddress, businessRegistrationNumber, businessRegistrationImageUrl, businessHoursNote, parkingInfo, directionsInfo, hasHadRunningAd, marketingAgreed, analyticsEnabled, bizCallNumber, createdAt, categoryId, ad_categories_v2:categoryId(categoryName)'
        )
        .eq('id', partnerId)
        .single();

      if (partnerError) throw partnerError;

      const row = partnerData as any;
      const mapped: PartnerDetail = {
        id: row.id,
        userId: row.userId,
        businessName: row.businessName,
        representativeName: row.representativeName,
        displayPhoneNumber: row.displayPhoneNumber,
        phoneNumber: row.phoneNumber,
        businessAddress: row.businessAddress,
        businessDetailAddress: row.businessDetailAddress,
        businessRegistrationNumber: row.businessRegistrationNumber,
        businessRegistrationImageUrl: row.businessRegistrationImageUrl,
        businessHoursNote: row.businessHoursNote,
        parkingInfo: row.parkingInfo,
        directionsInfo: row.directionsInfo,
        hasHadRunningAd: row.hasHadRunningAd,
        marketingAgreed: row.marketingAgreed,
        analyticsEnabled: row.analyticsEnabled ?? false,
        createdAt: row.createdAt,
        categoryId: row.categoryId ?? null,
        categoryName: (row.ad_categories_v2 as any)?.categoryName ?? null,
        bizCallNumber: row.bizCallNumber ?? null,
      };
      setPartner(mapped);

      const { data: adsData, error: adsError } = await supabase
        .from('advertisements_v2')
        .select('id, title, adStatus, paymentStatus, isFirstAdApplication, submittedAt, createdAt')
        .eq('partnerId', row.userId)
        .neq('adStatus', 'draft')
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;

      setAdHistory(
        (adsData ?? []).map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          adStatus: ad.adStatus,
          paymentStatus: ad.paymentStatus,
          isFirstAdApplication: ad.isFirstAdApplication,
          submittedAt: ad.submittedAt,
          createdAt: ad.createdAt,
        }))
      );
    } catch (err) {
      console.error('파트너 상세 로드 실패:', err);
      toast.error('파트너 정보를 불러오는데 실패했습니다.');
      router.push('/admin/partners');
    } finally {
      setLoading(false);
    }
  }, [partnerId, supabase, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    supabase
      .from('ad_categories_v2')
      .select('id, categoryName')
      .order('categoryName')
      .then(({ data }) => setCategories((data ?? []) as PartnerCategoryOption[]));
  }, [supabase]);

  const handleToggleAnalytics = async (): Promise<void> => {
    if (!partner || analyticsToggling) return;
    setAnalyticsToggling(true);
    try {
      const next = !partner.analyticsEnabled;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('partner_users')
        .update({ analyticsEnabled: next })
        .eq('id', partner.id);
      if (error) throw error;
      setPartner((prev) => (prev ? { ...prev, analyticsEnabled: next } : prev));
      toast.success(next ? '광고 분석 권한을 부여했습니다.' : '광고 분석 권한을 해제했습니다.');
    } catch (err) {
      console.error('analyticsEnabled 변경 실패:', err);
      toast.error('권한 변경에 실패했습니다.');
    } finally {
      setAnalyticsToggling(false);
    }
  };

  const patchDraft = useCallback((changes: Partial<PartnerEditDraft>): void => {
    setDraft((prev) => ({ ...prev, ...changes }));
  }, []);

  const startEdit = (): void => {
    if (!partner) return;
    setDraft(toDraft(partner));
    setEditing(true);
  };

  const cancelEdit = (): void => {
    setEditing(false);
    setDraft(EMPTY_DRAFT);
  };

  const canSave =
    editing &&
    !saving &&
    draft.businessName.trim().length > 0 &&
    draft.representativeName.trim().length > 0 &&
    bizCallDuplicateName === null;

  const handleSave = async (): Promise<void> => {
    if (!partner || !canSave) return;
    setSaving(true);
    try {
      // 빈 문자열은 '지웠다'는 뜻이므로 null로 저장한다
      const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('partner_users')
        .update({
          businessName: draft.businessName.trim(),
          representativeName: draft.representativeName.trim(),
          displayPhoneNumber: orNull(draft.displayPhoneNumber),
          phoneNumber: orNull(draft.phoneNumber),
          businessAddress: orNull(draft.businessAddress),
          businessDetailAddress: orNull(draft.businessDetailAddress),
          businessRegistrationNumber: orNull(draft.businessRegistrationNumber),
          categoryId: draft.categoryId,
          parkingInfo: orNull(draft.parkingInfo),
          directionsInfo: orNull(draft.directionsInfo),
          bizCallNumber: orNull(draft.bizCallNumber),
        })
        .eq('id', partner.id);

      if (error) throw error;

      toast.success('파트너 정보를 수정했습니다.');
      setEditing(false);
      await fetchDetail();
    } catch (err) {
      // 상호명 중복은 DB 트리거가 막는다 — 메시지를 그대로 보여준다
      const message = (err as { message?: string })?.message ?? '';
      console.error('파트너 정보 수정 실패:', err);
      toast.error(message.includes('상호명') ? message : '파트너 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdClick = (adId: string): void => {
    router.push(`/admin/advertising-v2/applications/${adId}`);
  };

  const handleBack = (): void => {
    router.push('/admin/partners');
  };

  return {
    partner,
    adHistory,
    loading,
    analyticsToggling,
    handleAdClick,
    handleBack,
    handleToggleAnalytics,
    categories,
    editing,
    draft,
    patchDraft,
    bizCallDuplicateName,
    saving,
    canSave,
    startEdit,
    cancelEdit,
    handleSave,
  };
}
