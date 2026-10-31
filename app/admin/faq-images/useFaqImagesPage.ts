'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/supabase';
import { getSessionUser } from '@/lib/auth';

/** 앱 사용법·FAQ 화면의 플랫폼별 이미지 슬롯 (app_images.key) */
export const FAQ_SLOTS = [
  { key: 'faq_ios', label: 'iOS' },
  { key: 'faq_aos', label: 'Android' },
] as const;
export type FaqSlot = (typeof FAQ_SLOTS)[number];

const BUCKET = 'banners';
const STORAGE_DIR = 'app-images/faq';
const MAX_SIZE_MB = 10;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};
export const ACCEPTED_TYPES = Object.keys(MIME_EXTENSIONS);

export interface FaqImage {
  key: string;
  imageUrl: string;
  storagePath: string;
  width: number;
  height: number;
  updatedAt: string;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'PNG, JPG, WebP 이미지만 올릴 수 있습니다.';
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `${MAX_SIZE_MB}MB 이하 이미지만 올릴 수 있습니다.`;
  return null;
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = objectUrl;
  });
}

export function useFaqImagesPage() {
  const supabase = createClient() as any;
  const [images, setImages] = useState<Record<string, FaqImage>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_images')
      .select('*')
      .in('key', FAQ_SLOTS.map((s) => s.key));
    if (error) {
      console.error('FAQ 이미지 불러오기 실패:', error);
      toast.error('이미지를 불러오지 못했습니다.');
    } else {
      setImages(Object.fromEntries((data ?? []).map((row: FaqImage) => [row.key, row])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 성공 시 true. 새 이미지가 DB에 반영된 뒤에만 이전 파일을 지운다 (중간 실패해도 링크가 깨지지 않도록) */
  const replace = async (slot: FaqSlot, file: File): Promise<boolean> => {
    const invalid = validateFile(file);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      const { width, height } = await readImageSize(file);
      // 공용 업로드 유틸은 긴 변을 줄여 세로로 긴 이미지의 글자가 뭉개지므로 원본 그대로 올린다.
      // 파일명을 매번 새로 만들어야 URL이 바뀌어 앱·CDN 캐시가 갱신된다.
      const storagePath = `${STORAGE_DIR}/${crypto.randomUUID()}.${MIME_EXTENSIONS[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      uploadedPath = storagePath;

      const {
        data: { user },
      } = await getSessionUser();
      const { error: saveError } = await supabase.from('app_images').upsert(
        {
          key: slot.key,
          imageUrl: supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl,
          storagePath,
          width,
          height,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.id ?? null,
        },
        { onConflict: 'key' }
      );
      if (saveError) throw saveError;
      uploadedPath = null;

      const previous = images[slot.key];
      if (previous) await supabase.storage.from(BUCKET).remove([previous.storagePath]);
      toast.success(`${slot.label} 이미지를 교체했습니다.`);
      await load();
      return true;
    } catch (err) {
      console.error('FAQ 이미지 저장 실패:', err);
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      toast.error('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** 행을 지우면 앱이 내장 기본 이미지로 돌아간다 */
  const remove = async (slot: FaqSlot) => {
    const image = images[slot.key];
    if (!image) return;
    const { error } = await supabase.from('app_images').delete().eq('key', slot.key);
    if (error) {
      toast.error('삭제하지 못했습니다.');
      return;
    }
    await supabase.storage.from(BUCKET).remove([image.storagePath]);
    toast.success('기본 이미지로 되돌렸습니다.');
    await load();
  };

  return { images, loading, saving, replace, remove };
}
