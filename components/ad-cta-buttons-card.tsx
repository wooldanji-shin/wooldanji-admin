'use client';

import { Check, Circle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  CTA_CUSTOM_LABEL_MAX_LENGTH,
  MAX_CTA_BUTTONS,
  MAX_CUSTOM_CTA_BUTTONS,
  ctaButtonLabel,
  isDeliveryButton,
  type CtaButton,
  type CtaButtonType,
} from '@/lib/cta-button';

const DELIVERY_PLACEHOLDER: Record<string, string> = {
  baemin: 'https://baemin.me/...',
  coupangEats: 'https://www.coupangeats.com/...',
};

interface CtaButtonsCardProps {
  buttons: CtaButton[];
  /** 음식 카테고리 + 서브카테고리 선택 시에만 배달앱 버튼을 고를 수 있다 */
  deliveryAvailable: boolean;
  onToggleType: (type: CtaButtonType) => void;
  onAddCustom: () => void;
  onUpdate: (id: string, changes: Partial<CtaButton>) => void;
  onRemove: (id: string) => void;
}

export function CtaButtonsCard({
  buttons,
  deliveryAvailable,
  onToggleType,
  onAddCustom,
  onUpdate,
  onRemove,
}: CtaButtonsCardProps): React.ReactElement {
  const presetTypes: CtaButtonType[] = [
    'phone',
    'sms',
    ...(deliveryAvailable ? (['baemin', 'coupangEats'] as CtaButtonType[]) : []),
  ];
  const deliveryButtons = buttons.filter(isDeliveryButton);
  const customButtons = buttons.filter((b) => b.type === 'custom');
  const isFull = buttons.length >= MAX_CTA_BUTTONS;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>하단 버튼</CardTitle>
        <span
          className={cn(
            'text-sm font-semibold',
            isFull ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {buttons.length}/{MAX_CTA_BUTTONS}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          앱 광고 상세 하단에 노출될 버튼입니다. 전화·문자는 파트너 전화번호를 사용합니다.
        </p>

        <div className="flex flex-wrap gap-2">
          {presetTypes.map((type) => {
            const selected = buttons.some((b) => b.type === type);
            return (
              <button
                key={type}
                type="button"
                disabled={!selected && isFull}
                onClick={() => onToggleType(type)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                  !selected && isFull && 'cursor-not-allowed opacity-50'
                )}
              >
                {selected ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {ctaButtonLabel({ id: type, type })}
              </button>
            );
          })}
        </div>

        {!deliveryAvailable && (
          <p className="text-xs text-muted-foreground">
            배달의민족·쿠팡이츠는 음식 카테고리에서 서브카테고리를 선택하면 나타납니다.
          </p>
        )}

        {deliveryButtons.map((button) => (
          <div key={button.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {ctaButtonLabel(button)} 링크 <span className="text-destructive">*</span>
            </label>
            <Input
              value={button.url ?? ''}
              placeholder={DELIVERY_PLACEHOLDER[button.type]}
              onChange={(e) => onUpdate(button.id, { url: e.target.value.trim() })}
            />
          </div>
        ))}

        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <p className="text-sm font-semibold">직접 추가</p>
            <p className="text-xs text-muted-foreground">
              버튼 이름과 링크를 직접 입력합니다 (최대 {MAX_CUSTOM_CTA_BUTTONS}개)
            </p>
          </div>

          {customButtons.map((button) => (
            <div key={button.id} className="space-y-3 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">버튼 이름</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={() => onRemove(button.id)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  삭제
                </Button>
              </div>
              <Input
                value={button.label ?? ''}
                maxLength={CTA_CUSTOM_LABEL_MAX_LENGTH}
                placeholder={`예: 요기요 (최대 ${CTA_CUSTOM_LABEL_MAX_LENGTH}자)`}
                onChange={(e) => onUpdate(button.id, { label: e.target.value })}
              />
              <label className="block text-sm font-medium">링크</label>
              <Input
                value={button.url ?? ''}
                placeholder="https://"
                onChange={(e) => onUpdate(button.id, { url: e.target.value.trim() })}
              />
            </div>
          ))}

          {customButtons.length < MAX_CUSTOM_CTA_BUTTONS && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isFull}
              onClick={onAddCustom}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              버튼 추가
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
