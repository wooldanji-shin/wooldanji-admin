import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  SupabaseClient,
  CommonDevice,
  CommonDeviceFormData,
  UseCommonDevicesReturn,
} from '../types';

const DEFAULT_DEVICE_PASSWORD = '00000000';

interface UseCommonDevicesDeps {
  supabase: SupabaseClient;
  apartmentId: string;
}

export function useCommonDevices({
  supabase,
  apartmentId,
}: UseCommonDevicesDeps): UseCommonDevicesReturn {
  // --------------- Data ---------------
  const [commonDevices, setCommonDevices] = useState<CommonDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCommonDevices = useCallback(async (): Promise<void> => {
    if (!apartmentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apartment_common_devices')
        .select('*')
        .eq('apartmentId', apartmentId)
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setCommonDevices((data as CommonDevice[]) || []);
    } catch (err) {
      console.error('Failed to fetch common devices:', err);
      toast.error('공동출입문 기기를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apartmentId, supabase]);

  useEffect(() => {
    fetchCommonDevices();
  }, [fetchCommonDevices]);

  // --------------- Quick Add ---------------
  const [showQuickAdd, setShowQuickAdd] = useState<boolean>(false);
  const [quickAddForm, setQuickAddForm] = useState<CommonDeviceFormData>({
    placeName: '',
    macAddress: '',
    devicePassword: DEFAULT_DEVICE_PASSWORD,
  });

  const resetQuickAddForm = (): void => {
    setQuickAddForm({ placeName: '', macAddress: '', devicePassword: DEFAULT_DEVICE_PASSWORD });
  };

  const toggleQuickAdd = (): void => {
    setShowQuickAdd((prev) => !prev);
    resetQuickAddForm();
  };

  const handleQuickSave = async (): Promise<void> => {
    try {
      if (!quickAddForm.macAddress) {
        toast.error('MAC 주소를 입력해주세요.');
        return;
      }

      const tempId = `temp-common-${Date.now()}`;

      // Optimistic UI
      const optimisticDevice: CommonDevice = {
        id: tempId,
        apartmentId,
        placeName: quickAddForm.placeName,
        macAddress: quickAddForm.macAddress,
        devicePassword: quickAddForm.devicePassword,
        lastOpenedAt: null,
        isWorking: true,
        createdAt: new Date().toISOString(),
      };

      setCommonDevices((prev) => [optimisticDevice, ...prev]);
      resetQuickAddForm();

      // Focus first input for continuous entry
      setTimeout(() => {
        document
          .querySelector<HTMLInputElement>('[data-common-quick-add-place]')
          ?.focus();
      }, 100);

      // Persist to DB
      const { data: newDevice, error } = await supabase
        .from('apartment_common_devices')
        .insert({
          apartmentId,
          placeName: optimisticDevice.placeName,
          macAddress: optimisticDevice.macAddress,
          devicePassword: optimisticDevice.devicePassword,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp with real
      setCommonDevices((prev) =>
        prev.map((d) => (d.id === tempId ? (newDevice as CommonDevice) : d)),
      );
    } catch (err) {
      console.error('Failed to quick add common device:', err);
      toast.error('공동출입문 기기 추가에 실패했습니다.');
      setCommonDevices((prev) => prev.filter((d) => !d.id.startsWith('temp-common-')));
    }
  };

  const handleQuickAddKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickSave();
    }
  };

  // --------------- Selection & Delete ---------------
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<boolean>(false);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState<boolean>(false);

  const clearSelection = (): void => {
    setSelectedDevices(new Set());
  };

  const handleToggleSelect = (id: string): void => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (): void => {
    const allSelected = commonDevices.every((d) => selectedDevices.has(d.id));
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      commonDevices.forEach((d) =>
        allSelected ? next.delete(d.id) : next.add(d.id),
      );
      return next;
    });
  };

  const handleDeleteDevice = (id: string): void => {
    setDeviceToDelete(id);
    setDeleteDialog(true);
  };

  const confirmDeleteDevice = async (): Promise<void> => {
    if (!deviceToDelete) return;

    // Optimistic removal
    setCommonDevices((prev) => prev.filter((d) => d.id !== deviceToDelete));
    setDeleteDialog(false);
    setDeviceToDelete(null);

    if (deviceToDelete.startsWith('temp-common-')) return;

    try {
      const { error } = await supabase
        .from('apartment_common_devices')
        .delete()
        .eq('id', deviceToDelete);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete common device:', err);
      toast.error('기기 삭제에 실패했습니다. 페이지를 새로고침해주세요.');
      await fetchCommonDevices();
    }
  };

  const handleBulkDelete = (): void => {
    if (selectedDevices.size === 0) return;
    setBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async (): Promise<void> => {
    const deviceIds = Array.from(selectedDevices);

    // Optimistic removal
    setCommonDevices((prev) => prev.filter((d) => !selectedDevices.has(d.id)));
    setBulkDeleteDialog(false);
    setSelectedDevices(new Set());

    const realIds = deviceIds.filter((id) => !id.startsWith('temp-common-'));
    if (realIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('apartment_common_devices')
        .delete()
        .in('id', realIds);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to bulk delete common devices:', err);
      toast.error('일괄 삭제에 실패했습니다. 페이지를 새로고침해주세요.');
      await fetchCommonDevices();
    }
  };

  // --------------- Edit ---------------
  const [editDialog, setEditDialog] = useState<boolean>(false);
  const [editingDevice, setEditingDevice] = useState<CommonDevice | null>(null);
  const [editForm, setEditForm] = useState<CommonDeviceFormData>({
    placeName: '',
    macAddress: '',
    devicePassword: '',
  });

  const handleEditDevice = (device: CommonDevice): void => {
    setEditingDevice(device);
    setEditForm({
      placeName: device.placeName,
      macAddress: device.macAddress,
      devicePassword: device.devicePassword,
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editingDevice) return;
    try {
      if (!editForm.macAddress) {
        toast.error('MAC 주소를 입력해주세요.');
        return;
      }

      const { error } = await supabase
        .from('apartment_common_devices')
        .update({
          placeName: editForm.placeName,
          macAddress: editForm.macAddress,
          devicePassword: editForm.devicePassword,
        })
        .eq('id', editingDevice.id);

      if (error) throw error;

      setCommonDevices((prev) =>
        prev.map((d) =>
          d.id === editingDevice.id
            ? { ...d, placeName: editForm.placeName, macAddress: editForm.macAddress, devicePassword: editForm.devicePassword }
            : d,
        ),
      );
      setEditDialog(false);
      toast.success('기기가 수정되었습니다.');
    } catch (err) {
      console.error('Failed to edit common device:', err);
      toast.error('기기 수정에 실패했습니다.');
    }
  };

  // --------------- Toggle Working ---------------
  const handleToggleWorking = async (
    id: string,
    currentStatus: boolean,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('apartment_common_devices')
        .update({ isWorking: !currentStatus })
        .eq('id', id);
      if (error) throw error;

      setCommonDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isWorking: !currentStatus } : d)),
      );
    } catch (err) {
      console.error('Failed to toggle common device status:', err);
      toast.error('기기 상태 변경에 실패했습니다.');
    }
  };

  return {
    commonDevices,
    loading,
    fetchCommonDevices,

    showQuickAdd,
    quickAddForm,
    setQuickAddForm,
    toggleQuickAdd,
    handleQuickSave,
    handleQuickAddKeyPress,

    selectedDevices,
    clearSelection,
    handleToggleSelect,
    handleSelectAll,
    deleteDialog,
    setDeleteDialog,
    deviceToDelete,
    handleDeleteDevice,
    confirmDeleteDevice,
    bulkDeleteDialog,
    setBulkDeleteDialog,
    handleBulkDelete,
    confirmBulkDelete,

    editDialog,
    setEditDialog,
    editingDevice,
    editForm,
    setEditForm,
    handleEditDevice,
    handleSaveEdit,

    handleToggleWorking,
  };
}
