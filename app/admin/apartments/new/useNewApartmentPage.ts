'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatLineRange, parseMultipleLineRanges } from '@/lib/utils/line';
import { confirmModal } from '@/components/confirm-modal';
import type {
  BasicInfoErrors,
  BuildingDraft,
  BuildingErrors,
  BuildingField,
  BulkDraft,
  BulkErrors,
  NewApartmentSummary,
  UseNewApartmentPageReturn,
} from './types';
import { getSessionUser } from '@/lib/auth';
import { useInvalidateLookup } from '@/lib/hooks/useLookups';

const LIST_PATH = '/admin/apartments';
const BULK_MAX = 100;
const EMPTY_BULK: BulkDraft = { from: '', to: '', householdsCount: 0, lines: '' };

interface DaumPostcodeResult {
  roadAddress: string;
  jibunAddress: string;
}

/** 라인 입력을 묶음 단위로 해석한다. 틀린 조각이 하나라도 있으면 error를 돌려준다. */
function parseLines(input: string): { groups: number[][]; error?: string } {
  if (!input.trim()) return { groups: [], error: '라인 번호를 입력해주세요' };

  const parts = input.split(',').map((part) => part.trim()).filter(Boolean);
  const groups: number[][] = [];
  for (const part of parts) {
    const parsed = parseMultipleLineRanges(part);
    if (parsed.length === 0) {
      return { groups: [], error: `'${part}'은(는) 올바른 라인이 아닙니다 (1~99, 범위는 작은 수부터)` };
    }
    groups.push(parsed[0]);
  }

  const all = groups.flat();
  if (new Set(all).size !== all.length) return { groups: [], error: '겹치는 라인이 있습니다' };
  return { groups };
}

function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** 숫자, 쉼표, 물결표, 하이픈, 공백만 허용 */
function onlyLineChars(value: string): string {
  return value.replace(/[^0-9,~\-\s]/g, '');
}

function newId(): string {
  return crypto.randomUUID();
}

export function useNewApartmentPage(): UseNewApartmentPageReturn {
  const router = useRouter();
  const supabase = createClient();
  const invalidateLookup = useInvalidateLookup();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Step 1: 기본 정보
  const [apartmentName, setApartmentName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [step1Tried, setStep1Tried] = useState<boolean>(false);

  // Step 2: 동 정보
  const [buildings, setBuildings] = useState<BuildingDraft[]>([]);
  const [step2Tried, setStep2Tried] = useState<boolean>(false);

  // 여러 동 한 번에 추가
  const [bulkOpened, setBulkOpened] = useState<boolean>(false);
  const [bulkDraft, setBulkDraft] = useState<BulkDraft>(EMPTY_BULK);
  const [bulkTried, setBulkTried] = useState<boolean>(false);

  const isDirty = apartmentName.trim() !== '' || address !== '' || buildings.length > 0;

  // 작성 중에 새로고침·탭 닫기를 하면 브라우저가 한 번 더 묻는다
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (isDirty && !loading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, loading]);

  // ───── Step 1 ─────
  const openAddressSearch = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (window as any).daum.Postcode({
      oncomplete: (data: DaumPostcodeResult) => {
        setAddress(data.roadAddress || data.jibunAddress);
      },
    }).open();
  };

  const basicErrors = useMemo<BasicInfoErrors>(() => {
    const errors: BasicInfoErrors = {};
    if (!apartmentName.trim()) errors.name = '아파트명을 입력해주세요';
    if (!address) errors.address = '주소를 검색해주세요';
    return errors;
  }, [apartmentName, address]);

  const goNext = (): void => {
    setStep1Tried(true);
    if (Object.keys(basicErrors).length > 0) return;
    setStep(2);
  };

  const goPrev = (): void => setStep(1);

  // ───── Step 2 ─────
  const addBuilding = (): void => {
    // 이전 동 번호 + 1, 같은 라인을 미리 채워 둔다 (세대수는 동마다 달라 비워 둔다)
    const last = buildings[buildings.length - 1];
    const nextNumber = last && /^\d+$/.test(last.number) ? String(Number(last.number) + 1) : '';
    setBuildings([...buildings, { id: newId(), number: nextNumber, householdsCount: 0, lines: last?.lines ?? '' }]);
  };

  const removeBuilding = (id: string): void => {
    setBuildings(buildings.filter((b) => b.id !== id));
  };

  const updateBuilding = (id: string, field: BuildingField, value: string | number): void => {
    const next =
      field === 'number' ? onlyDigits(String(value)) : field === 'lines' ? onlyLineChars(String(value)) : value;
    setBuildings(buildings.map((b) => (b.id === id ? { ...b, [field]: next } : b)));
  };

  const allBuildingErrors = useMemo<Record<string, BuildingErrors>>(() => {
    const counts = new Map<string, number>();
    buildings.forEach((b) => b.number && counts.set(b.number, (counts.get(b.number) ?? 0) + 1));

    const result: Record<string, BuildingErrors> = {};
    buildings.forEach((b) => {
      const errors: BuildingErrors = {};
      if (!b.number) errors.number = '동 번호를 입력해주세요';
      else if ((counts.get(b.number) ?? 0) > 1) errors.number = '같은 동 번호가 있습니다';
      if (!(b.householdsCount > 0)) errors.householdsCount = '세대수를 입력해주세요';
      const lineError = parseLines(b.lines).error;
      if (lineError) errors.lines = lineError;
      if (Object.keys(errors).length > 0) result[b.id] = errors;
    });
    return result;
  }, [buildings]);

  const linePreview = (lines: string): string[] => {
    const { groups, error } = parseLines(lines);
    return error ? [] : groups.map((g) => formatLineRange(g));
  };

  const summary = useMemo<NewApartmentSummary>(
    () => ({
      buildingCount: buildings.length,
      householdsCount: buildings.reduce((sum, b) => sum + (b.householdsCount || 0), 0),
      lineGroupCount: buildings.reduce((sum, b) => sum + parseLines(b.lines).groups.length, 0),
    }),
    [buildings],
  );

  // ───── 여러 동 한 번에 추가 ─────
  const bulkErrors = useMemo<BulkErrors>(() => {
    const errors: BulkErrors = {};
    const from = Number(bulkDraft.from);
    const to = Number(bulkDraft.to);
    if (!bulkDraft.from || !bulkDraft.to) errors.range = '시작 동과 끝 동을 입력해주세요';
    else if (from > to) errors.range = '끝 동은 시작 동보다 크거나 같아야 합니다';
    else if (to - from + 1 > BULK_MAX) errors.range = `한 번에 ${BULK_MAX}개 동까지 추가할 수 있습니다`;
    else {
      const existing = new Set(buildings.map((b) => b.number));
      const dup = Array.from({ length: to - from + 1 }, (_, i) => String(from + i)).find((n) => existing.has(n));
      if (dup) errors.range = `이미 추가된 ${dup}동과 겹칩니다`;
    }
    if (!(bulkDraft.householdsCount > 0)) errors.householdsCount = '세대수를 입력해주세요';
    const lineError = parseLines(bulkDraft.lines).error;
    if (lineError) errors.lines = lineError;
    return errors;
  }, [bulkDraft, buildings]);

  const bulkCount = bulkErrors.range ? 0 : Number(bulkDraft.to) - Number(bulkDraft.from) + 1;

  const updateBulk = (field: keyof BulkDraft, value: string | number): void => {
    const next =
      field === 'from' || field === 'to' ? onlyDigits(String(value)) : field === 'lines' ? onlyLineChars(String(value)) : value;
    setBulkDraft((prev) => ({ ...prev, [field]: next }));
  };

  const submitBulk = (): void => {
    setBulkTried(true);
    if (Object.keys(bulkErrors).length > 0) return;
    const from = Number(bulkDraft.from);
    const added: BuildingDraft[] = Array.from({ length: bulkCount }, (_, i) => ({
      id: newId(),
      number: String(from + i),
      householdsCount: bulkDraft.householdsCount,
      lines: bulkDraft.lines,
    }));
    setBuildings([...buildings, ...added]);
    toast.success(`${added.length}개 동을 추가했습니다.`);
    setBulkDraft(EMPTY_BULK);
    setBulkTried(false);
    setBulkOpened(false);
  };

  // ───── 등록 ─────
  const handleSubmit = async (): Promise<void> => {
    setStep2Tried(true);
    if (buildings.length === 0) {
      toast.error('동을 하나 이상 추가해주세요.');
      return;
    }
    if (Object.keys(allBuildingErrors).length > 0) {
      toast.error('입력하지 않았거나 잘못된 항목이 있습니다.');
      return;
    }

    setLoading(true);
    let apartmentId: string | null = null;
    let managerId: string | null = null;
    try {
      // 현재 로그인한 사용자 정보 가져오기
      const { data: { user } } = await getSessionUser();
      if (!user) throw new Error('User not authenticated');

      // 1. apartments 테이블에 추가
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .insert({
          name: apartmentName,
          address: address,
          createdBy: user.id,
        } as never)
        .select()
        .single();

      if (apartmentError) throw apartmentError;
      if (!apartment) throw new Error('Failed to create apartment');
      apartmentId = (apartment as { id: string }).id;

      // 2. manager_apartments 테이블에 매니저-아파트 연결 추가
      const { error: managerApartmentError } = await supabase
        .from('manager_apartments')
        .insert({
          managerId: user.id,
          apartmentId,
        } as never);

      if (managerApartmentError) throw managerApartmentError;
      managerId = user.id;

      // 3. apartment_buildings 테이블에 동 정보 추가
      for (const building of buildings) {
        const { data: buildingData, error: buildingError } = await supabase
          .from('apartment_buildings')
          .insert({
            buildingNumber: parseInt(building.number),
            apartmentId,
            householdsCount: building.householdsCount,
          } as never)
          .select()
          .single();

        if (buildingError) throw buildingError;
        if (!buildingData) throw new Error('Failed to create building');

        // 4. apartment_lines 테이블에 라인 정보 추가
        for (const lineRange of parseLines(building.lines).groups) {
          const { error: lineError } = await supabase
            .from('apartment_lines')
            .insert({
              line: lineRange,
              buildingId: (buildingData as { id: string }).id,
            } as never);

          if (lineError) throw lineError;
        }
      }

      invalidateLookup('apartments');
      toast.success('아파트가 성공적으로 등록되었습니다.');
      router.push(LIST_PATH);
    } catch (error) {
      console.error('Failed to create apartment:', error);

      // 중간에 실패하면 만들다 만 아파트를 지운다 (동·라인은 아파트 삭제 시 함께 지워진다)
      let rolledBack = true;
      if (apartmentId) {
        try {
          if (managerId) {
            const { error: unlinkError } = await supabase
              .from('manager_apartments')
              .delete()
              .eq('apartmentId', apartmentId)
              .eq('managerId', managerId);
            if (unlinkError) throw unlinkError;
          }
          const { error: deleteError } = await supabase.from('apartments').delete().eq('id', apartmentId);
          if (deleteError) throw deleteError;
        } catch (rollbackError) {
          console.error('Failed to roll back apartment:', rollbackError);
          rolledBack = false;
        }
      }

      toast.error(
        rolledBack
          ? '아파트 등록 중 오류가 발생했습니다.'
          : '아파트 등록 중 오류가 발생했습니다. 일부 정보가 저장되었을 수 있으니 아파트 목록을 확인해주세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async (): Promise<void> => {
    if (isDirty) {
      const ok = await confirmModal({
        title: '작성 취소',
        message: '작성 중인 내용이 사라집니다. 목록으로 나가시겠어요?',
        confirmLabel: '나가기',
        danger: true,
      });
      if (!ok) return;
    }
    router.push(LIST_PATH);
  };

  return {
    step,
    goNext,
    goPrev,
    basic: {
      apartmentName,
      setApartmentName,
      address,
      openAddressSearch,
      errors: step1Tried ? basicErrors : {},
    },
    buildings: {
      list: buildings,
      addBuilding,
      removeBuilding,
      updateBuilding,
      errors: step2Tried ? allBuildingErrors : {},
      linePreview,
    },
    bulk: {
      opened: bulkOpened,
      toggle: () => setBulkOpened((v) => !v),
      draft: bulkDraft,
      update: updateBulk,
      errors: bulkTried ? bulkErrors : {},
      count: bulkCount,
      submit: submitBulk,
    },
    summary,
    loading,
    handleSubmit,
    handleBack,
  };
}
