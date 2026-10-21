'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ACCEPTED_TYPES,
  TIME_SLOTS,
  type ApartmentOption,
  type FillerImage,
  type FillerImageInput,
  type TimeSlot,
} from './useFillerImagesPage';

interface Props {
  open: boolean;
  /** null 이면 신규 등록 */
  image: FillerImage | null;
  apartments: ApartmentOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: FillerImageInput) => Promise<boolean>;
}

const EMPTY_INPUT: FillerImageInput = {
  file: null,
  timeSlots: TIME_SLOTS.map((s) => s.value),
  isAllApartments: true,
  apartmentIds: [],
  isActive: true,
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FillerImageDialog({ open, image, apartments, saving, onClose, onSave }: Props): React.ReactElement {
  const [input, setInput] = useState<FillerImageInput>(EMPTY_INPUT);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // 열 때마다 대상 이미지 값으로 초기화
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setPreviewUrl(image?.imageUrl ?? null);
    setInput(
      image
        ? {
            file: null,
            timeSlots: image.timeSlots,
            isAllApartments: image.isAllApartments,
            apartmentIds: image.apartments.map((a) => a.id),
            isActive: image.isActive,
          }
        : EMPTY_INPUT
    );
  }, [open, image]);

  const patch = (changes: Partial<FillerImageInput>) => setInput((prev) => ({ ...prev, ...changes }));

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    patch({ file });
    setPreviewUrl(URL.createObjectURL(file));
  };

  const filteredApartments = useMemo(
    () => apartments.filter((a) => a.name.includes(search.trim())),
    [apartments, search]
  );

  const submit = async () => {
    if (await onSave(input)) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{image ? '채움 이미지 수정' : '채움 이미지 등록'}</DialogTitle>
          <DialogDescription>
            단독 팝업 광고가 최대 장수보다 적을 때 남은 자리를 채우며, 광고와 섞여 랜덤으로 나옵니다. 단독 팝업 카드 크기 안에 이미지 전체가 보이게 들어갑니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <label className="text-sm font-medium">이미지 (세로형)</label>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="채움 이미지 미리보기" className="max-h-[280px] rounded-md border object-contain" />
            )}
            <Input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={onFileChange} />
          </section>

          <section className="space-y-2">
            <label className="text-sm font-medium">노출 시간대 (여러 개 선택 가능)</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => (
                <label key={slot.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={input.timeSlots.includes(slot.value)}
                    onCheckedChange={() => patch({ timeSlots: toggle<TimeSlot>(input.timeSlots, slot.value) })}
                  />
                  {slot.label}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-sm font-medium">노출 아파트</label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={input.isAllApartments}
                onCheckedChange={(v) => patch({ isAllApartments: v === true })}
              />
              전체 단지
            </label>
            {!input.isAllApartments && (
              <div className="space-y-2 rounded-md border p-3">
                <Input placeholder="아파트 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
                <p className="text-xs text-muted-foreground">{input.apartmentIds.length}개 선택됨</p>
                <div className="max-h-[200px] space-y-1 overflow-y-auto">
                  {filteredApartments.map((apt) => (
                    <label key={apt.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={input.apartmentIds.includes(apt.id)}
                        onCheckedChange={() => patch({ apartmentIds: toggle(input.apartmentIds, apt.id) })}
                      />
                      {apt.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="flex items-center justify-between">
            <label className="text-sm font-medium">사용</label>
            <Switch checked={input.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
