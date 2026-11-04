export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR');
}

/** 회원 목록 표의 '만 N세' 표시와 같은 계산 (birthDay는 'YYYY' 형식 출생년도) */
export function getAgeFromBirthDay(birthDay: string | null): number | null {
  if (!birthDay) return null;
  const birthYear = parseInt(birthDay.substring(0, 4));
  if (Number.isNaN(birthYear)) return null;
  return new Date().getFullYear() - birthYear;
}

/** 다른 앱 위에 표시 권한은 Android 아파트 회원만 앱이 동기화하므로 그 외는 '-' */
export function getOverlayPermissionLabel(registrationType: string | null, granted: boolean | null): string {
  if (registrationType !== 'APARTMENT') return '-';
  return granted ? '허용' : '미허용';
}
