'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  Save,
  AlertCircle,
  Upload,
  X,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string;
}

const BUCKET_NAME = 'home-content';
const NOTIFICATIONS_FOLDER = 'notifications';

export default function NotificationSettingsPage() {
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadCurrentNotification();
  }, []);

  const loadCurrentNotification = async () => {
    try {
      setLoading(true);

      // Get the most recent notification (there should only be one)
      const { data, error: fetchError } = await supabase
        .from('home_notifications')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setCurrentNotification(data);
        setTitle(data.title || '');
        setContent(data.content || '');
        setLinkUrl(data.linkUrl || '');
        setExistingImageUrl(data.imageUrl);
        setImagePreview(data.imageUrl);
      }
    } catch (err) {
      console.error('Error loading notification:', err);
      toast.error('알림 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    // Clear both file and preview
    setImageFile(null);
    setImagePreview(null);
    // Note: existingImageUrl is kept for deletion logic in handleSave
  };

  const deleteImageFromStorage = async (imageUrl: string | null) => {
    // Safety check: if no image URL, nothing to delete
    if (!imageUrl) return;

    try {
      // Extract file path from URL
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);

      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1];
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        if (error) {
          console.error('Error deleting image from storage:', error);
          // Don't throw - allow operation to continue even if deletion fails
        }
      }
    } catch (err) {
      console.error('Error parsing or deleting image URL:', err);
      // Don't throw - allow operation to continue
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${NOTIFICATIONS_FOLDER}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      throw err;
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      let finalImageUrl = existingImageUrl;

      // Handle image changes
      if (imageFile) {
        // New image selected - delete old image if exists
        if (existingImageUrl) {
          await deleteImageFromStorage(existingImageUrl);
        }

        // Upload new image
        finalImageUrl = await uploadImage(imageFile);

        if (!finalImageUrl) {
          throw new Error('이미지 업로드에 실패했습니다.');
        }
      } else if (!imagePreview && existingImageUrl) {
        // Image was removed (no preview and had existing image)
        await deleteImageFromStorage(existingImageUrl);
        finalImageUrl = null;
      }
      // else: keep existing image (existingImageUrl) or null if never had one

      // If editing existing notification, delete the old one
      if (currentNotification) {
        // Delete old notification
        await supabase
          .from('home_notifications')
          .delete()
          .eq('id', currentNotification.id);
      }

      // Create new notification
      const { data, error: insertError } = await supabase
        .from('home_notifications')
        .insert({
          title: title.trim() || null,
          content: content.trim() || null,
          imageUrl: finalImageUrl,
          linkUrl: linkUrl.trim() || null,
          orderIndex: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Reload to show new notification
      await loadCurrentNotification();

      // Reset form
      setImageFile(null);

      toast.success('알림이 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('Error saving notification:', err);
      toast.error('알림을 저장하는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    // Safety check: can't delete if no current notification
    if (!currentNotification) {
      toast.error('삭제할 알림이 없습니다.');
      return;
    }

    if (!confirm('현재 알림을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setDeleting(true);

      // Delete image from storage if exists
      // deleteImageFromStorage handles null safely
      await deleteImageFromStorage(currentNotification.imageUrl);

      // Delete notification from database
      const { error: deleteError } = await supabase
        .from('home_notifications')
        .delete()
        .eq('id', currentNotification.id);

      if (deleteError) throw deleteError;

      // Reset all state to empty
      setCurrentNotification(null);
      setTitle('');
      setContent('');
      setLinkUrl('');
      setImagePreview(null);
      setExistingImageUrl(null);
      setImageFile(null);

      toast.success('알림이 성공적으로 삭제되었습니다.');
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast.error('알림을 삭제하는 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    if (currentNotification) {
      setTitle(currentNotification.title || '');
      setContent(currentNotification.content || '');
      setLinkUrl(currentNotification.linkUrl || '');
      setImagePreview(currentNotification.imageUrl);
      setExistingImageUrl(currentNotification.imageUrl);
    } else {
      setTitle('');
      setContent('');
      setLinkUrl('');
      setImagePreview(null);
      setExistingImageUrl(null);
    }
    setImageFile(null);
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='알림 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='알림 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-4xl mx-auto space-y-6'>
          {/* Info Alert */}
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              홈 화면에 표시되는 알림을 관리합니다. 한 번에 하나의 알림만 표시됩니다.
              {!currentNotification && ' 현재 등록된 알림이 없습니다.'}
            </AlertDescription>
          </Alert>

          {/* Current Notification Display */}
          {currentNotification && (
            <Card className='bg-card border-border'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
                <CardTitle className='text-card-foreground'>현재 등록된 알림</CardTitle>
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <>
                      <Trash2 className='h-4 w-4 mr-2' />
                      삭제
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {currentNotification.imageUrl && (
                    <div className='relative w-full aspect-video rounded-lg overflow-hidden bg-muted border border-border'>
                      <Image
                        src={currentNotification.imageUrl}
                        alt={currentNotification.title || '알림 이미지'}
                        fill
                        className='object-contain'
                      />
                    </div>
                  )}
                  {currentNotification.title && (
                    <h3 className='font-semibold text-lg'>{currentNotification.title}</h3>
                  )}
                  <p className='text-muted-foreground'>{currentNotification.content}</p>
                  {currentNotification.linkUrl && (
                    <p className='text-sm text-primary truncate'>
                      링크: {currentNotification.linkUrl}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Form */}
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-card-foreground'>
                {currentNotification ? '새 알림으로 교체' : '새 알림 만들기'}
              </CardTitle>
              {currentNotification && (
                <p className='text-sm text-muted-foreground mt-1'>
                  저장하면 현재 알림이 삭제되고 새 알림으로 교체됩니다.
                </p>
              )}
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Image Upload */}
              <div className='space-y-2'>
                <Label className='text-sm font-medium'>이미지</Label>
                {imagePreview ? (
                  <div className='relative w-full aspect-video rounded-lg overflow-hidden bg-muted border border-border'>
                    <Image
                      src={imagePreview}
                      alt='Preview'
                      fill
                      className='object-contain'
                    />
                    <Button
                      variant='destructive'
                      size='icon'
                      className='absolute top-2 right-2 z-10'
                      onClick={removeImage}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                ) : (
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
                      dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type='file'
                      id='imageUpload'
                      className='hidden'
                      accept='image/*'
                      onChange={handleFileInput}
                    />
                    <label
                      htmlFor='imageUpload'
                      className='flex flex-col items-center justify-center cursor-pointer'
                    >
                      <Upload className='h-12 w-12 text-muted-foreground mb-4' />
                      <p className='text-sm font-medium text-center mb-1'>
                        이미지를 드래그하거나 클릭하여 업로드
                      </p>
                      <p className='text-xs text-muted-foreground text-center'>
                        PNG, JPG, GIF (최대 5MB)
                      </p>
                    </label>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className='space-y-2'>
                <Label htmlFor='title' className='text-sm font-medium'>
                  제목 <span className='text-muted-foreground'>(선택사항)</span>
                </Label>
                <Input
                  id='title'
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='알림 제목'
                />
              </div>

              {/* Content */}
              <div className='space-y-2'>
                <Label htmlFor='content' className='text-sm font-medium'>
                  내용 <span className='text-muted-foreground'>(선택사항)</span>
                </Label>
                <Textarea
                  id='content'
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder='알림 내용을 입력하세요'
                  rows={4}
                  className='resize-none'
                />
              </div>

              {/* Link URL */}
              <div className='space-y-2'>
                <Label htmlFor='linkUrl' className='text-sm font-medium'>
                  링크 URL <span className='text-muted-foreground'>(선택사항)</span>
                </Label>
                <Input
                  id='linkUrl'
                  type='url'
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder='https://example.com'
                />
                <p className='text-xs text-muted-foreground'>
                  알림 클릭 시 이동할 URL을 입력하세요.
                </p>
              </div>

              {/* Action Buttons */}
              <div className='flex justify-end gap-3 pt-4'>
                <Button
                  variant='outline'
                  onClick={resetForm}
                  disabled={saving}
                >
                  초기화
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
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
