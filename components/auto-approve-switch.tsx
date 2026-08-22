'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface AutoApproveSwitchProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

/** 수정 심사 자동승인 스위치 — 켜두면 10분마다 도는 스케줄러가 대신 승인한다 */
export function AutoApproveSwitch({
  id,
  checked,
  disabled,
  onChange,
}: AutoApproveSwitchProps): React.ReactElement {
  const switchId = `auto-approve-${id}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Switch
          id={switchId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
        <Label htmlFor={switchId} className="cursor-pointer text-sm font-medium">
          수정 심사 자동승인
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        켜두면 파트너가 올린 수정 요청을 10분마다 자동으로 승인합니다.
      </p>
    </div>
  );
}
