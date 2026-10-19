'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { readApiErrorMessage } from '@/lib/utils/api-error';
import { createClient } from '@/lib/supabase/client';
import { calcDiscountedTotalAmount } from '@/lib/ads/pricing';
import {
  normalizeButtons,
  periodError,
  periodToWeeks,
  SOLO_IMAGE_MAX_COUNT,
  soloContentError,
  soloTextLines,
  type SoloButton,
  type SoloButtonMode,
  type SoloContentType,
  type SoloPeriodUnit,
} from '@/lib/ads/solo-popup';
import { arrayMove } from '@dnd-kit/sortable';
import { uploadImageFile } from '@/lib/utils/upload-image';
import { cropToSoloPopupImage, type CropArea } from './cropImage';

export interface SoloPartnerOption {
  id: string;
  businessName: string;
  description: string;
}

export interface SoloBaseAdOption {
  id: string;
  partnerId: string;
  title: string | null;
  categoryName: string | null;
  totalHouseholds: number;
}

export type SoloImage =
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File; previewUrl: string };

export interface SoloFormState {
  partnerId: string | null;
  baseAdId: string | null;
  title: string;
  images: SoloImage[];
  contentType: SoloContentType;
  bulletLines: string[];
  /** 자유 문장 원문 — 형식을 바꿔도 지우지 않는다 */
  bodyText: string;
  buttonMode: SoloButtonMode;
  buttons: SoloButton[];
  periodUnit: SoloPeriodUnit;
  periodCount: number;
  discountRate: number;
  /** 할인율 100%일 때만 유효 — 결제 없이 바로 게재 시작 */
  startImmediately: boolean;
  adminMemo: string;
  salesRepId: string | null;
}

const EMPTY_FORM: SoloFormState = {
  partnerId: null,
  baseAdId: null,
  title: '',
  images: [],
  contentType: 'bullets',
  bulletLines: [''],
  bodyText: '',
  buttonMode: 'detail',
  buttons: [{ label: '', url: '' }, { label: '', url: '' }],
  periodUnit: 'week',
  periodCount: 1,
  discountRate: 0,
  startImmediately: false,
  adminMemo: '',
  salesRepId: null,
};

/**
 * 단독 팝업 광고 대리 등록/수정 폼 상태.
 * 금액·weeks·스냅샷은 서버(DB 함수)가 계산한다 — 여기 금액은 미리보기다.
 * [soloId]를 주면 수정 모드. 광고중(running)이면 내용만 고치고 기간·할인율은 잠근다.
 */
export function useSoloPopupForm(soloId?: string) {
  const router = useRouter();
  const supabase = createClient() as any;
  const isEdit = !!soloId;

  const [form, setForm] = useState<SoloFormState>(EMPTY_FORM);
  const [partners, setPartners] = useState<SoloPartnerOption[]>([]);
  const [baseAds, setBaseAds] = useState<SoloBaseAdOption[]>([]);
  const [pricePerWeek, setPricePerWeek] = useState(0);
  const [contentOnly, setContentOnly] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const patch = useCallback((changes: Partial<SoloFormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  useEffect(() => {
    const loadBaseAds = async (): Promise<SoloBaseAdOption[]> => {
      const [adRes, soloRes] = await Promise.all([
        supabase
          .from('advertisements_v2')
          .select(
            'id, partnerId, title, ad_categories_v2:categoryId(categoryName), advertisement_apartments_v2(totalHouseholds)'
          )
          .eq('adStatus', 'running')
          .eq('paymentStatus', 'paid'),
        supabase
          .from('solo_popup_ads_v2')
          .select('id, baseAdId')
          .in('status', ['pending', 'approved', 'running']),
      ]);
      // 수정 중인 자신은 제외해야 그 기본 광고가 남는다
      const occupied = new Set(
        ((soloRes.data ?? []) as any[]).filter((s) => s.id !== soloId).map((s) => s.baseAdId as string)
      );
      return ((adRes.data ?? []) as any[])
        .filter((ad) => !occupied.has(ad.id))
        .map((ad) => ({
          id: ad.id,
          partnerId: ad.partnerId,
          title: ad.title,
          categoryName: ad.ad_categories_v2?.categoryName ?? null,
          totalHouseholds: ((ad.advertisement_apartments_v2 ?? []) as any[]).reduce(
            (sum, a) => sum + (a.totalHouseholds ?? 0),
            0
          ),
        }));
    };

    const loadExisting = async (id: string) => {
      const { data } = await supabase.from('solo_popup_ads_v2').select('*').eq('id', id).maybeSingle();
      if (!data) return setLoadError('단독 팝업 광고를 찾을 수 없습니다.');

      const isRunning = data.status === 'running';
      const isBeforePayment = data.status === 'approved' && data.paymentStatus === 'unpaid';
      if (!isRunning && !isBeforePayment) {
        return setLoadError('결제 전(승인·미결제) 또는 광고중인 단독 팝업 광고만 수정할 수 있습니다.');
      }
      if (isRunning && data.modificationStatus === 'pending') {
        return setLoadError('파트너의 수정 심사가 진행 중입니다. 먼저 승인하거나 거절해주세요.');
      }
      setContentOnly(isRunning);

      const stored = (data.buttons ?? []) as SoloButton[];
      setForm({
        partnerId: data.partnerId,
        baseAdId: data.baseAdId,
        title: data.title,
        images: ((data.imageUrls ?? []) as string[]).map((url) => ({ kind: 'url', url })),
        contentType: data.contentType,
        // 저장된 줄은 현재 형식의 입력칸에만 채운다
        bulletLines: data.contentType === 'text' ? [''] : data.bulletLines,
        bodyText: data.contentType === 'text' ? data.bulletLines.join('\n') : '',
        buttonMode: data.buttonMode,
        buttons: [0, 1].map((i) => ({ label: stored[i]?.label ?? '', url: stored[i]?.url ?? '' })),
        periodUnit: data.periodUnit,
        periodCount: data.periodCount,
        discountRate: data.approvedDiscountRate ?? 0,
        startImmediately: false,
        adminMemo: data.adminMemo ?? '',
        salesRepId: data.salesRepId ?? null,
      });
    };

    const load = async () => {
      const [partnerRes, pricingRes, loadedBaseAds] = await Promise.all([
        supabase.from('partner_users').select('id, businessName, representativeName, displayPhoneNumber').order('businessName'),
        supabase
          .from('ad_pricing_v2')
          .select('soloPopupPricePerHouseholdPerWeek')
          .order('effectiveFrom', { ascending: false })
          .limit(1)
          .maybeSingle(),
        loadBaseAds(),
      ]);
      setPartners(
        ((partnerRes.data ?? []) as any[]).map((p) => ({
          id: p.id,
          businessName: p.businessName,
          description: [p.representativeName, p.displayPhoneNumber].filter(Boolean).join(' · '),
        }))
      );
      setBaseAds(loadedBaseAds);
      setPricePerWeek(pricingRes.data?.soloPopupPricePerHouseholdPerWeek ?? 0);
      if (soloId) await loadExisting(soloId);
      setLoading(false);
    };

    load().catch(() => {
      toast.error('기초 데이터를 불러오지 못했습니다.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloId]);

  const partnerBaseAds = useMemo(
    () => baseAds.filter((ad) => ad.partnerId === form.partnerId),
    [baseAds, form.partnerId]
  );
  const selectedBaseAd = useMemo(
    () => baseAds.find((ad) => ad.id === form.baseAdId) ?? null,
    [baseAds, form.baseAdId]
  );

  const selectPartner = useCallback((partnerId: string | null) => {
    setForm((prev) => ({ ...prev, partnerId, baseAdId: null }));
  }, []);

  // 자르기 대기열 — 앞에서부터 한 장씩 모달로 자른다
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropTotal, setCropTotal] = useState(0);

  /** 파일을 고르면 남은 칸만큼만 받아 한 장씩 자르기 모달 대기열에 넣는다 */
  const pickImages = useCallback((files: File[]) => {
    const remaining = SOLO_IMAGE_MAX_COUNT - form.images.length;
    const accepted = files.slice(0, Math.max(0, remaining));
    if (accepted.length < files.length) {
      toast.info(`이미지는 최대 ${SOLO_IMAGE_MAX_COUNT}장까지라 ${accepted.length}장만 불러왔습니다.`);
    }
    setCropTotal(accepted.length);
    setCropQueue(accepted);
  }, [form.images.length]);

  const cropNext = useCallback(() => setCropQueue((prev) => prev.slice(1)), []);

  /** 선택한 영역으로 1080×1080 변환해 추가하고 다음 사진으로 넘어간다 */
  const applyCrop = useCallback(async (area: CropArea) => {
    const current = cropQueue[0];
    if (!current) return;
    try {
      const file = await cropToSoloPopupImage(current, area);
      const added: SoloImage = { kind: 'file', file, previewUrl: URL.createObjectURL(file) };
      setForm((prev) => ({ ...prev, images: [...prev.images, added].slice(0, SOLO_IMAGE_MAX_COUNT) }));
    } catch {
      toast.error('이미지를 처리하지 못했습니다.');
    }
    cropNext();
  }, [cropQueue, cropNext]);

  const cropState = {
    file: cropQueue[0] ?? null,
    title: `사진 자르기 (${cropTotal - cropQueue.length + 1}/${cropTotal})`,
  };

  const removeImage = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  }, []);

  const reorderImages = useCallback((fromIndex: number, toIndex: number) => {
    setForm((prev) => ({ ...prev, images: arrayMove(prev.images, fromIndex, toIndex) }));
  }, []);

  /** 단위를 바꾸면 개수를 1로 리셋 (하나만 고르는 규칙) */
  const changeUnit = useCallback((unit: SoloPeriodUnit) => {
    setForm((prev) => (prev.periodUnit === unit ? prev : { ...prev, periodUnit: unit, periodCount: 1 }));
  }, []);

  const content = useMemo(
    () => ({
      title: form.title,
      imageUrls: form.images.map(() => 'https://pending-upload'), // 장수만 검증 (실제 URL 은 업로드 후)
      bulletLines: form.contentType === 'text' ? soloTextLines(form.bodyText) : form.bulletLines,
      contentType: form.contentType,
      buttonMode: form.buttonMode,
      buttons: form.buttonMode === 'direct' ? form.buttons.slice(0, 1) : form.buttons,
    }),
    [form]
  );
  const contentErr = soloContentError(content);
  const periodErr = contentOnly ? null : periodError(form.periodUnit, form.periodCount);

  const weeks = periodToWeeks(form.periodUnit, form.periodCount);
  const totalAmount = (selectedBaseAd?.totalHouseholds ?? 0) * pricePerWeek * weeks;
  const discountedTotalAmount = calcDiscountedTotalAmount(totalAmount, form.discountRate);

  // 받을 돈이 0원일 때만 바로 시작할 수 있다 (서버도 같은 기준으로 검증)
  const canStartImmediately = !isEdit && form.discountRate === 100;

  const canSubmit =
    !!form.partnerId && !!form.baseAdId && !contentErr && !periodErr && !loadError && !submitting;

  const submit = useCallback(async () => {
    setSubmitting(true);
    const failMessage = isEdit ? '단독 팝업 광고를 수정하지 못했습니다.' : '단독 팝업 광고를 등록하지 못했습니다.';
    try {
      // 파일명이 겹치지 않도록 순차 업로드 + 인덱스를 붙인다
      const imageUrls: string[] = [];
      for (const [index, image] of form.images.entries()) {
        if (image.kind === 'url') {
          imageUrls.push(image.url);
          continue;
        }
        const named = new File([image.file], `solo_${index}.webp`, { type: image.file.type });
        imageUrls.push(
          await uploadImageFile(named, { bucket: 'advertisements', storagePath: `ads/${form.partnerId}` })
        );
      }

      const buttons = normalizeButtons(form.buttonMode, content.buttons);
      const response = await fetch(
        isEdit ? `/api/advertising-v2/solo-popup/${soloId}/update` : '/api/advertising-v2/solo-popup/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId: form.partnerId,
            baseAdId: form.baseAdId,
            title: form.title,
            imageUrls,
            bulletLines: content.bulletLines,
            contentType: form.contentType,
            buttonMode: form.buttonMode,
            buttons,
            periodUnit: form.periodUnit,
            periodCount: form.periodCount,
            discountRate: form.discountRate,
            startImmediately: canStartImmediately && form.startImmediately,
            adminMemo: form.adminMemo,
            salesRepId: form.salesRepId,
          }),
        }
      );
      if (!response.ok) {
        toast.error((await readApiErrorMessage(response)) ?? failMessage);
        return;
      }
      const result = await response.json();
      toast.success(
        isEdit
          ? '단독 팝업 광고를 수정했습니다.'
          : result.startImmediately
            ? '단독 팝업 광고를 등록하고 바로 시작했습니다.'
            : '단독 팝업 광고를 등록했습니다. 파트너 결제만 남았습니다.'
      );
      router.push(`/admin/advertising-v2/solo-popup/${soloId ?? result.soloPopupAdId}`);
    } catch {
      // 이미지 업로드 실패도 여기로 온다 — 인터넷 연결만 탓하지 않는다
      toast.error(`${failMessage} 이미지 업로드나 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`);
    } finally {
      setSubmitting(false);
    }
  }, [form, content, isEdit, soloId, router, canStartImmediately]);

  return {
    isEdit,
    contentOnly,
    loadError,
    loading,
    submitting,
    canSubmit,
    form,
    patch,
    partners,
    partnerBaseAds,
    selectedBaseAd,
    selectPartner,
    pickImages,
    cropState,
    applyCrop,
    cancelCrop: cropNext,
    removeImage,
    reorderImages,
    changeUnit,
    contentErr,
    periodErr,
    pricePerWeek,
    weeks,
    totalAmount,
    discountedTotalAmount,
    canStartImmediately,
    submit,
  };
}
