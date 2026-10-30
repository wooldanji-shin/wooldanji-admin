import { useCallback, useEffect, useState } from 'react';
import type { UseImagePreviewReturn } from '../types';

export function useImagePreview(): UseImagePreviewReturn {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ESC 키로 이미지 미리보기 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && imagePreview) {
        e.preventDefault();
        e.stopPropagation();
        setImagePreview(null);
      }
    };

    if (imagePreview) {
      document.addEventListener('keydown', handleEscape, true); // capture phase에서 처리
      return () => document.removeEventListener('keydown', handleEscape, true);
    }
  }, [imagePreview]);

  // 미리보기 닫기 (오버레이/닫기 버튼) — memo된 오버레이에 넘기므로 참조 고정
  const closeImagePreview = useCallback((): void => {
    setImagePreview(null);
  }, []);

  return { imagePreview, setImagePreview, closeImagePreview };
}
