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
  soloContentError,
  soloTextLines,
  type SoloButton,
  type SoloButtonMode,
  type SoloContentType,
  type SoloPeriodUnit,
} from '@/lib/ads/solo-popup';
import { uploadImageFile } from '@/lib/utils/upload-image';
import { cropToSoloPopupImage } from './cropImage';

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
  image: SoloImage | null;
  contentType: SoloContentType;
  bulletLines: string[];
  /** 자유 문장 원문 — 형식을 바꿔도 지우지 않는다 */
  bodyText: string;
  buttonMode: SoloButtonMode;
  buttons: SoloButton[];
  periodUnit: SoloPeriodUnit;
  periodCount: number;
  discountRate: number;
  adminMemo: string;
  salesRepId: string | null;
}

const EMPTY_FORM: SoloFormState = {
  partnerId: null,
  baseAdId: null,
  title: '',
  image: null,
  contentType: 'bullets',
  bulletLines: [''],
  bodyText: '',
  buttonMode: 'detail',
  buttons: [{ label: '', url: '' }, { label: '', url: '' }],
  periodUnit: 'week',
  periodCount: 1,
  discountRate: 0,
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
        image: { kind: 'url', url: data.imageUrl },
        contentType: data.contentType,
        // 저장된 줄은 현재 형식의 입력칸에만 채운다
        bulletLines: data.contentType === 'text' ? [''] : data.bulletLines,
        bodyText: data.contentType === 'text' ? data.bulletLines.join('\n') : '',
        buttonMode: data.buttonMode,
        buttons: [0, 1].map((i) => ({ label: stored[i]?.label ?? '', url: stored[i]?.url ?? '' })),
        periodUnit: data.periodUnit,
        periodCount: data.periodCount,
        discountRate: data.approvedDiscountRate ?? 0,
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

  /** 파일을 고르면 3:4 중앙 크롭 + 1080×1440 으로 변환해 미리보기를 만든다 */
  const pickImage = useCallback(async (file: File) => {
    try {
      const cropped = await cropToSoloPopupImage(file);
      setForm((prev) => ({ ...prev, image: { kind: 'file', file: cropped, previewUrl: URL.createObjectURL(cropped) } }));
    } catch {
      toast.error('이미지를 처리하지 못했습니다.');
    }
  }, []);

  /** 단위를 바꾸면 개수를 1로 리셋 (하나만 고르는 규칙) */
  const changeUnit = useCallback((unit: SoloPeriodUnit) => {
    setForm((prev) => (prev.periodUnit === unit ? prev : { ...prev, periodUnit: unit, periodCount: 1 }));
  }, []);

  const content = useMemo(
    () => ({
      title: form.title,
      imageUrl: form.image ? 'x' : '', // 이미지 존재 여부만 검증 (실제 URL 은 업로드 후)
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

  const canSubmit =
    !!form.partnerId && !!form.baseAdId && !contentErr && !periodErr && !loadError && !submitting;

  const submit = useCallback(async () => {
    setSubmitting(true);
    const failMessage = isEdit ? '단독 팝업 광고를 수정하지 못했습니다.' : '단독 팝업 광고를 등록하지 못했습니다.';
    try {
      let imageUrl = '';
      if (form.image?.kind === 'url') imageUrl = form.image.url;
      else if (form.image?.kind === 'file') {
        imageUrl = await uploadImageFile(form.image.file, {
          bucket: 'advertisements',
          storagePath: `ads/${form.partnerId}`,
        });
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
            imageUrl,
            bulletLines: content.bulletLines,
            contentType: form.contentType,
            buttonMode: form.buttonMode,
            buttons,
            periodUnit: form.periodUnit,
            periodCount: form.periodCount,
            discountRate: form.discountRate,
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
      toast.success(isEdit ? '단독 팝업 광고를 수정했습니다.' : '단독 팝업 광고를 등록했습니다. 파트너 결제만 남았습니다.');
      router.push(`/admin/advertising-v2/solo-popup/${soloId ?? result.soloPopupAdId}`);
    } catch {
      // 이미지 업로드 실패도 여기로 온다 — 인터넷 연결만 탓하지 않는다
      toast.error(`${failMessage} 이미지 업로드나 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`);
    } finally {
      setSubmitting(false);
    }
  }, [form, content, isEdit, soloId, router]);

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
    pickImage,
    changeUnit,
    contentErr,
    periodErr,
    pricePerWeek,
    weeks,
    totalAmount,
    discountedTotalAmount,
    submit,
  };
}
