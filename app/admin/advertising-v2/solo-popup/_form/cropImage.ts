import { SOLO_IMAGE_HEIGHT, SOLO_IMAGE_WIDTH } from '@/lib/ads/solo-popup';

/** 원본 이미지 기준 잘라낼 영역(px) — react-easy-crop 의 croppedAreaPixels 와 같은 형식 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 지정한 영역을 잘라 1080×1080 으로 그려 WebP 파일로 돌려준다.
 * 영역이 더 작아도 업스케일해 규격을 통일한다 (앱 크롭 결과와 같은 규격).
 */
export function cropToSoloPopupImage(file: File, area: CropArea): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = SOLO_IMAGE_WIDTH;
      canvas.height = SOLO_IMAGE_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 가져올 수 없습니다.'));
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, SOLO_IMAGE_WIDTH, SOLO_IMAGE_HEIGHT);

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
