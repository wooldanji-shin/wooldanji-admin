import { AUTH_PROVIDER_LABEL } from '@/lib/types/partner';

/**
 * 휴대폰 번호 포맷팅 (010-1234-5678)
 */
export const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');

  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

/**
 * 유선 전화번호 포맷팅 (02-123-1234, 031-123-1234)
 * 서울(02)은 2자리, 그 외 지역번호는 3자리
 */
export const formatLandlineNumber = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');

  // 서울 (02)
  if (numbers.startsWith('02')) {
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 5) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else if (numbers.length <= 9) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    } else if (numbers.length <= 10) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    } else {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }
  }

  // 그 외 지역 (031, 032, 051, etc.) 또는 휴대폰
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 10) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

/**
 * 날짜 슬래시 포맷팅 (2026/01/08)
 * 브라우저 native date input의 표시 형식이 OS/브라우저 locale에 좌우되는 것을 피하기 위한 용도.
 * digits: 숫자만 있는 문자열(최대 8자리, YYYYMMDD)
 */
export const formatDateSlash = (digits: string): string => {
  const numbers = digits.replace(/[^\d]/g, '');

  if (numbers.length <= 4) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}/${numbers.slice(4)}`;
  } else {
    return `${numbers.slice(0, 4)}/${numbers.slice(4, 6)}/${numbers.slice(6, 8)}`;
  }
};

/**
 * 사업자등록번호 포맷팅 (123-45-678901)
 * 3자리-2자리-6자리
 */
export const formatBusinessRegistrationNumber = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');

  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 5) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 11)}`;
  }
};

/**
 * auth.users의 provider 목록을 한글 라벨로 변환
 * 예: ['email'] → '이메일', ['google', 'email'] → '구글, 이메일'
 */
export const formatAuthProviders = (providers: string[] | undefined): string => {
  if (!providers || providers.length === 0) return '-';
  return providers.map((p) => AUTH_PROVIDER_LABEL[p] ?? p).join(', ');
};
