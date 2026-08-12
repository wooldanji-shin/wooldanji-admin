'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface PartnerOption {
  id: string;
  businessName: string;
  /** 상호명이 같은 파트너를 구분하기 위한 부가 정보 (대표자·전화번호 등) */
  description?: string | null;
  /** 계정 이메일 — 부가 정보 아래 줄에 표시 */
  email?: string | null;
}

interface PartnerComboboxProps {
  partners: PartnerOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function PartnerCombobox({
  partners,
  value,
  onChange,
  placeholder = '파트너 선택',
}: PartnerComboboxProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const selected = partners.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-11 w-[200px] justify-between border-border bg-card text-sm font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{selected?.businessName ?? placeholder}</span>
          {value ? (
            <X
              className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setOpen(false);
              }}
            />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      {/* 상호명 아래 대표자·전화번호가 잘리지 않을 만큼 넓힌다 */}
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="파트너 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {partners.map((partner) => (
                <CommandItem
                  key={partner.id}
                  // 상호명이 같은 파트너가 있으면 cmdk가 같은 항목으로 취급해
                  // 엉뚱한 파트너가 선택되므로 id를 붙여 값을 고유하게 만든다
                  value={`${partner.businessName} ${partner.id}`}
                  // 화면에 보이는 항목은 모두 검색되게 한다 (상호명·대표자·전화번호·이메일)
                  keywords={[
                    partner.businessName,
                    partner.description ?? '',
                    partner.email ?? '',
                  ].filter(Boolean)}
                  onSelect={() => {
                    onChange(partner.id === value ? null : partner.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === partner.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{partner.businessName}</span>
                    {partner.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {partner.description}
                      </span>
                    )}
                    {partner.email && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {partner.email}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
