'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { InlineLoadingSkeleton } from '@/components/skeletons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/supabase';
import { cn } from '@/lib/utils';
import { Loader2, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';

/** 앱의 파트너 광고 소개 이미지 슬롯 키 */
const IMAGE_KEY = 'partner_ad_intro';

const BUCKET = 'banners';
const STORAGE_DIR = 'app-images/ad-intro';

const MAX_SIZE_MB = 10;
/** 앱 기본 이미지(ad_preview_v3.png)의 가로폭 — 이보다 좁으면 흐리게 보인다 */
const RECOMMENDED_MIN_WIDTH = 786;

/**
 * 허용 포맷 → 저장 확장자
 *
 * 파일명이 아니라 실제 MIME으로 정한다. 확장자 없는 파일을 올려도
 * 스토리지에 남는 파일명이 실제 포맷과 어긋나지 않게 하기 위함.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const ACCEPTED_TYPES = Object.keys(MIME_EXTENSIONS);

interface AppImage {
  id: string;
  imageUrl: string;
  storagePath: string;
  width: number;
  height: number;
  updatedAt: string;
}

/**
 * 원본 이미지의 실제 픽셀 크기를 읽는다.
 *
 * 관리자가 직접 입력하지 않도록 파일에서 자동으로 추출한다.
 */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };

    img.src = objectUrl;
  });
}

export default function PartnerAdIntroImagePage() {
  const [image, setImage] = useState<AppImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadImage();
  }, []);

  const loadImage = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('app_images')
        .select('*')
        .eq('key', IMAGE_KEY)
        .maybeSingle();

      if (error) throw error;

      setImage(data ?? null);
    } catch (err) {
      console.error('Error loading ad intro image:', err);
      toast.error('이미지 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 onChange가 뜨도록 즉시 비운다
    e.target.value = '';
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (saving) return;

    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const uploadFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('PNG, JPG, WebP 이미지만 올릴 수 있습니다.');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`이미지 용량은 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      return;
    }

    setSaving(true);
    const previousPath = image?.storagePath ?? null;

    try {
      const { width, height } = await readImageSize(file);

      if (width < RECOMMENDED_MIN_WIDTH) {
        toast.warning(
          `가로 ${width}px 이미지입니다. ${RECOMMENDED_MIN_WIDTH}px 이상을 권장합니다 — 앱에서 흐리게 보일 수 있어요.`
        );
      }

      // 화질 손실을 막기 위해 리사이즈·변환 없이 원본 그대로 올린다
      const extension = MIME_EXTENSIONS[file.type];
      const storagePath = `${STORAGE_DIR}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
        .data.publicUrl;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: saved, error: saveError } = await supabase
        .from('app_images')
        .upsert(
          {
            key: IMAGE_KEY,
            imageUrl,
            storagePath,
            width,
            height,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.id ?? null,
          },
          { onConflict: 'key' }
        )
        .select()
        .single();

      if (saveError) {
        // DB 반영 실패 시 방금 올린 파일은 쓸모없으므로 되돌린다.
        // 되돌리기가 실패해도 진짜 원인(saveError)을 가리지 않도록 따로 잡는다.
        try {
          await supabase.storage.from(BUCKET).remove([storagePath]);
        } catch (rollbackErr) {
          console.error('Failed to roll back uploaded file:', rollbackErr);
        }
        throw saveError;
      }

      setImage(saved);

      // DB가 새 이미지를 가리킨 뒤에 이전 파일을 지운다 (중간 실패해도 링크가 깨지지 않도록)
      if (previousPath) {
        await supabase.storage.from(BUCKET).remove([previousPath]);
      }

      toast.success('광고 소개 이미지가 교체되었습니다.');
    } catch (err) {
      console.error('Error uploading ad intro image:', err);
      toast.error('이미지를 올리는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /** 행을 지우면 앱이 내장 기본 이미지로 되돌아간다 */
  const handleResetToDefault = async () => {
    if (!image) return;
    if (!confirm('앱 기본 이미지로 되돌립니다. 업로드한 이미지는 삭제됩니다.')) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('app_images')
        .delete()
        .eq('key', IMAGE_KEY);

      if (error) throw error;

      await supabase.storage.from(BUCKET).remove([image.storagePath]);

      setImage(null);
      toast.success('앱 기본 이미지로 되돌렸습니다.');
    } catch (err) {
      console.error('Error resetting ad intro image:', err);
      toast.error('되돌리는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader>
          <PageHeaderTitle title="광고 소개 이미지" />
        </PageHeader>
        <InlineLoadingSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle title="광고 소개 이미지" />
      </PageHeader>

      <PageContent>
        <Card className='bg-card border-border max-w-2xl'>
          <CardHeader>
            <CardTitle className='text-card-foreground'>
              파트너 앱 광고 소개 이미지
            </CardTitle>
          </CardHeader>

          <CardContent className='space-y-6'>
            <div className='rounded-md bg-muted/50 p-4 text-sm text-muted-foreground space-y-1'>
              <p>
                파트너 앱의 <strong>가입 소개</strong> /{' '}
                <strong>기본광고 알아보기</strong> / <strong>내 광고</strong>{' '}
                화면에 함께 표시됩니다.
              </p>
              <p>
                세로로 긴 이미지, 가로 {RECOMMENDED_MIN_WIDTH}px 이상 권장 (최대{' '}
                {MAX_SIZE_MB}MB). 올린 이미지는 화질 손실 없이 원본 그대로
                사용됩니다.
              </p>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>현재 이미지</p>

              {/* 영역 전체가 드롭존 — 파일을 끌어다 놓으면 바로 교체된다 */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !saving && fileInputRef.current?.click()}
                className={cn(
                  'rounded-md border-2 border-dashed transition-colors cursor-pointer',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  saving && 'opacity-50 pointer-events-none'
                )}
              >
                {image ? (
                  <div className='max-h-[480px] overflow-y-auto rounded-md'>
                    {/* 세로로 긴 원본을 그대로 확인할 수 있도록 스크롤 영역에 넣는다 */}
                    <img
                      src={image.imageUrl}
                      alt='광고 소개 이미지'
                      className='w-full'
                    />
                  </div>
                ) : (
                  <div className='p-8 text-center text-sm text-muted-foreground'>
                    올린 이미지가 없어 앱에 내장된 기본 이미지가 표시되고
                    있습니다.
                  </div>
                )}

                <div className='border-t border-border px-4 py-3 text-center text-xs text-muted-foreground'>
                  {isDragging
                    ? '여기에 놓으면 교체됩니다'
                    : '클릭하거나 이미지를 이 영역에 끌어다 놓으세요'}
                </div>
              </div>

              {image && (
                <p className='text-xs text-muted-foreground'>
                  {image.width} × {image.height}px · 최종 수정{' '}
                  {new Date(image.updatedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>

            <input
              ref={fileInputRef}
              type='file'
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFileSelected}
              className='hidden'
            />

            <div className='flex justify-end gap-3 pt-2'>
              {image && (
                <Button
                  variant='outline'
                  onClick={handleResetToDefault}
                  disabled={saving}
                >
                  <RotateCcw className='mr-2 h-4 w-4' />
                  기본 이미지로 되돌리기
                </Button>
              )}
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    처리 중...
                  </>
                ) : (
                  <>
                    <Upload className='mr-2 h-4 w-4' />
                    {image ? '이미지 교체' : '이미지 올리기'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </PageShell>
  );
}
