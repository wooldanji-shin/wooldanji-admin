'use client';

import { Plus, Trash2, MapPin, Building2, Layers } from 'lucide-react';
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Divider,
  Group,
  NumberInput,
  Paper,
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

const LINE_HELP = '범위는 물결표(~)로, 여러 개는 쉼표(,)로 구분하세요 (예: 1~3, 4, 5~11)';

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

              <Group gap="xs" align="flex-start" wrap="nowrap">
                {/* 입력칸을 눌러도 주소 검색이 열린다 */}
                <TextInput
                  id="address"
                  label="주소 *"
                  placeholder="주소를 검색해주세요"
                  value={basic.address}
                  readOnly
                  onClick={basic.openAddressSearch}
                  error={basic.errors.address}
                  style={{ flex: 1 }}
                  styles={{ input: { cursor: 'pointer' } }}
                />
                {/* 라벨 높이만큼 내려 입력칸과 줄을 맞춘다 */}
                <Button type="button" onClick={basic.openAddressSearch} mt="1.75rem" style={{ flexShrink: 0 }}>
                  주소 검색
                </Button>
              </Group>

              <Group justify="flex-end">
                <Button onClick={page.goNext}>다음 단계</Button>
              </Group>
            </Stack>
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
                <Text size="sm" c="dimmed">
                  아파트의 동 정보와 각 동의 라인을 설정해주세요
                </Text>
              </Stack>

              {buildings.list.length === 0 ? (
                <Stack align="center" gap="xs" py="xl">
                  <Building2 size={32} color="var(--mantine-color-dimmed)" />
                  <Text ta="center" size="sm" c="dimmed">
                    아직 등록된 동이 없습니다. &apos;동 추가하기&apos; 버튼을 클릭하여 동을 추가해주세요.
                  </Text>
                </Stack>
              ) : (
                <Stack gap="sm">
                  {buildings.list.map((building, index) => {
                    const errors = buildings.errors[building.id] ?? {};
                    return (
                      // 카드 안의 카드 — 테두리 없이 연한 회색 배경으로 구분된다
                      <Paper key={building.id} radius="md" p="md">
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Text fw={600}>
                              동 {index + 1}
                              {building.number && (
                                <Text span c="dimmed" fw={500} ml={6}>
                                  · {building.number}동
                                </Text>
                              )}
                            </Text>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="삭제"
                              onClick={() => buildings.removeBuilding(building.id)}
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
                          </Group>

                          <SimpleGrid cols={2} spacing="sm">
                            <TextInput
                              label="동 번호 *"
                              placeholder="예: 101"
                              inputMode="numeric"
                              value={building.number}
                              onChange={(e) => buildings.updateBuilding(building.id, 'number', e.target.value)}
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
                              onChange={(v) => buildings.updateBuilding(building.id, 'householdsCount', Number(v) || 0)}
                              error={errors.householdsCount}
                            />
                          </SimpleGrid>

                          <TextInput
                            label="라인 번호 *"
                            placeholder="예: 1~3, 4, 5~11"
                            value={building.lines}
                            onChange={(e) => buildings.updateBuilding(building.id, 'lines', e.target.value)}
                            description={LINE_HELP}
                            error={errors.lines}
                            inputWrapperOrder={['label', 'input', 'description', 'error']}
                          />
                          <LinePreview groups={buildings.linePreview(building.lines)} />
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}

              {/* 동 목록 바로 아래에서 이어서 추가한다 */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Button onClick={buildings.addBuilding} fullWidth variant="light" leftSection={<Plus size={16} />}>
                  동 추가하기
                </Button>
                <Button onClick={bulk.toggle} fullWidth variant="default" leftSection={<Layers size={16} />}>
                  여러 동 한 번에 추가
                </Button>
              </SimpleGrid>

              <Collapse expanded={bulk.opened}>
                <Paper radius="md" p="md">
                  <Stack gap="sm">
                    <Text fw={600}>여러 동 한 번에 추가</Text>
                    <Text size="sm" c="dimmed">
                      번호가 이어지는 동을 같은 세대수·라인으로 한 번에 만듭니다. 추가한 뒤 동마다 고칠 수 있습니다.
                    </Text>
                    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                      <TextInput
                        label="시작 동 *"
                        placeholder="예: 101"
                        inputMode="numeric"
                        value={bulk.draft.from}
                        onChange={(e) => bulk.update('from', e.target.value)}
                      />
                      <TextInput
                        label="끝 동 *"
                        placeholder="예: 110"
                        inputMode="numeric"
                        value={bulk.draft.to}
                        onChange={(e) => bulk.update('to', e.target.value)}
                      />
                      <NumberInput
                        label="동마다 세대수 *"
                        placeholder="예: 120"
                        min={0}
                        allowDecimal={false}
                        allowNegative={false}
                        hideControls
                        value={bulk.draft.householdsCount || ''}
                        onChange={(v) => bulk.update('householdsCount', Number(v) || 0)}
                        error={bulk.errors.householdsCount}
                      />
                    </SimpleGrid>
                    {/* 시작·끝 동 오류는 두 칸에 걸친 문제라 한 줄로 따로 보여준다 */}
                    {bulk.errors.range && (
                      <Text size="sm" c="red">
                        {bulk.errors.range}
                      </Text>
                    )}
                    <TextInput
                      label="라인 번호 *"
                      placeholder="예: 1~3, 4, 5~11"
                      value={bulk.draft.lines}
                      onChange={(e) => bulk.update('lines', e.target.value)}
                      description={LINE_HELP}
                      error={bulk.errors.lines}
                      inputWrapperOrder={['label', 'input', 'description', 'error']}
                    />
                    <Group justify="flex-end">
                      <Button onClick={bulk.submit}>
                        {bulk.count > 0 ? `${bulk.count}개 동 추가` : '추가'}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              </Collapse>

              <Divider />

              {/* 등록 전 한눈에 확인 */}
              {summary.buildingCount > 0 && (
                <SimpleGrid cols={3} spacing="sm">
                  {[
                    { key: 'buildings', label: '동', value: `${summary.buildingCount.toLocaleString()}개` },
                    { key: 'households', label: '세대', value: `${summary.householdsCount.toLocaleString()}세대` },
                    { key: 'lines', label: '라인 묶음', value: `${summary.lineGroupCount.toLocaleString()}개` },
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
