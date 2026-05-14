'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

// door_popup_settings 에서 관리하는 모드 타입
type PopupMode = 'ad' | 'category' | 'none';

interface DoorPopupSettings {
  id: string;
  mode: PopupMode;
}

export default function DoorBannerPage() {
  const supabase = createClient();

  const [settings, setSettings] = useState<DoorPopupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  // 저장 중 상태 — 중복 토글 방지
  const [saving, setSaving] = useState(false);

  // 초기 설정값 조회
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // door_popup_settings 미타입 테이블 any 캐스팅
        const { data, error } = await (supabase as any)
          .from('door_popup_settings')
          .select('id, mode')
          .limit(1)
          .single();
        if (error) throw error;
        setSettings(data as DoorPopupSettings);
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
    targetMode: 'ad' | 'category',
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
          ? `${targetMode === 'ad' ? '광고 팝업' : '카테고리 팝업'} 모드가 활성화되었습니다.`
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

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <AdminHeader
        title="공동현관문 배너관리 v2"
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
        </div>
      )}
    </div>
  );
}
