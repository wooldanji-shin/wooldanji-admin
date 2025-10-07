'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Settings,
  Shield,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Cpu,
  Save,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

interface Device {
  id: string;
  macAddress: string;
  password: string;
  placeName: string;
}

interface Line {
  id: string;
  line: number;
  devices: Device[];
}

interface Building {
  id: string;
  number: string;
  householdsCount: number;
  lines: Line[];
}

interface Apartment {
  id: string;
  name: string;
  address: string;
  detailAddress?: string;
  buildings: Building[];
  createdAt: string;
  status: 'active' | 'pending' | 'inactive';
}

const AVAILABLE_LINES = [
  { value: 12, label: '12라인' },
  { value: 34, label: '34라인' },
  { value: 56, label: '56라인' },
  { value: 78, label: '78라인' },
  { value: 90, label: '90라인' },
];

const PLACE_OPTIONS = [
  'B1 전기실',
  '1F 엘리베이터홀',
  '각 층 현관문',
  '옥상',
  '지하주차장',
  '정문',
  '후문',
];

export default function ApartmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  const [expandedLines, setExpandedLines] = useState<string[]>([]);

  // Device dialog state
  const [deviceDialog, setDeviceDialog] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<string>('');
  const [deviceForm, setDeviceForm] = useState({
    placeName: '',
    macAddress: '',
    password: '',
  });

  useEffect(() => {
    fetchApartmentDetail();
  }, [params.id]);

  const fetchApartmentDetail = async () => {
    try {
      // TODO: Supabase 연동
      // 임시 데이터
      setApartment({
        id: params.id,
        name: '동부아파트',
        address: '관악구 신원로 26',
        detailAddress: '101동 옆',
        status: 'active',
        createdAt: '2024-01-15',
        buildings: [
          {
            id: '1',
            number: '101',
            householdsCount: 120,
            lines: [
              {
                id: '1-12',
                line: 12,
                devices: [
                  {
                    id: 'd1',
                    macAddress: 'AA:BB:CC:DD:EE:01',
                    password: '****',
                    placeName: 'B1 전기실',
                  },
                  {
                    id: 'd2',
                    macAddress: 'AA:BB:CC:DD:EE:02',
                    password: '****',
                    placeName: '1F 엘리베이터홀',
                  },
                ],
              },
              {
                id: '1-34',
                line: 34,
                devices: [],
              },
              {
                id: '1-56',
                line: 56,
                devices: [],
              },
            ],
          },
          {
            id: '2',
            number: '102',
            householdsCount: 120,
            lines: [
              {
                id: '2-12',
                line: 12,
                devices: [],
              },
              {
                id: '2-34',
                line: 34,
                devices: [],
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('Failed to fetch apartment detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBuilding = (buildingId: string) => {
    setExpandedBuildings(prev =>
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  const toggleLine = (lineId: string) => {
    setExpandedLines(prev =>
      prev.includes(lineId)
        ? prev.filter(id => id !== lineId)
        : [...prev, lineId]
    );
  };

  const handleAddDevice = (lineId: string) => {
    setCurrentLineId(lineId);
    setDeviceForm({
      placeName: '',
      macAddress: '',
      password: '',
    });
    setDeviceDialog(true);
  };

  const handleSaveDevice = () => {
    if (!apartment) return;

    // TODO: Supabase 연동
    const newDevice: Device = {
      id: Date.now().toString(),
      ...deviceForm,
    };

    // Update local state
    const updatedBuildings = apartment.buildings.map(building => ({
      ...building,
      lines: building.lines.map(line =>
        line.id === currentLineId
          ? { ...line, devices: [...line.devices, newDevice] }
          : line
      ),
    }));

    setApartment({ ...apartment, buildings: updatedBuildings });
    setDeviceDialog(false);
  };

  const handleDeleteDevice = (lineId: string, deviceId: string) => {
    if (!apartment) return;
    if (!confirm('정말로 이 기기를 삭제하시겠습니까?')) return;

    // TODO: Supabase 연동
    const updatedBuildings = apartment.buildings.map(building => ({
      ...building,
      lines: building.lines.map(line =>
        line.id === lineId
          ? { ...line, devices: line.devices.filter(d => d.id !== deviceId) }
          : line
      ),
    }));

    setApartment({ ...apartment, buildings: updatedBuildings });
  };

  const handleSaveBasicInfo = () => {
    // TODO: Supabase 연동
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="p-8">
        <Alert>
          <AlertDescription>아파트 정보를 찾을 수 없습니다.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/apartments')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{apartment.name}</h1>
            <p className="text-muted-foreground mt-1">{apartment.address}</p>
          </div>
          <Badge variant={apartment.status === 'active' ? 'default' : 'secondary'}>
            {apartment.status === 'active' ? '활성' : '비활성'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">기본 정보</TabsTrigger>
          <TabsTrigger value="buildings">동 관리</TabsTrigger>
          <TabsTrigger value="devices">기기 관리</TabsTrigger>
          <TabsTrigger value="permissions">권한 설정</TabsTrigger>
        </TabsList>

        {/* Tab 1: 기본 정보 */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    <MapPin className="inline-block mr-2 h-5 w-5" />
                    기본 정보
                  </CardTitle>
                  <CardDescription>
                    아파트의 기본 정보를 확인하고 수정할 수 있습니다
                  </CardDescription>
                </div>
                {!editMode ? (
                  <Button onClick={() => setEditMode(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    수정
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      취소
                    </Button>
                    <Button onClick={handleSaveBasicInfo}>
                      <Save className="h-4 w-4 mr-2" />
                      저장
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>아파트명</Label>
                  <Input
                    value={apartment.name}
                    onChange={(e) => setApartment({ ...apartment, name: e.target.value })}
                    disabled={!editMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>상태</Label>
                  <Select
                    value={apartment.status}
                    onValueChange={(value: any) => setApartment({ ...apartment, status: value })}
                    disabled={!editMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">활성</SelectItem>
                      <SelectItem value="inactive">비활성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>주소</Label>
                <Input
                  value={apartment.address}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>상세주소</Label>
                <Input
                  value={apartment.detailAddress || ''}
                  onChange={(e) => setApartment({ ...apartment, detailAddress: e.target.value })}
                  disabled={!editMode}
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label>총 동수</Label>
                  <p className="text-2xl font-bold mt-1">{apartment.buildings.length}동</p>
                </div>
                <div>
                  <Label>총 세대수</Label>
                  <p className="text-2xl font-bold mt-1">
                    {apartment.buildings.reduce((acc, b) => acc + b.householdsCount, 0)}세대
                  </p>
                </div>
                <div>
                  <Label>등록일</Label>
                  <p className="text-2xl font-bold mt-1">{apartment.createdAt}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: 동 관리 */}
        <TabsContent value="buildings">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    <Building2 className="inline-block mr-2 h-5 w-5" />
                    동 관리
                  </CardTitle>
                  <CardDescription>
                    각 동의 정보와 라인을 관리합니다
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  동 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apartment.buildings.map((building) => (
                  <Card key={building.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold">{building.number}동</h3>
                          <Badge variant="outline">{building.householdsCount}세대</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>라인 설정</Label>
                        <div className="flex gap-3">
                          {AVAILABLE_LINES.map((line) => (
                            <div key={line.value} className="flex items-center space-x-2">
                              <Checkbox
                                checked={building.lines.some(l => l.line === line.value)}
                                disabled
                              />
                              <Label className="text-sm font-normal">
                                {line.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: 기기 관리 */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  <Cpu className="inline-block mr-2 h-5 w-5" />
                  기기 관리
                </CardTitle>
                <CardDescription>
                  각 라인에 설치된 기기를 관리합니다
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apartment.buildings.map((building) => (
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
                        <span className="font-semibold">{building.number}동</span>
                        <Badge variant="outline">
                          {building.lines.reduce((acc, l) => acc + l.devices.length, 0)} 기기
                        </Badge>
                      </div>
                    </div>

                    {expandedBuildings.includes(building.id) && (
                      <div className="border-t px-4 pb-4">
                        {building.lines.map((line) => (
                          <div key={line.id} className="mt-4">
                            <div
                              className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/30 rounded px-2"
                              onClick={() => toggleLine(line.id)}
                            >
                              <div className="flex items-center gap-2">
                                {expandedLines.includes(line.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-medium">{line.line}라인</span>
                                <Badge variant="secondary">
                                  {line.devices.length} 기기
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddDevice(line.id);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {expandedLines.includes(line.id) && (
                              <div className="ml-6 mt-2 space-y-2">
                                {line.devices.length === 0 ? (
                                  <p className="text-sm text-muted-foreground py-2">
                                    등록된 기기가 없습니다
                                  </p>
                                ) : (
                                  line.devices.map((device) => (
                                    <div
                                      key={device.id}
                                      className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium">{device.placeName}</p>
                                        <div className="text-sm text-muted-foreground">
                                          <p>MAC: {device.macAddress}</p>
                                          <p>Password: {device.password}</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="sm">
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteDevice(line.id, device.id)}
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
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: 권한 설정 */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  <Shield className="inline-block mr-2 h-5 w-5" />
                  권한 설정
                </CardTitle>
                <CardDescription>
                  아파트 관리자 권한을 설정합니다
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">권한 설정 기능은 준비 중입니다.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Device Dialog */}
      <Dialog open={deviceDialog} onOpenChange={setDeviceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>기기 추가</DialogTitle>
            <DialogDescription>
              새로운 기기 정보를 입력해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>설치 장소</Label>
              <Select
                value={deviceForm.placeName}
                onValueChange={(value) => setDeviceForm({ ...deviceForm, placeName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="장소를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {PLACE_OPTIONS.map((place) => (
                    <SelectItem key={place} value={place}>
                      {place}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MAC Address</Label>
              <Input
                placeholder="예: AA:BB:CC:DD:EE:FF"
                value={deviceForm.macAddress}
                onChange={(e) => setDeviceForm({ ...deviceForm, macAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>비밀번호</Label>
              <Input
                type="password"
                placeholder="기기 비밀번호"
                value={deviceForm.password}
                onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceDialog(false)}>
              취소
            </Button>
            <Button onClick={handleSaveDevice}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}