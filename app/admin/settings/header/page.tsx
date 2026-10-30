'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import { Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

const MAX_HEADER_LENGTH = 21;

export default function HeaderSettingsPage() {
  const [headerText, setHeaderText] = useState('');
  const [headerId, setHeaderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadHeader();
  }, []);

  const loadHeader = async () => {
    try {
      setLoading(true);

      // Get the first header (there should only be one)
      const { data, error: fetchError } = await supabase
        .from('home_headers')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setHeaderText(data.headerText || '');
        setHeaderId(data.id);
      }
    } catch (err) {
      console.error('Error loading header:', err);
      toast.error('헤더 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate text
      if (!headerText.trim()) {
        toast.error('헤더 텍스트를 입력해주세요.');
        return;
      }

      if (headerText.length > MAX_HEADER_LENGTH) {
        toast.error(`헤더는 최대 ${MAX_HEADER_LENGTH}자까지 입력 가능합니다.`);
        return;
      }

      if (headerId) {
        // Update existing header
        const { error: updateError } = await supabase
          .from('home_headers')
          .update({
            headerText: headerText.trim(),
          })
          .eq('id', headerId);

        if (updateError) throw updateError;
      } else {
        // Create new header
        const { data, error: insertError } = await supabase
          .from('home_headers')
          .insert({
            headerText: headerText.trim(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (data) setHeaderId(data.id);
      }

      toast.success('헤더가 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('Error saving header:', err);
      toast.error('헤더를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow up to MAX_HEADER_LENGTH characters
    if (value.length <= MAX_HEADER_LENGTH) {
      setHeaderText(value);
    }
  };

  if (loading) {
    return <DetailSkeleton sections={1} />;
  }

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle title="헤더 설정" />
      </PageHeader>

      <PageContent>
        <Paper withBorder radius="md" p="lg">
          <Stack gap="lg">
            <Title order={4}>헤더 텍스트</Title>
            <TextInput
              id="headerText"
              type="text"
              label="텍스트"
              description={`스페이스 포함 최대 ${MAX_HEADER_LENGTH}자까지 입력 가능합니다.`}
              inputWrapperOrder={['label', 'input', 'description']}
              value={headerText}
              onChange={handleInputChange}
              placeholder="예: 주민이 추천하는 믿을 수 있는 곳"
              maxLength={MAX_HEADER_LENGTH}
              rightSectionWidth={64}
              rightSection={
                <Text
                  size="sm"
                  c={headerText.length === MAX_HEADER_LENGTH ? 'red' : 'dimmed'}
                  fw={headerText.length === MAX_HEADER_LENGTH ? 500 : undefined}
                >
                  {headerText.length}/{MAX_HEADER_LENGTH}
                </Text>
              }
            />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={loadHeader} disabled={saving}>
                되돌리기
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !headerText.trim()}
                leftSection={
                  saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />
                }
              >
                {saving ? '저장 중...' : '저장'}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </PageContent>
    </PageShell>
  );
}
