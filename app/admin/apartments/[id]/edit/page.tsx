'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Building2 } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { parseMultipleLineRanges, formatLineRange } from '@/lib/utils/line';

interface Building {
  id: string;
  buildingNumber: number;
  householdsCount: number;
  lines: Line[];
}

interface Line {
  id: string;
  line: number[];
}

interface ApartmentDetails {
  id: string;
  name: string;
  address: string;
  buildings: Building[];
}

export default function EditApartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [apartment, setApartment] = useState<ApartmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 편집할 데이터
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [buildings, setBuildings] = useState<Building[]>([]);

  // 새로운 라인 추가 상태
  const [newLines, setNewLines] = useState<Record<string, string>>({});

  // 주소 검색
  const handleAddressSearch = () => {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setAddress(data.roadAddress || data.jibunAddress);
      }
    }).open();
  };

  // 라인 삭제 다이얼로그
  const [deleteLineDialog, setDeleteLineDialog] = useState(false);
  const [deletingLine, setDeletingLine] = useState<{ buildingId: string; lineId: string; lineRange: string } | null>(null);

  useEffect(() => {
    fetchApartment();
  }, [resolvedParams.id]);

  const fetchApartment = async () => {
    try {
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select(`
          id,
          name,
          address,
          apartment_buildings (
            id,
            buildingNumber,
            householdsCount,
            apartment_lines (
              id,
              line
            )
          )
        `)
        .eq('id', resolvedParams.id)
        .single();

      if (apartmentError) throw apartmentError;

      const formattedApartment: ApartmentDetails = {
        id: (apartmentData as any).id,
        name: (apartmentData as any).name,
        address: (apartmentData as any).address,
        buildings: ((apartmentData as any).apartment_buildings || []).map((b: any) => ({
          id: b.id,
          buildingNumber: b.buildingNumber,
          householdsCount: b.householdsCount,
          lines: (b.apartment_lines || []).map((l: any) => ({
            id: l.id,
            line: l.line,
          })),
        })),
      };

      setApartment(formattedApartment);
      setName(formattedApartment.name);
      setAddress(formattedApartment.address);
      setBuildings(formattedApartment.buildings);
    } catch (err) {
      console.error('Failed to fetch apartment:', err);
      setError('아파트 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateBuildingNumber = (buildingId: string, newNumber: number) => {
    setBuildings(buildings.map(b =>
      b.id === buildingId ? { ...b, buildingNumber: newNumber } : b
    ));
  };

  const updateHouseholdsCount = (buildingId: string, newCount: number) => {
    setBuildings(buildings.map(b =>
      b.id === buildingId ? { ...b, householdsCount: newCount } : b
    ));
  };

  const handleAddLine = async (buildingId: string) => {
    const lineInput = newLines[buildingId];
    if (!lineInput || !lineInput.trim()) return;

    // 쉼표로 구분된 여러 범위를 파싱 (예: "1~2, 3~7" → [[1,2], [3,4,5,6,7]])
    const lineRanges = parseMultipleLineRanges(lineInput);

    if (lineRanges.length === 0) {
      alert('올바른 라인 번호를 입력하세요. (예: 1~4 또는 1~2, 3~7)');
      return;
    }

    // 현재 동의 기존 라인들과 중복 체크
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return;

    // 기존 라인들의 번호들을 모두 flat하게 가져옴
    const existingLineNumbers = building.lines.flatMap(l => l.line);

    // 중복 체크
    const allNewNumbers = lineRanges.flat();
    const duplicates = allNewNumbers.filter(num => existingLineNumbers.includes(num));
    if (duplicates.length > 0) {
      alert(`${duplicates.join(', ')}라인은 이미 존재합니다.`);
      return;
    }

    try {
      // 각 범위를 별도의 라인 row로 추가
      const linesToInsert = lineRanges.map(range => ({
        buildingId,
        line: range,
      }));

      const { data: insertedLines, error: lineError } = await supabase
        .from('apartment_lines')
        .insert(linesToInsert)
        .select();

      if (lineError) throw lineError;

      // 로컬 상태 업데이트
      const addedLines: Line[] = (insertedLines as any[]).map(l => ({
        id: l.id,
        line: l.line,
      }));

      setBuildings(buildings.map(b =>
        b.id === buildingId
          ? {
              ...b,
              lines: [...b.lines, ...addedLines],
            }
          : b
      ));

      setNewLines({ ...newLines, [buildingId]: '' });
    } catch (err) {
      console.error('Failed to add line:', err);
      alert('라인 추가에 실패했습니다.');
    }
  };

  const handleDeleteLineClick = (buildingId: string, lineId: string, lineRange: string) => {
    setDeletingLine({ buildingId, lineId, lineRange });
    setDeleteLineDialog(true);
  };

  const handleDeleteLineConfirm = async () => {
    if (!deletingLine) return;

    try {
      const { error: deleteError } = await supabase
        .from('apartment_lines')
        .delete()
        .eq('id', deletingLine.lineId);

      if (deleteError) throw deleteError;

      // 로컬 상태 업데이트
      setBuildings(buildings.map(b =>
        b.id === deletingLine.buildingId
          ? { ...b, lines: b.lines.filter(l => l.id !== deletingLine.lineId) }
          : b
      ));

      setDeleteLineDialog(false);
      setDeletingLine(null);
    } catch (err) {
      console.error('Failed to delete line:', err);
      setError('라인 삭제에 실패했습니다.');
    }
  };

  const handleAddBuilding = async () => {
    try {
      const { data: newBuilding, error: buildingError } = await supabase
        .from('apartment_buildings')
        .insert({
          apartmentId: resolvedParams.id,
          buildingNumber: 0,
          householdsCount: 0,
        })
        .select()
        .single();

      if (buildingError) throw buildingError;

      // 로컬 상태 업데이트
      setBuildings([
        ...buildings,
        {
          id: (newBuilding as any).id,
          buildingNumber: 0,
          householdsCount: 0,
          lines: [],
        },
      ]);
    } catch (err) {
      console.error('Failed to add building:', err);
      alert('동 추가에 실패했습니다.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // 1. 아파트 기본 정보 업데이트
      const { error: apartmentError } = await supabase
        .from('apartments')
        .update({
          name,
          address,
        })
        .eq('id', resolvedParams.id);

      if (apartmentError) throw apartmentError;

      // 2. 각 동의 정보 업데이트
      for (const building of buildings) {
        const { error: buildingError } = await supabase
          .from('apartment_buildings')
          .update({
            buildingNumber: building.buildingNumber,
            householdsCount: building.householdsCount,
          })
          .eq('id', building.id);

        if (buildingError) throw buildingError;
      }

      router.push('/admin/apartments');
    } catch (err) {
      console.error('Failed to save apartment:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
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
        <Card>
          <CardContent className="text-center py-8">
            아파트 정보를 찾을 수 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold tracking-tight">아파트 설정</h1>
            <p className="text-muted-foreground mt-1">
              아파트 정보를 수정합니다
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>아파트의 기본 정보를 수정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>아파트명</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="아파트명"
            />
          </div>
          <div className="space-y-2">
            <Label>주소</Label>
            <div className="flex gap-2">
              <Input
                value={address}
                readOnly
                placeholder="주소를 검색해주세요"
              />
              <Button type="button" onClick={handleAddressSearch}>
                주소 검색
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buildings */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <Building2 className="inline-block mr-2 h-5 w-5" />
              동 및 라인 관리
            </CardTitle>
            <CardDescription>각 동의 정보와 라인을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {buildings.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    등록된 동이 없습니다. '동 추가하기' 버튼을 클릭하여 동을 추가해주세요.
                  </AlertDescription>
                </Alert>
              ) : (
                buildings.map((building) => (
                  <Card key={building.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>동 번호</Label>
                            <Input
                              type="number"
                              value={building.buildingNumber === 0 ? '' : building.buildingNumber}
                              onChange={(e) =>
                                updateBuildingNumber(building.id, parseInt(e.target.value) || 0)
                              }
                              placeholder="동 번호 입력"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>세대수</Label>
                            <Input
                              type="number"
                              value={building.householdsCount === 0 ? '' : building.householdsCount}
                              onChange={(e) =>
                                updateHouseholdsCount(building.id, parseInt(e.target.value) || 0)
                              }
                              placeholder="세대수 입력"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>라인 목록</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {building.lines.length === 0 ? (
                              <p className="text-sm text-muted-foreground">등록된 라인이 없습니다</p>
                            ) : (
                              building.lines.map((line) => {
                                const lineRange = formatLineRange(line.line);
                                return (
                                  <Badge key={line.id} variant="secondary" className="flex items-center gap-2">
                                    {lineRange}라인
                                    <button
                                      onClick={() => handleDeleteLineClick(building.id, line.id, lineRange)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="라인 번호 (예: 1~2, 3~7, 8~10)"
                              value={newLines[building.id] || ''}
                              onChange={(e) => {
                                // 숫자, 쉼표, 물결표, 하이픈, 공백만 허용
                                const value = e.target.value.replace(/[^0-9,~\-\s]/g, '');
                                setNewLines({ ...newLines, [building.id]: value });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddLine(building.id);
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddLine(building.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              라인 추가
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleAddBuilding} className="w-full" variant="outline" size="lg">
          <Plus className="h-4 w-4 mr-2" />
          동 추가하기
        </Button>
      </div>

      {/* Delete Line Confirmation Dialog */}
      <Dialog open={deleteLineDialog} onOpenChange={setDeleteLineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>라인 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingLine?.lineRange}라인</strong>을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 해당 라인의 모든 데이터(장소, 기기)가 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLineDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteLineConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
