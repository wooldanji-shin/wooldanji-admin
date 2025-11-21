'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import { Loader2, Save, AlertCircle } from 'lucide-react';
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
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='헤더 설정' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='헤더 설정' />

      <div className='flex-1 p-6'>
        <div className='max-w-2xl mx-auto space-y-6'>
          {/* Info Alert */}
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              홈 화면 상단에 표시되는 헤더 텍스트를 설정합니다. 최대 {MAX_HEADER_LENGTH}자까지 입력 가능합니다.
            </AlertDescription>
          </Alert>

          {/* Header Settings Card */}
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-card-foreground'>헤더 텍스트</CardTitle>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Input Field */}
              <div className='space-y-2'>
                <Label htmlFor='headerText' className='text-sm font-medium'>
                  텍스트
                </Label>
                <div className='relative'>
                  <Input
                    id='headerText'
                    type='text'
                    value={headerText}
                    onChange={handleInputChange}
                    placeholder='예: 주민이 추천하는 믿을 수 있는 곳'
                    className='pr-16'
                    maxLength={MAX_HEADER_LENGTH}
                  />
                  <div
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${
                      headerText.length === MAX_HEADER_LENGTH
                        ? 'text-destructive font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {headerText.length}/{MAX_HEADER_LENGTH}
                  </div>
                </div>
                <p className='text-xs text-muted-foreground'>
                  스페이스 포함 최대 {MAX_HEADER_LENGTH}자까지 입력 가능합니다.
                </p>
              </div>

              {/* Action Buttons */}
              <div className='flex justify-end gap-3 pt-4'>
                <Button
                  variant='outline'
                  onClick={loadHeader}
                  disabled={saving}
                >
                  초기화
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !headerText.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className='mr-2 h-4 w-4' />
                      저장
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
