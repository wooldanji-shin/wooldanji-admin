/** 영업시간 요일 코드 (business_hours.dayOfWeek) */
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** 표시 순서대로 정렬된 요일 목록 */
export const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export const DAY_OF_WEEK_LABEL: Record<DayOfWeek, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

/** business_hours 한 행 (요일별 영업시간) */
export interface PartnerBusinessHour {
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  /** HH:mm 형식으로 정규화된 값 */
  openTime: string | null;
  closeTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  lastOrderTime: string | null;
}

/** auth.users에서 가져오는 파트너 계정 정보 (관리자 전용 API로 조회) */
export interface PartnerAuthInfo {
  email: string | null;
  phone: string | null;
  /** 가입에 사용한 주 provider (email, google, apple, kakao 등) */
  provider: string | null;
  /** 연결된 모든 provider */
  providers: string[];
  lastSignInAt: string | null;
  signedUpAt: string | null;
}

/** provider 코드 → 한글 라벨 */
export const AUTH_PROVIDER_LABEL: Record<string, string> = {
  email: '이메일',
  google: '구글',
  apple: '애플',
  kakao: '카카오',
  naver: '네이버',
  phone: '휴대폰',
};

/** 파트너가 발급한 쿠폰 요약 (광고 상세 페이지 표시용) */
export interface PartnerCoupon {
  id: string;
  title: string;
  description: string | null;
  discountType: 'percent' | 'fixed' | 'gift';
  discountValue: number | null;
  minAmount: number | null;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  downloadCount: number;
}
