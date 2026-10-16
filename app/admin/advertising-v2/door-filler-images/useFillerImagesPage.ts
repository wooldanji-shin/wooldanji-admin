'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/supabase';

/** 시간대 (KST) — DB door_popup_current_time_slot() 과 같은 값 */
export const TIME_SLOTS = [
  { value: 'dawn', label: '새벽 (00~06시)' },
  { value: 'morning', label: '오전 (06~12시)' },
  { value: 'afternoon', label: '오후 (12~18시)' },
  { value: 'evening', label: '저녁 (18~24시)' },
] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number]['value'];

const BUCKET = 'banners';
const STORAGE_DIR = 'app-images/door-filler';
const MAX_SIZE_MB = 10;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};
export const ACCEPTED_TYPES = Object.keys(MIME_EXTENSIONS);

export interface FillerImage {
  id: string;
  imageUrl: string;
  storagePath: string;
  timeSlots: TimeSlot[];
  isAllApartments: boolean;
  isActive: boolean;
  createdAt: string;
  apartments: { id: string; name: string }[];
  totalImpressions: number;
  todayImpressions: number;
}

export interface ApartmentOption {
  id: string;
  name: string;
}

/** 등록·수정 폼 값 — file 이 없으면 기존 이미지 유지 */
export interface FillerImageInput {
  file: File | null;
  timeSlots: TimeSlot[];
  isAllApartments: boolean;
  apartmentIds: string[];
  isActive: boolean;
}

/** 한국 날짜 YYYY-MM-DD (집계 date 컬럼이 KST 기준 — 브라우저 타임존과 무관하게) */
function todayKst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** 입력값 검증 — 오류 문구 또는 null */
export function validateFillerInput(input: FillerImageInput, isNew: boolean): string | null {
  if (isNew && !input.file) return '이미지를 선택해 주세요.';
  if (input.file && !ACCEPTED_TYPES.includes(input.file.type)) return 'PNG, JPG, WebP 이미지만 올릴 수 있습니다.';
  if (input.file && input.file.size > MAX_SIZE_MB * 1024 * 1024) return `${MAX_SIZE_MB}MB 이하 이미지만 올릴 수 있습니다.`;
  if (input.timeSlots.length === 0) return '시간대를 하나 이상 선택해 주세요.';
  if (!input.isAllApartments && input.apartmentIds.length === 0) return '노출할 아파트를 선택하거나 전체 단지를 체크해 주세요.';
  return null;
}

export function useFillerImagesPage() {
  const supabase = createClient() as any;
  const [images, setImages] = useState<FillerImage[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [imagesRes, dailyRes, aptRes] = await Promise.all([
        supabase
          .from('door_popup_filler_images')
          .select('*, door_popup_filler_image_apartments(apartmentId, apartments(id, name))')
          .order('createdAt', { ascending: false }),
        supabase.from('door_popup_filler_image_daily').select('fillerImageId, date, impressionCount'),
        supabase.from('apartments').select('id, name').order('name'),
      ]);
      if (imagesRes.error) throw imagesRes.error;
      if (dailyRes.error) throw dailyRes.error;
      if (aptRes.error) throw aptRes.error;

      const today = todayKst();
      const totals = new Map<string, { total: number; today: number }>();
      for (const d of dailyRes.data ?? []) {
        const t = totals.get(d.fillerImageId) ?? { total: 0, today: 0 };
        t.total += d.impressionCount;
        if (d.date === today) t.today += d.impressionCount;
        totals.set(d.fillerImageId, t);
      }

      setImages(
        (imagesRes.data ?? []).map((row: any) => ({
          id: row.id,
          imageUrl: row.imageUrl,
          storagePath: row.storagePath,
          timeSlots: row.timeSlots,
          isAllApartments: row.isAllApartments,
          isActive: row.isActive,
          createdAt: row.createdAt,
          apartments: (row.door_popup_filler_image_apartments ?? [])
            .map((a: any) => a.apartments)
            .filter(Boolean),
          totalImpressions: totals.get(row.id)?.total ?? 0,
          todayImpressions: totals.get(row.id)?.today ?? 0,
        }))
      );
      setApartments(aptRes.data ?? []);
    } catch (err) {
      console.error('채움 이미지 불러오기 실패:', err);
      toast.error('채움 이미지를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadImage = async (file: File): Promise<{ imageUrl: string; storagePath: string }> => {
    const storagePath = `${STORAGE_DIR}/${crypto.randomUUID()}.${MIME_EXTENSIONS[file.type]}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
    return { imageUrl, storagePath };
  };

  /** 아파트 연결을 입력값으로 교체 (전체 단지면 연결 없음) */
  const replaceApartments = async (fillerImageId: string, input: FillerImageInput) => {
    const { error: delError } = await supabase
      .from('door_popup_filler_image_apartments')
      .delete()
      .eq('fillerImageId', fillerImageId);
    if (delError) throw delError;
    if (input.isAllApartments) return;
    const { error } = await supabase
      .from('door_popup_filler_image_apartments')
      .insert(input.apartmentIds.map((apartmentId) => ({ fillerImageId, apartmentId })));
    if (error) throw error;
  };

  /** 등록(existing 없음) 또는 수정. 성공 시 true */
  const save = async (input: FillerImageInput, existing: FillerImage | null): Promise<boolean> => {
    const invalid = validateFillerInput(input, existing === null);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    setSaving(true);
    let uploaded: { imageUrl: string; storagePath: string } | null = null;
    try {
      if (input.file) uploaded = await uploadImage(input.file);
      const fields = {
        timeSlots: input.timeSlots,
        isAllApartments: input.isAllApartments,
        isActive: input.isActive,
        ...(uploaded ?? {}),
      };

      const { data, error } = existing
        ? await supabase.from('door_popup_filler_images').update(fields).eq('id', existing.id).select('id').single()
        : await supabase.from('door_popup_filler_images').insert(fields).select('id').single();
      if (error) throw error;

      await replaceApartments(data.id, input);
      // 이미지를 바꿨으면 이전 파일 정리 (실패해도 저장은 성공)
      if (existing && uploaded) {
        await supabase.storage.from(BUCKET).remove([existing.storagePath]);
      }
      toast.success(existing ? '수정했습니다.' : '등록했습니다.');
      await load();
      return true;
    } catch (err) {
      console.error('채움 이미지 저장 실패:', err);
      // 새로 올린 파일이 고아로 남지 않게 정리
      if (uploaded) await supabase.storage.from(BUCKET).remove([uploaded.storagePath]);
      toast.error('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (image: FillerImage, isActive: boolean) => {
    const { error } = await supabase.from('door_popup_filler_images').update({ isActive }).eq('id', image.id);
    if (error) {
      toast.error('변경하지 못했습니다.');
      return;
    }
    setImages((prev) => prev.map((i) => (i.id === image.id ? { ...i, isActive } : i)));
  };

  const remove = async (image: FillerImage) => {
    const { error } = await supabase.from('door_popup_filler_images').delete().eq('id', image.id);
    if (error) {
      toast.error('삭제하지 못했습니다.');
      return;
    }
    await supabase.storage.from(BUCKET).remove([image.storagePath]);
    toast.success('삭제했습니다.');
    await load();
  };

  return { images, apartments, loading, saving, save, toggleActive, remove };
}
