'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  calcDiscountedTotalAmount,
  calcPremiumTotalAmount,
} from '@/lib/ads/pricing';
import {
  MAX_AD_IMAGES,
  PREMIUM_MAX_WEEKS,
  PREMIUM_MIN_WEEKS,
} from '@/lib/ads/constants';
import { uploadImageFile } from '@/lib/utils/upload-image';
import { adImageKey, type AdImageItem } from '@/components/ad-image-picker';
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

export interface PremiumPartnerOption {
  id: string;
  businessName: string;
  representativeName: string | null;
  displayPhoneNumber: string | null;
}

export interface BaseAdOption {
  id: string;
  partnerId: string;
  title: string | null;
  categoryName: string | null;
  subCategoryCount: number;
  apartments: { name: string; address: string; totalHouseholds: number }[];
  totalHouseholds: number;
  /** 기본 광고 내용 — 프리미엄 폼 초기값으로 쓴다 */
  content: string | null;
  imageUrls: string[];
  naverMapUrl: string | null;
  blogUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  kakaoOpenChatUrl: string | null;
  ctaButtons: CtaButton[] | null;
}

export interface PremiumFormState {
  partnerId: string | null;
  baseAdId: string | null;
  title: string;
  content: string;
  images: AdImageItem[];
  naverMapUrl: string;
  blogUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  kakaoOpenChatUrl: string;
  ctaButtons: CtaButton[];
  weeks: number;
  discountRate: number;
  adminMemo: string;
  salesRepId: string | null;
}

const EMPTY_FORM: PremiumFormState = {
  partnerId: null,
  baseAdId: null,
  title: '',
  content: '',
  images: [],
  naverMapUrl: '',
  blogUrl: '',
  youtubeUrl: '',
  instagramUrl: '',
  kakaoOpenChatUrl: '',
  ctaButtons: [],
  weeks: PREMIUM_MIN_WEEKS,
  discountRate: 0,
  adminMemo: '',
  salesRepId: null,
};

/**
 * 프리미엄 광고 대리 등록/수정 폼 상태
 *
 * 프리미엄은 기본 광고에 얹히는 광고라, 운영 중(running·paid)인 기본 광고를 골라야 하고
 * 노출 아파트는 그 기본 광고의 것을 그대로 승계한다(선택 불가).
 *
 * [premiumId]를 주면 수정 모드 — 결제 전(approved + unpaid)만 허용한다.
 */
export function usePremiumForm(premiumId?: string) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!premiumId;

  const [form, setForm] = useState<PremiumFormState>(EMPTY_FORM);
  const [partners, setPartners] = useState<PremiumPartnerOption[]>([]);
  const [partnerEmails, setPartnerEmails] = useState<Record<string, string | null>>({});
  const [baseAds, setBaseAds] = useState<BaseAdOption[]>([]);
  const [pricePerWeek, setPricePerWeek] = useState(20);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const patch = useCallback((changes: Partial<PremiumFormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  useEffect(() => {
    /** 프리미엄을 얹을 수 있는 기본 광고: 운영 중이고, 아직 살아있는 프리미엄이 없는 것 */
    const loadBaseAds = async (): Promise<BaseAdOption[]> => {
      const [adRes, premiumRes] = await Promise.all([
        supabase
          .from('advertisements_v2')
          .select(
            'id, partnerId, title, content, imageUrls, naverMapUrl, blogUrl, youtubeUrl, ' +
            'instagramUrl, kakaoOpenChatUrl, ctaButtons, ' +
            'ad_categories_v2:categoryId(categoryName), ' +
            'advertisement_sub_categories_v2(subCategoryId), ' +
            'advertisement_apartments_v2(totalHouseholds, apartments:apartmentId(name, address))'
          )
          .eq('adStatus', 'running')
          .eq('paymentStatus', 'paid'),
        supabase
          .from('premium_advertisements_v2')
          .select('id, baseAdId, status')
          .not('status', 'in', '("ended","draft")'),
      ]);

      // 수정 중인 프리미엄 자신은 제외해야 그 기본 광고가 목록에 남는다
      const occupied = new Set(
        ((premiumRes.data ?? []) as any[])
          .filter((p) => p.id !== premiumId)
          .map((p) => p.baseAdId as string)
      );

      return ((adRes.data ?? []) as any[])
        .filter((ad) => !occupied.has(ad.id))
        .map((ad) => {
          const apartments = ((ad.advertisement_apartments_v2 ?? []) as any[]).map((a) => ({
            name: a.apartments?.name ?? '',
            address: a.apartments?.address ?? '',
            totalHouseholds: a.totalHouseholds ?? 0,
          }));

          const option: BaseAdOption = {
            id: ad.id,
            partnerId: ad.partnerId,
            title: ad.title,
            categoryName: ad.ad_categories_v2?.categoryName ?? null,
            subCategoryCount: ((ad.advertisement_sub_categories_v2 ?? []) as any[]).length,
            apartments,
            totalHouseholds: apartments.reduce((sum, a) => sum + a.totalHouseholds, 0),
            content: ad.content,
            imageUrls: (ad.imageUrls ?? []) as string[],
            naverMapUrl: ad.naverMapUrl,
            blogUrl: ad.blogUrl,
            youtubeUrl: ad.youtubeUrl,
            instagramUrl: ad.instagramUrl,
            kakaoOpenChatUrl: ad.kakaoOpenChatUrl,
            ctaButtons: parseCtaButtons(ad.ctaButtons),
          };
          return option;
        });
    };

    const loadExistingPremium = async (id: string) => {
      const { data } = await supabase
        .from('premium_advertisements_v2')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const premium = data as any;
      if (!premium) {
        setLoadError('프리미엄 광고를 찾을 수 없습니다.');
        return;
      }
      if (premium.status !== 'approved' || premium.paymentStatus !== 'unpaid') {
        setLoadError('결제 전(승인·미결제) 프리미엄 광고만 수정할 수 있습니다.');
        return;
      }

      setForm({
        partnerId: premium.partnerId,
        baseAdId: premium.baseAdId,
        title: premium.title ?? '',
        content: premium.content ?? '',
        images: ((premium.imageUrls ?? []) as string[]).map(
          (url) => ({ kind: 'url' as const, url })
        ),
        naverMapUrl: premium.naverMapUrl ?? '',
        blogUrl: premium.blogUrl ?? '',
        youtubeUrl: premium.youtubeUrl ?? '',
        instagramUrl: premium.instagramUrl ?? '',
        kakaoOpenChatUrl: premium.kakaoOpenChatUrl ?? '',
        ctaButtons: parseCtaButtons(premium.ctaButtons) ?? [],
        weeks: premium.weeks ?? PREMIUM_MIN_WEEKS,
        discountRate: premium.approvedDiscountRate ?? 0,
        adminMemo: premium.adminMemo ?? '',
        salesRepId: premium.salesRepId ?? null,
      });
    };

    const load = async () => {
      const [partnerRes, pricingRes, loadedBaseAds] = await Promise.all([
        supabase
          .from('partner_users')
          .select('id, businessName, representativeName, displayPhoneNumber')
          .order('businessName'),
        supabase
          .from('ad_pricing_v2')
          .select('premiumPricePerHouseholdPerWeek')
          .order('effectiveFrom', { ascending: false })
          .limit(1)
          .maybeSingle(),
        loadBaseAds(),
      ]);

      setPartners((partnerRes.data ?? []) as PremiumPartnerOption[]);
      setBaseAds(loadedBaseAds);
      setPricePerWeek(
        (pricingRes.data as { premiumPricePerHouseholdPerWeek?: number } | null)
          ?.premiumPricePerHouseholdPerWeek ?? 20
      );

      if (premiumId) await loadExistingPremium(premiumId);

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
  }, [supabase, premiumId]);

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

  /** 선택한 파트너의 프리미엄 등록 가능 기본 광고 */
  const partnerBaseAds = useMemo(
    () => baseAds.filter((ad) => ad.partnerId === form.partnerId),
    [baseAds, form.partnerId]
  );

  const selectedBaseAd = useMemo(
    () => baseAds.find((ad) => ad.id === form.baseAdId) ?? null,
    [baseAds, form.baseAdId]
  );

  // 파트너를 바꾸면 고른 기본 광고와 거기서 가져온 내용이 의미를 잃는다
  const selectPartner = useCallback((partnerId: string | null) => {
    setForm((prev) => ({
      ...EMPTY_FORM,
      partnerId,
      // 기본 광고와 무관한 입력은 유지한다
      discountRate: prev.discountRate,
      salesRepId: prev.salesRepId,
    }));
  }, []);

  /** 기본 광고를 고르면 그 내용을 프리미엄 폼 초기값으로 채운다 (이후 자유롭게 고칠 수 있다) */
  const selectBaseAd = useCallback((baseAdId: string) => {
    const baseAd = baseAds.find((ad) => ad.id === baseAdId);
    if (!baseAd) return;

    setForm((prev) => ({
      ...prev,
      baseAdId,
      title: baseAd.title ?? '',
      content: baseAd.content ?? '',
      images: baseAd.imageUrls.map((url) => ({ kind: 'url' as const, url })),
      naverMapUrl: baseAd.naverMapUrl ?? '',
      blogUrl: baseAd.blogUrl ?? '',
      youtubeUrl: baseAd.youtubeUrl ?? '',
      instagramUrl: baseAd.instagramUrl ?? '',
      kakaoOpenChatUrl: baseAd.kakaoOpenChatUrl ?? '',
      ctaButtons: baseAd.ctaButtons ?? [],
    }));
  }, [baseAds]);

  const deliveryAvailable = useMemo(
    () => isDeliveryCategory(
      selectedBaseAd?.categoryName,
      // 서브카테고리 개수만 보므로 id는 의미 없다
      Array.from({ length: selectedBaseAd?.subCategoryCount ?? 0 }, (_, i) => String(i))
    ),
    [selectedBaseAd]
  );

  const toggleCtaType = useCallback((type: CtaButtonType) => {
    setForm((prev) => {
      if (prev.ctaButtons.some((b) => b.type === type)) {
        return { ...prev, ctaButtons: prev.ctaButtons.filter((b) => b.type !== type) };
      }
      if (prev.ctaButtons.length >= MAX_CTA_BUTTONS) return prev;
      return { ...prev, ctaButtons: [...prev.ctaButtons, { id: newCtaButtonId(), type }] };
    });
  }, []);

  const addCustomCta = useCallback(() => {
    setForm((prev) => prev.ctaButtons.length >= MAX_CTA_BUTTONS ? prev : {
      ...prev,
      ctaButtons: [
        ...prev.ctaButtons,
        { id: newCtaButtonId(), type: 'custom' as const, label: '', url: '' },
      ],
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
      if (target?.kind === 'file') URL.revokeObjectURL(target.previewUrl);
      return {
        ...prev,
        images: prev.images.filter((item) => adImageKey(item) !== key),
      };
    });
  }, []);

  // 배달앱 조건이 깨지면 해당 버튼을 남겨둘 수 없다
  useEffect(() => {
    if (deliveryAvailable) return;
    setForm((prev) => prev.ctaButtons.some(isDeliveryButton)
      ? { ...prev, ctaButtons: prev.ctaButtons.filter((b) => !isDeliveryButton(b)) }
      : prev);
  }, [deliveryAvailable]);

  const ctaError = ctaButtonsError(form.ctaButtons);
  const totalHouseholds = selectedBaseAd?.totalHouseholds ?? 0;
  const totalAmount = calcPremiumTotalAmount(totalHouseholds, pricePerWeek, form.weeks);
  const discountedTotalAmount = calcDiscountedTotalAmount(totalAmount, form.discountRate);

  const canSubmit =
    !!form.partnerId &&
    !!form.baseAdId &&
    form.title.trim().length > 0 &&
    form.images.length > 0 &&
    form.weeks >= PREMIUM_MIN_WEEKS &&
    form.weeks <= PREMIUM_MAX_WEEKS &&
    ctaError === null &&
    loadError === null &&
    !submitting;

  const submit = useCallback(async () => {
    setSubmitting(true);
    const endpoint = premiumId
      ? `/api/advertising-v2/premium/${premiumId}/update`
      : '/api/advertising-v2/premium/create';
    const failMessage = premiumId
      ? '프리미엄 광고 수정에 실패했습니다.'
      : '프리미엄 광고 등록에 실패했습니다.';

    try {
      // 새로 고른 파일만 올려 URL 목록을 완성한다
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

      // 빠진 이미지는 Storage에서 지우지 않는다 — 기본 광고와 URL을 공유하기 때문
      toast.success(
        premiumId
          ? '프리미엄 광고를 수정했습니다.'
          : '프리미엄 광고를 등록했습니다. 파트너 결제만 남았습니다.'
      );
      router.push(
        `/admin/advertising-v2/premium/${premiumId ?? result.premiumAdId}`
      );
    } catch {
      toast.error(failMessage);
    } finally {
      setSubmitting(false);
    }
  }, [form, router, premiumId]);

  return {
    isEdit,
    loadError,
    form,
    patch,
    partnerOptions,
    partnerBaseAds,
    selectedPartner,
    selectedBaseAd,
    selectPartner,
    selectBaseAd,
    deliveryAvailable,
    ctaError,
    toggleCtaType,
    addCustomCta,
    updateCtaButton,
    removeCtaButton,
    addImages,
    removeImage,
    pricePerWeek,
    totalHouseholds,
    totalAmount,
    discountedTotalAmount,
    loading,
    submitting,
    canSubmit,
    submit,
  };
}
