'use client';

import { useRef } from 'react';
import { GripVertical, ImagePlus, X } from 'lucide-react';
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
import { Badge, Button, Group, Stack, Text } from '@mantine/core';
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
  /** 드래그로 순서를 바꿨을 때 — 저장 시 이 순서가 그대로 imageUrls가 된다 */
  onReorder: (activeKey: string, overKey: string) => void;
}

export function AdImagePicker({
  items,
  onAdd,
  onRemove,
  onReorder,
}: AdImagePickerProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFull = items.length >= MAX_AD_IMAGES;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <Stack gap="sm" align="flex-start">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map(adImageKey)} strategy={rectSortingStrategy}>
          <Group gap="sm">
            {items.map((item, index) => (
              <SortableImage
                key={adImageKey(item)}
                item={item}
                isPrimary={index === 0}
                onRemove={onRemove}
              />
            ))}
          </Group>
        </SortableContext>
      </DndContext>

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
        variant="default"
        disabled={isFull}
        onClick={() => inputRef.current?.click()}
        leftSection={<ImagePlus size={16} />}
      >
        이미지 추가
      </Button>

      <Text size="xs" c="dimmed">
        최소 1장, 최대 {MAX_AD_IMAGES}장. 첫 번째 이미지가 목록의 대표 이미지로 쓰입니다.
        손잡이를 끌어 순서를 바꿀 수 있고, 업로드는 저장할 때 한 번에 처리됩니다.
      </Text>
    </Stack>
  );
}

interface SortableImageProps {
  item: AdImageItem;
  /** 목록에 대표로 걸리는 첫 번째 이미지 */
  isPrimary: boolean;
  onRemove: (key: string) => void;
}

function SortableImage({
  item,
  isPrimary,
  onRemove,
}: SortableImageProps): React.ReactElement {
  const key = adImageKey(item);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: '1px solid var(--app-divider)',
        borderRadius: 'var(--mantine-radius-md)',
      }}
      className="relative h-28 w-28 overflow-hidden"
    >
      {/* 로컬 파일은 blob URL이라 next/image 최적화 대상이 아니다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.kind === 'url' ? item.url : item.previewUrl}
        alt=""
        className="h-full w-full object-cover"
      />
      {/* 손잡이를 따로 둔다 — 이미지 전체가 드래그면 삭제 버튼을 누르기 어렵다 */}
      <button
        type="button"
        aria-label="순서 변경 손잡이"
        className="absolute left-1 top-1 cursor-grab rounded-full bg-black/60 p-1 text-white active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="이미지 제거"
        onClick={() => onRemove(key)}
        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {isPrimary && (
        <Badge
          variant="filled"
          radius="sm"
          size="sm"
          style={{ position: 'absolute', left: 4, bottom: 4 }}
        >
          대표사진
        </Badge>
      )}
    </div>
  );
}
