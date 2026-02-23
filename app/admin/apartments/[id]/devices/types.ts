import type { createClient } from '@/lib/supabase/client';

// --------------- Supabase Client ---------------

export type SupabaseClient = ReturnType<typeof createClient>;

// --------------- Domain Models ---------------

export interface DeviceRow {
  id: string;
  createdAt: string;
  linePlaceId: string;
  macAddress: string;
  devicePassword: string;
  lastOpenedAt: string | null;
  isWorking: boolean;
}

export type Device = DeviceRow & {
  apartment_line_places?: {
    id: string;
    placeName: string;
    apartment_lines?: {
      id: string;
      line: number[];
      apartment_buildings?: {
        id: string;
        buildingNumber: number;
      };
    };
  };
};

export interface ApartmentLinePlace {
  id: string;
  placeName: string;
}

export interface ApartmentLine {
  id: string;
  line: number[];
  places?: ApartmentLinePlace[];
}

export interface ApartmentBuilding {
  id: string;
  buildingNumber: number;
  lines?: ApartmentLine[];
}

export interface ApartmentDetails {
  id: string;
  name: string;
  buildings?: ApartmentBuilding[];
}

export interface AdminScopeUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
}

export interface AdminScope {
  id: string;
  scopeLevel: 'APARTMENT' | 'BUILDING' | 'LINE';
  apartmentId: string | null;
  buildingId: string | null;
  lineId: string | null;
  user?: AdminScopeUser;
}

// --------------- Common Device (공동출입문) ---------------

export interface CommonDevice {
  id: string;
  apartmentId: string;
  placeName: string;
  macAddress: string;
  devicePassword: string;
  lastOpenedAt: string | null;
  isWorking: boolean;
  createdAt: string;
}

export interface CommonDeviceFormData {
  placeName: string;
  macAddress: string;
  devicePassword: string;
}

// --------------- Form Data ---------------

export interface DeviceFormData {
  buildingId: string;
  lineId: string;
  linePlaceId: string;
  placeName: string;
  macAddress: string;
  devicePassword: string;
}

export interface QuickAddFormData {
  placeName: string;
  macAddress: string;
  devicePassword: string;
}

// --------------- Hook Return Types ---------------

export type ViewMode = 'tree' | 'table';

export interface UseDevicesFetchReturn {
  apartmentId: string;
  apartment: ApartmentDetails | null;
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  adminScopes: AdminScope[];
  loading: boolean;
  fetchData: () => Promise<void>;
}

export interface UseTreeExpandReturn {
  expandedBuildings: string[];
  toggleBuilding: (buildingId: string) => void;
  expandedLines: string[];
  toggleLine: (lineKey: string) => void;
  ensureLineExpanded: (lineKey: string) => void;
}

export interface UseDeviceDialogReturn {
  deviceDialog: boolean;
  setDeviceDialog: (open: boolean) => void;
  editingDevice: Device | null;
  deviceForm: DeviceFormData;
  setDeviceForm: (form: DeviceFormData) => void;
  handleAddDevice: (preselectedBuildingId?: string, preselectedLineId?: string) => void;
  handleEditDevice: (device: Device) => void;
  handleSaveDevice: () => Promise<void>;
  getSelectedBuilding: () => ApartmentBuilding | undefined;
  getSelectedLine: () => ApartmentLine | undefined;
}

export interface UseQuickAddReturn {
  quickAddLineKey: string | null;
  quickAddForm: QuickAddFormData;
  setQuickAddForm: (form: QuickAddFormData) => void;
  handleToggleQuickAdd: (lineKey: string) => void;
  handleQuickSave: (buildingId: string, lineId: string) => Promise<void>;
  handleQuickAddKeyPress: (e: React.KeyboardEvent, buildingId: string, lineId: string) => void;
}

export interface UseDeviceSelectionReturn {
  selectedDevices: Set<string>;
  clearSelection: () => void;
  handleToggleSelectDevice: (deviceId: string) => void;
  handleSelectAllInLine: (lineDevices: Device[]) => void;
  deleteDialog: boolean;
  setDeleteDialog: (open: boolean) => void;
  deviceToDelete: string | null;
  handleDeleteDevice: (id: string) => void;
  confirmDeleteDevice: () => Promise<void>;
  bulkDeleteDialog: boolean;
  setBulkDeleteDialog: (open: boolean) => void;
  handleBulkDelete: () => void;
  confirmBulkDelete: () => Promise<void>;
}

export interface UseCommonDevicesReturn {
  // Data
  commonDevices: CommonDevice[];
  loading: boolean;
  fetchCommonDevices: () => Promise<void>;

  // Quick Add
  showQuickAdd: boolean;
  quickAddForm: CommonDeviceFormData;
  setQuickAddForm: (form: CommonDeviceFormData) => void;
  toggleQuickAdd: () => void;
  handleQuickSave: () => Promise<void>;
  handleQuickAddKeyPress: (e: React.KeyboardEvent) => void;

  // Selection & Delete
  selectedDevices: Set<string>;
  clearSelection: () => void;
  handleToggleSelect: (id: string) => void;
  handleSelectAll: () => void;
  deleteDialog: boolean;
  setDeleteDialog: (open: boolean) => void;
  deviceToDelete: string | null;
  handleDeleteDevice: (id: string) => void;
  confirmDeleteDevice: () => Promise<void>;
  bulkDeleteDialog: boolean;
  setBulkDeleteDialog: (open: boolean) => void;
  handleBulkDelete: () => void;
  confirmBulkDelete: () => Promise<void>;

  // Edit
  editDialog: boolean;
  setEditDialog: (open: boolean) => void;
  editingDevice: CommonDevice | null;
  editForm: CommonDeviceFormData;
  setEditForm: (form: CommonDeviceFormData) => void;
  handleEditDevice: (device: CommonDevice) => void;
  handleSaveEdit: () => Promise<void>;

  // Toggle Working
  handleToggleWorking: (id: string, currentStatus: boolean) => Promise<void>;
}
