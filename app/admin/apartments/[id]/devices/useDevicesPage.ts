'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatLineRange } from '@/lib/utils/line';

import { useDevicesFetch } from './hooks/useDevicesFetch';
import { useTreeExpand } from './hooks/useTreeExpand';
import { useDeviceDialog } from './hooks/useDeviceDialog';
import { useQuickAdd } from './hooks/useQuickAdd';
import { useDeviceSelection } from './hooks/useDeviceSelection';
import { useCommonDevices } from './hooks/useCommonDevices';
import type {
  Device,
  CommonDevice,
  AdminScope,
  ViewMode,
  UseDevicesFetchReturn,
  UseTreeExpandReturn,
  UseDeviceDialogReturn,
  UseQuickAddReturn,
  UseDeviceSelectionReturn,
  UseCommonDevicesReturn,
} from './types';

// --------------- Utility (exported for UI) ---------------

export function formatMacAddress(value: string): string {
  const cleaned = value.replace(/:/g, '').toUpperCase();
  const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
  return formatted.slice(0, 17);
}

// --------------- Composition Hook Return ---------------

export interface UseDevicesPageReturn {
  fetch: UseDevicesFetchReturn;
  tree: UseTreeExpandReturn;
  dialog: UseDeviceDialogReturn;
  quickAdd: UseQuickAddReturn;
  selection: UseDeviceSelectionReturn;
  commonDevices: UseCommonDevicesReturn;

  // Search & filter
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  showBrokenOnly: boolean;
  setShowBrokenOnly: (v: boolean) => void;

  // Derived
  filteredDevices: Device[];
  filteredCommonDevices: CommonDevice[];
  groupedDevices: Record<number, Record<string, Device[]>>;
  brokenDeviceCount: number;
  totalDeviceCount: number;

  // Actions
  handleToggleDeviceWorking: (deviceId: string, currentStatus: boolean) => Promise<void>;
  handleExportCSV: () => void;

  // Admin scope helpers
  getApartmentAdmins: () => AdminScope[];
  getBuildingAdmins: (buildingId: string) => AdminScope[];
  getLineAdmins: (lineId: string) => AdminScope[];
}

// --------------- Composition Hook ---------------

export function useDevicesPage(
  params: Promise<{ id: string }>,
): UseDevicesPageReturn {
  const supabase = createClient();

  // --- Compose sub-hooks ---
  const fetchHook = useDevicesFetch(supabase, params);
  const treeHook = useTreeExpand();
  const dialogHook = useDeviceDialog({
    supabase,
    apartment: fetchHook.apartment,
    fetchData: fetchHook.fetchData,
  });
  const quickAddHook = useQuickAdd({
    supabase,
    apartment: fetchHook.apartment,
    setDevices: fetchHook.setDevices,
    ensureLineExpanded: treeHook.ensureLineExpanded,
  });
  const selectionHook = useDeviceSelection({
    supabase,
    devices: fetchHook.devices,
    setDevices: fetchHook.setDevices,
    fetchData: fetchHook.fetchData,
  });
  const commonDevicesHook = useCommonDevices({
    supabase,
    apartmentId: fetchHook.apartmentId,
  });

  // --- Local UI state ---
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [showBrokenOnly, setShowBrokenOnly] = useState<boolean>(false);

  // --- Derived data ---
  const brokenDeviceCount = useMemo<number>(
    () =>
      fetchHook.devices.filter((d) => d.isWorking === false).length +
      commonDevicesHook.commonDevices.filter((d) => d.isWorking === false).length,
    [fetchHook.devices, commonDevicesHook.commonDevices],
  );

  const totalDeviceCount = useMemo<number>(
    () => fetchHook.devices.length + commonDevicesHook.commonDevices.length,
    [fetchHook.devices, commonDevicesHook.commonDevices],
  );

  const filteredDevices = useMemo<Device[]>(() => {
    return fetchHook.devices.filter((device) => {
      if (showBrokenOnly && device.isWorking !== false) return false;

      const q = searchTerm.toLowerCase();
      const building =
        device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber;
      const line = device.apartment_line_places?.apartment_lines?.line;
      const place = device.apartment_line_places?.placeName;
      const lineRange = line ? formatLineRange(line) : '';

      return (
        device.macAddress.toLowerCase().includes(q) ||
        place?.toLowerCase().includes(q) ||
        building?.toString().includes(searchTerm) ||
        lineRange.includes(searchTerm)
      );
    });
  }, [fetchHook.devices, searchTerm, showBrokenOnly]);

  const groupedDevices = useMemo<Record<number, Record<string, Device[]>>>(() => {
    return filteredDevices.reduce(
      (acc, device) => {
        const building =
          device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber || 0;
        const lineId = device.apartment_line_places?.apartment_lines?.id || '';
        if (!acc[building]) acc[building] = {};
        if (!acc[building][lineId]) acc[building][lineId] = [];
        acc[building][lineId].push(device);
        return acc;
      },
      {} as Record<number, Record<string, Device[]>>,
    );
  }, [filteredDevices]);

  const filteredCommonDevices = useMemo<CommonDevice[]>(() => {
    return commonDevicesHook.commonDevices.filter((device) => {
      if (showBrokenOnly && device.isWorking !== false) return false;
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      return (
        device.macAddress.toLowerCase().includes(q) ||
        device.placeName?.toLowerCase().includes(q)
      );
    });
  }, [commonDevicesHook.commonDevices, searchTerm, showBrokenOnly]);

  // --- Actions ---
  const handleToggleDeviceWorking = async (
    deviceId: string,
    currentStatus: boolean,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ isWorking: !currentStatus })
        .eq('id', deviceId);
      if (error) throw error;
      fetchHook.fetchData();
    } catch (err) {
      console.error('Failed to toggle device status:', err);
      toast.error('기기 상태 변경에 실패했습니다.');
    }
  };

  const handleExportCSV = (): void => {
    const lineDeviceRows = filteredDevices.map((device) => {
      const line = device.apartment_line_places?.apartment_lines?.line;
      const lineRange = line ? formatLineRange(line) : '';
      return [
        device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber || '',
        lineRange,
        device.apartment_line_places?.placeName || '',
        device.macAddress,
        device.devicePassword,
        new Date(device.createdAt).toLocaleDateString('ko-KR'),
      ];
    });

    const commonDeviceRows = filteredCommonDevices.map((device) => [
      '공동출입문',
      '',
      device.placeName || '',
      device.macAddress,
      device.devicePassword,
      new Date(device.createdAt).toLocaleDateString('ko-KR'),
    ]);

    const csv = [
      ['동', '라인', '장소', 'MAC Address', '비밀번호', '등록일'],
      ...commonDeviceRows,
      ...lineDeviceRows,
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `devices_${fetchHook.apartment?.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- Admin scope helpers ---
  const getApartmentAdmins = (): AdminScope[] =>
    fetchHook.adminScopes.filter(
      (s) => s.scopeLevel === 'APARTMENT' && s.apartmentId === fetchHook.apartmentId,
    );

  const getBuildingAdmins = (buildingId: string): AdminScope[] =>
    fetchHook.adminScopes.filter(
      (s) => s.scopeLevel === 'BUILDING' && s.buildingId === buildingId,
    );

  const getLineAdmins = (lineId: string): AdminScope[] =>
    fetchHook.adminScopes.filter(
      (s) => s.scopeLevel === 'LINE' && s.lineId === lineId,
    );

  return {
    fetch: fetchHook,
    tree: treeHook,
    dialog: dialogHook,
    quickAdd: quickAddHook,
    selection: selectionHook,
    commonDevices: commonDevicesHook,

    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    showBrokenOnly,
    setShowBrokenOnly,

    filteredDevices,
    filteredCommonDevices,
    groupedDevices,
    brokenDeviceCount,
    totalDeviceCount,

    handleToggleDeviceWorking,
    handleExportCSV,

    getApartmentAdmins,
    getBuildingAdmins,
    getLineAdmins,
  };
}
