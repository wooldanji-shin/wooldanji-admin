'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Building2, AlertCircle } from 'lucide-react';
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
import { toast } from 'sonner';
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
  isNew?: boolean; // 새로 추가된 동인지 표시
}

interface Line {
  id: string;
  line: number[];
  isNew?: boolean; // 새로 추가된 라인인지 표시
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
  const [hasChanges, setHasChanges] = useState(false);

  // 편집할 데이터
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [deletedBuildingIds, setDeletedBuildingIds] = useState<string[]>([]);
  const [deletedLineIds, setDeletedLineIds] = useState<string[]>([]);

  // 새로운 라인 추가 상태
  const [newLines, setNewLines] = useState<Record<string, string>>({});

  // 주소 검색
  const handleAddressSearch = () => {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setAddress(data.roadAddress || data.jibunAddress);
        setHasChanges(true);
      }
    }).open();
  };

  // 변경사항 있을 때 페이지 나가기 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // 라인 삭제 다이얼로그
  const [deleteLineDialog, setDeleteLineDialog] = useState(false);
  const [deletingLine, setDeletingLine] = useState<{ buildingId: string; lineId: string; lineRange: string } | null>(null);

  // 동 삭제 다이얼로그
  const [deleteBuildingDialog, setDeleteBuildingDialog] = useState(false);
  const [deletingBuilding, setDeletingBuilding] = useState<{ id: string; buildingNumber: number; linesCount: number } | null>(null);

  // 뒤로가기 확인 다이얼로그
  const [backConfirmDialog, setBackConfirmDialog] = useState(false);

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
      toast.error('아파트 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateBuildingNumber = (buildingId: string, newNumber: number) => {
    setBuildings(buildings.map(b =>
      b.id === buildingId ? { ...b, buildingNumber: newNumber } : b
    ));
    setHasChanges(true);
  };

  const updateHouseholdsCount = (buildingId: string, newCount: number) => {
    setBuildings(buildings.map(b =>
      b.id === buildingId ? { ...b, householdsCount: newCount } : b
    ));
    setHasChanges(true);
  };

  const handleAddLine = (buildingId: string) => {
    const lineInput = newLines[buildingId];
    if (!lineInput || !lineInput.trim()) return;

    // 쉼표로 구분된 여러 범위를 파싱 (예: "1~2, 3~7" → [[1,2], [3,4,5,6,7]])
    const lineRanges = parseMultipleLineRanges(lineInput);

    if (lineRanges.length === 0) {
      toast.error('올바른 라인 번호를 입력하세요. (예: 1~4 또는 1~2, 3~7)');
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
      toast.error(`${duplicates.join(', ')}라인은 이미 존재합니다.`);
      return;
    }

    // 로컬 상태에만 추가 (임시 ID 생성)
    const addedLines: Line[] = lineRanges.map(range => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      line: range,
      isNew: true,
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
    setHasChanges(true);
  };

  const handleDeleteLineClick = (buildingId: string, lineId: string, lineRange: string) => {
    setDeletingLine({ buildingId, lineId, lineRange });
    setDeleteLineDialog(true);
  };

  const handleDeleteLineConfirm = () => {
    if (!deletingLine) return;

    const line = buildings
      .find(b => b.id === deletingLine.buildingId)
      ?.lines.find(l => l.id === deletingLine.lineId);

    // 기존 라인이면 삭제 목록에 추가
    if (line && !line.isNew) {
      setDeletedLineIds([...deletedLineIds, deletingLine.lineId]);
    }

    // 로컬 상태에서 제거
    setBuildings(buildings.map(b =>
      b.id === deletingLine.buildingId
        ? { ...b, lines: b.lines.filter(l => l.id !== deletingLine.lineId) }
        : b
    ));

    setDeleteLineDialog(false);
    setDeletingLine(null);
    setHasChanges(true);
  };

  const handleAddBuilding = () => {
    // 로컬 상태에만 추가 (임시 ID 생성)
    const newBuilding: Building = {
      id: `temp-${Date.now()}-${Math.random()}`,
      buildingNumber: 0,
      householdsCount: 0,
      lines: [],
      isNew: true,
    };

    setBuildings([...buildings, newBuilding]);
    setHasChanges(true);
  };

  const handleDeleteBuilding = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return;

    setDeletingBuilding({
      id: buildingId,
      buildingNumber: building.buildingNumber,
      linesCount: building.lines.length,
    });
    setDeleteBuildingDialog(true);
  };

  const confirmDeleteBuilding = () => {
    if (!deletingBuilding) return;

    const building = buildings.find(b => b.id === deletingBuilding.id);
    if (!building) return;

    // 해당 동의 라인도 삭제 목록에 추가
    building.lines.forEach(line => {
      if (!line.isNew) {
        setDeletedLineIds(prev => [...prev, line.id]);
      }
    });

    // 기존 동이면 삭제 목록에 추가
    if (!building.isNew) {
      setDeletedBuildingIds([...deletedBuildingIds, deletingBuilding.id]);
    }

    // 로컬 상태에서 제거
    setBuildings(buildings.filter(b => b.id !== deletingBuilding.id));
    setHasChanges(true);
    setDeleteBuildingDialog(false);
    setDeletingBuilding(null);
  };

  const handleSave = async () => {
    // 폼 검증
    if (!name.trim()) {
      toast.error('아파트명을 입력해주세요.');
      return;
    }

    if (!address.trim()) {
      toast.error('주소를 입력해주세요.');
      return;
    }

    // 동 번호 검증
    const buildingNumbers = buildings.map(b => b.buildingNumber);
    const invalidBuildings = buildings.filter(b => b.buildingNumber === 0);
    if (invalidBuildings.length > 0) {
      toast.error('모든 동의 번호를 1 이상으로 입력해주세요.');
      return;
    }

    // 동 번호 중복 검증
    const duplicates = buildingNumbers.filter((num, index) => buildingNumbers.indexOf(num) !== index);
    if (duplicates.length > 0) {
      toast.error(`동 번호가 중복되었습니다: ${duplicates.join(', ')}동`);
      return;
    }

    setSaving(true);

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

      // 2. 삭제된 라인 삭제
      if (deletedLineIds.length > 0) {
        const { error: deleteLineError } = await supabase
          .from('apartment_lines')
          .delete()
          .in('id', deletedLineIds);

        if (deleteLineError) throw deleteLineError;
      }

      // 3. 삭제된 동 삭제
      if (deletedBuildingIds.length > 0) {
        const { error: deleteBuildingError } = await supabase
          .from('apartment_buildings')
          .delete()
          .in('id', deletedBuildingIds);

        if (deleteBuildingError) throw deleteBuildingError;
      }

      // 4. 기존 동 업데이트 & 새 동 추가
      for (const building of buildings) {
        if (building.isNew) {
          // 새 동 추가
          const { data: newBuilding, error: insertError } = await supabase
            .from('apartment_buildings')
            .insert({
              apartmentId: resolvedParams.id,
              buildingNumber: building.buildingNumber,
              householdsCount: building.householdsCount,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // 새 동의 라인 추가
          const newLines = building.lines.filter(l => l.isNew);
          if (newLines.length > 0) {
            const linesToInsert = newLines.map(line => ({
              buildingId: (newBuilding as any).id,
              line: line.line,
            }));

            const { error: lineInsertError } = await supabase
              .from('apartment_lines')
              .insert(linesToInsert);

            if (lineInsertError) throw lineInsertError;
          }
        } else {
          // 기존 동 업데이트
          const { error: updateError } = await supabase
            .from('apartment_buildings')
            .update({
              buildingNumber: building.buildingNumber,
              householdsCount: building.householdsCount,
            })
            .eq('id', building.id);

          if (updateError) throw updateError;

          // 기존 동의 새 라인 추가
          const newLines = building.lines.filter(l => l.isNew);
          if (newLines.length > 0) {
            const linesToInsert = newLines.map(line => ({
              buildingId: building.id,
              line: line.line,
            }));

            const { error: lineInsertError } = await supabase
              .from('apartment_lines')
              .insert(linesToInsert);

            if (lineInsertError) throw lineInsertError;
          }
        }
      }

      setHasChanges(false);
      toast.success('아파트 정보가 저장되었습니다.');
      router.push('/admin/apartments');
    } catch (err) {
      console.error('Failed to save apartment:', err);
      toast.error('저장에 실패했습니다.');
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
    <div className="p-8 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-8 px-8 -mt-8 pt-8 mb-8 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (hasChanges) {
              setBackConfirmDialog(true);
            } else {
              router.push('/admin/apartments');
            }
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">아파트 설정</h1>
              {hasChanges && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  저장 안됨
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              아파트 정보와 구조를 관리합니다
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || !hasChanges} size="lg">
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

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
              onChange={(e) => {
                setName(e.target.value);
                setHasChanges(true);
              }}
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
                <p className="text-center text-muted-foreground py-8">
                  등록된 동이 없습니다. '동 추가하기' 버튼을 클릭하여 동을 추가해주세요.
                </p>
              ) : (
                buildings.map((building) => (
                  <Card key={building.id} className={building.isNew ? 'border-blue-200' : ''}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {building.isNew && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                신규
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {building.buildingNumber}동 {building.lines.length > 0 && `· ${building.lines.length}개 라인`}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBuilding(building.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            동 삭제
                          </Button>
                        </div>
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
                                  <Badge
                                    key={line.id}
                                    variant={line.isNew ? "outline" : "secondary"}
                                    className={`flex items-center gap-2 ${line.isNew ? 'border-blue-600 text-blue-600' : ''}`}
                                  >
                                    {lineRange}라인
                                    {line.isNew && <span className="text-xs">(신규)</span>}
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

      {/* Sticky Bottom Save Button */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4">
          <div className="container max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <span className="text-muted-foreground">저장하지 않은 변경사항이 있습니다</span>
            </div>
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      )}

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

      {/* Delete Building Confirmation Dialog */}
      <Dialog open={deleteBuildingDialog} onOpenChange={setDeleteBuildingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>동 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingBuilding?.buildingNumber}동</strong>을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {deletingBuilding && deletingBuilding.linesCount > 0 && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                이 동에는 <strong>{deletingBuilding.linesCount}개의 라인</strong>이 있습니다.
                <br />
                동을 삭제하면 모든 라인과 해당 라인의 데이터(장소, 기기)도 함께 삭제됩니다.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteBuildingDialog(false);
              setDeletingBuilding(null);
            }}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBuilding}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back Confirmation Dialog */}
      <Dialog open={backConfirmDialog} onOpenChange={setBackConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>저장하지 않은 변경사항</DialogTitle>
            <DialogDescription>
              저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackConfirmDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => {
              setBackConfirmDialog(false);
              router.push('/admin/apartments');
            }}>
              나가기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
