'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Smartphone,
  UserCog,
  Trash,
  AlertCircle,
} from 'lucide-react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { formatLineRange } from '@/lib/utils/line';
import { useDevicesPage, formatMacAddress } from './useDevicesPage';

function formatLastOpenedAt(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
import type {
  Device,
  CommonDevice,
  UseTreeExpandReturn,
  UseQuickAddReturn,
  UseDeviceSelectionReturn,
  UseDeviceDialogReturn,
  UseCommonDevicesReturn,
  AdminScope,
  ApartmentDetails,
  ApartmentBuilding,
} from './types';

// ============================================================
// Page Component
// ============================================================

export default function DevicesManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = useDevicesPage(params);

  return (
    <PageShell>
      {/* Header */}
      <Header
        apartmentName={page.fetch.apartment?.name}
        brokenDeviceCount={page.brokenDeviceCount}
        onBack={() => router.push('/admin/apartments')}
      />

      {/* Bulk Actions Bar */}
      {(page.selection.selectedDevices.size > 0 || page.commonDevices.selectedDevices.size > 0) && (
        <BulkActionsBar
          count={page.selection.selectedDevices.size + page.commonDevices.selectedDevices.size}
          onClear={() => {
            page.selection.clearSelection();
            page.commonDevices.clearSelection();
          }}
          onDelete={page.handleBulkDelete}
        />
      )}

      {/* Search & Filters */}
      <SearchBar
        searchTerm={page.searchTerm}
        setSearchTerm={page.setSearchTerm}
        viewMode={page.viewMode}
        setViewMode={page.setViewMode}
        showBrokenOnly={page.showBrokenOnly}
        setShowBrokenOnly={page.setShowBrokenOnly}
        totalCount={page.totalDeviceCount}
        brokenCount={page.brokenDeviceCount}
      />

      {/* Content */}
      {page.fetch.loading ? (
        <Paper withBorder radius="md" p="xl">
          <Stack gap="sm" py={4} align="center">
            <Skeleton h={16} w="66%" />
            <Skeleton h={16} w="100%" />
            <Skeleton h={16} w="80%" />
          </Stack>
        </Paper>
      ) : page.viewMode === 'tree' ? (
        <Stack gap="md">
          <CommonDevicesSection
            commonDevices={page.filteredCommonDevices}
            hook={page.commonDevices}
          />
          <TreeView
            apartment={page.fetch.apartment}
            groupedDevices={page.groupedDevices}
            tree={page.tree}
            quickAdd={page.quickAdd}
            selection={page.selection}
            dialog={page.dialog}
            handleToggleDeviceWorking={page.handleToggleDeviceWorking}
            getBuildingAdmins={page.getBuildingAdmins}
            getLineAdmins={page.getLineAdmins}
          />
        </Stack>
      ) : (
        <TableView
          filteredDevices={page.filteredDevices}
          filteredCommonDevices={page.filteredCommonDevices}
          searchTerm={page.searchTerm}
          dialog={page.dialog}
          selection={page.selection}
          commonDevicesHook={page.commonDevices}
          handleToggleDeviceWorking={page.handleToggleDeviceWorking}
        />
      )}

      {/* Dialogs */}
      <DeviceDialog
        dialog={page.dialog}
        apartment={page.fetch.apartment}
      />
      <DeleteDialog
        open={page.selection.deleteDialog}
        onOpenChange={page.selection.setDeleteDialog}
        deviceToDelete={page.selection.deviceToDelete}
        devices={page.fetch.devices}
        onConfirm={page.selection.confirmDeleteDevice}
        deleting={page.selection.deleting}
      />
      <BulkDeleteDialog
        open={page.bulkDeleteDialog}
        onOpenChange={page.setBulkDeleteDialog}
        count={page.bulkDeleteCount}
        onConfirm={page.confirmBulkDelete}
        deleting={page.bulkDeleting}
      />

      {/* Common Device Dialogs */}
      <CommonDeviceEditDialog hook={page.commonDevices} />
      <CommonDeviceDeleteDialog hook={page.commonDevices} />
    </PageShell>
  );
}

// ============================================================
// Header
// ============================================================

function Header({
  apartmentName,
  brokenDeviceCount,
  onBack,
}: {
  apartmentName: string | undefined;
  brokenDeviceCount: number;
  onBack: () => void;
}): React.ReactElement {
  return (
    <>
      <HeaderTitle title="장치 관리" onBack={onBack} />
      <Group gap="sm">
        <Text size="sm" c="dimmed">
          {apartmentName || '아파트'}의 모든 장치를 관리합니다
        </Text>
        {brokenDeviceCount > 0 && (
          <Badge variant="light" color="red" leftSection={<AlertCircle size={12} />}>
            고장 {brokenDeviceCount}개
          </Badge>
        )}
      </Group>
    </>
  );
}

// ============================================================
// Bulk Actions Bar
// ============================================================

function BulkActionsBar({
  count,
  onClear,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      bg="var(--mantine-color-blue-light)"
      style={{ borderColor: 'var(--mantine-color-blue-outline)' }}
    >
      <Group justify="space-between">
        <Text size="sm" fw={500}>{count}개 선택됨</Text>
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onClear}>
            선택 해제
          </Button>
          <Button color="red" size="xs" leftSection={<Trash size={16} />} onClick={onDelete}>
            선택 삭제
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

// ============================================================
// Search Bar
// ============================================================

function SearchBar({
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  showBrokenOnly,
  setShowBrokenOnly,
  totalCount,
  brokenCount,
}: {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  viewMode: string;
  setViewMode: (m: 'tree' | 'table') => void;
  showBrokenOnly: boolean;
  setShowBrokenOnly: (v: boolean) => void;
  totalCount: number;
  brokenCount: number;
}): React.ReactElement {
  return (
    <Stack gap="md">
      <Group gap="md" wrap="nowrap">
        <TextInput
          placeholder="MAC 주소, 장소, 동, 라인으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftSection={<Search size={16} />}
          style={{ flex: 1 }}
        />
        <Button.Group>
          <Button
            variant={viewMode === 'tree' ? 'filled' : 'default'}
            onClick={() => setViewMode('tree')}
          >
            트리 뷰
          </Button>
          <Button
            variant={viewMode === 'table' ? 'filled' : 'default'}
            onClick={() => setViewMode('table')}
          >
            테이블 뷰
          </Button>
        </Button.Group>
      </Group>
      <Group justify="space-between">
        <Button
          variant={showBrokenOnly ? 'filled' : 'default'}
          color={showBrokenOnly ? 'red' : undefined}
          size="sm"
          leftSection={<AlertCircle size={16} />}
          rightSection={
            showBrokenOnly ? (
              <Badge variant="white" color="red" size="sm">
                {brokenCount}
              </Badge>
            ) : undefined
          }
          onClick={() => setShowBrokenOnly(!showBrokenOnly)}
        >
          고장난 기기만 보기
        </Button>
        <Text size="sm" c="dimmed">
          전체 {totalCount}개 기기
          {brokenCount > 0 && (
            <Text span c="red" ml="xs" inherit>
              · 고장 {brokenCount}개
            </Text>
          )}
        </Text>
      </Group>
    </Stack>
  );
}

// ============================================================
// Tree View
// ============================================================

function TreeView({
  apartment,
  groupedDevices,
  tree,
  quickAdd,
  selection,
  dialog,
  handleToggleDeviceWorking,
  getBuildingAdmins,
  getLineAdmins,
}: {
  apartment: ApartmentDetails | null;
  groupedDevices: Record<number, Record<string, Device[]>>;
  tree: UseTreeExpandReturn;
  quickAdd: UseQuickAddReturn;
  selection: UseDeviceSelectionReturn;
  dialog: UseDeviceDialogReturn;
  handleToggleDeviceWorking: (id: string, status: boolean) => Promise<void>;
  getBuildingAdmins: (id: string) => AdminScope[];
  getLineAdmins: (id: string) => AdminScope[];
}): React.ReactElement {
  return (
    <Paper withBorder radius="md" p="lg">
      {!apartment?.buildings || apartment.buildings.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl">등록된 동이 없습니다</Text>
      ) : (
        <Stack gap="md">
          {apartment.buildings.map((building) => {
            const buildingDevices = groupedDevices[building.buildingNumber] || {};
            const totalDevices = Object.values(buildingDevices).flat().length;
            const brokenDevices = Object.values(buildingDevices)
              .flat()
              .filter((d) => d.isWorking === false).length;

            return (
              <Paper key={building.id} withBorder radius="md">
                {/* Building Header */}
                <UnstyledButton
                  w="100%"
                  p="md"
                  onClick={() => tree.toggleBuilding(building.id)}
                >
                  <Group gap="xs">
                    {tree.expandedBuildings.includes(building.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    <Text fw={600}>{building.buildingNumber}동</Text>
                    {totalDevices === 0 ? (
                      <Badge variant="light" color="gray">
                        등록된 기기 없음
                      </Badge>
                    ) : (
                      <Badge variant="light" color="gray">{totalDevices} 기기</Badge>
                    )}
                    {brokenDevices > 0 && (
                      <Badge variant="light" color="red">
                        고장 {brokenDevices}
                      </Badge>
                    )}
                    <AdminBadge admins={getBuildingAdmins(building.id)} />
                  </Group>
                </UnstyledButton>

                {/* Lines */}
                {tree.expandedBuildings.includes(building.id) && (
                  <Box
                    px="md"
                    pb="md"
                    style={{ borderTop: '1px solid var(--app-divider)' }}
                  >
                    {building.lines && building.lines.length > 0 ? (
                      building.lines.map((line) => (
                        <LineSection
                          key={`${building.id}-${line.id}`}
                          building={building}
                          line={line}
                          lineDevices={buildingDevices[line.id] || []}
                          lineKey={`${building.id}-${line.id}`}
                          tree={tree}
                          quickAdd={quickAdd}
                          selection={selection}
                          dialog={dialog}
                          handleToggleDeviceWorking={handleToggleDeviceWorking}
                          lineAdmins={getLineAdmins(line.id)}
                        />
                      ))
                    ) : (
                      <Text size="sm" c="dimmed" py="md" ta="center">
                        등록된 라인이 없습니다
                      </Text>
                    )}
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

// ============================================================
// Line Section (inside Tree)
// ============================================================

function LineSection({
  building,
  line,
  lineDevices,
  lineKey,
  tree,
  quickAdd,
  selection,
  dialog,
  handleToggleDeviceWorking,
  lineAdmins,
}: {
  building: ApartmentBuilding;
  line: { id: string; line: number[] };
  lineDevices: Device[];
  lineKey: string;
  tree: UseTreeExpandReturn;
  quickAdd: UseQuickAddReturn;
  selection: UseDeviceSelectionReturn;
  dialog: UseDeviceDialogReturn;
  handleToggleDeviceWorking: (id: string, status: boolean) => Promise<void>;
  lineAdmins: AdminScope[];
}): React.ReactElement {
  const lineRange = formatLineRange(line.line);
  const lineBrokenDevices = lineDevices.filter((d) => d.isWorking === false).length;

  return (
    <Box mt="md">
      {/* Line Header */}
      <Group justify="space-between" wrap="nowrap" py={4}>
        <UnstyledButton
          style={{ flex: 1 }}
          py={4}
          px={4}
          onClick={() => tree.toggleLine(lineKey)}
        >
          <Group gap="xs">
            {tree.expandedLines.includes(lineKey) ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            <Text fw={500}>{lineRange}라인</Text>
            {lineDevices.length === 0 ? (
              <Badge variant="light" color="gray" size="sm">
                등록된 기기 없음
              </Badge>
            ) : (
              <Badge variant="light" color="gray" size="sm">
                {lineDevices.length} 기기
              </Badge>
            )}
            {lineBrokenDevices > 0 && (
              <Badge variant="light" color="red" size="sm">
                고장 {lineBrokenDevices}
              </Badge>
            )}
            <AdminBadge admins={lineAdmins} />
          </Group>
        </UnstyledButton>
        <Button
          variant={quickAdd.quickAddLineKey === lineKey ? 'default' : 'filled'}
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            quickAdd.handleToggleQuickAdd(lineKey);
          }}
        >
          {quickAdd.quickAddLineKey === lineKey ? '닫기' : '기기 추가'}
        </Button>
      </Group>

      {/* Quick Add Form */}
      {quickAdd.quickAddLineKey === lineKey && (
        <QuickAddForm
          buildingNumber={building.buildingNumber}
          buildingId={building.id}
          lineId={line.id}
          lineRange={lineRange}
          quickAdd={quickAdd}
        />
      )}

      {/* Device List */}
      {tree.expandedLines.includes(lineKey) && (
        <Stack gap="xs" ml="lg" mt="xs">
          {lineDevices.length === 0 ? (
            <Text size="sm" c="dimmed" py="sm" pl="md">등록된 기기가 없습니다</Text>
          ) : (
            <>
              <Group gap="xs" px="xs" py={4}>
                <Checkbox
                  size="xs"
                  checked={lineDevices.every((d) => selection.selectedDevices.has(d.id))}
                  onChange={() => selection.handleSelectAllInLine(lineDevices)}
                />
                <Text size="xs" c="dimmed">
                  전체 선택 (
                  {lineDevices.filter((d) => selection.selectedDevices.has(d.id)).length}/
                  {lineDevices.length})
                </Text>
              </Group>
              {lineDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  selected={selection.selectedDevices.has(device.id)}
                  onToggleSelect={() => selection.handleToggleSelectDevice(device.id)}
                  onEdit={() => dialog.handleEditDevice(device)}
                  onDelete={() => selection.handleDeleteDevice(device.id)}
                  onRestore={() => handleToggleDeviceWorking(device.id, device.isWorking)}
                />
              ))}
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

// ============================================================
// Quick Add Form
// ============================================================

function QuickAddForm({
  buildingNumber,
  buildingId,
  lineId,
  lineRange,
  quickAdd,
}: {
  buildingNumber: number;
  buildingId: string;
  lineId: string;
  lineRange: string;
  quickAdd: UseQuickAddReturn;
}): React.ReactElement {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      ml="lg"
      mt="sm"
      bg="var(--mantine-color-blue-light)"
      style={{ borderColor: 'var(--mantine-color-blue-outline)' }}
    >
      <Group gap="xs" mb="sm">
        <Text fw={500} c="blue">기기 추가</Text>
        <Text size="sm" c="blue">
          {buildingNumber}동 · {lineRange}라인
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="sm">
        <TextInput
          label="설치 장소"
          size="xs"
          placeholder="예: B1 전기실"
          value={quickAdd.quickAddForm.placeName}
          onChange={(e) =>
            quickAdd.setQuickAddForm({ ...quickAdd.quickAddForm, placeName: e.target.value })
          }
          onKeyDown={(e) => quickAdd.handleQuickAddKeyPress(e, buildingId, lineId)}
          autoFocus
        />
        <TextInput
          label="MAC Address"
          size="xs"
          placeholder="AABBCCDDEEFF"
          value={quickAdd.quickAddForm.macAddress}
          onChange={(e) =>
            quickAdd.setQuickAddForm({
              ...quickAdd.quickAddForm,
              macAddress: formatMacAddress(e.target.value),
            })
          }
          onKeyDown={(e) => quickAdd.handleQuickAddKeyPress(e, buildingId, lineId)}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
        <TextInput
          label="비밀번호"
          size="xs"
          placeholder="00000000"
          value={quickAdd.quickAddForm.devicePassword}
          onChange={(e) =>
            quickAdd.setQuickAddForm({
              ...quickAdd.quickAddForm,
              devicePassword: e.target.value,
            })
          }
          onKeyDown={(e) => quickAdd.handleQuickAddKeyPress(e, buildingId, lineId)}
        />
      </SimpleGrid>
      <Group gap="xs">
        <Button
          size="xs"
          onClick={() => quickAdd.handleQuickSave(buildingId, lineId)}
          disabled={!quickAdd.quickAddForm.placeName || !quickAdd.quickAddForm.macAddress}
        >
          추가
        </Button>
        <Button
          size="xs"
          variant="default"
          onClick={() => quickAdd.handleToggleQuickAdd('')}
        >
          닫기
        </Button>
      </Group>
    </Paper>
  );
}

// ============================================================
// Device Card
// ============================================================

function DeviceCard({
  device,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onRestore,
}: {
  device: Device;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}): React.ReactElement {
  return (
    <Paper
      radius="md"
      p="sm"
      withBorder={device.isWorking === false}
      bg={device.isWorking === false ? 'var(--mantine-color-red-light)' : 'var(--mantine-color-default-hover)'}
      style={
        device.isWorking === false
          ? { borderColor: 'var(--mantine-color-red-outline)' }
          : undefined
      }
    >
      <Group gap="sm" wrap="nowrap">
        <Checkbox checked={selected} onChange={() => onToggleSelect()} />
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={500}>{device.apartment_line_places?.placeName}</Text>
            {device.isWorking === false && (
              <Badge variant="light" color="red" size="sm">
                고장
              </Badge>
            )}
          </Group>
          <Stack gap={4}>
            <Group gap="xs">
              <Smartphone size={12} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">MAC: {device.macAddress}</Text>
            </Group>
            <Text size="sm" c="dimmed">Password: {device.devicePassword}</Text>
            <Text size="sm" c="dimmed">마지막 문연 시간: {formatLastOpenedAt(device.lastOpenedAt)}</Text>
          </Stack>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          {device.isWorking === false && (
            <Button variant="light" color="green" size="xs" onClick={onRestore}>
              복구
            </Button>
          )}
          <ActionIcon variant="subtle" color="gray" aria-label="수정" onClick={onEdit}>
            <Edit2 size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" aria-label="삭제" onClick={onDelete}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

// ============================================================
// Admin Badge (shared)
// ============================================================

function AdminBadge({ admins }: { admins: AdminScope[] }): React.ReactElement | null {
  if (admins.length === 0) return null;
  return (
    <Group gap={4} ml="xs" wrap="nowrap">
      <UserCog size={12} color="var(--mantine-color-dimmed)" />
      <Text size="xs" c="dimmed">
        관리자:{' '}
        {admins
          .map(
            (s) =>
              `${s.user?.name}${s.user?.phoneNumber ? ` ${s.user.phoneNumber}` : ''}`,
          )
          .join(', ')}
      </Text>
    </Group>
  );
}

// ============================================================
// Table View
// ============================================================

function TableView({
  filteredDevices,
  filteredCommonDevices,
  searchTerm,
  dialog,
  selection,
  commonDevicesHook,
  handleToggleDeviceWorking,
}: {
  filteredDevices: Device[];
  filteredCommonDevices: CommonDevice[];
  searchTerm: string;
  dialog: UseDeviceDialogReturn;
  selection: UseDeviceSelectionReturn;
  commonDevicesHook: UseCommonDevicesReturn;
  handleToggleDeviceWorking: (id: string, status: boolean) => Promise<void>;
}): React.ReactElement {
  const isEmpty = filteredDevices.length === 0 && filteredCommonDevices.length === 0;

  return (
    <Paper withBorder radius="md">
      <Table.ScrollContainer minWidth={900}>
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>동</Table.Th>
              <Table.Th>라인</Table.Th>
              <Table.Th>설치 장소</Table.Th>
              <Table.Th>MAC Address</Table.Th>
              <Table.Th>비밀번호</Table.Th>
              <Table.Th>마지막 문연 시간</Table.Th>
              <Table.Th>등록일</Table.Th>
              <Table.Th ta="right">관리</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isEmpty ? (
              <Table.Tr>
                <Table.Td colSpan={8} ta="center" py="xl">
                  {searchTerm ? '검색 결과가 없습니다' : '등록된 기기가 없습니다'}
                </Table.Td>
              </Table.Tr>
            ) : (
              <>
                {filteredCommonDevices.map((device) => (
                  <Table.Tr
                    key={device.id}
                    bg={device.isWorking === false ? 'var(--mantine-color-red-light)' : undefined}
                  >
                    <Table.Td>
                      <Badge variant="light" color="gray">공동출입문</Badge>
                    </Table.Td>
                    <Table.Td>-</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {device.placeName || '-'}
                        {device.isWorking === false && (
                          <Badge variant="light" color="red" size="sm">
                            고장
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td ff="monospace" fz="sm">{device.macAddress}</Table.Td>
                    <Table.Td>{device.devicePassword}</Table.Td>
                    <Table.Td fz="sm" c="dimmed">
                      {formatLastOpenedAt(device.lastOpenedAt)}
                    </Table.Td>
                    <Table.Td>
                      {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        {device.isWorking === false && (
                          <Button
                            variant="light"
                            color="green"
                            size="xs"
                            onClick={() =>
                              commonDevicesHook.handleToggleWorking(device.id, device.isWorking)
                            }
                          >
                            복구
                          </Button>
                        )}
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <Button variant="subtle" color="gray" size="xs">
                              •••
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<Edit2 size={16} />}
                              onClick={() => commonDevicesHook.handleEditDevice(device)}
                            >
                              수정
                            </Menu.Item>
                            <Menu.Item
                              color="red"
                              leftSection={<Trash2 size={16} />}
                              onClick={() => commonDevicesHook.handleDeleteDevice(device.id)}
                            >
                              삭제
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filteredDevices.map((device) => {
                  const line = device.apartment_line_places?.apartment_lines?.line;
                  const lineRange = line ? formatLineRange(line) : '';
                  const building =
                    device.apartment_line_places?.apartment_lines?.apartment_buildings
                      ?.buildingNumber;

                  return (
                    <Table.Tr
                      key={device.id}
                      bg={device.isWorking === false ? 'var(--mantine-color-red-light)' : undefined}
                    >
                      <Table.Td>{building}동</Table.Td>
                      <Table.Td>{lineRange}라인</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {device.apartment_line_places?.placeName}
                          {device.isWorking === false && (
                            <Badge variant="light" color="red" size="sm">
                              고장
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td ff="monospace" fz="sm">{device.macAddress}</Table.Td>
                      <Table.Td>{device.devicePassword}</Table.Td>
                      <Table.Td fz="sm" c="dimmed">
                        {formatLastOpenedAt(device.lastOpenedAt)}
                      </Table.Td>
                      <Table.Td>
                        {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          {device.isWorking === false && (
                            <Button
                              variant="light"
                              color="green"
                              size="xs"
                              onClick={() =>
                                handleToggleDeviceWorking(device.id, device.isWorking)
                              }
                            >
                              복구
                            </Button>
                          )}
                          <Menu position="bottom-end">
                            <Menu.Target>
                              <Button variant="subtle" color="gray" size="xs">
                                •••
                              </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<Edit2 size={16} />}
                                onClick={() => dialog.handleEditDevice(device)}
                              >
                                수정
                              </Menu.Item>
                              <Menu.Item
                                color="red"
                                leftSection={<Trash2 size={16} />}
                                onClick={() => selection.handleDeleteDevice(device.id)}
                              >
                                삭제
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

// ============================================================
// Dialogs
// ============================================================

function DeviceDialog({
  dialog,
  apartment,
}: {
  dialog: UseDeviceDialogReturn;
  apartment: ApartmentDetails | null;
}): React.ReactElement {
  const { deviceDialog, setDeviceDialog, editingDevice, deviceForm, setDeviceForm } = dialog;

  return (
    <Modal
      opened={deviceDialog}
      onClose={() => setDeviceDialog(false)}
      title={editingDevice ? '기기 수정' : '기기 추가'}
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">기기 정보를 입력해주세요</Text>

        {!editingDevice && deviceForm.buildingId && deviceForm.lineId && (
          <Paper bg="var(--mantine-color-default-hover)" radius="md" p="md">
            <Text size="sm">
              <strong>
                {apartment?.buildings?.find((b) => b.id === deviceForm.buildingId)?.buildingNumber}
                동 · {formatLineRange(dialog.getSelectedLine()?.line || [])}라인
              </strong>
              에 기기를 추가합니다
            </Text>
          </Paper>
        )}

        {(!deviceForm.buildingId || !deviceForm.lineId) && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="동"
              placeholder="동을 선택하세요"
              data={
                apartment?.buildings?.map((b) => ({
                  value: b.id,
                  label: `${b.buildingNumber}동`,
                })) ?? []
              }
              value={deviceForm.buildingId || null}
              onChange={(v) => {
                if (v === null) return;
                setDeviceForm({ ...deviceForm, buildingId: v, lineId: '', linePlaceId: '' });
              }}
              allowDeselect={false}
            />
            <Select
              label="라인"
              placeholder="라인을 선택하세요"
              data={
                dialog.getSelectedBuilding()?.lines?.map((l) => ({
                  value: l.id,
                  label: `${formatLineRange(l.line)}라인`,
                })) ?? []
              }
              value={deviceForm.lineId || null}
              onChange={(v) => {
                if (v === null) return;
                setDeviceForm({ ...deviceForm, lineId: v, linePlaceId: '' });
              }}
              disabled={!deviceForm.buildingId}
              allowDeselect={false}
            />
          </SimpleGrid>
        )}

        <TextInput
          label="설치 장소"
          description="기기가 설치된 장소를 입력하세요"
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          placeholder="예: B1 전기실, 1F 엘리베이터홀, 각 층 현관문"
          value={deviceForm.placeName}
          onChange={(e) => setDeviceForm({ ...deviceForm, placeName: e.target.value })}
        />

        <TextInput
          label="MAC Address"
          description="기기의 MAC 주소를 입력하세요"
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          placeholder="예: AA:BB:CC:DD:EE:FF"
          value={deviceForm.macAddress}
          onChange={(e) =>
            setDeviceForm({ ...deviceForm, macAddress: e.target.value.toUpperCase() })
          }
        />

        <TextInput
          label="비밀번호"
          description="기본값: 00000000 (0이 8개)"
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          type="text"
          placeholder="00000000"
          value={deviceForm.devicePassword}
          onChange={(e) =>
            setDeviceForm({ ...deviceForm, devicePassword: e.target.value })
          }
        />
      </Stack>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => setDeviceDialog(false)}>
          취소
        </Button>
        <Button
          onClick={dialog.handleSaveDevice}
          disabled={
            !deviceForm.lineId ||
            !deviceForm.placeName ||
            !deviceForm.macAddress ||
            !deviceForm.devicePassword
          }
        >
          저장
        </Button>
      </Group>
    </Modal>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  deviceToDelete,
  devices,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceToDelete: string | null;
  devices: Device[];
  onConfirm: () => Promise<void>;
  deleting: boolean;
}): React.ReactElement {
  const device = deviceToDelete ? devices.find((d) => d.id === deviceToDelete) : null;
  return (
    <Modal opened={open} onClose={() => onOpenChange(false)} title="기기 삭제" closeOnClickOutside={!deleting} closeOnEscape={!deleting}>
      <Text size="sm" c="dimmed">정말로 이 기기를 삭제하시겠습니까?</Text>
      {device && (
        <Stack gap="md" mt="md">
          <Paper bg="var(--mantine-color-default-hover)" radius="md" p="md">
            <Stack gap="xs">
              <Text size="sm">
                <strong>장소:</strong> {device.apartment_line_places?.placeName}
              </Text>
              <Text size="sm">
                <strong>MAC:</strong> {device.macAddress}
              </Text>
              <Text size="sm">
                <strong>동:</strong>{' '}
                {device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber}동
              </Text>
            </Stack>
          </Paper>
          <Text size="sm" c="red">삭제된 기기는 복구할 수 없습니다.</Text>
        </Stack>
      )}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => onOpenChange(false)} disabled={deleting}>
          취소
        </Button>
        <Button color="red" onClick={onConfirm} disabled={deleting}>
          {deleting ? '삭제 중...' : '삭제'}
        </Button>
      </Group>
    </Modal>
  );
}

function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}): React.ReactElement {
  return (
    <Modal opened={open} onClose={() => onOpenChange(false)} title="일괄 삭제" closeOnClickOutside={!deleting} closeOnEscape={!deleting}>
      <Text size="sm" c="dimmed">선택한 {count}개의 기기를 삭제하시겠습니까?</Text>
      <Paper
        withBorder
        radius="md"
        p="md"
        mt="md"
        bg="var(--mantine-color-red-light)"
        style={{ borderColor: 'var(--mantine-color-red-outline)' }}
      >
        <Text size="sm" c="red">삭제된 기기는 복구할 수 없습니다.</Text>
      </Paper>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => onOpenChange(false)} disabled={deleting}>
          취소
        </Button>
        <Button color="red" onClick={onConfirm} disabled={deleting}>
          {deleting ? '삭제 중...' : `${count}개 삭제`}
        </Button>
      </Group>
    </Modal>
  );
}

// ============================================================
// Common Devices Section (공동출입문)
// ============================================================

function CommonDevicesSection({
  commonDevices,
  hook,
}: {
  commonDevices: CommonDevice[];
  hook: UseCommonDevicesReturn;
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState<boolean>(true);
  const brokenCount = commonDevices.filter((d) => d.isWorking === false).length;

  return (
    <Paper withBorder radius="md" p="lg">
      <Paper withBorder radius="md">
        {/* Header */}
        <Group
          justify="space-between"
          wrap="nowrap"
          p="md"
          style={{ cursor: 'pointer' }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Group gap="xs">
            {expanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            <Text fw={600}>공동출입문</Text>
            {commonDevices.length === 0 ? (
              <Badge variant="light" color="gray">
                등록된 기기 없음
              </Badge>
            ) : (
              <Badge variant="light" color="gray">{commonDevices.length} 기기</Badge>
            )}
            {brokenCount > 0 && (
              <Badge variant="light" color="red">
                고장 {brokenCount}
              </Badge>
            )}
          </Group>
          <Button
            variant={hook.showQuickAdd ? 'default' : 'filled'}
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              hook.toggleQuickAdd();
            }}
          >
            {hook.showQuickAdd ? '닫기' : '기기 추가'}
          </Button>
        </Group>

        {/* Quick Add Form */}
        {hook.showQuickAdd && (
          <Box px="md" pb="md">
            <CommonDeviceQuickAddForm hook={hook} />
          </Box>
        )}

        {/* Device List */}
        {expanded && (
          <Box
            px="md"
            pb="md"
            style={{ borderTop: '1px solid var(--app-divider)' }}
          >
            <Stack gap="xs" mt="md">
              {commonDevices.length === 0 ? (
                <Text size="sm" c="dimmed" py="sm" ta="center">
                  등록된 공동출입문 기기가 없습니다
                </Text>
              ) : (
                <>
                  <Group gap="xs" px="xs" py={4}>
                    <Checkbox
                      size="xs"
                      checked={commonDevices.every((d) => hook.selectedDevices.has(d.id))}
                      onChange={() => hook.handleSelectAll()}
                    />
                    <Text size="xs" c="dimmed">
                      전체 선택 (
                      {commonDevices.filter((d) => hook.selectedDevices.has(d.id)).length}/
                      {commonDevices.length})
                    </Text>
                  </Group>
                  {commonDevices.map((device) => (
                    <CommonDeviceCard
                      key={device.id}
                      device={device}
                      selected={hook.selectedDevices.has(device.id)}
                      onToggleSelect={() => hook.handleToggleSelect(device.id)}
                      onEdit={() => hook.handleEditDevice(device)}
                      onDelete={() => hook.handleDeleteDevice(device.id)}
                    />
                  ))}
                </>
              )}
            </Stack>
          </Box>
        )}
      </Paper>
    </Paper>
  );
}

// ============================================================
// Common Device Quick Add Form
// ============================================================

function CommonDeviceQuickAddForm({
  hook,
}: {
  hook: UseCommonDevicesReturn;
}): React.ReactElement {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      mt="sm"
      bg="var(--mantine-color-blue-light)"
      style={{ borderColor: 'var(--mantine-color-blue-outline)' }}
    >
      <Group gap="xs" mb="sm">
        <Text fw={500} c="blue">공동출입문 기기 추가</Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="sm">
        <TextInput
          data-common-quick-add-place
          label="설치 장소"
          size="xs"
          placeholder="예: 정문, 후문"
          value={hook.quickAddForm.placeName}
          onChange={(e) =>
            hook.setQuickAddForm({
              ...hook.quickAddForm,
              placeName: e.target.value,
            })
          }
          onKeyDown={hook.handleQuickAddKeyPress}
          autoFocus
        />
        <TextInput
          label="MAC Address"
          size="xs"
          placeholder="AABBCCDDEEFF"
          value={hook.quickAddForm.macAddress}
          onChange={(e) =>
            hook.setQuickAddForm({
              ...hook.quickAddForm,
              macAddress: formatMacAddress(e.target.value),
            })
          }
          onKeyDown={hook.handleQuickAddKeyPress}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
        <TextInput
          label="비밀번호"
          size="xs"
          placeholder="00000000"
          value={hook.quickAddForm.devicePassword}
          onChange={(e) =>
            hook.setQuickAddForm({
              ...hook.quickAddForm,
              devicePassword: e.target.value,
            })
          }
          onKeyDown={hook.handleQuickAddKeyPress}
        />
      </SimpleGrid>
      <Group gap="xs">
        <Button
          size="xs"
          onClick={() => hook.handleQuickSave()}
          disabled={!hook.quickAddForm.macAddress}
        >
          추가
        </Button>
        <Button
          size="xs"
          variant="default"
          onClick={() => hook.toggleQuickAdd()}
        >
          닫기
        </Button>
      </Group>
    </Paper>
  );
}

// ============================================================
// Common Device Card
// ============================================================

function CommonDeviceCard({
  device,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  device: CommonDevice;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Paper
      radius="md"
      p="sm"
      withBorder={device.isWorking === false}
      bg={device.isWorking === false ? 'var(--mantine-color-red-light)' : 'var(--mantine-color-default-hover)'}
      style={
        device.isWorking === false
          ? { borderColor: 'var(--mantine-color-red-outline)' }
          : undefined
      }
    >
      <Group gap="sm" wrap="nowrap">
        <Checkbox checked={selected} onChange={() => onToggleSelect()} />
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={500}>{device.placeName || '(장소 미지정)'}</Text>
            {device.isWorking === false && (
              <Badge variant="light" color="red" size="sm">
                고장
              </Badge>
            )}
          </Group>
          <Stack gap={4}>
            <Group gap="xs">
              <Smartphone size={12} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">MAC: {device.macAddress}</Text>
            </Group>
            <Text size="sm" c="dimmed">Password: {device.devicePassword}</Text>
            <Text size="sm" c="dimmed">마지막 문연 시간: {formatLastOpenedAt(device.lastOpenedAt)}</Text>
          </Stack>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" aria-label="수정" onClick={onEdit}>
            <Edit2 size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" aria-label="삭제" onClick={onDelete}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

// ============================================================
// Common Device Edit Dialog
// ============================================================

function CommonDeviceEditDialog({
  hook,
}: {
  hook: UseCommonDevicesReturn;
}): React.ReactElement {
  return (
    <Modal
      opened={hook.editDialog}
      onClose={() => hook.setEditDialog(false)}
      title="공동출입문 기기 수정"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">기기 정보를 수정해주세요</Text>
        <TextInput
          label="설치 장소"
          placeholder="예: 정문, 후문, 지하주차장"
          value={hook.editForm.placeName}
          onChange={(e) =>
            hook.setEditForm({
              ...hook.editForm,
              placeName: e.target.value,
            })
          }
        />
        <TextInput
          label="MAC Address"
          placeholder="예: AA:BB:CC:DD:EE:FF"
          value={hook.editForm.macAddress}
          onChange={(e) =>
            hook.setEditForm({
              ...hook.editForm,
              macAddress: formatMacAddress(e.target.value),
            })
          }
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
        <TextInput
          label="비밀번호"
          type="text"
          placeholder="00000000"
          value={hook.editForm.devicePassword}
          onChange={(e) =>
            hook.setEditForm({
              ...hook.editForm,
              devicePassword: e.target.value,
            })
          }
        />
      </Stack>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => hook.setEditDialog(false)}>
          취소
        </Button>
        <Button
          onClick={hook.handleSaveEdit}
          disabled={!hook.editForm.macAddress || !hook.editForm.devicePassword}
        >
          저장
        </Button>
      </Group>
    </Modal>
  );
}

// ============================================================
// Common Device Delete Dialog
// ============================================================

function CommonDeviceDeleteDialog({
  hook,
}: {
  hook: UseCommonDevicesReturn;
}): React.ReactElement {
  const device = hook.deviceToDelete
    ? hook.commonDevices.find((d) => d.id === hook.deviceToDelete)
    : null;

  return (
    <Modal
      opened={hook.deleteDialog}
      onClose={() => hook.setDeleteDialog(false)}
      title="공동출입문 기기 삭제"
      closeOnClickOutside={!hook.deleting}
      closeOnEscape={!hook.deleting}
    >
      <Text size="sm" c="dimmed">정말로 이 기기를 삭제하시겠습니까?</Text>
      {device && (
        <Stack gap="md" mt="md">
          <Paper bg="var(--mantine-color-default-hover)" radius="md" p="md">
            <Stack gap="xs">
              {device.placeName && (
                <Text size="sm">
                  <strong>장소:</strong> {device.placeName}
                </Text>
              )}
              <Text size="sm">
                <strong>MAC:</strong> {device.macAddress}
              </Text>
              <Text size="sm">
                <strong>비밀번호:</strong> {device.devicePassword}
              </Text>
            </Stack>
          </Paper>
          <Text size="sm" c="red">삭제된 기기는 복구할 수 없습니다.</Text>
        </Stack>
      )}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => hook.setDeleteDialog(false)} disabled={hook.deleting}>
          취소
        </Button>
        <Button color="red" onClick={hook.confirmDeleteDevice} disabled={hook.deleting}>
          {hook.deleting ? '삭제 중...' : '삭제'}
        </Button>
      </Group>
    </Modal>
  );
}
