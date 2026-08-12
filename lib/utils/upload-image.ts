// 이미지 업로드 유틸
//
// 파일 선택 즉시 올리지 않고 저장 시점에 모아 올리는 화면에서 쓴다.
// (ImageUpload 컴포넌트와 같은 변환·경로 규칙을 따른다)

import { createClient } from '@/lib/supabase/client';

/** 긴 변 기준 최대 크기 — 레티나 대응 */
const MAX_SIZE = 2560;

/** WebP 품질 */
const WEBP_QUALITY = 0.95;

/** Supabase Storage는 ASCII 파일명만 허용한다 */
function sanitizeFileName(fileName: string): string {
  let sanitized = fileName
    .replace(/\s+/g, '_')
    .replace(/\.+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-')
    .replace(/^[_-]+|[_-]+$/g, '');

  if (!sanitized) sanitized = 'file';
  return sanitized.length > 40 ? sanitized.substring(0, 40) : sanitized;
}

/** 비율을 유지한 채 WebP로 변환 */
function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context를 가져올 수 없습니다.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => blob
            ? resolve(blob)
            : reject(new Error('WebP 변환에 실패했습니다.')),
          'image/webp',
          WEBP_QUALITY
        );
      };

      img.onerror = () => reject(new Error('이미지를 로드할 수 없습니다.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

/**
 * 이미지 한 장을 Storage에 올리고 public URL을 돌려준다.
 *
 * jpg/png는 WebP로 변환해 올린다.
 */
export async function uploadImageFile(
  file: File,
  { bucket, storagePath }: { bucket: string; storagePath: string }
): Promise<string> {
  const supabase = createClient();

  const shouldConvert = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
  const body: File | Blob = shouldConvert ? await convertToWebP(file) : file;
  const extension = shouldConvert ? 'webp' : (file.name.split('.').pop() ?? 'bin');
  const contentType = shouldConvert ? 'image/webp' : file.type;

  const baseName = sanitizeFileName(
    file.name.substring(0, file.name.lastIndexOf('.')) || file.name
  );
  const filePath = `${storagePath}/${baseName}_${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, body, { upsert: false, contentType });

  if (error) throw error;

  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
}
