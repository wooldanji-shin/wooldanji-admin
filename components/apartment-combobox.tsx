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

export interface ApartmentOption {
  id: string;
  name: string;
}

interface ApartmentComboboxProps {
  apartments: ApartmentOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function ApartmentCombobox({
  apartments,
  value,
  onChange,
  placeholder = '아파트 선택',
}: ApartmentComboboxProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const selected = apartments.find((a) => a.id === value);

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
          <span className="truncate">{selected?.name ?? placeholder}</span>
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
          <CommandInput placeholder="아파트 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {apartments.map((apt) => (
                <CommandItem
                  key={apt.id}
                  value={apt.name}
                  onSelect={() => {
                    onChange(apt.id === value ? null : apt.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === apt.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {apt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
