import { useState } from 'react';
import { toast } from 'sonner';
import type {
  SupabaseClient,
  Device,
  DeviceFormData,
  ApartmentDetails,
  ApartmentBuilding,
  ApartmentLine,
  UseDeviceDialogReturn,
} from '../types';

const DEFAULT_DEVICE_PASSWORD = '00000000';

interface UseDeviceDialogDeps {
  supabase: SupabaseClient;
  apartment: ApartmentDetails | null;
  fetchData: () => Promise<void>;
}

export function useDeviceDialog({
  supabase,
  apartment,
  fetchData,
}: UseDeviceDialogDeps): UseDeviceDialogReturn {
  const [deviceDialog, setDeviceDialog] = useState<boolean>(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormData>({
    buildingId: '',
    lineId: '',
    linePlaceId: '',
    placeName: '',
    macAddress: '',
    devicePassword: '',
  });

  const handleAddDevice = (
    preselectedBuildingId?: string,
    preselectedLineId?: string,
  ): void => {
    setEditingDevice(null);
    setDeviceForm({
      buildingId: preselectedBuildingId || '',
      lineId: preselectedLineId || '',
      linePlaceId: '',
      placeName: '',
      macAddress: '',
      devicePassword: DEFAULT_DEVICE_PASSWORD,
    });
    setDeviceDialog(true);
  };

  const handleEditDevice = (device: Device): void => {
    setEditingDevice(device);
    setDeviceForm({
      buildingId: device.apartment_line_places?.apartment_lines?.apartment_buildings?.id || '',
      lineId: device.apartment_line_places?.apartment_lines?.id || '',
      linePlaceId: device.linePlaceId,
      placeName: device.apartment_line_places?.placeName || '',
      macAddress: device.macAddress,
      devicePassword: device.devicePassword,
    });
    setDeviceDialog(true);
  };

  const handleSaveDevice = async (): Promise<void> => {
    try {
      if (!deviceForm.lineId || !deviceForm.placeName) {
        toast.error('모든 필수 정보를 입력해주세요.');
        return;
      }

      let linePlaceId = deviceForm.linePlaceId;

      if (!linePlaceId) {
        const { data: newPlace, error: placeError } = await supabase
          .from('apartment_line_places')
          .insert({ lineId: deviceForm.lineId, placeName: deviceForm.placeName })
          .select()
          .single();
        if (placeError) throw placeError;
        linePlaceId = newPlace.id;
      }

      if (editingDevice) {
        if (linePlaceId) {
          const { error } = await supabase
            .from('apartment_line_places')
            .update({ placeName: deviceForm.placeName })
            .eq('id', linePlaceId);
          if (error) throw error;
        }

        const { error } = await supabase
          .from('devices')
          .update({
            linePlaceId,
            macAddress: deviceForm.macAddress,
            devicePassword: deviceForm.devicePassword,
          })
          .eq('id', editingDevice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('devices')
          .insert({
            linePlaceId,
            macAddress: deviceForm.macAddress,
            devicePassword: deviceForm.devicePassword,
          })
          .select();
        if (error) throw error;
      }

      setDeviceDialog(false);
      toast.success('기기가 저장되었습니다.');
      await fetchData();
    } catch (err) {
      console.error('Failed to save device:', err);
      toast.error('기기 저장에 실패했습니다.');
    }
  };

  const getSelectedBuilding = (): ApartmentBuilding | undefined => {
    return apartment?.buildings?.find((b) => b.id === deviceForm.buildingId);
  };

  const getSelectedLine = (): ApartmentLine | undefined => {
    return getSelectedBuilding()?.lines?.find((l) => l.id === deviceForm.lineId);
  };

  return {
    deviceDialog,
    setDeviceDialog,
    editingDevice,
    deviceForm,
    setDeviceForm,
    handleAddDevice,
    handleEditDevice,
    handleSaveDevice,
    getSelectedBuilding,
    getSelectedLine,
  };
}
