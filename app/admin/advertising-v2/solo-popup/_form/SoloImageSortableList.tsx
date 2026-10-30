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
import { Button, Group } from '@mantine/core';
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
        <Group align="flex-start" gap="sm">
          {images.map((image, index) => (
            <SortableThumbnail
              key={keys[index]}
              id={keys[index]}
              image={image}
              index={index}
              onRemove={() => onRemove(index)}
            />
          ))}
        </Group>
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
    >
      <div
        className="cursor-grab touch-none active:cursor-grabbing"
        style={{
          width: 150,
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          borderRadius: 'var(--mantine-radius-md)',
          border: '1px solid var(--app-divider)',
          background: 'var(--app-bg-muted)',
        }}
        {...attributes}
        {...listeners}
      >
        {/* 로컬 파일은 blob URL이라 next/image 최적화 대상이 아니다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.kind === 'url' ? image.url : image.previewUrl}
          alt={`단독 팝업 이미지 ${index + 1}`}
          draggable={false}
          className="object-cover"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
      <Button type="button" size="xs" variant="default" fullWidth mt={4} onClick={onRemove}>
        삭제
      </Button>
    </div>
  );
}
