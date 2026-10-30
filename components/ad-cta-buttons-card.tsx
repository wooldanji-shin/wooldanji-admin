'use client';

import { Check, Circle, Plus, X } from 'lucide-react';
import {
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  CTA_CUSTOM_LABEL_MAX_LENGTH,
  MAX_CTA_BUTTONS,
  MAX_CUSTOM_CTA_BUTTONS,
  ctaButtonLabel,
  isDeliveryButton,
  type CtaButton,
  type CtaButtonType,
} from '@/lib/cta-button';

const PRESET_PLACEHOLDER: Record<string, string> = {
  baemin: 'https://baemin.me/...',
  coupangEats: 'https://www.coupangeats.com/...',
  naver: 'https://naver.me/...',
};

interface CtaButtonsCardProps {
  buttons: CtaButton[];
  /** 음식 카테고리 + 서브카테고리 선택 시에만 배달앱 버튼을 고를 수 있다 */
  deliveryAvailable: boolean;
  onToggleType: (type: CtaButtonType) => void;
  onAddCustom: () => void;
  onUpdate: (id: string, changes: Partial<CtaButton>) => void;
  onRemove: (id: string) => void;
}

export function CtaButtonsCard({
  buttons,
  deliveryAvailable,
  onToggleType,
  onAddCustom,
  onUpdate,
  onRemove,
}: CtaButtonsCardProps): React.ReactElement {
  const presetTypes: CtaButtonType[] = [
    'phone',
    'sms',
    'naver',
    ...(deliveryAvailable ? (['baemin', 'coupangEats'] as CtaButtonType[]) : []),
  ];
  // 링크 입력이 필요한 프리셋 버튼 (배달앱 + 네이버)
  const linkButtons = buttons.filter(
    (b) => isDeliveryButton(b) || b.type === 'naver'
  );
  const customButtons = buttons.filter((b) => b.type === 'custom');
  const isFull = buttons.length >= MAX_CTA_BUTTONS;

  return (
    <Paper withBorder radius="md" p="lg">
      <Group justify="space-between" mb="xs">
        <Title order={4}>하단 버튼</Title>
        <Text size="sm" fw={600} c={isFull ? 'blue' : 'dimmed'}>
          {buttons.length}/{MAX_CTA_BUTTONS}
        </Text>
      </Group>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          앱 광고 상세 하단에 노출될 버튼입니다. 전화·문자는 파트너 전화번호를 사용합니다.
        </Text>

        <Group gap="xs">
          {presetTypes.map((type) => {
            const selected = buttons.some((b) => b.type === type);
            return (
              <Button
                key={type}
                type="button"
                variant={selected ? 'light' : 'default'}
                disabled={!selected && isFull}
                onClick={() => onToggleType(type)}
                leftSection={selected ? <Check size={16} /> : <Circle size={16} />}
              >
                {ctaButtonLabel({ id: type, type })}
              </Button>
            );
          })}
        </Group>

        {!deliveryAvailable && (
          <Text size="xs" c="dimmed">
            배달의민족·쿠팡이츠는 음식 카테고리에서 서브카테고리를 선택하면 나타납니다.
          </Text>
        )}

        {linkButtons.map((button) => (
          <TextInput
            key={button.id}
            label={`${ctaButtonLabel(button)} 링크`}
            withAsterisk
            value={button.url ?? ''}
            placeholder={PRESET_PLACEHOLDER[button.type]}
            onChange={(e) => onUpdate(button.id, { url: e.target.value.trim() })}
          />
        ))}

        <Divider />

        <Stack gap="sm">
          <div>
            <Text size="sm" fw={600}>직접 추가</Text>
            <Text size="xs" c="dimmed">
              버튼 이름과 링크를 직접 입력합니다 (최대 {MAX_CUSTOM_CTA_BUTTONS}개)
            </Text>
          </div>

          {customButtons.map((button) => (
            <Paper key={button.id} bg="var(--app-bg-muted)" radius="md" p="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>버튼 이름</Text>
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    leftSection={<X size={14} />}
                    onClick={() => onRemove(button.id)}
                  >
                    삭제
                  </Button>
                </Group>
                <TextInput
                  value={button.label ?? ''}
                  maxLength={CTA_CUSTOM_LABEL_MAX_LENGTH}
                  placeholder={`예: 요기요 (최대 ${CTA_CUSTOM_LABEL_MAX_LENGTH}자)`}
                  onChange={(e) => onUpdate(button.id, { label: e.target.value })}
                />
                <TextInput
                  label="링크"
                  value={button.url ?? ''}
                  placeholder="https://"
                  onChange={(e) => onUpdate(button.id, { url: e.target.value.trim() })}
                />
              </Stack>
            </Paper>
          ))}

          {customButtons.length < MAX_CUSTOM_CTA_BUTTONS && (
            <Button
              type="button"
              variant="default"
              fullWidth
              disabled={isFull}
              onClick={onAddCustom}
              leftSection={<Plus size={16} />}
            >
              버튼 추가
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
