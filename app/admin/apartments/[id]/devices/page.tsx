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
  TabletSmartphone,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type Device = Database['public']['Tables']['devices']['Row'] & {
  apartment_line_places?: {
    id: string;
    placeName: string;
    apartment_lines?: {
      id: string;
      line: number;
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
  iosMacAddress: string;
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
      line: number;
      places?: Array<{
        id: string;
        placeName: string;
      }>;
    }>;
  }>;
}

interface AdminScope {
  id: string;
  scope_level: 'APARTMENT' | 'BUILDING' | 'LINE';
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

const PLACE_TEMPLATES = [
  'B1 전기실',
  '1F 엘리베이터홀',
  '각 층 현관문',
  '옥상',
  '지하주차장',
  '정문',
  '후문',
  '계단실',
  '복도',
];

export default function DevicesManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();

  const [apartmentId, setApartmentId] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [apartment, setApartment] = useState<ApartmentDetails | null>(null);
  const [adminScopes, setAdminScopes] = useState<AdminScope[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  const [expandedLines, setExpandedLines] = useState<string[]>([]);

  // Device dialog state
  const [deviceDialog, setDeviceDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormData>({
    buildingId: '',
    lineId: '',
    linePlaceId: '',
    placeName: '',
    macAddress: '',
    iosMacAddress: '',
    devicePassword: '',
  });

  // Bulk upload dialog
  const [bulkUploadDialog, setBulkUploadDialog] = useState(false);

  // params unwrap
  useEffect(() => {
    params.then(p => setApartmentId(p.id));
  }, [params]);

  // 아파트 및 기기 데이터 로드
  const fetchData = useCallback(async () => {
    if (!apartmentId) return;

    setLoading(true);
    setError(null);

    try {
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

      // 기기 목록 로드
      const { data: devicesData, error: devicesError } = await supabase
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
                buildingNumber,
                apartmentId
              )
            )
          )
        `)
        .eq('apartment_line_places.apartment_lines.apartment_buildings.apartmentId', apartmentId)
        .order('createdAt', { ascending: false });

      if (devicesError) throw devicesError;

      setDevices(devicesData || []);

      // 관리자 권한 정보 로드
      const { data: scopesData, error: scopesError } = await supabase
        .from('admin_scopes')
        .select(`
          id,
          scope_level,
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
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apartmentId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDevices = devices.filter((device) => {
    const searchLower = searchTerm.toLowerCase();
    const building = device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber;
    const line = device.apartment_line_places?.apartment_lines?.line;
    const place = device.apartment_line_places?.placeName;

    return (
      device.macAddress.toLowerCase().includes(searchLower) ||
      device.iosMacAddress?.toLowerCase().includes(searchLower) ||
      place?.toLowerCase().includes(searchLower) ||
      building?.toString().includes(searchTerm) ||
      line?.toString().includes(searchTerm)
    );
  });

  const groupedDevices = filteredDevices.reduce((acc, device) => {
    const building = device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber || 0;
    const line = device.apartment_line_places?.apartment_lines?.line || 0;

    if (!acc[building]) {
      acc[building] = {};
    }
    if (!acc[building][line]) {
      acc[building][line] = [];
    }
    acc[building][line].push(device);
    return acc;
  }, {} as Record<number, Record<number, Device[]>>);

  const handleAddDevice = () => {
    setEditingDevice(null);
    setDeviceForm({
      buildingId: '',
      lineId: '',
      linePlaceId: '',
      placeName: '',
      macAddress: '',
      iosMacAddress: '',
      devicePassword: '',
    });
    setDeviceDialog(true);
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
      iosMacAddress: device.iosMacAddress || '',
      devicePassword: device.devicePassword,
    });
    setDeviceDialog(true);
  };

  const handleSaveDevice = async () => {
    try {
      if (!deviceForm.lineId || !deviceForm.placeName) {
        setError('모든 필수 정보를 입력해주세요.');
        return;
      }

      // 먼저 apartment_line_places 생성 또는 조회
      let linePlaceId = deviceForm.linePlaceId;

      if (!linePlaceId) {
        // 새로운 place 생성
        const { data: newPlace, error: placeError } = await supabase
          .from('apartment_line_places')
          .insert({
            lineId: deviceForm.lineId,
            placeName: deviceForm.placeName,
          })
          .select()
          .single();

        if (placeError) throw placeError;
        linePlaceId = newPlace.id;
      }

      if (editingDevice) {
        // 기기 수정
        const { error: updateError } = await supabase
          .from('devices')
          .update({
            linePlaceId,
            macAddress: deviceForm.macAddress,
            iosMacAddress: deviceForm.iosMacAddress || null,
            devicePassword: deviceForm.devicePassword,
          })
          .eq('id', editingDevice.id);

        if (updateError) throw updateError;
      } else {
        // 기기 추가
        const { error: insertError } = await supabase
          .from('devices')
          .insert({
            linePlaceId,
            macAddress: deviceForm.macAddress,
            iosMacAddress: deviceForm.iosMacAddress || null,
            devicePassword: deviceForm.devicePassword,
          });

        if (insertError) throw insertError;
      }

      setDeviceDialog(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save device:', err);
      setError('기기 저장에 실패했습니다.');
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('정말로 이 기기를 삭제하시겠습니까?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchData();
    } catch (err) {
      console.error('Failed to delete device:', err);
      setError('기기 삭제에 실패했습니다.');
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
      ['동', '라인', '장소', 'Android MAC', 'iOS MAC', '비밀번호', '등록일'],
      ...filteredDevices.map(device => [
        device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber || '',
        device.apartment_line_places?.apartment_lines?.line || '',
        device.apartment_line_places?.placeName || '',
        device.macAddress,
        device.iosMacAddress || '',
        device.devicePassword,
        new Date(device.createdAt).toLocaleDateString('ko-KR'),
      ])
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
      scope.scope_level === 'APARTMENT' && scope.apartmentId === apartmentId
    );
  };

  // 특정 동의 관리자 가져오기
  const getBuildingAdmins = (buildingId: string) => {
    return adminScopes.filter(scope =>
      scope.scope_level === 'BUILDING' && scope.buildingId === buildingId
    );
  };

  // 특정 라인의 관리자 가져오기
  const getLineAdmins = (lineId: string) => {
    return adminScopes.filter(scope =>
      scope.scope_level === 'LINE' && scope.lineId === lineId
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
            <h1 className="text-3xl font-bold tracking-tight">기기 관리</h1>
            <p className="text-muted-foreground mt-1">
              {apartment?.name || '아파트'}의 모든 기기를 관리합니다
            </p>
            {getApartmentAdmins().length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  관리자: {getApartmentAdmins().map(scope =>
                    `${scope.user?.name}${scope.user?.phoneNumber ? ` ${scope.user.phoneNumber}` : ''}`
                  ).join(', ')}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV 내보내기
            </Button>
            <Button onClick={handleAddDevice}>
              <Plus className="h-4 w-4 mr-2" />
              기기 추가
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search and View Toggle */}
      <Card className="mb-6">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

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
                              const lineDevices = buildingDevices[line.line] || [];
                              const lineKey = `${building.id}-${line.id}`;

                              return (
                                <div key={lineKey} className="mt-4">
                                  <div
                                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/30 rounded px-2"
                                    onClick={() => toggleLine(lineKey)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {expandedLines.includes(lineKey) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      <span className="font-medium">{line.line}라인</span>
                                      {lineDevices.length === 0 ? (
                                        <Badge variant="secondary" className="text-xs text-muted-foreground">
                                          등록된 기기 없음
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">
                                          {lineDevices.length} 기기
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
                                  </div>

                                  {expandedLines.includes(lineKey) && (
                                    <div className="ml-6 mt-2 space-y-2">
                                      {lineDevices.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-3 pl-4">
                                          등록된 기기가 없습니다
                                        </p>
                                      ) : (
                                        lineDevices.map((device) => (
                                    <div
                                      key={device.id}
                                      className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">
                                            {device.apartment_line_places?.placeName}
                                          </p>
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Smartphone className="h-3 w-3" />
                                            <span>Android: {device.macAddress}</span>
                                          </div>
                                          {device.iosMacAddress && (
                                            <div className="flex items-center gap-2">
                                              <TabletSmartphone className="h-3 w-3" />
                                              <span>iOS: {device.iosMacAddress}</span>
                                            </div>
                                          )}
                                          <p>Password: {device.devicePassword}</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
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
                                        ))
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
                  <TableHead>Android MAC</TableHead>
                  <TableHead>iOS MAC</TableHead>
                  <TableHead>비밀번호</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {searchTerm ? '검색 결과가 없습니다' : '등록된 기기가 없습니다'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        {device.apartment_line_places?.apartment_lines?.apartment_buildings?.buildingNumber}동
                      </TableCell>
                      <TableCell>
                        {device.apartment_line_places?.apartment_lines?.line}라인
                      </TableCell>
                      <TableCell>
                        {device.apartment_line_places?.placeName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {device.macAddress}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {device.iosMacAddress || '-'}
                      </TableCell>
                      <TableCell>{device.devicePassword}</TableCell>
                      <TableCell>
                        {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                  ))
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
                    {getSelectedBuilding()?.lines?.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.line}라인
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>설치 장소</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="예: B1 전기실"
                  value={deviceForm.placeName}
                  onChange={(e) => setDeviceForm({ ...deviceForm, placeName: e.target.value })}
                  className="flex-1"
                />
                <Select
                  value=""
                  onValueChange={(value) => setDeviceForm({ ...deviceForm, placeName: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="템플릿 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACE_TEMPLATES.map((place) => (
                      <SelectItem key={place} value={place}>
                        {place}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Android MAC Address</Label>
              <Input
                placeholder="예: AA:BB:CC:DD:EE:FF"
                value={deviceForm.macAddress}
                onChange={(e) => setDeviceForm({ ...deviceForm, macAddress: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-muted-foreground">
                Android 기기의 MAC 주소를 입력하세요
              </p>
            </div>

            <div className="space-y-2">
              <Label>iOS MAC Address (선택)</Label>
              <Input
                placeholder="예: AA:BB:CC:DD:EE:FF"
                value={deviceForm.iosMacAddress}
                onChange={(e) => setDeviceForm({ ...deviceForm, iosMacAddress: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-muted-foreground">
                iOS 기기의 MAC 주소를 입력하세요 (선택사항)
              </p>
            </div>

            <div className="space-y-2">
              <Label>비밀번호</Label>
              <Input
                type="password"
                placeholder="기기 비밀번호"
                value={deviceForm.devicePassword}
                onChange={(e) => setDeviceForm({ ...deviceForm, devicePassword: e.target.value })}
              />
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
    </div>
  );
}