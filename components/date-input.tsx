'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatDateSlash } from '@/lib/utils/format';

interface DateInputProps {
  /** ISO 형식(yyyy-mm-dd) 값. */
  value: string;
  /** 완전하고 유효한 날짜가 입력됐을 때만 ISO 형식(yyyy-mm-dd)으로 호출된다. */
  onChange: (isoValue: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}

function isoToDigits(iso: string): string {
  return iso.replace(/-/g, '');
}

function isValidDateDigits(digits: string): boolean {
  if (digits.length !== 8) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (month < 1 || month > 12) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * 브라우저 native date input의 표시 형식이 OS/브라우저 locale에 좌우되는 문제를 피하기 위해,
 * YYYY/MM/DD 형식을 직접 그려주는 텍스트 입력.
 */
export function DateInput({ value, onChange, onKeyDown, className }: DateInputProps): React.ReactElement {
  const [text, setText] = useState(() => formatDateSlash(isoToDigits(value)));

  useEffect(() => {
    setText(formatDateSlash(isoToDigits(value)));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    setText(formatDateSlash(digits));
    if (isValidDateDigits(digits)) {
      onChange(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`);
    }
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      placeholder="YYYY/MM/DD"
      className={className}
    />
  );
}
