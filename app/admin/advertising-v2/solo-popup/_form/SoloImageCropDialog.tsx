'use client';

import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CropArea } from './cropImage';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;

interface SoloImageCropDialogProps {
  /** 자를 사진 (null 이면 닫힘) */
  file: File | null;
  title: string;
  /** 가로/세로 비율 (기본 1:1) */
  aspect?: number;
  onApply: (area: CropArea) => void;
  onCancel: () => void;
}

/** 사진 한 장을 드래그·확대로 원하는 위치에서 자르는 모달 */
export function SoloImageCropDialog({
  file,
  title,
  aspect = 1,
  onApply,
  onCancel,
}: SoloImageCropDialogProps): React.ReactElement {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [area, setArea] = useState<CropArea | null>(null);

  // 사진이 바뀔 때마다 미리보기 주소를 만들고 위치·확대를 처음으로 돌린다
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setArea(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>사진을 드래그해 위치를 옮기고, 아래 막대로 확대할 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="relative h-[360px] w-full overflow-hidden rounded-md bg-black">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">확대</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
            aria-label="확대"
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
          <Button type="button" disabled={!area} onClick={() => area && onApply(area)}>적용</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
