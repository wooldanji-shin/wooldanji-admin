export interface BuildingDraft {
  id: string;
  number: string;
  householdsCount: number;
  lines: string; // 범위 또는 쉼표로 구분된 라인 번호 (예: "1~3, 4, 5~11")
}

export type BuildingField = 'number' | 'householdsCount' | 'lines';

/** 동 하나의 입력 오류 (없으면 undefined) */
export interface BuildingErrors {
  number?: string;
  householdsCount?: string;
  lines?: string;
}

/** 여러 동을 한 번에 추가하는 입력값 */
export interface BulkDraft {
  from: string;
  to: string;
  householdsCount: number;
  lines: string;
}

export interface BulkErrors {
  range?: string;
  householdsCount?: string;
  lines?: string;
}

export interface BasicInfoErrors {
  name?: string;
  address?: string;
}

export interface UseBasicInfoReturn {
  apartmentName: string;
  setApartmentName: (value: string) => void;
  address: string;
  openAddressSearch: () => void;
  /** '다음 단계'를 누른 뒤에만 채워진다 */
  errors: BasicInfoErrors;
}

export interface UseBuildingsReturn {
  list: BuildingDraft[];
  addBuilding: () => void;
  removeBuilding: (id: string) => void;
  updateBuilding: (id: string, field: BuildingField, value: string | number) => void;
  /** '아파트 등록'을 누른 뒤에만 채워진다 */
  errors: Record<string, BuildingErrors>;
  /** 동별 라인 묶음 미리보기 (예: ["1~3", "4"]) */
  linePreview: (lines: string) => string[];
}

export interface UseBulkAddReturn {
  opened: boolean;
  toggle: () => void;
  draft: BulkDraft;
  update: (field: keyof BulkDraft, value: string | number) => void;
  errors: BulkErrors;
  /** 추가될 동 수 (입력이 올바를 때만) */
  count: number;
  submit: () => void;
}

export interface NewApartmentSummary {
  buildingCount: number;
  householdsCount: number;
  lineGroupCount: number;
}

export interface UseNewApartmentPageReturn {
  step: 1 | 2;
  goNext: () => void;
  goPrev: () => void;
  basic: UseBasicInfoReturn;
  buildings: UseBuildingsReturn;
  bulk: UseBulkAddReturn;
  summary: NewApartmentSummary;
  loading: boolean;
  handleSubmit: () => Promise<void>;
  handleBack: () => Promise<void>;
}
