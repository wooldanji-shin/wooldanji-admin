'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageContent, PageHeader, PageHeaderActions, PageHeaderTitle, PageShell } from '@/components/page-shell';
import { InlineLoadingSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { FillerImageDialog } from './FillerImageDialog';
import { TIME_SLOTS, useFillerImagesPage, type FillerImage } from './useFillerImagesPage';

const SLOT_SHORT_LABEL = Object.fromEntries(TIME_SLOTS.map((s) => [s.value, s.label.split(' ')[0]]));
/** 카드에 바로 보여줄 아파트 이름 수 (나머지는 +N) */
const VISIBLE_APARTMENTS = 3;

function ApartmentsText({ image }: { image: FillerImage }): React.ReactElement {
  if (image.isAllApartments) return <span>전체 단지</span>;
  const names = image.apartments.map((a) => a.name);
  const rest = names.length - VISIBLE_APARTMENTS;
  return (
    <span>
      {names.slice(0, VISIBLE_APARTMENTS).join(', ')}
      {rest > 0 && ` 외 ${rest}곳`}
    </span>
  );
}

function FillerImageCard({
  image,
  onEdit,
  onToggle,
  onDelete,
}: {
  image: FillerImage;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.imageUrl} alt="채움 이미지" className="h-[160px] w-[90px] rounded-md border bg-muted object-contain" />
        <div className="flex flex-1 flex-col gap-2 text-sm">
          <div className="flex flex-wrap gap-1">
            {image.timeSlots.map((slot) => (
              <Badge key={slot} variant="outline">
                {SLOT_SHORT_LABEL[slot]}
              </Badge>
            ))}
          </div>
          <ApartmentsText image={image} />
          <span className="text-muted-foreground">
            노출 누적 {image.totalImpressions.toLocaleString()} · 오늘 {image.todayImpressions.toLocaleString()}
          </span>
          <div className="mt-auto flex items-center gap-3">
            <label className="flex items-center gap-2">
              <Switch checked={image.isActive} onCheckedChange={onToggle} />
              {image.isActive ? '사용 중' : '사용 안 함'}
            </label>
            <Button variant="outline" size="sm" onClick={onEdit}>
              수정
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
              삭제
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DoorFillerImagesPage(): React.ReactElement {
  const page = useFillerImagesPage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FillerImage | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (image: FillerImage) => {
    setEditing(image);
    setDialogOpen(true);
  };
  const confirmDelete = (image: FillerImage) => {
    if (window.confirm('이 채움 이미지를 삭제할까요? 노출 기록도 함께 삭제됩니다.')) page.remove(image);
  };

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="문열림 채움 이미지"
          description="단독 팝업 광고를 먼저 채우고, '팝업 최대 장수'보다 적으면 남은 자리를 이 이미지들이 채웁니다. 보여주는 순서는 광고와 섞여 랜덤입니다. 시간대·아파트 조건에 맞는 것 중 랜덤으로 나갑니다. (팝업 모드가 '단독 팝업'일 때만 노출)"
        />
        <PageHeaderActions>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            이미지 등록
          </Button>
        </PageHeaderActions>
      </PageHeader>
      <PageContent>
        {page.loading ? (
          <InlineLoadingSkeleton />
        ) : page.images.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">등록된 채움 이미지가 없습니다.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {page.images.map((image) => (
              <FillerImageCard
                key={image.id}
                image={image}
                onEdit={() => openEdit(image)}
                onToggle={(v) => page.toggleActive(image, v)}
                onDelete={() => confirmDelete(image)}
              />
            ))}
          </div>
        )}
      </PageContent>
      <FillerImageDialog
        open={dialogOpen}
        image={editing}
        apartments={page.apartments}
        saving={page.saving}
        onClose={() => setDialogOpen(false)}
        onSave={(input) => page.save(input, editing)}
      />
    </PageShell>
  );
}
