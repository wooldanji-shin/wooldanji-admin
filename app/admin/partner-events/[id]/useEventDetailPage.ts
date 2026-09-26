'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { EventBannerPreviewData } from './EventBannerPreview';

export type EventParticipationType = 'draw' | 'first_come';
export type EventStatus = 'pending' | 'approved' | 'rejected' | 'ended';
export type CouponDiscountType = 'percent' | 'fixed' | 'gift';

export interface ApartmentOption {
  id: string;
  name: string;
}

export interface EventDetail {
  id: string;
  title: string;
  participationType: EventParticipationType;
  winnerCount: number;
  couponTitle: string;
  couponDiscountType: CouponDiscountType;
  couponDiscountValue: number | null;
  couponExpiresAt: string;
  status: EventStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  endedAt: string | null;
  entryStartAt: string;
  entryEndAt: string;
  announceAt: string;
  endAt: string;
  bannerImageUrl: string | null;
  /** 홈 배너 표시 방식: template(기본 배너 — 앱이 텍스트+1:1 썸네일) | image(이미지로만, 약 2.1:1) */
  bannerType: 'template' | 'image';
  /** 상세 소개 이미지 (최대 3장, 순서 = 앱 표시 순서) — 관리자 화면에선 조회만 */
  detailImageUrls: string[];
  drawnAt: string | null;
  createdAt: string;
  businessName: string;
  apartmentIds: string[];
  apartmentNames: string[];
}

export interface EventEntryRow {
  entryId: string;
  userName: string;
  /** 응모 코드 (6자리 영문) */
  entryCode: string;
  /** 응모 당시 아파트 */
  apartmentName: string | null;
  buildingNumber: number | null;
  unit: number | null;
  isWinner: boolean;
  enteredAt: string;
}

/** 관리자가 고칠 수 있는 필드 — datetime 필드는 datetime-local input 값(로컬 문자열)으로 다룬다 */
export interface EventEditForm {
  title: string;
  couponTitle: string;
  participationType: EventParticipationType;
  winnerCount: number;
  couponDiscountType: CouponDiscountType;
  couponDiscountValue: number | null;
  couponExpiresAt: string;
  entryStartAt: string;
  entryEndAt: string;
  apartmentIds: string[];
}

/** ISO(UTC) 문자열 → datetime-local input 값(로컬 시간, 'YYYY-MM-DDTHH:mm') */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDetailForm(detail: EventDetail): EventEditForm {
  return {
    title: detail.title,
    couponTitle: detail.couponTitle,
    participationType: detail.participationType,
    winnerCount: detail.winnerCount,
    couponDiscountType: detail.couponDiscountType,
    couponDiscountValue: detail.couponDiscountValue,
    couponExpiresAt: toLocalInputValue(detail.couponExpiresAt),
    entryStartAt: toLocalInputValue(detail.entryStartAt),
    entryEndAt: toLocalInputValue(detail.entryEndAt),
    apartmentIds: detail.apartmentIds,
  };
}

/**
 * 일정 순서 검증 — DB CHECK(chk_partner_events_schedule_order)와 동일한 규칙.
 * 발표(응모 종료 + 2시간)·종료(발표 다음날 자정 KST)는 DB가 자동 계산하므로 검증 대상이 아니다.
 */
export function validateEventSchedule(form: EventEditForm): string | null {
  const entryStart = new Date(form.entryStartAt).getTime();
  const entryEnd = new Date(form.entryEndAt).getTime();

  if (entryStart >= entryEnd) return '응모 종료일은 응모 시작일보다 늦어야 합니다.';
  return null;
}

/** 당첨 발표 = 응모 종료 + 2시간 (DB generated column announceAt과 동일) */
const ANNOUNCE_DELAY_MS = 2 * 60 * 60 * 1000;
/** 쿠폰 유효기간은 발표 + 1일 이후 (DB CHECK chk_partner_events_coupon_expiry_after_announce와 동일) */
const COUPON_MIN_VALIDITY_MS = 24 * 60 * 60 * 1000;
/** % 할인 최댓값 (DB CHECK chk_partner_events_percent_discount_max와 동일) */
const MAX_PERCENT_DISCOUNT = 100;

/** 쿠폰 값 검증 — DB CHECK와 같은 규칙을 저장 전에 한국어로 안내. 통과하면 null. */
export function validateEventCoupon(form: EventEditForm): string | null {
  if (form.couponDiscountType !== 'gift' && form.couponDiscountValue === null) {
    return '증정이 아니면 할인 값을 입력해야 합니다.';
  }
  if (form.couponDiscountType === 'percent' && (form.couponDiscountValue ?? 0) > MAX_PERCENT_DISCOUNT) {
    return `% 할인은 ${MAX_PERCENT_DISCOUNT}을 초과할 수 없습니다.`;
  }
  const announce = new Date(form.entryEndAt).getTime() + ANNOUNCE_DELAY_MS;
  if (new Date(form.couponExpiresAt).getTime() < announce + COUPON_MIN_VALIDITY_MS) {
    return '쿠폰 만료일은 당첨 발표(응모 종료 + 2시간) 1일 이후여야 합니다.';
  }
  return null;
}

/**
 * 쿠폰 혜택 문장 — 앱(couponBenefitText)과 같은 규칙.
 * '아메리카노 10% 할인' / '전 메뉴 3,000원 할인' / '아메리카노 1잔 증정'
 */
export function couponBenefitText(
  target: string,
  discountType: CouponDiscountType,
  discountValue: number | null,
): string {
  const label =
    discountType === 'gift'
      ? '증정'
      : discountValue == null
        ? ''
        : discountType === 'percent'
          ? `${discountValue}% 할인`
          : `${discountValue.toLocaleString()}원 할인`;
  return [target.trim(), label].filter(Boolean).join(' ');
}

/** 배너 미리보기 데이터 — 수정 중이면 입력 중인 값으로 바로 보여준다 */
export function bannerPreviewOf(detail: EventDetail, form: EventEditForm | null): EventBannerPreviewData {
  const source = form ?? detail;
  const entryEnd = new Date(source.entryEndAt);
  return {
    businessName: detail.businessName,
    title: source.title,
    bannerType: detail.bannerType,
    bannerImageUrl: detail.bannerImageUrl,
    winnerCount: source.winnerCount,
    participationType: source.participationType,
    benefitText: couponBenefitText(source.couponTitle, source.couponDiscountType, source.couponDiscountValue),
    entryStartAt: new Date(source.entryStartAt),
    announceAt: form ? new Date(entryEnd.getTime() + ANNOUNCE_DELAY_MS) : new Date(detail.announceAt),
  };
}

export type DrawStatusLabel = '추첨 완료' | '추첨 대기중' | '발표 예정' | null;

/** approved/ended 상태에서만 의미가 있는 추첨 진행 상태 표시 */
export function drawStatusLabelOf(detail: EventDetail): DrawStatusLabel {
  if (detail.status !== 'approved' && detail.status !== 'ended') return null;
  if (detail.drawnAt) return '추첨 완료';
  if (new Date(detail.announceAt).getTime() <= Date.now()) return '추첨 대기중';
  return '발표 예정';
}

export interface UseEventDetailPageReturn {
  loading: boolean;
  detail: EventDetail | null;
  allApartments: ApartmentOption[];
  entries: EventEntryRow[];
  winners: EventEntryRow[];
  // 수정
  editing: boolean;
  startEdit: () => void;
  cancelEdit: () => void;
  editForm: EventEditForm | null;
  setEditForm: (updater: (prev: EventEditForm) => EventEditForm) => void;
  scheduleError: string | null;
  saving: boolean;
  handleSaveEdit: () => Promise<void>;
  // 승인
  approving: boolean;
  handleApprove: () => Promise<void>;
  // 거절
  rejectDialog: boolean;
  setRejectDialog: (open: boolean) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  rejecting: boolean;
  handleReject: () => Promise<void>;
  // 강제 종료
  endDialog: boolean;
  setEndDialog: (open: boolean) => void;
  ending: boolean;
  handleForceEnd: () => Promise<void>;
}

export function useEventDetailPage(
  params: Promise<{ id: string }>
): UseEventDetailPageReturn {
  const supabase = createClient();

  const [id, setId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [allApartments, setAllApartments] = useState<ApartmentOption[]>([]);
  const [entries, setEntries] = useState<EventEntryRow[]>([]);
  const [winners, setWinners] = useState<EventEntryRow[]>([]);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditFormRaw] = useState<EventEditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [approving, setApproving] = useState(false);

  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [endDialog, setEndDialog] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const fetchDetail = useCallback(async (): Promise<void> => {
    if (!id) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('partner_events')
        .select(`
          *,
          partner_users:partnerUserId(businessName),
          partner_event_apartments(apartmentId, apartments:apartmentId(name))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const mapped: EventDetail = {
        id: data.id,
        title: data.title,
        participationType: data.participationType,
        winnerCount: data.winnerCount,
        couponTitle: data.couponTitle,
        couponDiscountType: data.couponDiscountType,
        couponDiscountValue: data.couponDiscountValue,
        couponExpiresAt: data.couponExpiresAt,
        status: data.status,
        rejectionReason: data.rejectionReason,
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
        endedAt: data.endedAt,
        entryStartAt: data.entryStartAt,
        entryEndAt: data.entryEndAt,
        announceAt: data.announceAt,
        endAt: data.endAt,
        bannerImageUrl: data.bannerImageUrl,
        bannerType: data.bannerType ?? 'template',
        detailImageUrls: data.detailImageUrls ?? [],
        drawnAt: data.drawnAt,
        createdAt: data.createdAt,
        businessName: data.partner_users?.businessName ?? '-',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apartmentIds: (data.partner_event_apartments ?? []).map((a: any) => a.apartmentId),
        apartmentNames: (data.partner_event_apartments ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((a: any) => a.apartments?.name)
          .filter(Boolean),
      };

      setDetail(mapped);
    } catch (err) {
      console.error('Failed to fetch event detail:', err);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, id]);

  const fetchApartments = useCallback(async (): Promise<void> => {
    const { data } = await supabase.from('apartments').select('id, name').order('name');
    setAllApartments((data ?? []) as ApartmentOption[]);
  }, [supabase]);

  const fetchEntries = useCallback(async (): Promise<void> => {
    if (!id) return;
    const [entriesRes, winnersRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc('get_event_entries', { p_event_id: id }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc('get_event_winners', { p_event_id: id }),
    ]);
    setEntries((entriesRes.data ?? []) as EventEntryRow[]);
    setWinners((winnersRes.data ?? []) as EventEntryRow[]);
  }, [supabase, id]);

  useEffect(() => {
    fetchDetail();
    fetchApartments();
    fetchEntries();
  }, [fetchDetail, fetchApartments, fetchEntries]);

  const startEdit = useCallback(() => {
    if (!detail) return;
    setEditFormRaw(toDetailForm(detail));
    setEditing(true);
  }, [detail]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditFormRaw(null);
  }, []);

  const setEditForm = useCallback((updater: (prev: EventEditForm) => EventEditForm) => {
    setEditFormRaw((prev) => (prev ? updater(prev) : prev));
  }, []);

  const scheduleError = editForm ? validateEventSchedule(editForm) : null;

  const handleSaveEdit = useCallback(async (): Promise<void> => {
    if (!editForm) return;
    const err = validateEventSchedule(editForm);
    if (err) {
      toast.error(err);
      return;
    }
    const couponErr = validateEventCoupon(editForm);
    if (couponErr) {
      toast.error(couponErr);
      return;
    }
    if (editForm.apartmentIds.length === 0) {
      toast.error('대상 아파트를 1곳 이상 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/partner-events/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          couponExpiresAt: new Date(editForm.couponExpiresAt).toISOString(),
          entryStartAt: new Date(editForm.entryStartAt).toISOString(),
          entryEndAt: new Date(editForm.entryEndAt).toISOString(),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update event');
      }
      toast.success('이벤트 정보가 수정되었습니다.');
      setEditing(false);
      setEditFormRaw(null);
      await fetchDetail();
    } catch (err) {
      console.error('Failed to update event:', err);
      toast.error(err instanceof Error ? err.message : '이벤트 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [editForm, id, fetchDetail]);

  const handleApprove = useCallback(async (): Promise<void> => {
    setApproving(true);
    try {
      const response = await fetch(`/api/partner-events/${id}/approve`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve event');
      }
      toast.success('이벤트가 승인되었습니다.');
      await fetchDetail();
    } catch (err) {
      console.error('Failed to approve event:', err);
      // 서버가 막은 사유(예: 응모 시작 경과)를 그대로 보여준다
      toast.error(err instanceof Error ? err.message : '이벤트 승인에 실패했습니다.');
    } finally {
      setApproving(false);
    }
  }, [id, fetchDetail]);

  const handleReject = useCallback(async (): Promise<void> => {
    if (!rejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    setRejecting(true);
    try {
      const response = await fetch(`/api/partner-events/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to reject event');
      }
      toast.success('이벤트가 거절되었습니다.');
      setRejectDialog(false);
      setRejectReason('');
      await fetchDetail();
    } catch (err) {
      console.error('Failed to reject event:', err);
      toast.error('이벤트 거절에 실패했습니다.');
    } finally {
      setRejecting(false);
    }
  }, [id, rejectReason, fetchDetail]);

  const handleForceEnd = useCallback(async (): Promise<void> => {
    setEnding(true);
    try {
      const response = await fetch(`/api/partner-events/${id}/end`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to end event');
      }
      toast.success('이벤트가 종료되었습니다.');
      setEndDialog(false);
      await fetchDetail();
    } catch (err) {
      console.error('Failed to end event:', err);
      toast.error('이벤트 강제 종료에 실패했습니다.');
    } finally {
      setEnding(false);
    }
  }, [id, fetchDetail]);

  return {
    loading,
    detail,
    allApartments,
    entries,
    winners,
    editing,
    startEdit,
    cancelEdit,
    editForm,
    setEditForm,
    scheduleError,
    saving,
    handleSaveEdit,
    approving,
    handleApprove,
    rejectDialog,
    setRejectDialog,
    rejectReason,
    setRejectReason,
    rejecting,
    handleReject,
    endDialog,
    setEndDialog,
    ending,
    handleForceEnd,
  };
}
