'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageThumbnailProps {
  src: string;
  alt?: string;
  /** 썸네일 크기 (Tailwind class로 override). 기본 180x180. */
  className?: string;
  onClick?: () => void;
}

/**
 * 작은 썸네일 이미지. 클릭 시 ImageLightbox와 함께 쓰면 확대 보기.
 * 단독 사용 시 onClick 직접 처리.
 */
export function ImageThumbnail({
  src,
  alt = '',
  className,
  onClick,
}: ImageThumbnailProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative h-[180px] w-[180px] shrink-0 overflow-hidden rounded-md border border-border bg-muted transition-all hover:border-primary/40 hover:shadow-card-hover',
        className
      )}
      aria-label={alt || '이미지 크게 보기'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </button>
  );
}

interface ImageLightboxProps {
  /** 표시할 이미지 URL 목록. null이면 닫힘 상태. */
  images: string[] | null;
  /** 현재 인덱스 */
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: ImageLightboxProps): React.ReactElement | null {
  const open = images !== null && images.length > 0;

  const toPrev = useCallback((): void => {
    if (!images || !onIndexChange) return;
    if (index > 0) onIndexChange(index - 1);
  }, [images, index, onIndexChange]);

  const toNext = useCallback((): void => {
    if (!images || !onIndexChange) return;
    if (index < images.length - 1) onIndexChange(index + 1);
  }, [images, index, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        toPrev();
      } else if (e.key === 'ArrowRight') {
        toNext();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, toPrev, toNext]);

  if (!open || !images) return null;

  const current = images[index];
  const hasMultiple = images.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="닫기"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {/* 이전/다음 버튼 */}
      {hasMultiple && index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toPrev();
          }}
          aria-label="이전 이미지"
          className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {hasMultiple && index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toNext();
          }}
          aria-label="다음 이미지"
          className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* 이미지 + 인덱서 */}
      <div
        className="relative flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt=""
          className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
        {hasMultiple && (
          <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {index + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * useState 기반 헬퍼 훅. 이미지 배열을 받고, 썸네일 클릭 핸들러와 Lightbox prop을 반환.
 *
 * @example
 * const lb = useImageLightbox(images);
 * <ImageThumbnail src={img} onClick={() => lb.open(0)} />
 * <ImageLightbox {...lb.props} />
 */
export function useImageLightbox(images: string[]): {
  open: (index: number) => void;
  close: () => void;
  props: ImageLightboxProps;
} {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return {
    open: (i: number) => setOpenIndex(i),
    close: () => setOpenIndex(null),
    props: {
      images: openIndex === null ? null : images,
      index: openIndex ?? 0,
      onClose: () => setOpenIndex(null),
      onIndexChange: (i: number) => setOpenIndex(i),
    },
  };
}
