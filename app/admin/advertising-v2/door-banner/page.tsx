'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { PageShell } from '@/components/page-shell';
import { Badge, Button, Group, Paper, Skeleton, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
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
const MAX_CARDS_MIN = 3;
const MAX_CARDS_MAX = 10;
// DB 기본값과 같음 — 설정값이 없을 때 보여줄 값
const MAX_CARDS_DEFAULT = 5;

export default function DoorBannerPage() {
  const supabase = createClient();

  const [settings, setSettings] = useState<DoorPopupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  // 저장 중 상태 — 중복 토글 방지
  const [saving, setSaving] = useState(false);
  // 팝업 최대 장수 입력값
  const [maxCardsInput, setMaxCardsInput] = useState(String(MAX_CARDS_DEFAULT));

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
        setMaxCardsInput(String(data.maxCards ?? MAX_CARDS_DEFAULT));
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
    <PageShell>
      <AdminHeader
        title="공동현관문 팝업관리 v2"
        description="공동현관문이 열릴 때 표시할 팝업 모드를 설정합니다."
      />

      {loading ? (
        <Stack gap="md">
          <Skeleton h={140} radius="md" />
          <Skeleton h={140} radius="md" />
        </Stack>
      ) : (
        <Stack gap="md" maw={576}>
          <Text size="sm" c="dimmed">
            한 번에 하나의 모드만 켤 수 있습니다. 다른 모드를 켜면 기존 모드는 자동으로 꺼집니다.
          </Text>
          {/* 광고 팝업 카드 */}
          <Paper withBorder radius="md" p="lg">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
              <Stack gap={4}>
                <Title order={4}>광고 팝업</Title>
                <Text size="sm" c="dimmed">
                  활성화된 광고 중 랜덤 1개를 팝업으로 노출합니다.
                </Text>
              </Stack>
              <Switch
                checked={settings?.mode === 'ad'}
                onChange={(e) => handleToggle('ad', e.currentTarget.checked)}
                disabled={saving}
                aria-label="광고 팝업 모드 토글"
              />
            </Group>
            <Group gap="xs" mt="sm">
              <Text size="xs" c="dimmed">
                현재 상태:
              </Text>
              <Badge variant="light" color={settings?.mode === 'ad' ? 'green' : 'gray'}>
                {settings?.mode === 'ad' ? 'ON' : 'OFF'}
              </Badge>
            </Group>
          </Paper>

          {/* 카테고리 팝업 카드 */}
          <Paper withBorder radius="md" p="lg">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
              <Stack gap={4}>
                <Title order={4}>카테고리 팝업</Title>
                <Text size="sm" c="dimmed">
                  광고 카테고리 소개를 팝업으로 노출합니다.
                </Text>
              </Stack>
              <Switch
                checked={settings?.mode === 'category'}
                onChange={(e) => handleToggle('category', e.currentTarget.checked)}
                disabled={saving}
                aria-label="카테고리 팝업 모드 토글"
              />
            </Group>
            <Group gap="xs" mt="sm">
              <Text size="xs" c="dimmed">
                현재 상태:
              </Text>
              <Badge variant="light" color={settings?.mode === 'category' ? 'green' : 'gray'}>
                {settings?.mode === 'category' ? 'ON' : 'OFF'}
              </Badge>
            </Group>
          </Paper>
          {/* 단독 팝업 카드 */}
          <Paper withBorder radius="md" p="lg">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
              <Stack gap={4}>
                <Title order={4}>단독 팝업</Title>
                <Text size="sm" c="dimmed">
                  파트너가 신청한 단독 팝업 광고를 최대 장수(아래 설정)까지 캐러셀로 노출합니다.
                </Text>
              </Stack>
              <Switch
                checked={settings?.mode === 'solo_popup'}
                onChange={(e) => handleToggle('solo_popup', e.currentTarget.checked)}
                disabled={saving}
                aria-label="단독 팝업 모드 토글"
              />
            </Group>
            <Group gap="xs" mt="sm">
              <Text size="xs" c="dimmed">
                현재 상태:
              </Text>
              <Badge variant="light" color={settings?.mode === 'solo_popup' ? 'green' : 'gray'}>
                {settings?.mode === 'solo_popup' ? 'ON' : 'OFF'}
              </Badge>
            </Group>
          </Paper>

          {/* 단독 팝업 모드의 팝업 최대 장수 */}
          <Paper withBorder radius="md" p="lg">
            <Stack gap={4}>
              <Title order={4}>팝업 최대 장수</Title>
              <Text size="sm" c="dimmed">
                광고를 먼저 채우고 남은 칸은 채움 이미지로 채워요. 단독 팝업 &apos;첫 화면&apos; 광고 → 팝업 우선 광고 순으로 맨 앞에 나오고, 나머지 순서는 섞여서 랜덤이에요.
              </Text>
            </Stack>
            <Group gap="sm" mt="md">
              <TextInput
                type="number"
                min={MAX_CARDS_MIN}
                max={MAX_CARDS_MAX}
                w={128}
                value={maxCardsInput}
                onChange={(e) => setMaxCardsInput(e.target.value)}
                disabled={saving}
                aria-label="팝업 최대 장수"
              />
              <Text size="xs" c="dimmed">
                {MAX_CARDS_MIN}~{MAX_CARDS_MAX}장 (기본 {MAX_CARDS_DEFAULT})
              </Text>
              <Button variant="default" onClick={handleSaveMaxCards} disabled={saving}>
                저장
              </Button>
            </Group>
          </Paper>
        </Stack>
      )}
    </PageShell>
  );
}
