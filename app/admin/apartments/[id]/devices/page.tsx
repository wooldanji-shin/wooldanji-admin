'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Cpu,
  Search,
  Download,
  Upload,
  Smartphone,
  UserCog,
  Trash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { formatLineRange } from '@/lib/utils/line';

type Device = Database['public']['Tables']['devices']['Row'] & {
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

interface DeviceFormData {
  buildingId: string;
  lineId: string;
  linePlaceId: string;
  placeName: string;
  macAddress: string;
  devicePassword: string;
}

interface ApartmentDetails {
  id: string;
  name: string;
  buildings?: Array<{
    id: string;
    buildingNumber: number;
    lines?: Array<{
      id: string;
      line: number[];
      places?: Array<{
        id: string;
        placeName: string;
      }>;
    }>;
  }>;
}

interface AdminScope {
  id: string;
  scopeLevel: 'APARTMENT' | 'BUILDING' | 'LINE';
  apartmentId: string | null;
  buildingId: string | null;
  lineId: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
}

const DEFAULT_DEVICE_PASSWORD = '00000000';

// MAC 주소 자동 포맷팅 함수
const formatMacAddress = (value: string): string => {
  // 모든 : 제거하고 대문자로 변환
  const cleaned = value.replace(/:/g, '').toUpperCase();
  // 2자리마다 : 추가
  const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
  // 최대 17자 (AA:BB:CC:DD:EE:FF)
  return formatted.slice(0, 17);
};

export default function DevicesManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();

  const [apartmentId, setApartmentId] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [apartment, setApartment] = useState<ApartmentDetails | null>(null);
  const [adminScopes, setAdminScopes] = useState<AdminScope[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  const [expandedLines, setExpandedLines] = useState<string[]>([]);
  const [showBrokenOnly, setShowBrokenOnly] = useState(false);

  // Device dialog state
  const [deviceDialog, setDeviceDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormData>({
    buildingId: '',
    lineId: '',
    linePlaceId: '',
    placeName: '',
    macAddress: '',
    devicePassword: '',
  });

  // Quick add state
  const [quickAddLineKey, setQuickAddLineKey] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    placeName: '',
    macAddress: '',
    devicePassword: DEFAULT_DEVICE_PASSWORD,
  });

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

  // Bulk delete state
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);

  // Bulk upload dialog
  const [bulkUploadDialog, setBulkUploadDialog] = useState(false);

  // params unwrap
  useEffect(() => {
    params.then(p => setApartmentId(p.id));
  }, [params]);

  // 아파트 및 기기 데이터 로드
  const fetchData = useCallback(async () => {
    console.log('🔄 fetchData 호출됨 - apartmentId:', apartmentId);

    if (!apartmentId) {
      console.log('⚠️ apartmentId 없음, 종료');
      return;
    }

    setLoading(true);

    try {
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      // 사용자 역할 확인
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('userId', user.id);

      const userRoles = roles?.map(r => r.role) || [];
      const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
      const isManager = userRoles.includes('MANAGER');

      // 매니저인 경우 관리 권한 확인
      if (isManager && !isSuperAdmin) {
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', user.id)
          .eq('apartmentId', apartmentId);

        if (!managerApartments || managerApartments.length === 0) {
          throw new Error('이 아파트에 대한 접근 권한이 없습니다.');
        }
      }
      // 아파트 정보 및 구조 로드
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select(`
          id,
          name,
          apartment_buildings (
            id,
            buildingNumber,
            apartment_lines (
              id,
              line,
              apartment_line_places (
                id,
                placeName
              )
            )
          )
        `)
        .eq('id', apartmentId)
        .single();

      if (apartmentError) throw apartmentError;
      if (!apartmentData) throw new Error('Apartment not found');

      const formattedApartment: ApartmentDetails = {
        id: apartmentData.id,
        name: apartmentData.name,
        buildings: ((apartmentData as any).apartment_buildings || []).map((b: any) => ({
          id: b.id,
          buildingNumber: b.buildingNumber,
          lines: (b.apartment_lines || []).map((l: any) => ({
            id: l.id,
            line: l.line,
            places: l.apartment_line_places || [],
          })),
        })),
      };

      setApartment(formattedApartment);

      // 1단계: 해당 아파트의 모든 linePlaceId 수집
      console.log('📡 아파트의 모든 linePlaceId 수집 시작 - apartmentId:', apartmentId);
      const linePlaceIds: string[] = [];
      formattedApartment.buildings?.forEach(building => {
        building.lines?.forEach(line => {
          line.places?.forEach(place => {
            linePlaceIds.push(place.id);
          });
        });
      });

      console.log('📡 수집된 linePlaceIds:', linePlaceIds.length, linePlaceIds);

      // 2단계: linePlaceId로 기기 목록 필터링
      console.log('📡 기기 목록 로드 시작 - linePlaceIds로 필터링');

      let devicesData;
      let devicesError;

      if (linePlaceIds.length === 0) {
        // linePlaceId가 없으면 빈 배열
        devicesData = [];
        devicesError = null;
      } else {
        const { data, error } = await supabase
          .from('devices')
          .select(`
            *,
            apartment_line_places (
              id,
              placeName,
              apartment_lines (
                id,
                line,
                apartment_buildings (
                  id,
                  buildingNumber
                )
              )
            )
          `)
          .in('linePlaceId', linePlaceIds)
          .order('createdAt', { ascending: false });

        devicesData = data;
        devicesError = error;
      }

      console.log('📡 기기 목록 응답:', { count: devicesData?.length, error: devicesError });

      if (devicesError) throw devicesError;

      // 0동 문제 확인
      devicesData?.forEach((device, index) => {
        const building = device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber;
        if (!building || building === 0) {
          console.warn(`⚠️ [${index}] 0동 또는 없는 동 발견:`, {
            deviceId: device.id,
            macAddress: device.macAddress,
            linePlaceId: device.linePlaceId,
            fullPath: device.apartment_line_places,
          });
        }
      });

      setDevices(devicesData || []);

      // 관리자 권한 정보 로드
      const { data: scopesData, error: scopesError } = await supabase
        .from('admin_scopes')
        .select(`
          id,
          scopeLevel,
          apartmentId,
          buildingId,
          lineId,
          user:userId (
            id,
            name,
            email,
            phoneNumber
          )
        `)
        .eq('apartmentId', apartmentId);

      if (scopesError) throw scopesError;

      setAdminScopes(scopesData || []);

      console.log('✅ fetchData 완료:', {
        아파트: apartment?.name,
        동수: apartment?.buildings?.length,
        기기수: devicesData?.length,
        관리자수: scopesData?.length
      });
    } catch (err) {
      console.error('❌ Failed to fetch data:', err);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apartmentId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDevices = devices.filter((device) => {
    // 고장난 기기만 보기 필터
    if (showBrokenOnly && device.isWorking !== false) {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    const building = device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber;
    const line = device.apartment_line_places?.apartment_lines?.line;
    const place = device.apartment_line_places?.placeName;
    const lineRange = line ? formatLineRange(line) : '';

    return (
      device.macAddress.toLowerCase().includes(searchLower) ||
      place?.toLowerCase().includes(searchLower) ||
      building?.toString().includes(searchTerm) ||
      lineRange.includes(searchTerm)
    );
  });

  const groupedDevices = filteredDevices.reduce((acc, device) => {
    const building = device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber || 0;
    const lineId = device.apartment_line_places?.apartment_lines?.id || '';

    if (building === 0) {
      console.warn('⚠️ groupedDevices에서 0동 발견:', {
        deviceId: device.id,
        macAddress: device.macAddress,
        placeName: device.apartment_line_places?.placeName,
        lineId,
        rawData: device.apartment_line_places
      });
    }

    if (!acc[building]) {
      acc[building] = {};
    }
    if (!acc[building][lineId]) {
      acc[building][lineId] = [];
    }
    acc[building][lineId].push(device);
    return acc;
  }, {} as Record<number, Record<string, Device[]>>);

  const handleAddDevice = (preselectedBuildingId?: string, preselectedLineId?: string) => {
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

  const handleToggleDeviceWorking = async (deviceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ isWorking: !currentStatus })
        .eq('id', deviceId);

      if (error) throw error;

      fetchData();
    } catch (err) {
      console.error('Failed to toggle device status:', err);
      toast.error('기기 상태 변경에 실패했습니다.');
    }
  };

  const handleToggleQuickAdd = (lineKey: string) => {
    if (quickAddLineKey === lineKey) {
      // 이미 열려있으면 닫기
      setQuickAddLineKey(null);
      setQuickAddForm({
        placeName: '',
        macAddress: '',
        devicePassword: DEFAULT_DEVICE_PASSWORD,
      });
    } else {
      // 새로 열기
      setQuickAddLineKey(lineKey);
      setQuickAddForm({
        placeName: '',
        macAddress: '',
        devicePassword: DEFAULT_DEVICE_PASSWORD,
      });
      // 해당 라인 자동으로 펼치기
      if (!expandedLines.includes(lineKey)) {
        setExpandedLines(prev => [...prev, lineKey]);
      }
    }
  };

  const handleQuickSave = async (buildingId: string, lineId: string) => {
    try {
      if (!quickAddForm.placeName || !quickAddForm.macAddress) {
        toast.error('장소와 MAC 주소를 입력해주세요.');
        return;
      }

      // Optimistic UI: 임시 ID로 즉시 UI 업데이트
      const tempDeviceId = `temp-${Date.now()}`;
      const tempPlaceId = `temp-place-${Date.now()}`;

      const building = apartment?.buildings?.find(b => b.id === buildingId);
      const line = building?.lines?.find(l => l.id === lineId);

      const optimisticDevice: Device = {
        id: tempDeviceId,
        linePlaceId: tempPlaceId,
        macAddress: quickAddForm.macAddress,
        devicePassword: quickAddForm.devicePassword,
        isWorking: true,
        createdAt: new Date().toISOString(),
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

      // 즉시 UI에 추가
      setDevices(prev => [optimisticDevice, ...prev]);

      // 폼만 초기화 (폼은 열린 상태 유지)
      setQuickAddForm({
        placeName: '',
        macAddress: '',
        devicePassword: DEFAULT_DEVICE_PASSWORD,
      });

      // 첫 번째 입력 필드로 포커스 이동 (연속 입력 가능)
      setTimeout(() => {
        const firstInput = document.querySelector<HTMLInputElement>(`input[placeholder="예: B1 전기실"]`);
        firstInput?.focus();
      }, 100);

      // 백그라운드에서 실제 저장
      const { data: newPlace, error: placeError } = await supabase
        .from('apartment_line_places')
        .insert({
          lineId: lineId,
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
        .select(`
          *,
          apartment_line_places (
            id,
            placeName,
            apartment_lines (
              id,
              line,
              apartment_buildings (
                id,
                buildingNumber
              )
            )
          )
        `)
        .single();

      if (insertError) throw insertError;

      // 임시 기기를 실제 기기로 교체 (깜빡임 없이)
      setDevices(prev => prev.map(d =>
        d.id === tempDeviceId ? newDevice as Device : d
      ));

      console.log('✅ 임시 ID를 실제 ID로 교체 완료:', { tempDeviceId, realId: newDevice.id });
    } catch (err) {
      console.error('Failed to quick add device:', err);
      toast.error('기기 추가에 실패했습니다.');
      // 에러 시 optimistic update 롤백 (임시 기기 제거)
      setDevices(prev => prev.filter(d => d.id !== `temp-${Date.now()}`));
    }
  };

  const handleQuickAddKeyPress = (e: React.KeyboardEvent, buildingId: string, lineId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickSave(buildingId, lineId);
    }
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);

    const building = device.apartment_line_places?.apartment_lines?.apartment_buildings;
    const line = device.apartment_line_places?.apartment_lines;

    setDeviceForm({
      buildingId: building?.id || '',
      lineId: line?.id || '',
      linePlaceId: device.linePlaceId,
      placeName: device.apartment_line_places?.placeName || '',
      macAddress: device.macAddress,
      devicePassword: device.devicePassword,
    });
    setDeviceDialog(true);
  };

  const handleSaveDevice = async () => {
    console.log('💾 기기 저장 시작:', deviceForm);

    try {
      if (!deviceForm.lineId || !deviceForm.placeName) {
        toast.error('모든 필수 정보를 입력해주세요.');
        return;
      }

      // 먼저 apartment_line_places 생성 또는 조회
      let linePlaceId = deviceForm.linePlaceId;

      if (!linePlaceId) {
        // 새로운 place 생성
        console.log('📍 새 장소 생성:', { lineId: deviceForm.lineId, placeName: deviceForm.placeName });
        const { data: newPlace, error: placeError } = await supabase
          .from('apartment_line_places')
          .insert({
            lineId: deviceForm.lineId,
            placeName: deviceForm.placeName,
          })
          .select()
          .single();

        console.log('📍 장소 생성 응답:', { newPlace, error: placeError });

        if (placeError) throw placeError;
        linePlaceId = newPlace.id;
      }

      if (editingDevice) {
        // 기기 수정
        console.log('✏️ 기기 수정:', { deviceId: editingDevice.id, linePlaceId });
        const { error: updateError } = await supabase
          .from('devices')
          .update({
            linePlaceId,
            macAddress: deviceForm.macAddress,
            devicePassword: deviceForm.devicePassword,
          })
          .eq('id', editingDevice.id);

        console.log('✏️ 수정 결과:', { error: updateError });

        if (updateError) throw updateError;
      } else {
        // 기기 추가
        console.log('➕ 새 기기 추가:', { linePlaceId, macAddress: deviceForm.macAddress });
        const { data: insertedDevice, error: insertError } = await supabase
          .from('devices')
          .insert({
            linePlaceId,
            macAddress: deviceForm.macAddress,
            devicePassword: deviceForm.devicePassword,
          })
          .select();

        console.log('➕ 추가 결과:', { data: insertedDevice, error: insertError });

        if (insertError) throw insertError;
      }

      console.log('✅ 저장 성공! 다이얼로그 닫고 데이터 새로고침...');
      setDeviceDialog(false);
      toast.success('기기가 저장되었습니다.');
      await fetchData();
    } catch (err) {
      console.error('❌ Failed to save device:', err);
      toast.error('기기 저장에 실패했습니다.');
    }
  };

  const handleDeleteDevice = async (id: string) => {
    setDeviceToDelete(id);
    setDeleteDialog(true);
  };

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete) return;

    console.log('🗑️ 삭제 시도 - Device ID:', deviceToDelete);

    // Optimistic UI: 즉시 제거
    setDevices(prev => prev.filter(d => d.id !== deviceToDelete));
    setDeleteDialog(false);
    setDeviceToDelete(null);

    // 임시 ID인 경우 DB 작업 불필요
    if (deviceToDelete.startsWith('temp-')) {
      console.log('⚠️ 임시 기기 삭제 - UI에서만 제거');
      return;
    }

    // 백그라운드에서 실제 삭제
    try {
      console.log('🗑️ Supabase DELETE 요청 시작...');
      const { error: deleteError } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceToDelete);

      if (deleteError) {
        console.error('❌ 삭제 실패:', deleteError);
        throw deleteError;
      }

      console.log('✅ 삭제 성공!');
    } catch (err) {
      console.error('❌ Failed to delete device:', err);
      toast.error('기기 삭제에 실패했습니다. 페이지를 새로고침해주세요.');
      // 에러 시 롤백을 위해 데이터 다시 로드
      await fetchData();
    }
  };

  const handleToggleSelectDevice = (deviceId: string) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const handleSelectAllInLine = (lineDevices: Device[]) => {
    const allSelected = lineDevices.every(d => selectedDevices.has(d.id));
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        lineDevices.forEach(d => newSet.delete(d.id));
      } else {
        lineDevices.forEach(d => newSet.add(d.id));
      }
      return newSet;
    });
  };

  const handleBulkDelete = () => {
    if (selectedDevices.size === 0) return;
    setBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
    const deviceIds = Array.from(selectedDevices);

    console.log('🗑️ 일괄 삭제 시도:', deviceIds);

    // Optimistic UI: 즉시 제거
    setDevices(prev => prev.filter(d => !selectedDevices.has(d.id)));
    setBulkDeleteDialog(false);
    setSelectedDevices(new Set());

    // 임시 ID가 아닌 것들만 DB에서 삭제
    const realDeviceIds = deviceIds.filter(id => !id.startsWith('temp-'));

    if (realDeviceIds.length === 0) {
      console.log('⚠️ 모두 임시 기기 - DB 작업 불필요');
      return;
    }

    // 백그라운드에서 실제 삭제
    try {
      console.log('🗑️ Supabase 일괄 DELETE 요청 시작...');
      const { error: deleteError } = await supabase
        .from('devices')
        .delete()
        .in('id', realDeviceIds);

      if (deleteError) {
        console.error('❌ 일괄 삭제 실패:', deleteError);
        throw deleteError;
      }

      console.log('✅ 일괄 삭제 성공!');
    } catch (err) {
      console.error('❌ Failed to bulk delete devices:', err);
      toast.error('일괄 삭제에 실패했습니다. 페이지를 새로고침해주세요.');
      // 에러 시 롤백을 위해 데이터 다시 로드
      await fetchData();
    }
  };

  const toggleBuilding = (building: string) => {
    setExpandedBuildings(prev =>
      prev.includes(building)
        ? prev.filter(b => b !== building)
        : [...prev, building]
    );
  };

  const toggleLine = (lineKey: string) => {
    setExpandedLines(prev =>
      prev.includes(lineKey)
        ? prev.filter(l => l !== lineKey)
        : [...prev, lineKey]
    );
  };

  const handleExportCSV = () => {
    const csv = [
      ['동', '라인', '장소', 'MAC Address', '비밀번호', '등록일'],
      ...filteredDevices.map(device => {
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
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `devices_${apartment?.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getSelectedBuilding = () => {
    return apartment?.buildings?.find(b => b.id === deviceForm.buildingId);
  };

  const getSelectedLine = () => {
    return getSelectedBuilding()?.lines?.find(l => l.id === deviceForm.lineId);
  };

  // 아파트 전체 관리자 가져오기
  const getApartmentAdmins = () => {
    return adminScopes.filter(scope =>
      scope.scopeLevel === 'APARTMENT' && scope.apartmentId === apartmentId
    );
  };

  // 특정 동의 관리자 가져오기
  const getBuildingAdmins = (buildingId: string) => {
    return adminScopes.filter(scope =>
      scope.scopeLevel === 'BUILDING' && scope.buildingId === buildingId
    );
  };

  // 특정 라인의 관리자 가져오기
  const getLineAdmins = (lineId: string) => {
    return adminScopes.filter(scope =>
      scope.scopeLevel === 'LINE' && scope.lineId === lineId
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/apartments')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">장치 관리</h1>
              {devices.filter(d => d.isWorking === false).length > 0 && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  고장 {devices.filter(d => d.isWorking === false).length}개
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {apartment?.name || '아파트'}의 모든 장치를 관리합니다
            </p>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedDevices.size > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedDevices.size}개 선택됨</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDevices(new Set())}
                >
                  선택 해제
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  선택 삭제
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and View Toggle */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="MAC 주소, 장소, 동, 라인으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('tree')}
            >
              트리 뷰
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              테이블 뷰
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={showBrokenOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setShowBrokenOnly(!showBrokenOnly)}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              고장난 기기만 보기
              {showBrokenOnly && (
                <Badge variant="secondary" className="ml-2">
                  {devices.filter(d => d.isWorking === false).length}
                </Badge>
              )}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            전체 {devices.length}개 기기
            {devices.filter(d => d.isWorking === false).length > 0 && (
              <span className="text-destructive ml-2">
                · 고장 {devices.filter(d => d.isWorking === false).length}개
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : viewMode === 'tree' ? (
        <Card>
          <CardContent className="p-6">
            {!apartment?.buildings || apartment.buildings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                등록된 동이 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {apartment.buildings.map((building) => {
                  const buildingDevices = groupedDevices[building.buildingNumber] || {};
                  const totalDevices = Object.values(buildingDevices).flat().length;
                  const brokenDevices = Object.values(buildingDevices).flat().filter(d => d.isWorking === false).length;

                  return (
                    <div key={building.id} className="border rounded-lg">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleBuilding(building.id)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedBuildings.includes(building.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-semibold">{building.buildingNumber}동</span>
                          {totalDevices === 0 ? (
                            <Badge variant="secondary" className="text-muted-foreground">
                              등록된 기기 없음
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {totalDevices} 기기
                            </Badge>
                          )}
                          {brokenDevices > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              고장 {brokenDevices}
                            </Badge>
                          )}
                          {getBuildingAdmins(building.id).length > 0 && (
                            <>
                              <UserCog className="h-3 w-3 text-muted-foreground ml-2" />
                              <span className="text-xs text-muted-foreground">
                                관리자: {getBuildingAdmins(building.id).map(scope =>
                                  `${scope.user?.name}${scope.user?.phoneNumber ? ` ${scope.user.phoneNumber}` : ''}`
                                ).join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {expandedBuildings.includes(building.id) && (
                        <div className="border-t px-4 pb-4">
                          {building.lines && building.lines.length > 0 ? (
                            building.lines.map((line: any) => {
                              const lineDevices = buildingDevices[line.id] || [];
                              const lineKey = `${building.id}-${line.id}`;
                              const lineRange = formatLineRange(line.line);
                              const lineBrokenDevices = lineDevices.filter(d => d.isWorking === false).length;

                              return (
                                <div key={lineKey} className="mt-4">
                                  <div className="flex items-center justify-between py-2 rounded px-2">
                                    <div
                                      className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-muted/30 rounded-l py-1 px-1"
                                      onClick={() => toggleLine(lineKey)}
                                    >
                                      {expandedLines.includes(lineKey) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      <span className="font-medium">{lineRange}라인</span>
                                      {lineDevices.length === 0 ? (
                                        <Badge variant="secondary" className="text-xs text-muted-foreground">
                                          등록된 기기 없음
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">
                                          {lineDevices.length} 기기
                                        </Badge>
                                      )}
                                      {lineBrokenDevices > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          고장 {lineBrokenDevices}
                                        </Badge>
                                      )}
                                      {getLineAdmins(line.id).length > 0 && (
                                        <>
                                          <UserCog className="h-3 w-3 text-muted-foreground ml-2" />
                                          <span className="text-xs text-muted-foreground">
                                            관리자: {getLineAdmins(line.id).map(scope =>
                                              `${scope.user?.name}${scope.user?.phoneNumber ? ` ${scope.user.phoneNumber}` : ''}`
                                            ).join(', ')}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <Button
                                      variant={quickAddLineKey === lineKey ? 'outline' : 'default'}
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleQuickAdd(lineKey);
                                      }}
                                      className={`text-xs h-8 ${quickAddLineKey !== lineKey ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                    >
                                      {quickAddLineKey === lineKey ? '닫기' : '기기 추가'}
                                    </Button>
                                  </div>

                                  {/* Quick Add Form */}
                                  {quickAddLineKey === lineKey && (
                                    <div className="ml-6 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                      <div className="flex items-center gap-2 mb-3">
                                        <span className="font-medium text-blue-900">기기 추가</span>
                                        <span className="text-sm text-blue-700">
                                          {building.buildingNumber}동 · {lineRange}라인
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-3 mb-3">
                                        <div>
                                          <Label className="text-xs mb-1">설치 장소</Label>
                                          <Input
                                            placeholder="예: B1 전기실"
                                            value={quickAddForm.placeName}
                                            onChange={(e) => setQuickAddForm({ ...quickAddForm, placeName: e.target.value })}
                                            onKeyPress={(e) => handleQuickAddKeyPress(e, building.id, line.id)}
                                            className="h-9"
                                            autoFocus
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs mb-1">MAC Address</Label>
                                          <Input
                                            placeholder="AABBCCDDEEFF"
                                            value={quickAddForm.macAddress}
                                            onChange={(e) => setQuickAddForm({ ...quickAddForm, macAddress: formatMacAddress(e.target.value) })}
                                            onKeyPress={(e) => handleQuickAddKeyPress(e, building.id, line.id)}
                                            className="h-9 font-mono"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs mb-1">비밀번호</Label>
                                          <Input
                                            placeholder="00000000"
                                            value={quickAddForm.devicePassword}
                                            onChange={(e) => setQuickAddForm({ ...quickAddForm, devicePassword: e.target.value })}
                                            onKeyPress={(e) => handleQuickAddKeyPress(e, building.id, line.id)}
                                            className="h-9"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => handleQuickSave(building.id, line.id)}
                                          disabled={!quickAddForm.placeName || !quickAddForm.macAddress}
                                          className="h-8"
                                        >
                                          추가
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleToggleQuickAdd(lineKey)}
                                          className="h-8"
                                        >
                                          닫기
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {expandedLines.includes(lineKey) && (
                                    <div className="ml-6 mt-2 space-y-2">
                                      {lineDevices.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-3 pl-4">
                                          등록된 기기가 없습니다
                                        </p>
                                      ) : (
                                        <>
                                          {/* 라인별 전체 선택 */}
                                          <div className="flex items-center gap-2 px-2 py-1">
                                            <Checkbox
                                              checked={lineDevices.every(d => selectedDevices.has(d.id))}
                                              onCheckedChange={() => handleSelectAllInLine(lineDevices)}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                              전체 선택 ({lineDevices.filter(d => selectedDevices.has(d.id)).length}/{lineDevices.length})
                                            </span>
                                          </div>
                                          {lineDevices.map((device) => (
                                    <div
                                      key={device.id}
                                      className={`flex items-center gap-3 p-3 rounded-lg ${
                                        device.isWorking === false ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/20'
                                      }`}
                                    >
                                      <Checkbox
                                        checked={selectedDevices.has(device.id)}
                                        onCheckedChange={() => handleToggleSelectDevice(device.id)}
                                      />
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">
                                            {device.apartment_line_places?.placeName}
                                          </p>
                                          {device.isWorking === false && (
                                            <Badge variant="destructive" className="text-xs">
                                              고장
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Smartphone className="h-3 w-3" />
                                            <span>MAC: {device.macAddress}</span>
                                          </div>
                                          <p>Password: {device.devicePassword}</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        {device.isWorking === false && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleToggleDeviceWorking(device.id, device.isWorking)}
                                            className="text-green-600 border-green-600 hover:bg-green-50"
                                          >
                                            복구
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditDevice(device)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteDevice(device.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                          </div>
                                        ))}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-muted-foreground py-4 text-center">
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
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>동</TableHead>
                  <TableHead>라인</TableHead>
                  <TableHead>설치 장소</TableHead>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>비밀번호</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {searchTerm ? '검색 결과가 없습니다' : '등록된 기기가 없습니다'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => {
                    const line = device.apartment_line_places?.apartment_lines?.line;
                    const lineRange = line ? formatLineRange(line) : '';
                    const building = device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber;

                    return (
                      <TableRow
                        key={device.id}
                        className={device.isWorking === false ? 'bg-destructive/5' : ''}
                      >
                        <TableCell>
                          {building}동
                        </TableCell>
                        <TableCell>
                          {lineRange}라인
                        </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {device.apartment_line_places?.placeName}
                          {device.isWorking === false && (
                            <Badge variant="destructive" className="text-xs">
                              고장
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {device.macAddress}
                      </TableCell>
                      <TableCell>{device.devicePassword}</TableCell>
                      <TableCell>
                        {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {device.isWorking === false && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleDeviceWorking(device.id, device.isWorking)}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              복구
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                •••
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditDevice(device)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteDevice(device.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Device Dialog */}
      <Dialog open={deviceDialog} onOpenChange={setDeviceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? '기기 수정' : '기기 추가'}
            </DialogTitle>
            <DialogDescription>
              기기 정보를 입력해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(!editingDevice && deviceForm.buildingId && deviceForm.lineId) && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>
                    {apartment?.buildings?.find(b => b.id === deviceForm.buildingId)?.buildingNumber}동 ·
                    {' '}{formatLineRange(getSelectedLine()?.line || [])}라인
                  </strong>에 기기를 추가합니다
                </p>
              </div>
            )}

            {!deviceForm.buildingId || !deviceForm.lineId ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>동</Label>
                  <Select
                    value={deviceForm.buildingId}
                    onValueChange={(value) => {
                      setDeviceForm({
                        ...deviceForm,
                        buildingId: value,
                        lineId: '',
                        linePlaceId: ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="동을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {apartment?.buildings?.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.buildingNumber}동
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>라인</Label>
                  <Select
                    value={deviceForm.lineId}
                    onValueChange={(value) => {
                      setDeviceForm({
                        ...deviceForm,
                        lineId: value,
                        linePlaceId: ''
                      });
                    }}
                    disabled={!deviceForm.buildingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="라인을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSelectedBuilding()?.lines?.map((line) => {
                        const lineRange = formatLineRange(line.line);
                        return (
                          <SelectItem key={line.id} value={line.id}>
                            {lineRange}라인
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>설치 장소</Label>
              <Input
                placeholder="예: B1 전기실, 1F 엘리베이터홀, 각 층 현관문"
                value={deviceForm.placeName}
                onChange={(e) => setDeviceForm({ ...deviceForm, placeName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                기기가 설치된 장소를 입력하세요
              </p>
            </div>

            <div className="space-y-2">
              <Label>MAC Address</Label>
              <Input
                placeholder="예: AA:BB:CC:DD:EE:FF"
                value={deviceForm.macAddress}
                onChange={(e) => setDeviceForm({ ...deviceForm, macAddress: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-muted-foreground">
                기기의 MAC 주소를 입력하세요
              </p>
            </div>

            <div className="space-y-2">
              <Label>비밀번호</Label>
              <Input
                type="text"
                placeholder="00000000"
                value={deviceForm.devicePassword}
                onChange={(e) => setDeviceForm({ ...deviceForm, devicePassword: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                기본값: 00000000 (0이 8개)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleSaveDevice}
              disabled={!deviceForm.lineId || !deviceForm.placeName || !deviceForm.macAddress || !deviceForm.devicePassword}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>기기 삭제</DialogTitle>
            <DialogDescription>
              정말로 이 기기를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {deviceToDelete && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>장소:</strong> {devices.find(d => d.id === deviceToDelete)?.apartment_line_places?.placeName}
                </p>
                <p className="text-sm">
                  <strong>MAC:</strong> {devices.find(d => d.id === deviceToDelete)?.macAddress}
                </p>
                <p className="text-sm">
                  <strong>동:</strong> {devices.find(d => d.id === deviceToDelete)?.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber}동
                </p>
              </div>
              <p className="text-sm text-destructive mt-4">
                삭제된 기기는 복구할 수 없습니다.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialog(false);
              setDeviceToDelete(null);
            }}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDevice}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialog} onOpenChange={setBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일괄 삭제</DialogTitle>
            <DialogDescription>
              선택한 {selectedDevices.size}개의 기기를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                삭제된 기기는 복구할 수 없습니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              {selectedDevices.size}개 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}