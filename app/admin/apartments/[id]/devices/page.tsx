'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLineRange } from '@/lib/utils/line';
import { useDevicesPage, formatMacAddress } from './useDevicesPage';
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
    <div className='p-8'>
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
          onDelete={() => {
            if (page.selection.selectedDevices.size > 0) page.selection.handleBulkDelete();
            if (page.commonDevices.selectedDevices.size > 0) page.commonDevices.handleBulkDelete();
          }}
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
        <Card>
          <CardContent className='p-12 text-center text-muted-foreground'>
            로딩 중...
          </CardContent>
        </Card>
      ) : page.viewMode === 'tree' ? (
        <div className='space-y-4'>
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
        </div>
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
      />
      <BulkDeleteDialog
        open={page.selection.bulkDeleteDialog}
        onOpenChange={page.selection.setBulkDeleteDialog}
        count={page.selection.selectedDevices.size}
        onConfirm={page.selection.confirmBulkDelete}
      />

      {/* Common Device Dialogs */}
      <CommonDeviceEditDialog hook={page.commonDevices} />
      <CommonDeviceDeleteDialog hook={page.commonDevices} />
      <BulkDeleteDialog
        open={page.commonDevices.bulkDeleteDialog}
        onOpenChange={page.commonDevices.setBulkDeleteDialog}
        count={page.commonDevices.selectedDevices.size}
        onConfirm={page.commonDevices.confirmBulkDelete}
      />
    </div>
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
    <div className='mb-8'>
      <Button variant='ghost' size='sm' onClick={onBack} className='mb-4'>
        <ArrowLeft className='h-4 w-4 mr-2' />
        뒤로
      </Button>
      <div className='flex items-center gap-3'>
        <h1 className='text-3xl font-bold tracking-tight'>장치 관리</h1>
        {brokenDeviceCount > 0 && (
          <Badge variant='destructive' className='text-sm px-3 py-1'>
            <AlertCircle className='h-3 w-3 mr-1' />
            고장 {brokenDeviceCount}개
          </Badge>
        )}
      </div>
      <p className='text-muted-foreground mt-1'>
        {apartmentName || '아파트'}의 모든 장치를 관리합니다
      </p>
    </div>
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
    <Card className='mb-6 border-blue-200 bg-blue-50'>
      <CardContent>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium'>{count}개 선택됨</span>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={onClear}>
              선택 해제
            </Button>
            <Button variant='destructive' size='sm' onClick={onDelete}>
              <Trash className='h-4 w-4 mr-2' />
              선택 삭제
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className='flex flex-col gap-4 mb-6'>
      <div className='flex gap-4'>
        <div className='flex-1 relative'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='MAC 주소, 장소, 동, 라인으로 검색...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='pl-10'
          />
        </div>
        <div className='flex gap-2'>
          <Button
            variant={viewMode === 'tree' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('tree')}
          >
            트리 뷰
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('table')}
          >
            테이블 뷰
          </Button>
        </div>
      </div>
      <div className='flex items-center justify-between'>
        <Button
          variant={showBrokenOnly ? 'destructive' : 'outline'}
          size='sm'
          onClick={() => setShowBrokenOnly(!showBrokenOnly)}
        >
          <AlertCircle className='h-4 w-4 mr-2' />
          고장난 기기만 보기
          {showBrokenOnly && (
            <Badge variant='secondary' className='ml-2'>
              {brokenCount}
            </Badge>
          )}
        </Button>
        <div className='text-sm text-muted-foreground'>
          전체 {totalCount}개 기기
          {brokenCount > 0 && (
            <span className='text-destructive ml-2'>· 고장 {brokenCount}개</span>
          )}
        </div>
      </div>
    </div>
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
    <Card>
      <CardContent className='p-6'>
        {!apartment?.buildings || apartment.buildings.length === 0 ? (
          <p className='text-center text-muted-foreground py-8'>등록된 동이 없습니다</p>
        ) : (
          <div className='space-y-4'>
            {apartment.buildings.map((building) => {
              const buildingDevices = groupedDevices[building.buildingNumber] || {};
              const totalDevices = Object.values(buildingDevices).flat().length;
              const brokenDevices = Object.values(buildingDevices)
                .flat()
                .filter((d) => d.isWorking === false).length;

              return (
                <div key={building.id} className='border rounded-lg'>
                  {/* Building Header */}
                  <div
                    className='flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50'
                    onClick={() => tree.toggleBuilding(building.id)}
                  >
                    <div className='flex items-center gap-2'>
                      {tree.expandedBuildings.includes(building.id) ? (
                        <ChevronDown className='h-4 w-4' />
                      ) : (
                        <ChevronRight className='h-4 w-4' />
                      )}
                      <span className='font-semibold'>{building.buildingNumber}동</span>
                      {totalDevices === 0 ? (
                        <Badge variant='secondary' className='text-muted-foreground'>
                          등록된 기기 없음
                        </Badge>
                      ) : (
                        <Badge variant='outline'>{totalDevices} 기기</Badge>
                      )}
                      {brokenDevices > 0 && (
                        <Badge variant='destructive' className='text-xs'>
                          고장 {brokenDevices}
                        </Badge>
                      )}
                      <AdminBadge admins={getBuildingAdmins(building.id)} />
                    </div>
                  </div>

                  {/* Lines */}
                  {tree.expandedBuildings.includes(building.id) && (
                    <div className='border-t px-4 pb-4'>
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
                        <p className='text-sm text-muted-foreground py-4 text-center'>
                          등록된 라인이 없습니다
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className='mt-4'>
      {/* Line Header */}
      <div className='flex items-center justify-between py-2 rounded px-2'>
        <div
          className='flex items-center gap-2 flex-1 cursor-pointer hover:bg-muted/30 rounded-l py-1 px-1'
          onClick={() => tree.toggleLine(lineKey)}
        >
          {tree.expandedLines.includes(lineKey) ? (
            <ChevronDown className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
          <span className='font-medium'>{lineRange}라인</span>
          {lineDevices.length === 0 ? (
            <Badge variant='secondary' className='text-xs text-muted-foreground'>
              등록된 기기 없음
            </Badge>
          ) : (
            <Badge variant='secondary' className='text-xs'>
              {lineDevices.length} 기기
            </Badge>
          )}
          {lineBrokenDevices > 0 && (
            <Badge variant='destructive' className='text-xs'>
              고장 {lineBrokenDevices}
            </Badge>
          )}
          <AdminBadge admins={lineAdmins} />
        </div>
        <Button
          variant={quickAdd.quickAddLineKey === lineKey ? 'outline' : 'default'}
          size='sm'
          onClick={(e) => {
            e.stopPropagation();
            quickAdd.handleToggleQuickAdd(lineKey);
          }}
          className={`text-xs h-8 ${quickAdd.quickAddLineKey !== lineKey ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
        >
          {quickAdd.quickAddLineKey === lineKey ? '닫기' : '기기 추가'}
        </Button>
      </div>

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
        <div className='ml-6 mt-2 space-y-2'>
          {lineDevices.length === 0 ? (
            <p className='text-sm text-muted-foreground py-3 pl-4'>등록된 기기가 없습니다</p>
          ) : (
            <>
              <div className='flex items-center gap-2 px-2 py-1'>
                <Checkbox
                  checked={lineDevices.every((d) => selection.selectedDevices.has(d.id))}
                  onCheckedChange={() => selection.handleSelectAllInLine(lineDevices)}
                />
                <span className='text-xs text-muted-foreground'>
                  전체 선택 (
                  {lineDevices.filter((d) => selection.selectedDevices.has(d.id)).length}/
                  {lineDevices.length})
                </span>
              </div>
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
        </div>
      )}
    </div>
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
    <div className='ml-6 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
      <div className='flex items-center gap-2 mb-3'>
        <span className='font-medium text-blue-900'>기기 추가</span>
        <span className='text-sm text-blue-700'>
          {buildingNumber}동 · {lineRange}라인
        </span>
      </div>
      <div className='grid grid-cols-3 gap-3 mb-3'>
        <div>
          <Label className='text-xs mb-1'>설치 장소</Label>
          <Input
            placeholder='예: B1 전기실'
            value={quickAdd.quickAddForm.placeName}
            onChange={(e) =>
              quickAdd.setQuickAddForm({ ...quickAdd.quickAddForm, placeName: e.target.value })
            }
            onKeyDown={(e) => quickAdd.handleQuickAddKeyPress(e, buildingId, lineId)}
            className='h-9'
            autoFocus
          />
        </div>
        <div>
          <Label className='text-xs mb-1'>MAC Address</Label>
          <Input
            placeholder='AABBCCDDEEFF'
            value={quickAdd.quickAddForm.macAddress}
            onChange={(e) =>
              quickAdd.setQuickAddForm({
                ...quickAdd.quickAddForm,
                macAddress: formatMacAddress(e.target.value),
              })
            }
            onKeyDown={(e) => quickAdd.handleQuickAddKeyPress(e, buildingId, lineId)}
            className='h-9 font-mono'
          />
        </div>
        <div>
          <Label className='text-xs mb-1'>비밀번호</Label>
          <Input
            placeholder='00000000'
            value={quickAdd.quickAddForm.devicePassword}
            onChange={(e) =>
              quickAdd.setQuickAddForm({
                ...quickAdd.quickAddForm,
                devicePassword: e.target.value,
              })
            }
            onKeyDown={(e) => quickAdd.handleQuickAddKeyPress(e, buildingId, lineId)}
            className='h-9'
          />
        </div>
      </div>
      <div className='flex gap-2'>
        <Button
          size='sm'
          onClick={() => quickAdd.handleQuickSave(buildingId, lineId)}
          disabled={!quickAdd.quickAddForm.placeName || !quickAdd.quickAddForm.macAddress}
          className='h-8'
        >
          추가
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => quickAdd.handleToggleQuickAdd('')}
          className='h-8'
        >
          닫기
        </Button>
      </div>
    </div>
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
    <div
      className={`flex items-center gap-3 p-3 rounded-lg ${
        device.isWorking === false
          ? 'bg-destructive/10 border border-destructive/20'
          : 'bg-muted/20'
      }`}
    >
      <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      <div className='space-y-1 flex-1'>
        <div className='flex items-center gap-2'>
          <p className='font-medium'>{device.apartment_line_places?.placeName}</p>
          {device.isWorking === false && (
            <Badge variant='destructive' className='text-xs'>
              고장
            </Badge>
          )}
        </div>
        <div className='text-sm text-muted-foreground space-y-1'>
          <div className='flex items-center gap-2'>
            <Smartphone className='h-3 w-3' />
            <span>MAC: {device.macAddress}</span>
          </div>
          <p>Password: {device.devicePassword}</p>
        </div>
      </div>
      <div className='flex gap-2'>
        {device.isWorking === false && (
          <Button
            variant='outline'
            size='sm'
            onClick={onRestore}
            className='text-green-600 border-green-600 hover:bg-green-50'
          >
            복구
          </Button>
        )}
        <Button variant='ghost' size='sm' onClick={onEdit}>
          <Edit2 className='h-4 w-4' />
        </Button>
        <Button variant='ghost' size='sm' onClick={onDelete}>
          <Trash2 className='h-4 w-4 text-destructive' />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Admin Badge (shared)
// ============================================================

function AdminBadge({ admins }: { admins: AdminScope[] }): React.ReactElement | null {
  if (admins.length === 0) return null;
  return (
    <>
      <UserCog className='h-3 w-3 text-muted-foreground ml-2' />
      <span className='text-xs text-muted-foreground'>
        관리자:{' '}
        {admins
          .map(
            (s) =>
              `${s.user?.name}${s.user?.phoneNumber ? ` ${s.user.phoneNumber}` : ''}`,
          )
          .join(', ')}
      </span>
    </>
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
    <Card>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>동</TableHead>
              <TableHead>라인</TableHead>
              <TableHead>설치 장소</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>비밀번호</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead className='text-right'>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center py-8'>
                  {searchTerm ? '검색 결과가 없습니다' : '등록된 기기가 없습니다'}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredCommonDevices.map((device) => (
                  <TableRow
                    key={device.id}
                    className={device.isWorking === false ? 'bg-destructive/5' : ''}
                  >
                    <TableCell>
                      <Badge variant='secondary'>공동출입문</Badge>
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {device.placeName || '-'}
                        {device.isWorking === false && (
                          <Badge variant='destructive' className='text-xs'>
                            고장
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='font-mono text-sm'>{device.macAddress}</TableCell>
                    <TableCell>{device.devicePassword}</TableCell>
                    <TableCell>
                      {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        {device.isWorking === false && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              commonDevicesHook.handleToggleWorking(device.id, device.isWorking)
                            }
                            className='text-green-600 border-green-600 hover:bg-green-50'
                          >
                            복구
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='sm'>
                              •••
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => commonDevicesHook.handleEditDevice(device)}
                            >
                              <Edit2 className='h-4 w-4 mr-2' />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => commonDevicesHook.handleDeleteDevice(device.id)}
                              className='text-destructive'
                            >
                              <Trash2 className='h-4 w-4 mr-2' />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDevices.map((device) => {
                  const line = device.apartment_line_places?.apartment_lines?.line;
                  const lineRange = line ? formatLineRange(line) : '';
                  const building =
                    device.apartment_line_places?.apartment_lines?.apartment_buildings
                      ?.buildingNumber;

                  return (
                    <TableRow
                      key={device.id}
                      className={device.isWorking === false ? 'bg-destructive/5' : ''}
                    >
                      <TableCell>{building}동</TableCell>
                      <TableCell>{lineRange}라인</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          {device.apartment_line_places?.placeName}
                          {device.isWorking === false && (
                            <Badge variant='destructive' className='text-xs'>
                              고장
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='font-mono text-sm'>{device.macAddress}</TableCell>
                      <TableCell>{device.devicePassword}</TableCell>
                      <TableCell>
                        {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex items-center justify-end gap-2'>
                          {device.isWorking === false && (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() =>
                                handleToggleDeviceWorking(device.id, device.isWorking)
                              }
                              className='text-green-600 border-green-600 hover:bg-green-50'
                            >
                              복구
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='sm'>
                                •••
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem
                                onClick={() => dialog.handleEditDevice(device)}
                              >
                                <Edit2 className='h-4 w-4 mr-2' />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => selection.handleDeleteDevice(device.id)}
                                className='text-destructive'
                              >
                                <Trash2 className='h-4 w-4 mr-2' />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <Dialog open={deviceDialog} onOpenChange={setDeviceDialog}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{editingDevice ? '기기 수정' : '기기 추가'}</DialogTitle>
          <DialogDescription>기기 정보를 입력해주세요</DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          {!editingDevice && deviceForm.buildingId && deviceForm.lineId && (
            <div className='p-4 bg-muted rounded-lg'>
              <p className='text-sm'>
                <strong>
                  {apartment?.buildings?.find((b) => b.id === deviceForm.buildingId)?.buildingNumber}
                  동 · {formatLineRange(dialog.getSelectedLine()?.line || [])}라인
                </strong>
                에 기기를 추가합니다
              </p>
            </div>
          )}

          {(!deviceForm.buildingId || !deviceForm.lineId) && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>동</Label>
                <Select
                  value={deviceForm.buildingId}
                  onValueChange={(v) =>
                    setDeviceForm({ ...deviceForm, buildingId: v, lineId: '', linePlaceId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='동을 선택하세요' />
                  </SelectTrigger>
                  <SelectContent>
                    {apartment?.buildings?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.buildingNumber}동
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>라인</Label>
                <Select
                  value={deviceForm.lineId}
                  onValueChange={(v) =>
                    setDeviceForm({ ...deviceForm, lineId: v, linePlaceId: '' })
                  }
                  disabled={!deviceForm.buildingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='라인을 선택하세요' />
                  </SelectTrigger>
                  <SelectContent>
                    {dialog.getSelectedBuilding()?.lines?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {formatLineRange(l.line)}라인
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Label>설치 장소</Label>
            <Input
              placeholder='예: B1 전기실, 1F 엘리베이터홀, 각 층 현관문'
              value={deviceForm.placeName}
              onChange={(e) => setDeviceForm({ ...deviceForm, placeName: e.target.value })}
            />
            <p className='text-xs text-muted-foreground'>기기가 설치된 장소를 입력하세요</p>
          </div>

          <div className='space-y-2'>
            <Label>MAC Address</Label>
            <Input
              placeholder='예: AA:BB:CC:DD:EE:FF'
              value={deviceForm.macAddress}
              onChange={(e) =>
                setDeviceForm({ ...deviceForm, macAddress: e.target.value.toUpperCase() })
              }
            />
            <p className='text-xs text-muted-foreground'>기기의 MAC 주소를 입력하세요</p>
          </div>

          <div className='space-y-2'>
            <Label>비밀번호</Label>
            <Input
              type='text'
              placeholder='00000000'
              value={deviceForm.devicePassword}
              onChange={(e) =>
                setDeviceForm({ ...deviceForm, devicePassword: e.target.value })
              }
            />
            <p className='text-xs text-muted-foreground'>기본값: 00000000 (0이 8개)</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setDeviceDialog(false)}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  deviceToDelete,
  devices,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceToDelete: string | null;
  devices: Device[];
  onConfirm: () => Promise<void>;
}): React.ReactElement {
  const device = deviceToDelete ? devices.find((d) => d.id === deviceToDelete) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>기기 삭제</DialogTitle>
          <DialogDescription>정말로 이 기기를 삭제하시겠습니까?</DialogDescription>
        </DialogHeader>
        {device && (
          <div className='py-4'>
            <div className='p-4 bg-muted rounded-lg space-y-2'>
              <p className='text-sm'>
                <strong>장소:</strong> {device.apartment_line_places?.placeName}
              </p>
              <p className='text-sm'>
                <strong>MAC:</strong> {device.macAddress}
              </p>
              <p className='text-sm'>
                <strong>동:</strong>{' '}
                {device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber}동
              </p>
            </div>
            <p className='text-sm text-destructive mt-4'>삭제된 기기는 복구할 수 없습니다.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant='destructive' onClick={onConfirm}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => Promise<void>;
}): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>일괄 삭제</DialogTitle>
          <DialogDescription>선택한 {count}개의 기기를 삭제하시겠습니까?</DialogDescription>
        </DialogHeader>
        <div className='py-4'>
          <div className='p-4 bg-destructive/10 border border-destructive/20 rounded-lg'>
            <p className='text-sm text-destructive'>삭제된 기기는 복구할 수 없습니다.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant='destructive' onClick={onConfirm}>
            {count}개 삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Card>
      <CardContent className='p-6'>
        <div className='border rounded-lg'>
          {/* Header */}
          <div
            className='flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50'
            onClick={() => setExpanded((prev) => !prev)}
          >
            <div className='flex items-center gap-2'>
              {expanded ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
              <span className='font-semibold'>공동출입문</span>
              {commonDevices.length === 0 ? (
                <Badge variant='secondary' className='text-muted-foreground'>
                  등록된 기기 없음
                </Badge>
              ) : (
                <Badge variant='outline'>{commonDevices.length} 기기</Badge>
              )}
              {brokenCount > 0 && (
                <Badge variant='destructive' className='text-xs'>
                  고장 {brokenCount}
                </Badge>
              )}
            </div>
            <Button
              variant={hook.showQuickAdd ? 'outline' : 'default'}
              size='sm'
              onClick={(e) => {
                e.stopPropagation();
                hook.toggleQuickAdd();
              }}
              className={`text-xs h-8 ${!hook.showQuickAdd ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
            >
              {hook.showQuickAdd ? '닫기' : '기기 추가'}
            </Button>
          </div>

          {/* Quick Add Form */}
          {hook.showQuickAdd && (
            <div className='px-4 pb-4'>
              <CommonDeviceQuickAddForm hook={hook} />
            </div>
          )}

          {/* Device List */}
          {expanded && (
            <div className='border-t px-4 pb-4'>
              <div className='mt-4 space-y-2'>
                {commonDevices.length === 0 ? (
                  <p className='text-sm text-muted-foreground py-3 text-center'>
                    등록된 공동출입문 기기가 없습니다
                  </p>
                ) : (
                  <>
                    <div className='flex items-center gap-2 px-2 py-1'>
                      <Checkbox
                        checked={commonDevices.every((d) => hook.selectedDevices.has(d.id))}
                        onCheckedChange={() => hook.handleSelectAll()}
                      />
                      <span className='text-xs text-muted-foreground'>
                        전체 선택 (
                        {commonDevices.filter((d) => hook.selectedDevices.has(d.id)).length}/
                        {commonDevices.length})
                      </span>
                    </div>
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
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
    <div className='mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
      <div className='flex items-center gap-2 mb-3'>
        <span className='font-medium text-blue-900'>공동출입문 기기 추가</span>
      </div>
      <div className='grid grid-cols-3 gap-3 mb-3'>
        <div>
          <Label className='text-xs mb-1'>설치 장소</Label>
          <Input
            data-common-quick-add-place
            placeholder='예: 정문, 후문'
            value={hook.quickAddForm.placeName}
            onChange={(e) =>
              hook.setQuickAddForm({
                ...hook.quickAddForm,
                placeName: e.target.value,
              })
            }
            onKeyDown={hook.handleQuickAddKeyPress}
            className='h-9'
            autoFocus
          />
        </div>
        <div>
          <Label className='text-xs mb-1'>MAC Address</Label>
          <Input
            placeholder='AABBCCDDEEFF'
            value={hook.quickAddForm.macAddress}
            onChange={(e) =>
              hook.setQuickAddForm({
                ...hook.quickAddForm,
                macAddress: formatMacAddress(e.target.value),
              })
            }
            onKeyDown={hook.handleQuickAddKeyPress}
            className='h-9 font-mono'
          />
        </div>
        <div>
          <Label className='text-xs mb-1'>비밀번호</Label>
          <Input
            placeholder='00000000'
            value={hook.quickAddForm.devicePassword}
            onChange={(e) =>
              hook.setQuickAddForm({
                ...hook.quickAddForm,
                devicePassword: e.target.value,
              })
            }
            onKeyDown={hook.handleQuickAddKeyPress}
            className='h-9'
          />
        </div>
      </div>
      <div className='flex gap-2'>
        <Button
          size='sm'
          onClick={() => hook.handleQuickSave()}
          disabled={!hook.quickAddForm.macAddress}
          className='h-8'
        >
          추가
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => hook.toggleQuickAdd()}
          className='h-8'
        >
          닫기
        </Button>
      </div>
    </div>
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
    <div
      className={`flex items-center gap-3 p-3 rounded-lg ${
        device.isWorking === false
          ? 'bg-destructive/10 border border-destructive/20'
          : 'bg-muted/20'
      }`}
    >
      <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      <div className='space-y-1 flex-1'>
        <div className='flex items-center gap-2'>
          <p className='font-medium'>{device.placeName || '(장소 미지정)'}</p>
          {device.isWorking === false && (
            <Badge variant='destructive' className='text-xs'>
              고장
            </Badge>
          )}
        </div>
        <div className='text-sm text-muted-foreground space-y-1'>
          <div className='flex items-center gap-2'>
            <Smartphone className='h-3 w-3' />
            <span>MAC: {device.macAddress}</span>
          </div>
          <p>Password: {device.devicePassword}</p>
        </div>
      </div>
      <div className='flex gap-2'>
        <Button variant='ghost' size='sm' onClick={onEdit}>
          <Edit2 className='h-4 w-4' />
        </Button>
        <Button variant='ghost' size='sm' onClick={onDelete}>
          <Trash2 className='h-4 w-4 text-destructive' />
        </Button>
      </div>
    </div>
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
    <Dialog open={hook.editDialog} onOpenChange={hook.setEditDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>공동출입문 기기 수정</DialogTitle>
          <DialogDescription>기기 정보를 수정해주세요</DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label>설치 장소</Label>
            <Input
              placeholder='예: 정문, 후문, 지하주차장'
              value={hook.editForm.placeName}
              onChange={(e) =>
                hook.setEditForm({
                  ...hook.editForm,
                  placeName: e.target.value,
                })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label>MAC Address</Label>
            <Input
              placeholder='예: AA:BB:CC:DD:EE:FF'
              value={hook.editForm.macAddress}
              onChange={(e) =>
                hook.setEditForm({
                  ...hook.editForm,
                  macAddress: formatMacAddress(e.target.value),
                })
              }
              className='font-mono'
            />
          </div>
          <div className='space-y-2'>
            <Label>비밀번호</Label>
            <Input
              type='text'
              placeholder='00000000'
              value={hook.editForm.devicePassword}
              onChange={(e) =>
                hook.setEditForm({
                  ...hook.editForm,
                  devicePassword: e.target.value,
                })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => hook.setEditDialog(false)}>
            취소
          </Button>
          <Button
            onClick={hook.handleSaveEdit}
            disabled={!hook.editForm.macAddress || !hook.editForm.devicePassword}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open={hook.deleteDialog} onOpenChange={hook.setDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>공동출입문 기기 삭제</DialogTitle>
          <DialogDescription>정말로 이 기기를 삭제하시겠습니까?</DialogDescription>
        </DialogHeader>
        {device && (
          <div className='py-4'>
            <div className='p-4 bg-muted rounded-lg space-y-2'>
              {device.placeName && (
                <p className='text-sm'>
                  <strong>장소:</strong> {device.placeName}
                </p>
              )}
              <p className='text-sm'>
                <strong>MAC:</strong> {device.macAddress}
              </p>
              <p className='text-sm'>
                <strong>비밀번호:</strong> {device.devicePassword}
              </p>
            </div>
            <p className='text-sm text-destructive mt-4'>삭제된 기기는 복구할 수 없습니다.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant='outline' onClick={() => hook.setDeleteDialog(false)}>
            취소
          </Button>
          <Button variant='destructive' onClick={hook.confirmDeleteDevice}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
