export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * 브라우저에서 CSV 파일을 생성해 즉시 다운로드한다.
 * Excel에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
 */
export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsvValue(c.accessor(row))).join(','))
    .join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
