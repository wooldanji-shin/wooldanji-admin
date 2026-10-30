'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
  Input,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
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
    <Modal
      opened={open}
      onClose={onClose}
      title={image ? '채움 이미지 수정' : '채움 이미지 등록'}
      size={560}
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          단독 팝업 광고가 최대 장수보다 적을 때 남은 자리를 채우며, 광고와 섞여 랜덤으로 나옵니다. 단독 팝업 카드 크기 안에 이미지 전체가 보이게 들어갑니다.
        </Text>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            이미지 (세로형)
          </Text>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="채움 이미지 미리보기"
              className="object-contain"
              style={{
                maxHeight: 280,
                maxWidth: '100%',
                alignSelf: 'flex-start',
                borderRadius: 'var(--mantine-radius-md)',
                border: '1px solid var(--app-divider)',
              }}
            />
          )}
          <Input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={onFileChange} />
        </Stack>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            노출 시간대 (여러 개 선택 가능)
          </Text>
          <SimpleGrid cols={2} spacing="xs">
            {TIME_SLOTS.map((slot) => (
              <Checkbox
                key={slot.value}
                checked={input.timeSlots.includes(slot.value)}
                onChange={() => patch({ timeSlots: toggle<TimeSlot>(input.timeSlots, slot.value) })}
                label={slot.label}
              />
            ))}
          </SimpleGrid>
        </Stack>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            노출 아파트
          </Text>
          <Checkbox
            checked={input.isAllApartments}
            onChange={(e) => patch({ isAllApartments: e.currentTarget.checked })}
            label="전체 단지"
          />
          {!input.isAllApartments && (
            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <TextInput placeholder="아파트 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Text size="xs" c="dimmed">
                  {input.apartmentIds.length}개 선택됨
                </Text>
                <ScrollArea.Autosize mah={200}>
                  <Stack gap={6}>
                    {filteredApartments.map((apt) => (
                      <Checkbox
                        key={apt.id}
                        checked={input.apartmentIds.includes(apt.id)}
                        onChange={() => patch({ apartmentIds: toggle(input.apartmentIds, apt.id) })}
                        label={apt.name}
                      />
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Stack>
            </Paper>
          )}
        </Stack>

        <Group justify="space-between">
          <Text size="sm" fw={500}>
            사용
          </Text>
          <Switch
            checked={input.isActive}
            onChange={(e) => patch({ isActive: e.currentTarget.checked })}
            aria-label="사용"
          />
        </Group>
      </Stack>

      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </Group>
    </Modal>
  );
}
