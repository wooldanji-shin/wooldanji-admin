'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

// door_popup_settings 에서 관리하는 모드 타입
type PopupMode = 'ad' | 'category' | 'solo_popup' | 'none';

const MODE_LABELS = {
  ad: '광고 팝업',
  category: '카테고리 팝업',
  solo_popup: '단독 팝업',
} as const;

interface DoorPopupSettings {
  id: string;
  mode: PopupMode;
}

// DB CHECK 와 같은 범위 — 팝업 카드 최대 장수
const MAX_CARDS_MIN = 5;
const MAX_CARDS_MAX = 10;

export default function DoorBannerPage() {
  const supabase = createClient();

  const [settings, setSettings] = useState<DoorPopupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  // 저장 중 상태 — 중복 토글 방지
  const [saving, setSaving] = useState(false);
  // 팝업 최대 장수 입력값
  const [maxCardsInput, setMaxCardsInput] = useState(String(MAX_CARDS_MIN));

  // 초기 설정값 조회
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // door_popup_settings 미타입 테이블 any 캐스팅
        const { data, error } = await (supabase as any)
          .from('door_popup_settings')
          .select('id, mode, "maxCards"')
          .limit(1)
          .single();
        if (error) throw error;
        setSettings({ id: data.id, mode: data.mode });
        setMaxCardsInput(String(data.maxCards ?? MAX_CARDS_MIN));
      } catch (err) {
        console.error('door_popup_settings 조회 실패:', err);
        toast.error('설정을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [supabase]);

  /**
   * 뮤텍스 토글 핸들러.
   * 한 모드를 ON 하면 다른 모드는 자동 OFF.
   * 둘 다 OFF 하면 mode = 'none'.
   */
  const handleToggle = async (
    targetMode: 'ad' | 'category' | 'solo_popup',
    checked: boolean
  ) => {
    if (!settings || saving) return;

    const newMode: PopupMode = checked ? targetMode : 'none';

    // 낙관적 UI 업데이트
    setSaving(true);
    setSettings((prev) => (prev ? { ...prev, mode: newMode } : prev));

    try {
      const { error } = await (supabase as any)
        .from('door_popup_settings')
        .update({ mode: newMode })
        .eq('id', settings.id);
      if (error) throw error;

      toast.success(
        checked
          ? `${MODE_LABELS[targetMode]} 모드가 활성화되었습니다.`
          : '팝업 모드가 비활성화되었습니다.'
      );
    } catch (err: any) {
      console.error('팝업 모드 변경 실패:', err);
      toast.error(err.message || '설정 변경에 실패했습니다.');
      // 실패 시 원래 값으로 롤백
      setSettings((prev) => (prev ? { ...prev, mode: settings.mode } : prev));
    } finally {
      setSaving(false);
    }
  };

  /** 팝업 최대 장수 저장 — 광고가 먼저, 남은 칸은 채움 이미지로 채워진다 */
  const handleSaveMaxCards = async () => {
    if (!settings || saving) return;
    const count = Number(maxCardsInput);
    if (!Number.isInteger(count) || count < MAX_CARDS_MIN || count > MAX_CARDS_MAX) {
      toast.error(`${MAX_CARDS_MIN}~${MAX_CARDS_MAX} 사이의 숫자로 입력해 주세요.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('door_popup_settings')
        .update({ maxCards: count })
        .eq('id', settings.id);
      if (error) throw error;
      toast.success(`팝업 최대 장수를 ${count}장으로 저장했습니다.`);
    } catch (err) {
      console.error('팝업 최대 장수 저장 실패:', err);
      toast.error('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <AdminHeader
        title="공동현관문 팝업관리 v2"
        description="공동현관문이 열릴 때 표시할 팝업 모드를 설정합니다."
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-xl">
          {/* 광고 팝업 카드 */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">광고 팝업</CardTitle>
                <CardDescription>
                  활성화된 광고 중 랜덤 1개를 팝업으로 노출합니다.
                </CardDescription>
              </div>
              <Switch
                checked={settings?.mode === 'ad'}
                onCheckedChange={(checked) => handleToggle('ad', checked)}
                disabled={saving}
                aria-label="광고 팝업 모드 토글"
              />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                현재 상태:{' '}
                <span className={settings?.mode === 'ad' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {settings?.mode === 'ad' ? 'ON' : 'OFF'}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* 카테고리 팝업 카드 */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">카테고리 팝업</CardTitle>
                <CardDescription>
                  광고 카테고리 소개를 팝업으로 노출합니다.
                </CardDescription>
              </div>
              <Switch
                checked={settings?.mode === 'category'}
                onCheckedChange={(checked) => handleToggle('category', checked)}
                disabled={saving}
                aria-label="카테고리 팝업 모드 토글"
              />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                현재 상태:{' '}
                <span className={settings?.mode === 'category' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {settings?.mode === 'category' ? 'ON' : 'OFF'}
                </span>
              </p>
            </CardContent>
          </Card>
          {/* 단독 팝업 카드 */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">단독 팝업</CardTitle>
                <CardDescription>
                  파트너가 신청한 단독 팝업 광고를 최대 장수(아래 설정)까지 캐러셀로 노출합니다.
                </CardDescription>
              </div>
              <Switch
                checked={settings?.mode === 'solo_popup'}
                onCheckedChange={(checked) => handleToggle('solo_popup', checked)}
                disabled={saving}
                aria-label="단독 팝업 모드 토글"
              />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                현재 상태:{' '}
                <span className={settings?.mode === 'solo_popup' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {settings?.mode === 'solo_popup' ? 'ON' : 'OFF'}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* 단독 팝업 모드의 팝업 최대 장수 */}
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base font-semibold">팝업 최대 장수</CardTitle>
              <CardDescription>
                광고를 먼저 채우고 남은 칸은 채움 이미지로 채워요. 보여주는 순서는 섞여서 랜덤이에요.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Input
                type="number"
                min={MAX_CARDS_MIN}
                max={MAX_CARDS_MAX}
                className="w-32"
                value={maxCardsInput}
                onChange={(e) => setMaxCardsInput(e.target.value)}
                disabled={saving}
                aria-label="팝업 최대 장수"
              />
              <span className="text-xs text-muted-foreground">{MAX_CARDS_MIN}~{MAX_CARDS_MAX}장 (기본 {MAX_CARDS_MIN})</span>
              <Button variant="outline" onClick={handleSaveMaxCards} disabled={saving}>저장</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
