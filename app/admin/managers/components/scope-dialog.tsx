'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { formatLineRange } from '@/lib/utils/line';
import type { Apartment, UseScopeDialogReturn } from '../types';

interface ScopeDialogProps {
  dialog: UseScopeDialogReturn;
  apartments: Apartment[];
}

/** 관리 범위 설정 (레벨 + 아파트/동/라인 선택) */
export const ScopeDialog = memo(function ScopeDialog({ dialog, apartments }: ScopeDialogProps): ReactElement {
  const {
    manager: selectedManager,
    scopeLevel,
    selectedApartment,
    selectedBuilding,
    selectedLine,
    buildings,
    lines,
    saving,
    setScopeLevel,
    setSelectedApartment,
    setSelectedBuilding,
    setSelectedLine,
  } = dialog;

  return (
    <Modal
      opened={dialog.opened}
      onClose={dialog.close}
      title='관리 범위 설정'
      size={500}
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
    >
      <Text size='sm' c='dimmed'>
        {selectedManager?.name || selectedManager?.email}님의 관리 권한 범위를 설정합니다.
      </Text>

      <Stack gap='md' mt='md'>
        {/* 관리 레벨 선택 */}
        <Select
          label='관리 레벨'
          data={[
            { value: 'APARTMENT', label: '아파트 전체' },
            { value: 'BUILDING', label: '특정 동' },
            { value: 'LINE', label: '특정 라인' },
          ]}
          value={scopeLevel}
          onChange={(value) => {
            if (value === null) return;
            setScopeLevel(value as any);
          }}
          allowDeselect={false}
        />

        {/* 아파트 선택 */}
        <Select
          label='아파트'
          placeholder='아파트를 선택하세요'
          data={apartments.map((apt) => ({ value: apt.id, label: apt.name }))}
          value={selectedApartment || null}
          onChange={(v) => {
            if (v === null) return;
            setSelectedApartment(v);
          }}
          allowDeselect={false}
        />

        {/* 동 선택 (BUILDING 또는 LINE 레벨일 때) */}
        {(scopeLevel === 'BUILDING' || scopeLevel === 'LINE') && (
          <Select
            label='동'
            placeholder='동을 선택하세요'
            data={buildings.map((building) => ({ value: building.id, label: `${building.buildingNumber}동` }))}
            value={selectedBuilding || null}
            onChange={(v) => {
              if (v === null) return;
              setSelectedBuilding(v);
            }}
            allowDeselect={false}
            disabled={!selectedApartment}
          />
        )}

        {/* 라인 선택 (LINE 레벨일 때) */}
        {scopeLevel === 'LINE' && (
          <Select
            label='라인'
            placeholder='라인을 선택하세요'
            data={lines.map((line) => ({ value: line.id, label: `${formatLineRange(line.line)}라인` }))}
            value={selectedLine || null}
            onChange={(v) => {
              if (v === null) return;
              setSelectedLine(v);
            }}
            allowDeselect={false}
            disabled={!selectedBuilding}
          />
        )}
      </Stack>

      <Group justify='flex-end' mt='lg'>
        <Button variant='default' onClick={dialog.close} disabled={saving}>
          취소
        </Button>
        <Button
          onClick={dialog.save}
          loading={saving}
          disabled={
            !selectedApartment ||
            (scopeLevel === 'BUILDING' && !selectedBuilding) ||
            (scopeLevel === 'LINE' && (!selectedBuilding || !selectedLine))
          }
        >
          저장
        </Button>
      </Group>
    </Modal>
  );
});
