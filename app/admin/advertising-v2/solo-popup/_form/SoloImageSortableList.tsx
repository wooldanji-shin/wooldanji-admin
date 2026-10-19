'use client';

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { adImageKey } from '@/components/ad-image-picker';
import type { SoloImage } from './useSoloPopupForm';

// 이 거리(px) 이상 움직여야 드래그로 본다 — 삭제 버튼 클릭이 드래그로 먹히지 않게
const DRAG_START_DISTANCE = 6;

interface SoloImageSortableListProps {
  images: SoloImage[];
  onRemove: (index: number) => void;
  /** 드래그로 순서를 바꿨을 때 — 저장 시 이 순서가 그대로 imageUrls 가 된다 */
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/** 썸네일을 끌어서 순서를 바꾸는 사진 목록 */
export function SoloImageSortableList({
  images,
  onRemove,
  onReorder,
}: SoloImageSortableListProps): React.ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const keys = images.map(adImageKey);

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return;
    onReorder(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={keys} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap items-start gap-3">
          {images.map((image, index) => (
            <SortableThumbnail
              key={keys[index]}
              id={keys[index]}
              image={image}
              index={index}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableThumbnailProps {
  id: string;
  image: SoloImage;
  index: number;
  onRemove: () => void;
}

function SortableThumbnail({ id, image, index, onRemove }: SortableThumbnailProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="space-y-1"
    >
      <div
        className="aspect-square w-[150px] cursor-grab touch-none overflow-hidden rounded-md border border-border bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {/* 로컬 파일은 blob URL이라 next/image 최적화 대상이 아니다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.kind === 'url' ? image.url : image.previewUrl}
          alt={`단독 팝업 이미지 ${index + 1}`}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={onRemove}>
        삭제
      </Button>
    </div>
  );
}
