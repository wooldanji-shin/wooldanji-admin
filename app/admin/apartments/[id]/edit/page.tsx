'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Building2, AlertCircle } from 'lucide-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { DetailSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
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
    return <DetailSkeleton sections={2} />;
  }

  if (!apartment) {
    return (
      <PageShell>
        <Paper withBorder radius="md" py={48} px="lg">
          <Text ta="center" c="dimmed">
            아파트 정보를 찾을 수 없습니다.
          </Text>
        </Paper>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderTitle
        title="아파트 설정"
        onBack={() => {
          if (hasChanges) {
            setBackConfirmDialog(true);
          } else {
            router.push('/admin/apartments');
          }
        }}
      />
      <Group gap="sm">
        <Text size="sm" c="dimmed">
          아파트 정보와 구조를 관리합니다
        </Text>
        {hasChanges && (
          <Badge variant="light" color="yellow">
            저장 안됨
          </Badge>
        )}
      </Group>

      {/* Basic Info */}
      <Paper withBorder radius="md" p="lg">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={4}>기본 정보</Title>
            <Text size="sm" c="dimmed">아파트의 기본 정보를 수정합니다</Text>
          </Stack>
          <TextInput
            label="아파트명"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
            }}
            placeholder="아파트명"
          />
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput
              label="주소"
              value={address}
              readOnly
              placeholder="주소를 검색해주세요"
              style={{ flex: 1 }}
            />
            <Button type="button" onClick={handleAddressSearch}>
              주소 검색
            </Button>
          </Group>
        </Stack>
      </Paper>

      {/* Buildings */}
      <Stack gap="md">
        <Paper withBorder radius="md" p="lg">
          <Stack gap="lg">
            <Stack gap={4}>
              <Group gap="xs">
                <Building2 size={20} />
                <Title order={4}>동 및 라인 관리</Title>
              </Group>
              <Text size="sm" c="dimmed">각 동의 정보와 라인을 관리합니다</Text>
            </Stack>

            {buildings.length === 0 ? (
              <Text ta="center" c="dimmed" py="xl">
                등록된 동이 없습니다. &apos;동 추가하기&apos; 버튼을 클릭하여 동을 추가해주세요.
              </Text>
            ) : (
              buildings.map((building) => (
                <Paper
                  key={building.id}
                  withBorder
                  radius="md"
                  p="md"
                  style={building.isNew ? { borderColor: 'var(--mantine-color-blue-3)' } : undefined}
                >
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="xs">
                        {building.isNew && (
                          <Badge variant="light" color="blue">
                            신규
                          </Badge>
                        )}
                        <Text size="sm" c="dimmed">
                          {building.buildingNumber}동 {building.lines.length > 0 && `· ${building.lines.length}개 라인`}
                        </Text>
                      </Group>
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        leftSection={<Trash2 size={16} />}
                        onClick={() => handleDeleteBuilding(building.id)}
                      >
                        동 삭제
                      </Button>
                    </Group>
                    <SimpleGrid cols={2} spacing="md">
                      <TextInput
                        label="동 번호"
                        type="number"
                        value={building.buildingNumber === 0 ? '' : building.buildingNumber}
                        onChange={(e) =>
                          updateBuildingNumber(building.id, parseInt(e.target.value) || 0)
                        }
                        placeholder="동 번호 입력"
                      />
                      <TextInput
                        label="세대수"
                        type="number"
                        value={building.householdsCount === 0 ? '' : building.householdsCount}
                        onChange={(e) =>
                          updateHouseholdsCount(building.id, parseInt(e.target.value) || 0)
                        }
                        placeholder="세대수 입력"
                      />
                    </SimpleGrid>

                    <Stack gap="xs">
                      <Text size="sm" fw={500}>라인 목록</Text>
                      <Group gap="xs">
                        {building.lines.length === 0 ? (
                          <Text size="sm" c="dimmed">등록된 라인이 없습니다</Text>
                        ) : (
                          building.lines.map((line) => {
                            const lineRange = formatLineRange(line.line);
                            return (
                              <Badge
                                key={line.id}
                                variant="light"
                                color={line.isNew ? 'blue' : 'gray'}
                                size="lg"
                                tt="none"
                                rightSection={
                                  <ActionIcon
                                    size="xs"
                                    variant="transparent"
                                    color="red"
                                    aria-label="라인 삭제"
                                    onClick={() => handleDeleteLineClick(building.id, line.id, lineRange)}
                                  >
                                    <Trash2 size={12} />
                                  </ActionIcon>
                                }
                              >
                                {lineRange}라인
                                {line.isNew && <Text span size="xs" ml={4}>(신규)</Text>}
                              </Badge>
                            );
                          })
                        )}
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <TextInput
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
                          style={{ flex: 1 }}
                        />
                        <Button
                          variant="default"
                          leftSection={<Plus size={16} />}
                          onClick={() => handleAddLine(building.id)}
                        >
                          라인 추가
                        </Button>
                      </Group>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        </Paper>

        <Button
          onClick={handleAddBuilding}
          fullWidth
          variant="default"
          size="md"
          leftSection={<Plus size={16} />}
        >
          동 추가하기
        </Button>
      </Stack>

      {/* Sticky Bottom Save Button */}
      {hasChanges && (
        <Box
          pos="fixed"
          bottom={0}
          left="var(--app-shell-navbar-offset, 0px)"
          right={0}
          p="md"
          bg="var(--mantine-color-body)"
          style={{
            zIndex: 10,
            borderTop: '1px solid var(--app-divider)',
          }}
        >
          <Group justify="space-between" maw={1280} mx="auto">
            <Group gap="xs">
              <ThemeIcon variant="transparent" color="orange" size="sm">
                <AlertCircle size={16} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">저장하지 않은 변경사항이 있습니다</Text>
            </Group>
            <Button onClick={handleSave} disabled={saving} size="md">
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Group>
        </Box>
      )}

      {/* Delete Line Confirmation Dialog */}
      <Modal opened={deleteLineDialog} onClose={() => setDeleteLineDialog(false)} title="라인 삭제">
        <Text size="sm" c="dimmed">
          정말로 <strong>{deletingLine?.lineRange}라인</strong>을 삭제하시겠습니까?
          <br />
          이 작업은 되돌릴 수 없으며, 해당 라인의 모든 데이터(장소, 기기)가 삭제됩니다.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteLineDialog(false)}>
            취소
          </Button>
          <Button color="red" onClick={handleDeleteLineConfirm}>
            삭제
          </Button>
        </Group>
      </Modal>

      {/* Delete Building Confirmation Dialog */}
      <Modal opened={deleteBuildingDialog} onClose={() => setDeleteBuildingDialog(false)} title="동 삭제">
        <Text size="sm" c="dimmed">
          정말로 <strong>{deletingBuilding?.buildingNumber}동</strong>을 삭제하시겠습니까?
        </Text>
        {deletingBuilding && deletingBuilding.linesCount > 0 && (
          <Alert color="red" variant="light" mt="md">
            <Text size="sm" c="red">
              이 동에는 <strong>{deletingBuilding.linesCount}개의 라인</strong>이 있습니다.
              <br />
              동을 삭제하면 모든 라인과 해당 라인의 데이터(장소, 기기)도 함께 삭제됩니다.
            </Text>
          </Alert>
        )}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => {
            setDeleteBuildingDialog(false);
            setDeletingBuilding(null);
          }}>
            취소
          </Button>
          <Button color="red" onClick={confirmDeleteBuilding}>
            삭제
          </Button>
        </Group>
      </Modal>

      {/* Back Confirmation Dialog */}
      <Modal opened={backConfirmDialog} onClose={() => setBackConfirmDialog(false)} title="저장하지 않은 변경사항">
        <Text size="sm" c="dimmed">
          저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setBackConfirmDialog(false)}>
            취소
          </Button>
          <Button color="red" onClick={() => {
            setBackConfirmDialog(false);
            router.push('/admin/apartments');
          }}>
            나가기
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
