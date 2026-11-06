'use client';

import { Plus, Trash2, MapPin, Building2 } from 'lucide-react';
import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Popover,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { PageContent, PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { useNewApartmentPage } from './useNewApartmentPage';
import type { BuildingDraft, BuildingErrors, BuildingField, BulkMode, UseBulkAddReturn } from './types';

/** 주소 검색 드롭다운 높이 — 검색 결과 목록이 스크롤 없이 몇 줄 보이는 정도 */
const ADDRESS_SEARCH_HEIGHT = 420;

/** 다음 단계 버튼 높이 — 한 단계짜리 주요 버튼이라 크게 */
const NEXT_BUTTON_HEIGHT = 52;

const LINE_HELP = '범위는 ~, 여러 개는 쉼표로 구분';

/** 라인 입력 아래에 해석 결과를 칩으로 보여준다 (예: 1~3 · 4 · 5~11) */
function LinePreview({ groups }: { groups: string[] }): React.ReactElement | null {
  if (groups.length === 0) return null;
  return (
    <Group gap={6}>
      <Text size="xs" c="dimmed">
        라인 묶음 {groups.length}개
      </Text>
      {groups.map((g, i) => (
        <Badge key={`${g}-${i}`} variant="light" color="gray" size="sm">
          {g}
        </Badge>
      ))}
    </Group>
  );
}

const BULK_MODE_OPTIONS: { value: BulkMode; label: string }[] = [
  { value: 'single', label: '한 동씩' },
  { value: 'range', label: '여러 동 한 번에' },
];

/** 동 추가 패널 — 추가한 뒤에도 열려 있고 다음 동 번호가 미리 채워져 이어서 추가할 수 있다 */
function BuildingAddPanel({ bulk }: { bulk: UseBulkAddReturn }): React.ReactElement {
  const isRange = bulk.mode === 'range';
  // 입력 중 Enter로 바로 추가 — 키보드만으로 연속 입력
  const submitOnEnter = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    bulk.submit();
  };

  return (
    // 입력용 패널이라 아래 동 카드(흰 배경)와 색으로 구분한다
    <Paper
      withBorder
      radius="md"
      p="md"
      bg="var(--mantine-color-blue-light)"
      style={{ borderColor: 'var(--mantine-color-blue-outline)' }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600} c="blue">
            동 추가
          </Text>
          <SegmentedControl
            size="xs"
            data={BULK_MODE_OPTIONS}
            value={bulk.mode}
            onChange={(v) => bulk.setMode(v as BulkMode)}
          />
        </Group>

        <SimpleGrid cols={{ base: 2, sm: isRange ? 3 : 2 }} spacing="sm">
          <TextInput
            label={isRange ? '시작 동 *' : '동 번호 *'}
            placeholder="예: 101"
            inputMode="numeric"
            value={bulk.draft.from}
            onChange={(e) => bulk.update('from', e.target.value)}
            onKeyDown={submitOnEnter}
            error={!isRange && bulk.errors.range}
          />
          {isRange && (
            <TextInput
              label="끝 동 *"
              placeholder="예: 110"
              inputMode="numeric"
              value={bulk.draft.to}
              onChange={(e) => bulk.update('to', e.target.value)}
              onKeyDown={submitOnEnter}
            />
          )}
          <NumberInput
            label={isRange ? '동마다 세대수 *' : '세대수 *'}
            placeholder="예: 120"
            min={0}
            allowDecimal={false}
            allowNegative={false}
            hideControls
            value={bulk.draft.householdsCount || ''}
            onChange={(v) => bulk.update('householdsCount', Number(v) || 0)}
            onKeyDown={submitOnEnter}
            error={bulk.errors.householdsCount}
          />
        </SimpleGrid>
        {/* 시작·끝 동 오류는 두 칸에 걸친 문제라 한 줄로 따로 보여준다 */}
        {isRange && bulk.errors.range && (
          <Text size="sm" c="red">
            {bulk.errors.range}
          </Text>
        )}

        <TextInput
          label="라인 번호 *"
          placeholder="예: 1~3, 4, 5~11"
          value={bulk.draft.lines}
          onChange={(e) => bulk.update('lines', e.target.value)}
          onKeyDown={submitOnEnter}
          description={LINE_HELP}
          error={bulk.errors.lines}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
        />

        <Group justify="flex-end">
          <Button onClick={bulk.submit} leftSection={<Plus size={16} />}>
            {isRange && bulk.count > 0 ? `${bulk.count}개 동 추가` : '추가'}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

interface AddressSearchDropdownProps {
  opened: boolean;
  onOpenedChange: (opened: boolean) => void;
  embed: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}

/** 주소 입력칸 + 검색 버튼, 누르면 바로 아래에 주소 검색이 드롭다운으로 열린다 */
function AddressSearchDropdown({
  opened,
  onOpenedChange,
  embed,
  children,
}: AddressSearchDropdownProps): React.ReactElement {
  return (
    <Popover
      opened={opened}
      onDismiss={() => onOpenedChange(false)}
      width="target"
      position="bottom-start"
      shadow="md"
      trapFocus={false}
    >
      <Popover.Target>
        <Group gap="xs" wrap="nowrap" align="center">
          <div style={{ flex: 1 }}>{children}</div>
          <Button type="button" onClick={() => onOpenedChange(!opened)} style={{ flexShrink: 0 }}>
            주소 검색
          </Button>
        </Group>
      </Popover.Target>
      <Popover.Dropdown p={0} style={{ overflow: 'hidden' }}>
        {/* 바깥 상자에서 스크롤 — 안쪽 영역은 검색 화면 높이만큼 늘어난다 */}
        <div style={{ height: ADDRESS_SEARCH_HEIGHT, overflowY: 'auto' }}>
          {/* 열릴 때마다 이 영역에 검색 화면을 새로 띄운다 */}
          <div ref={embed} />
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

interface BuildingCardProps {
  building: BuildingDraft;
  errors: BuildingErrors;
  linePreview: string[];
  onUpdate: (field: BuildingField, value: string | number) => void;
  onRemove: () => void;
}

/** 추가된 동 하나 — 여기서 바로 고칠 수 있다 */
function BuildingCard({ building, errors, linePreview, onUpdate, onRemove }: BuildingCardProps): React.ReactElement {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>{building.number ? `${building.number}동` : '동 번호 없음'}</Text>
          <ActionIcon variant="subtle" color="red" aria-label="삭제" onClick={onRemove}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>

        <SimpleGrid cols={2} spacing="sm">
          <TextInput
            label="동 번호 *"
            placeholder="예: 101"
            inputMode="numeric"
            value={building.number}
            onChange={(e) => onUpdate('number', e.target.value)}
            error={errors.number}
          />
          <NumberInput
            label="세대수 *"
            placeholder="예: 120"
            min={0}
            allowDecimal={false}
            allowNegative={false}
            hideControls
            value={building.householdsCount || ''}
            onChange={(v) => onUpdate('householdsCount', Number(v) || 0)}
            error={errors.householdsCount}
          />
        </SimpleGrid>

        <TextInput
          label="라인 번호 *"
          placeholder="예: 1~3, 4, 5~11"
          value={building.lines}
          onChange={(e) => onUpdate('lines', e.target.value)}
          error={errors.lines}
        />
        <LinePreview groups={linePreview} />
      </Stack>
    </Paper>
  );
}

export default function NewApartmentPage(): React.ReactElement {
  const page = useNewApartmentPage();
  const { basic, buildings, bulk, summary } = page;

  return (
    <PageShell>
      <HeaderTitle title="새 아파트 등록" onBack={page.handleBack} />

      {/* 입력칸이 화면 끝까지 늘어나지 않게 폼을 가운데 한 열로 모은다 */}
      <PageContent className="w-full max-w-[45rem] mx-auto">
        <Text size="sm" c="dimmed">
          아파트 정보를 입력하여 새로운 아파트를 등록합니다
        </Text>

        <Stepper active={page.step - 1} size="sm">
          <Stepper.Step label="기본 정보" />
          <Stepper.Step label="동/라인 정보" />
        </Stepper>

        {/* Step 1: 기본 정보 */}
        {page.step === 1 && (
          <Paper withBorder radius="md" p="lg">
            {/* 입력 중 Enter를 누르면 다음 단계로 넘어간다 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                page.goNext();
              }}
            >
              <Stack gap="lg">
                <Stack gap={4}>
                  <Group gap="xs">
                    <MapPin size={20} />
                    <Title order={4}>아파트 기본 정보</Title>
                  </Group>
                  <Text size="sm" c="dimmed">
                    아파트의 기본 정보를 입력해주세요
                  </Text>
                </Stack>

                <TextInput
                  id="name"
                  label="아파트명 *"
                  placeholder="예: 동부아파트"
                  value={basic.apartmentName}
                  onChange={(e) => basic.setApartmentName(e.target.value)}
                  error={basic.errors.name}
                />

                {/* 입력칸을 눌러도 주소 검색이 열린다 */}
                <TextInput
                  id="address"
                  label="주소 *"
                  placeholder="주소를 검색해주세요"
                  value={basic.address}
                  readOnly
                  onClick={() => basic.setAddressSearchOpened(true)}
                  error={basic.errors.address}
                  styles={{ input: { cursor: 'pointer' } }}
                  // 버튼을 입력칸과 같은 줄에 둬서 라벨·오류 문구와 상관없이 높이가 맞는다
                  inputContainer={(input) => (
                    <AddressSearchDropdown
                      opened={basic.addressSearchOpened}
                      onOpenedChange={basic.setAddressSearchOpened}
                      embed={basic.embedAddressSearch}
                    >
                      {input}
                    </AddressSearchDropdown>
                  )}
                />

                <Button type="submit" fullWidth h={NEXT_BUTTON_HEIGHT}>
                  다음 단계
                </Button>
              </Stack>
            </form>
          </Paper>
        )}

        {/* Step 2: 동/라인 정보 */}
        {page.step === 2 && (
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Stack gap={4}>
                <Group gap="xs">
                  <Building2 size={20} />
                  <Title order={4}>동/라인 정보</Title>
                </Group>
              </Stack>

              <BuildingAddPanel bulk={bulk} />

              <Stack gap="sm">
                <Text fw={600}>
                  추가된 동{' '}
                  <Text span c="dimmed" fw={500}>
                    {buildings.list.length}개
                  </Text>
                </Text>
                {buildings.list.length === 0 ? (
                  <Stack align="center" gap="xs" py="lg">
                    <Building2 size={32} color="var(--mantine-color-dimmed)" />
                    <Text ta="center" size="sm" c="dimmed">
                      아직 추가된 동이 없습니다
                    </Text>
                  </Stack>
                ) : (
                  buildings.list.map((building) => (
                    <BuildingCard
                      key={building.id}
                      building={building}
                      errors={buildings.errors[building.id] ?? {}}
                      linePreview={buildings.linePreview(building.lines)}
                      onUpdate={(field, value) => buildings.updateBuilding(building.id, field, value)}
                      onRemove={() => buildings.removeBuilding(building.id)}
                    />
                  ))
                )}
              </Stack>

              <Divider />

              {/* 등록 전 한눈에 확인 */}
              {summary.buildingCount > 0 && (
                <SimpleGrid cols={3} spacing="sm">
                  {[
                    {
                      key: 'buildings',
                      label: '동',
                      value: `${summary.buildingCount.toLocaleString()}개`,
                    },
                    {
                      key: 'households',
                      label: '세대',
                      value: `${summary.householdsCount.toLocaleString()}세대`,
                    },
                    {
                      key: 'lines',
                      label: '라인 묶음',
                      value: `${summary.lineGroupCount.toLocaleString()}개`,
                    },
                  ].map((t) => (
                    <Paper key={t.key} radius="md" p="sm">
                      <Text size="xs" c="dimmed">
                        {t.label}
                      </Text>
                      <Text fz="lg" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {t.value}
                      </Text>
                    </Paper>
                  ))}
                </SimpleGrid>
              )}

              <Group justify="space-between">
                <Button variant="default" onClick={page.goPrev} disabled={page.loading}>
                  이전 단계
                </Button>
                <Button onClick={page.handleSubmit} loading={page.loading}>
                  아파트 등록
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
      </PageContent>
    </PageShell>
  );
}
