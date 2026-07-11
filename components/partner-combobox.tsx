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
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="파트너 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {partners.map((partner) => (
                <CommandItem
                  key={partner.id}
                  value={partner.businessName}
                  onSelect={() => {
                    onChange(partner.id === value ? null : partner.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === partner.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {partner.businessName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
