'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { calcMonthlyAmount } from '@/lib/ads/pricing';
import { MAX_AD_IMAGES } from '@/lib/ads/constants';
import { uploadImageFile } from '@/lib/utils/upload-image';
import { deleteFilesFromStorage } from '@/lib/utils/storage';
import { adImageKey, type AdImageItem } from '@/components/ad-image-picker';
import { useBizCallDuplicate } from '@/hooks/use-biz-call-duplicate';
import {
  MAX_CTA_BUTTONS,
  ctaButtonsError,
  isDeliveryButton,
  isDeliveryCategory,
  newCtaButtonId,
  parseCtaButtons,
  type CtaButton,
  type CtaButtonType,
} from '@/lib/cta-button';

export interface PartnerOption {
  id: string;
  businessName: string;
  representativeName: string | null;
  displayPhoneNumber: string | null;
  businessAddress: string | null;
  bizCallNumber: string | null;
  analyticsEnabled: boolean;
  hasHadRunningAd: boolean;
}

export interface ApartmentOption {
  id: string;
  name: string;
  totalHouseholds: number;
}

export interface CategoryOption {
  id: string;
  categoryName: string;
  subCategories: { id: string; subCategoryName: string }[];
}

export interface AdFormState {
  partnerId: string | null;
  categoryId: string | null;
  subCategoryIds: string[];
  title: string;
  content: string;
  /** 기존 이미지(url)와 새로 고른 파일(file)이 섞여 있다. 실제 업로드는 저장 시점에 한다 */
  images: AdImageItem[];
  naverMapUrl: string;
  blogUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  kakaoOpenChatUrl: string;
  ctaButtons: CtaButton[];
  apartmentIds: string[];
  discountRate: number;
  freeMonths: number;
  overrideEnabled: boolean;
  discountNote: string;
  adminMemo: string;
  bizCallNumber: string;
  grantAnalytics: boolean;
  salesRepId: string | null;
}

const EMPTY_FORM: AdFormState = {
  partnerId: null,
  categoryId: null,
  subCategoryIds: [],
  title: '',
  content: '',
  images: [],
  naverMapUrl: '',
  blogUrl: '',
  youtubeUrl: '',
  instagramUrl: '',
  kakaoOpenChatUrl: '',
  ctaButtons: [],
  apartmentIds: [],
  discountRate: 0,
  freeMonths: 0,
  overrideEnabled: false,
  discountNote: '',
  adminMemo: '',
  bizCallNumber: '',
  grantAnalytics: false,
  salesRepId: null,
};

/**
 * 광고 대리 등록/수정 폼 상태
 *
 * [adId]를 주면 기존 광고를 불러와 수정 모드로 동작한다. 파트너는 바꿀 수 없다.
 * 광고중(running)이면 내용·카테고리만 고치는 모드(contentOnly) — 아파트·할인·무료기간은
 * 돌고 있는 구독 청구액의 근거라 잠근다.
 */
export function useAdForm(adId?: string) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!adId;

  const [form, setForm] = useState<AdFormState>(EMPTY_FORM);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [partnerEmails, setPartnerEmails] = useState<Record<string, string | null>>({});
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [pricePerHousehold, setPricePerHousehold] = useState(70);
  // 수정 모드에서는 저장된 첫 광고 여부를 그대로 쓴다 (파트너 상태로 다시 판정하면 어긋난다)
  const [existingIsFirstAd, setExistingIsFirstAd] = useState<boolean | null>(null);
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([]);
  // 광고중 수정 — 금액의 근거가 되는 입력을 잠근다
  const [contentOnly, setContentOnly] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const patch = useCallback((changes: Partial<AdFormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  useEffect(() => {
    const loadExistingAd = async (id: string, partnerList: PartnerOption[]) => {
      const [adRes, aptRes, subRes] = await Promise.all([
        supabase
          .from('advertisements_v2')
          .select('*')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('advertisement_apartments_v2')
          .select('apartmentId')
          .eq('advertisementId', id),
        supabase
          .from('advertisement_sub_categories_v2')
          .select('subCategoryId')
          .eq('advertisementId', id),
      ]);

      const ad = adRes.data as any;
      if (!ad) {
        setLoadError('광고를 찾을 수 없습니다.');
        return;
      }
      const isRunning = ad.adStatus === 'running';
      const isBeforePayment = ad.adStatus === 'approved' && ad.paymentStatus === 'unpaid';
      if (!isRunning && !isBeforePayment) {
        setLoadError('결제 전(승인·미결제) 또는 광고중인 광고만 수정할 수 있습니다.');
        return;
      }
      if (isRunning && ad.modificationStatus === 'pending') {
        setLoadError('파트너의 수정 심사가 진행 중입니다. 먼저 승인하거나 거절해주세요.');
        return;
      }
      setContentOnly(isRunning);

      const partner = partnerList.find((p) => p.id === ad.partnerId);

      setExistingIsFirstAd(ad.isFirstAdApplication === true);
      // 저장 시 제거된 이미지를 가려내기 위해 원본 목록을 남겨둔다
      setOriginalImageUrls((ad.imageUrls ?? []) as string[]);
      setForm({
        partnerId: ad.partnerId,
        categoryId: ad.categoryId,
        subCategoryIds: ((subRes.data ?? []) as any[]).map((s) => s.subCategoryId),
        title: ad.title ?? '',
        content: ad.content ?? '',
        images: ((ad.imageUrls ?? []) as string[]).map(
          (url) => ({ kind: 'url' as const, url })
        ),
        naverMapUrl: ad.naverMapUrl ?? '',
        blogUrl: ad.blogUrl ?? '',
        youtubeUrl: ad.youtubeUrl ?? '',
        instagramUrl: ad.instagramUrl ?? '',
        kakaoOpenChatUrl: ad.kakaoOpenChatUrl ?? '',
        ctaButtons: (parseCtaButtons(ad.ctaButtons) ?? []),
        apartmentIds: ((aptRes.data ?? []) as any[]).map((a) => a.apartmentId),
        discountRate: ad.approvedDiscountRate ?? 0,
        freeMonths: ad.freeMonths ?? 0,
        // 첫 광고가 아닌데 혜택이 붙어 있다면 예외 승인으로 등록된 광고다
        overrideEnabled: ad.isFirstAdApplication !== true
          && ((ad.approvedDiscountRate ?? 0) > 0 || (ad.freeMonths ?? 0) > 0),
        discountNote: ad.discountNote ?? '',
        adminMemo: ad.adminMemo ?? '',
        bizCallNumber: partner?.bizCallNumber ?? '',
        grantAnalytics: partner?.analyticsEnabled ?? false,
        salesRepId: ad.salesRepId ?? null,
      });
    };

    const load = async () => {
      const [partnerRes, apartmentRes, categoryRes, pricingRes] = await Promise.all([
        supabase
          .from('partner_users')
          .select('id, businessName, representativeName, displayPhoneNumber, businessAddress, bizCallNumber, analyticsEnabled, hasHadRunningAd')
          .order('businessName'),
        supabase
          .from('apartments')
          .select('id, name, apartment_buildings(householdsCount)')
          .order('name'),
        supabase
          .from('ad_categories_v2')
          .select('id, categoryName, orderIndex, ad_sub_categories_v2(id, subCategoryName, isActive, orderIndex)')
          .order('orderIndex'),
        supabase
          .from('ad_pricing_v2')
          .select('pricePerHousehold, defaultDiscountRate')
          .order('effectiveFrom', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const partnerList = (partnerRes.data ?? []) as PartnerOption[];
      setPartners(partnerList);

      setApartments(
        ((apartmentRes.data ?? []) as any[]).map((apt) => ({
          id: apt.id,
          name: apt.name,
          totalHouseholds: ((apt.apartment_buildings ?? []) as any[]).reduce(
            (sum, b) => sum + (b.householdsCount ?? 0),
            0
          ),
        }))
      );

      setCategories(
        ((categoryRes.data ?? []) as any[]).map((cat) => ({
          id: cat.id,
          categoryName: cat.categoryName,
          subCategories: ((cat.ad_sub_categories_v2 ?? []) as any[])
            .filter((s) => s.isActive !== false)
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((s) => ({ id: s.id, subCategoryName: s.subCategoryName })),
        }))
      );

      const pricing = pricingRes.data as
        { pricePerHousehold?: number; defaultDiscountRate?: number } | null;
      setPricePerHousehold(pricing?.pricePerHousehold ?? 70);

      if (adId) {
        await loadExistingAd(adId, partnerList);
      } else {
        setForm((prev) => ({ ...prev, discountRate: pricing?.defaultDiscountRate ?? 0 }));
      }

      setLoading(false);

      // 계정 이메일은 auth.users에 있어 서버 API로만 읽을 수 있다.
      // 폼 진입을 막지 않도록 뒤늦게 채운다 (실패해도 이메일만 비어 보인다)
      fetch('/api/partners/emails')
        .then((res) => (res.ok ? res.json() : null))
        .then((result) => result && setPartnerEmails(result.emails ?? {}))
        .catch(() => {});
    };

    load().catch(() => {
      toast.error('기초 데이터를 불러오지 못했습니다.');
      setLoading(false);
    });
  }, [supabase, adId]);

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === form.partnerId) ?? null,
    [partners, form.partnerId]
  );

  // 상호명이 겹치는 파트너가 있어 대표자·전화번호·계정 이메일을 함께 보여준다
  const partnerOptions = useMemo(
    () => partners.map((p) => ({
      id: p.id,
      businessName: p.businessName,
      description: [p.representativeName, p.displayPhoneNumber]
        .filter(Boolean)
        .join(' · '),
      email: partnerEmails[p.id] ?? null,
    })),
    [partners, partnerEmails]
  );

  // 파트너를 바꾸면 그 파트너에 저장된 비즈콜·분석권한을 폼 기본값으로 가져온다
  const selectPartner = useCallback((partnerId: string | null) => {
    const partner = partners.find((p) => p.id === partnerId);
    patch({
      partnerId,
      bizCallNumber: partner?.bizCallNumber ?? '',
      grantAnalytics: partner?.analyticsEnabled ?? false,
    });
  }, [partners, patch]);

  // 카테고리를 바꾸면 서브카테고리가 비워져 배달앱 버튼 조건이 깨지므로 함께 제거한다
  const selectCategory = useCallback((categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      categoryId,
      subCategoryIds: [],
      ctaButtons: prev.ctaButtons.filter((b) => !isDeliveryButton(b)),
    }));
  }, []);

  const toggleSubCategory = useCallback((subCategoryId: string) => {
    setForm((prev) => {
      const subCategoryIds = prev.subCategoryIds.includes(subCategoryId)
        ? prev.subCategoryIds.filter((id) => id !== subCategoryId)
        : [...prev.subCategoryIds, subCategoryId];

      const categoryName = categories.find((c) => c.id === prev.categoryId)?.categoryName;
      const keepDelivery = isDeliveryCategory(categoryName, subCategoryIds);

      return {
        ...prev,
        subCategoryIds,
        ctaButtons: keepDelivery
          ? prev.ctaButtons
          : prev.ctaButtons.filter((b) => !isDeliveryButton(b)),
      };
    });
  }, [categories]);

  const toggleCtaType = useCallback((type: CtaButtonType) => {
    setForm((prev) => {
      if (prev.ctaButtons.some((b) => b.type === type)) {
        return { ...prev, ctaButtons: prev.ctaButtons.filter((b) => b.type !== type) };
      }
      if (prev.ctaButtons.length >= MAX_CTA_BUTTONS) return prev;
      return {
        ...prev,
        ctaButtons: [...prev.ctaButtons, { id: newCtaButtonId(), type }],
      };
    });
  }, []);

  const addCustomCta = useCallback(() => {
    setForm((prev) => {
      if (prev.ctaButtons.length >= MAX_CTA_BUTTONS) return prev;
      return {
        ...prev,
        ctaButtons: [
          ...prev.ctaButtons,
          { id: newCtaButtonId(), type: 'custom' as const, label: '', url: '' },
        ],
      };
    });
  }, []);

  const updateCtaButton = useCallback((id: string, changes: Partial<CtaButton>) => {
    setForm((prev) => ({
      ...prev,
      ctaButtons: prev.ctaButtons.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    }));
  }, []);

  const removeCtaButton = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      ctaButtons: prev.ctaButtons.filter((b) => b.id !== id),
    }));
  }, []);

  const toggleApartment = useCallback((apartmentId: string) => {
    setForm((prev) => ({
      ...prev,
      apartmentIds: prev.apartmentIds.includes(apartmentId)
        ? prev.apartmentIds.filter((id) => id !== apartmentId)
        : [...prev.apartmentIds, apartmentId],
    }));
  }, []);

  const addImages = useCallback((files: File[]) => {
    setForm((prev) => {
      const room = MAX_AD_IMAGES - prev.images.length;
      if (room <= 0) return prev;

      const added: AdImageItem[] = files.slice(0, room).map((file) => ({
        kind: 'file',
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      return { ...prev, images: [...prev.images, ...added] };
    });
  }, []);

  const removeImage = useCallback((key: string) => {
    setForm((prev) => {
      const target = prev.images.find((item) => adImageKey(item) === key);
      // 로컬 미리보기는 여기서만 참조하므로 바로 해제한다
      if (target?.kind === 'file') URL.revokeObjectURL(target.previewUrl);

      return {
        ...prev,
        images: prev.images.filter((item) => adImageKey(item) !== key),
      };
    });
  }, []);

  const subCategories = useMemo(
    () => categories.find((c) => c.id === form.categoryId)?.subCategories ?? [],
    [categories, form.categoryId]
  );

  const deliveryAvailable = useMemo(
    () => isDeliveryCategory(
      categories.find((c) => c.id === form.categoryId)?.categoryName,
      form.subCategoryIds
    ),
    [categories, form.categoryId, form.subCategoryIds]
  );

  const ctaError = ctaButtonsError(form.ctaButtons);

  const bizCallDuplicateName = useBizCallDuplicate(form.bizCallNumber, form.partnerId);

  const totalHouseholds = useMemo(
    () => form.apartmentIds.reduce((sum, id) => {
      const apt = apartments.find((a) => a.id === id);
      return sum + (apt?.totalHouseholds ?? 0);
    }, 0),
    [form.apartmentIds, apartments]
  );

  // 서버가 최종 금액을 다시 계산한다 — 여기 값은 등록 전에 보여주는 예상치
  // 수정 모드는 등록 당시 확정된 값을 쓴다 — 파트너 상태로 다시 판정하면 혜택 조건이 뒤집힌다
  const isFirstAdExpected = existingIsFirstAd
    ?? (selectedPartner ? !selectedPartner.hasHadRunningAd : false);
  const benefitsApplied = isFirstAdExpected || form.overrideEnabled;
  const estimatedMonthlyAmount = calcMonthlyAmount(
    totalHouseholds,
    pricePerHousehold,
    benefitsApplied ? form.discountRate : 0
  );

  const canSubmit =
    !!form.partnerId &&
    !!form.categoryId &&
    form.title.trim().length > 0 &&
    form.images.length > 0 &&
    form.apartmentIds.length > 0 &&
    ctaError === null &&
    bizCallDuplicateName === null &&
    loadError === null &&
    !submitting;

  const submit = useCallback(async () => {
    setSubmitting(true);
    const endpoint = adId
      ? `/api/advertising-v2/applications/${adId}/update`
      : '/api/advertising-v2/applications/create';
    const failMessage = adId ? '광고 수정에 실패했습니다.' : '광고 등록에 실패했습니다.';

    try {
      // 새로 고른 파일을 먼저 올려 URL 목록을 완성한다.
      // 업로드가 실패하면 저장 자체를 하지 않으므로 중간 상태가 남지 않는다.
      const imageUrls: string[] = [];
      for (const item of form.images) {
        if (item.kind === 'url') {
          imageUrls.push(item.url);
          continue;
        }
        imageUrls.push(
          await uploadImageFile(item.file, {
            bucket: 'advertisements',
            storagePath: `ads/${form.partnerId}`,
          })
        );
      }

      const { images: _images, ...rest } = form;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, imageUrls }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? failMessage);
        return;
      }

      // 저장에 성공한 뒤에만 빠진 기존 이미지를 지운다.
      // 광고중 광고는 위에 얹힌 프리미엄이 같은 파일을 쓰고 있을 수 있어 파일을 남긴다.
      const removed = contentOnly
        ? []
        : originalImageUrls.filter((url) => !imageUrls.includes(url));
      if (removed.length > 0) {
        await deleteFilesFromStorage(removed);
      }

      toast.success(
        adId ? '광고를 수정했습니다.' : '광고를 등록했습니다. 파트너 결제만 남았습니다.'
      );
      router.push(
        `/admin/advertising-v2/applications/${adId ?? result.advertisementId}`
      );
    } catch {
      toast.error(failMessage);
    } finally {
      setSubmitting(false);
    }
  }, [form, router, adId, originalImageUrls, contentOnly]);

  return {
    isEdit,
    contentOnly,
    loadError,
    form,
    patch,
    partners,
    partnerOptions,
    apartments,
    categories,
    subCategories,
    deliveryAvailable,
    ctaError,
    bizCallDuplicateName,
    selectedPartner,
    selectPartner,
    selectCategory,
    toggleSubCategory,
    toggleCtaType,
    addCustomCta,
    updateCtaButton,
    removeCtaButton,
    toggleApartment,
    addImages,
    removeImage,
    pricePerHousehold,
    totalHouseholds,
    estimatedMonthlyAmount,
    isFirstAdExpected,
    benefitsApplied,
    loading,
    submitting,
    canSubmit,
    submit,
  };
}
