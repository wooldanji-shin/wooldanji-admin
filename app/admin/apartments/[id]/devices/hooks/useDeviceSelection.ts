import { useState } from 'react';
import { toast } from 'sonner';
import type {
  SupabaseClient,
  Device,
  UseDeviceSelectionReturn,
} from '../types';

interface UseDeviceSelectionDeps {
  supabase: SupabaseClient;
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  fetchData: () => Promise<void>;
}

export function useDeviceSelection({
  supabase,
  devices,
  setDevices,
  fetchData,
}: UseDeviceSelectionDeps): UseDeviceSelectionReturn {
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<boolean>(false);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState<boolean>(false);

  const clearSelection = (): void => {
    setSelectedDevices(new Set());
  };

  const handleToggleSelectDevice = (deviceId: string): void => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const handleSelectAllInLine = (lineDevices: Device[]): void => {
    const allSelected = lineDevices.every((d) => selectedDevices.has(d.id));
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      lineDevices.forEach((d) =>
        allSelected ? next.delete(d.id) : next.add(d.id),
      );
      return next;
    });
  };

  // --------------- Single Delete ---------------

  const handleDeleteDevice = (id: string): void => {
    setDeviceToDelete(id);
    setDeleteDialog(true);
  };

  const confirmDeleteDevice = async (): Promise<void> => {
    if (!deviceToDelete) return;

    const target = devices.find((d) => d.id === deviceToDelete);
    const linePlaceId = target?.linePlaceId;

    // Optimistic removal
    setDevices((prev) => prev.filter((d) => d.id !== deviceToDelete));
    setDeleteDialog(false);
    setDeviceToDelete(null);

    if (deviceToDelete.startsWith('temp-')) return;

    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceToDelete);
      if (error) throw error;

      if (linePlaceId) {
        const { error: placeErr } = await supabase
          .from('apartment_line_places')
          .delete()
          .eq('id', linePlaceId);
        if (placeErr) throw placeErr;
      }
    } catch (err) {
      console.error('Failed to delete device:', err);
      toast.error('기기 삭제에 실패했습니다. 페이지를 새로고침해주세요.');
      await fetchData();
    }
  };

  // --------------- Bulk Delete ---------------

  const handleBulkDelete = (): void => {
    if (selectedDevices.size === 0) return;
    setBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async (): Promise<void> => {
    const deviceIds = Array.from(selectedDevices);

    const linePlaceIds = devices
      .filter((d) => selectedDevices.has(d.id) && d.linePlaceId && !d.id.startsWith('temp-'))
      .map((d) => d.linePlaceId);

    // Optimistic removal
    setDevices((prev) => prev.filter((d) => !selectedDevices.has(d.id)));
    setBulkDeleteDialog(false);
    setSelectedDevices(new Set());

    const realIds = deviceIds.filter((id) => !id.startsWith('temp-'));
    if (realIds.length === 0) return;

    try {
      const { error } = await supabase.from('devices').delete().in('id', realIds);
      if (error) throw error;

      if (linePlaceIds.length > 0) {
        const { error: placeErr } = await supabase
          .from('apartment_line_places')
          .delete()
          .in('id', linePlaceIds);
        if (placeErr) throw placeErr;
      }
    } catch (err) {
      console.error('Failed to bulk delete devices:', err);
      toast.error('일괄 삭제에 실패했습니다. 페이지를 새로고침해주세요.');
      await fetchData();
    }
  };

  return {
    selectedDevices,
    clearSelection,
    handleToggleSelectDevice,
    handleSelectAllInLine,
    deleteDialog,
    setDeleteDialog,
    deviceToDelete,
    handleDeleteDevice,
    confirmDeleteDevice,
    bulkDeleteDialog,
    setBulkDeleteDialog,
    handleBulkDelete,
    confirmBulkDelete,
  };
}
