/**
 * 단일 라인 범위 문자열을 숫자 배열로 변환
 * @param input "1~4" 또는 "1-4"
 * @returns [1, 2, 3, 4]
 */
function parseSingleRange(input: string): number[] {
  if (!input || !input.trim()) return [];

  // 물결표(~) 또는 하이픈(-)으로 범위 지정
  if (input.includes('~') || input.includes('-')) {
    const separator = input.includes('~') ? '~' : '-';
    const parts = input.split(separator).map(p => p.trim());

    if (parts.length !== 2) return [];

    const start = parseInt(parts[0]);
    const end = parseInt(parts[1]);

    if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > 99) {
      return [];
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  // 단일 숫자
  const num = parseInt(input.trim());
  if (isNaN(num) || num < 1 || num > 99) return [];
  return [num];
}

/**
 * 여러 라인 범위를 파싱 (쉼표로 구분)
 * @param input "1~2, 3~7, 8~10" 또는 "1~4"
 * @returns [[1,2], [3,4,5,6,7], [8,9,10]] 또는 [[1,2,3,4]]
 */
export function parseMultipleLineRanges(input: string): number[][] {
  if (!input || !input.trim()) return [];

  // 쉼표로 구분된 범위들을 파싱
  const ranges = input
    .split(',')
    .map(range => parseSingleRange(range.trim()))
    .filter(range => range.length > 0);

  return ranges;
}

/**
 * 라인 범위 문자열을 숫자 배열로 변환 (하나의 범위로 합침)
 * @param input "1~4" 또는 "1-4" 또는 "1,2,3,4"
 * @returns [1, 2, 3, 4]
 */
export function parseLineRange(input: string): number[] {
  if (!input || !input.trim()) return [];

  // 물결표(~) 또는 하이픈(-)으로 범위 지정
  if (input.includes('~') || input.includes('-')) {
    return parseSingleRange(input);
  }

  // 쉼표로 구분된 개별 숫자
  const numbers = input
    .split(',')
    .map(n => n.trim())
    .filter(n => n)
    .map(n => parseInt(n))
    .filter(n => !isNaN(n) && n >= 1 && n <= 99);

  return [...new Set(numbers)].sort((a, b) => a - b);
}

/**
 * 숫자 배열을 라인 범위 문자열로 변환
 * @param lines [1, 2, 3, 4]
 * @returns "1~4"
 */
export function formatLineRange(lines: number[]): string {
  if (!lines || lines.length === 0) return '';

  const sorted = [...lines].sort((a, b) => a - b);

  // 연속된 숫자인지 확인
  const isConsecutive = sorted.every((num, i) => {
    if (i === 0) return true;
    return num === sorted[i - 1] + 1;
  });

  if (isConsecutive && sorted.length > 1) {
    return `${sorted[0]}~${sorted[sorted.length - 1]}`;
  }

  // 연속되지 않으면 쉼표로 구분
  return sorted.join(',');
}

/**
 * 라인 배열이 유효한지 검증
 * @param lines 라인 번호 배열
 * @returns 유효 여부
 */
export function validateLineArray(lines: number[]): boolean {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  return lines.every(n => Number.isInteger(n) && n >= 1 && n <= 99);
}
