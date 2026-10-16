import { SOLO_IMAGE_HEIGHT, SOLO_IMAGE_WIDTH } from '@/lib/ads/solo-popup';

/**
 * 이미지를 3:4 로 중앙 크롭(cover)하고 1080×1440 으로 맞춰 WebP 파일로 돌려준다.
 * 원본이 더 작아도 업스케일해 규격을 통일한다 (앱 크롭 결과와 같은 규격).
 */
export function cropToSoloPopupImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const targetRatio = SOLO_IMAGE_WIDTH / SOLO_IMAGE_HEIGHT;
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const cropWidth = srcRatio > targetRatio ? img.naturalHeight * targetRatio : img.naturalWidth;
      const cropHeight = srcRatio > targetRatio ? img.naturalHeight : img.naturalWidth / targetRatio;
      const sx = (img.naturalWidth - cropWidth) / 2;
      const sy = (img.naturalHeight - cropHeight) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = SOLO_IMAGE_WIDTH;
      canvas.height = SOLO_IMAGE_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 가져올 수 없습니다.'));
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, SOLO_IMAGE_WIDTH, SOLO_IMAGE_HEIGHT);

      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(new File([blob], 'solo_popup.webp', { type: 'image/webp' }))
            : reject(new Error('WebP 변환에 실패했습니다.')),
        'image/webp',
        0.92
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = objectUrl;
  });
}
