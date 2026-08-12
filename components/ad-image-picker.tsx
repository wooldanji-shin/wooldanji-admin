'use client';

import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_AD_IMAGES } from '@/lib/ads/constants';

/** 이미 저장된 이미지(url)와 아직 올리지 않은 이미지(file)를 함께 다룬다 */
export type AdImageItem =
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File; previewUrl: string };

export function adImageKey(item: AdImageItem): string {
  return item.kind === 'url' ? item.url : item.previewUrl;
}

interface AdImagePickerProps {
  items: AdImageItem[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
}

export function AdImagePicker({
  items,
  onAdd,
  onRemove,
}: AdImagePickerProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFull = items.length >= MAX_AD_IMAGES;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {items.map((item) => {
          const key = adImageKey(item);
          return (
            <div
              key={key}
              className="relative h-28 w-28 overflow-hidden rounded-lg border border-border"
            >
              {/* 로컬 파일은 blob URL이라 next/image 최적화 대상이 아니다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.kind === 'url' ? item.url : item.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="이미지 제거"
                onClick={() => onRemove(key)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {item.kind === 'file' && (
                <span className="absolute bottom-0 w-full bg-black/60 py-0.5 text-center text-[11px] text-white">
                  저장 시 업로드
                </span>
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onAdd(files);
          e.target.value = '';
        }}
      />

      <Button
        type="button"
        variant="outline"
        disabled={isFull}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="mr-1.5 h-4 w-4" />
        이미지 추가
      </Button>

      <p className="text-xs text-muted-foreground">
        최소 1장, 최대 {MAX_AD_IMAGES}장. 첫 번째 이미지가 목록의 대표 이미지로 쓰입니다.
        업로드는 저장할 때 한 번에 처리됩니다.
      </p>
    </div>
  );
}
