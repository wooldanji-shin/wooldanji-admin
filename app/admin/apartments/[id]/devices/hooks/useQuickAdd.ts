import { useState } from 'react';
import { toast } from 'sonner';
import { DEVICE_SELECT_QUERY } from './useDevicesFetch';
import type {
  SupabaseClient,
  Device,
  QuickAddFormData,
  ApartmentDetails,
  UseQuickAddReturn,
} from '../types';

const DEFAULT_DEVICE_PASSWORD = '00000000';

interface UseQuickAddDeps {
  supabase: SupabaseClient;
  apartment: ApartmentDetails | null;
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  ensureLineExpanded: (lineKey: string) => void;
}

export function useQuickAdd({
  supabase,
  apartment,
  setDevices,
  ensureLineExpanded,
}: UseQuickAddDeps): UseQuickAddReturn {
  const [quickAddLineKey, setQuickAddLineKey] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState<QuickAddFormData>({
    placeName: '',
    macAddress: '',
    devicePassword: DEFAULT_DEVICE_PASSWORD,
  });

  const resetForm = (): void => {
    setQuickAddForm({
      placeName: '',
      macAddress: '',
      devicePassword: DEFAULT_DEVICE_PASSWORD,
    });
  };

  const handleToggleQuickAdd = (lineKey: string): void => {
    if (quickAddLineKey === lineKey) {
      setQuickAddLineKey(null);
      resetForm();
    } else {
      setQuickAddLineKey(lineKey);
      resetForm();
      ensureLineExpanded(lineKey);
    }
  };

  const handleQuickSave = async (buildingId: string, lineId: string): Promise<void> => {
    try {
      if (!quickAddForm.placeName || !quickAddForm.macAddress) {
        toast.error('장소와 MAC 주소를 입력해주세요.');
        return;
      }

      const tempDeviceId = `temp-${Date.now()}`;
      const tempPlaceId = `temp-place-${Date.now()}`;

      const building = apartment?.buildings?.find((b) => b.id === buildingId);
      const line = building?.lines?.find((l) => l.id === lineId);

      // Optimistic UI
      const optimisticDevice: Device = {
        id: tempDeviceId,
        linePlaceId: tempPlaceId,
        macAddress: quickAddForm.macAddress,
        devicePassword: quickAddForm.devicePassword,
        isWorking: true,
        createdAt: new Date().toISOString(),
        lastOpenedAt: null,
        apartment_line_places: {
          id: tempPlaceId,
          placeName: quickAddForm.placeName,
          apartment_lines: {
            id: lineId,
            line: line?.line || [],
            apartment_buildings: {
              id: buildingId,
              buildingNumber: building?.buildingNumber || 0,
            },
          },
        },
      };

      setDevices((prev) => [optimisticDevice, ...prev]);
      resetForm();

      // Focus first input for continuous entry
      setTimeout(() => {
        document
          .querySelector<HTMLInputElement>('input[placeholder="예: B1 전기실"]')
          ?.focus();
      }, 100);

      // Persist to DB
      const { data: newPlace, error: placeError } = await supabase
        .from('apartment_line_places')
        .insert({
          lineId,
          placeName: optimisticDevice.apartment_line_places?.placeName || '',
        })
        .select()
        .single();

      if (placeError) throw placeError;

      const { data: newDevice, error: insertError } = await supabase
        .from('devices')
        .insert({
          linePlaceId: newPlace.id,
          macAddress: optimisticDevice.macAddress,
          devicePassword: optimisticDevice.devicePassword,
        })
        .select(DEVICE_SELECT_QUERY)
        .single();

      if (insertError) throw insertError;

      // Replace temp with real
      setDevices((prev) =>
        prev.map((d) => (d.id === tempDeviceId ? (newDevice as Device) : d)),
      );
    } catch (err) {
      console.error('Failed to quick add device:', err);
      toast.error('기기 추가에 실패했습니다.');
      setDevices((prev) => prev.filter((d) => !d.id.startsWith('temp-')));
    }
  };

  const handleQuickAddKeyPress = (
    e: React.KeyboardEvent,
    buildingId: string,
    lineId: string,
  ): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickSave(buildingId, lineId);
    }
  };

  return {
    quickAddLineKey,
    quickAddForm,
    setQuickAddForm,
    handleToggleQuickAdd,
    handleQuickSave,
    handleQuickAddKeyPress,
  };
}
