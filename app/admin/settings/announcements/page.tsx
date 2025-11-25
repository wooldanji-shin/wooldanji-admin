'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  Save,
  AlertCircle,
  Upload,
  X,
  Edit,
  Trash2,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Announcement {
  id: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
}

interface AnnouncementForm {
  title: string;
  content: string;
  linkUrl: string;
  imageFile: File | null;
  imagePreview: string | null;
  existingImageUrl: string | null;
  orderIndex: number;
  isActive: boolean;
}

const BUCKET_NAME = 'home-content';
const ANNOUNCEMENTS_FOLDER = 'announcements';

function SortableRow({ announcement, onEdit, onDelete, onToggleActive }: {
  announcement: Announcement;
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: announcement.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...attributes}
      className='border-border hover:bg-secondary/50'
    >
      <TableCell>
        <div
          className='flex items-center gap-2 cursor-grab active:cursor-grabbing'
          {...listeners}
        >
          <GripVertical className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{announcement.orderIndex}</span>
        </div>
      </TableCell>
      <TableCell>
        {announcement.imageUrl && (
          <div className='relative w-16 h-16 rounded overflow-hidden bg-muted'>
            <Image
              src={announcement.imageUrl}
              alt={announcement.title || '공지사항 이미지'}
              fill
              className='object-cover'
            />
          </div>
        )}
      </TableCell>
      <TableCell className='font-medium'>
        {announcement.title || <span className='text-muted-foreground'>제목 없음</span>}
      </TableCell>
      <TableCell className='max-w-xs truncate'>
        {announcement.content || <span className='text-muted-foreground'>내용 없음</span>}
      </TableCell>
      <TableCell>
        <Switch
          checked={announcement.isActive}
          onCheckedChange={(checked) => onToggleActive(announcement.id, checked)}
        />
      </TableCell>
      <TableCell>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={(e) => {
              e.stopPropagation();
              onEdit(announcement);
            }}
          >
            <Edit className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={(e) => {
              e.stopPropagation();
              onDelete(announcement.id);
            }}
          >
            <Trash2 className='h-4 w-4 text-destructive' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>({
    title: '',
    content: '',
    linkUrl: '',
    imageFile: null,
    imagePreview: null,
    existingImageUrl: null,
    orderIndex: 0,
    isActive: true,
  });

  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('announcements')
        .select('*')
        .order('orderIndex', { ascending: true });

      if (fetchError) throw fetchError;

      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error loading announcements:', err);
      toast.error('공지사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = announcements.findIndex((a) => a.id === active.id);
    const newIndex = announcements.findIndex((a) => a.id === over.id);

    const newOrder = arrayMove(announcements, oldIndex, newIndex);
    setAnnouncements(newOrder);

    try {
      const updates = newOrder.map((announcement, index) => ({
        id: announcement.id,
        orderIndex: index,
      }));

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('announcements')
          .update({ orderIndex: update.orderIndex })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      toast.success('순서가 업데이트되었습니다.');
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error('순서 업데이트 중 오류가 발생했습니다.');
      loadAnnouncements();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('announcements')
        .update({ isActive })
        .eq('id', id);

      if (updateError) throw updateError;

      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive } : a))
      );

      toast.success('활성화 상태가 변경되었습니다.');
    } catch (err) {
      console.error('Error toggling active:', err);
      toast.error('활성화 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleAddNew = () => {
    const maxOrderIndex = announcements.length > 0
      ? Math.max(...announcements.map((a) => a.orderIndex))
      : -1;

    setEditingAnnouncement(null);
    setForm({
      title: '',
      content: '',
      linkUrl: '',
      imageFile: null,
      imagePreview: null,
      existingImageUrl: null,
      orderIndex: maxOrderIndex + 1,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      linkUrl: announcement.linkUrl || '',
      imageFile: null,
      imagePreview: announcement.imageUrl,
      existingImageUrl: announcement.imageUrl,
      orderIndex: announcement.orderIndex,
      isActive: announcement.isActive,
    });
    setDialogOpen(true);
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
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    setForm((prev) => ({ ...prev, imageFile: file }));

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, imagePreview: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setForm((prev) => ({
      ...prev,
      imageFile: null,
      imagePreview: null,
    }));
  };

  const deleteImageFromStorage = async (imageUrl: string | null) => {
    if (!imageUrl) return;

    try {
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);

      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1];
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        if (error) {
          console.error('Error deleting image from storage:', error);
        }
      }
    } catch (err) {
      console.error('Error parsing or deleting image URL:', err);
    }
  };

  // 이미지를 WebP로 변환하는 함수 (크기 제한 + 고품질)
  const convertToWebP = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new window.Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');

          // 최대 크기 제한 (긴 쪽 기준)
          const MAX_SIZE = 1080; // 모바일에 최적화된 크기
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 크기 조절
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            } else {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
            return;
          }

          // 고품질 렌더링 설정
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('WebP 변환에 실패했습니다.'));
              }
            },
            'image/webp',
            0.95 // 고품질 유지 (95%)
          );
        };

        img.onerror = () => {
          reject(new Error('이미지를 로드할 수 없습니다.'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('파일을 읽을 수 없습니다.'));
      };

      reader.readAsDataURL(file);
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      // 이미지 파일인지 확인 (jpg, jpeg, png는 webp로 변환)
      const isImageFile = file.type.startsWith('image/');
      const shouldConvertToWebP = isImageFile &&
        (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg');

      let fileToUpload: File | Blob = file;
      let fileExt = file.name.split('.').pop();
      let contentType = file.type;

      // WebP로 변환
      if (shouldConvertToWebP) {
        console.log('🔄 [공지사항] WebP로 변환 중...', { original: file.name });
        const webpBlob = await convertToWebP(file);
        fileToUpload = webpBlob;
        fileExt = 'webp';
        contentType = 'image/webp';

        const sizeDiff = ((1 - webpBlob.size / file.size) * 100).toFixed(1);
        console.log('✅ [공지사항] WebP 변환 완료', {
          원본크기: `${(file.size / 1024).toFixed(2)}KB`,
          변환후크기: `${(webpBlob.size / 1024).toFixed(2)}KB`,
          감소율: `${sizeDiff}%`,
        });
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${ANNOUNCEMENTS_FOLDER}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType,
        });

      if (uploadError) throw uploadError;

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

      let finalImageUrl = form.existingImageUrl;

      if (form.imageFile) {
        if (form.existingImageUrl) {
          await deleteImageFromStorage(form.existingImageUrl);
        }

        finalImageUrl = await uploadImage(form.imageFile);

        if (!finalImageUrl) {
          throw new Error('이미지 업로드에 실패했습니다.');
        }
      } else if (!form.imagePreview && form.existingImageUrl) {
        await deleteImageFromStorage(form.existingImageUrl);
        finalImageUrl = null;
      }

      const announcementData = {
        title: form.title.trim() || null,
        content: form.content.trim() || null,
        imageUrl: finalImageUrl,
        linkUrl: form.linkUrl.trim() || null,
        orderIndex: form.orderIndex,
        isActive: form.isActive,
      };

      if (editingAnnouncement) {
        const { error: updateError } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingAnnouncement.id);

        if (updateError) throw updateError;

        toast.success('공지사항이 수정되었습니다.');
      } else {
        const { error: insertError } = await supabase
          .from('announcements')
          .insert(announcementData);

        if (insertError) throw insertError;

        toast.success('공지사항이 등록되었습니다.');
      }

      await loadAnnouncements();
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving announcement:', err);
      toast.error('공지사항 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const announcement = announcements.find((a) => a.id === id);
      if (announcement?.imageUrl) {
        await deleteImageFromStorage(announcement.imageUrl);
      }

      const { error: deleteError } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('공지사항이 삭제되었습니다.');
      await loadAnnouncements();
    } catch (err) {
      console.error('Error deleting announcement:', err);
      toast.error('공지사항 삭제 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      linkUrl: '',
      imageFile: null,
      imagePreview: null,
      existingImageUrl: null,
      orderIndex: 0,
      isActive: true,
    });
    setEditingAnnouncement(null);
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='공지사항 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='공지사항 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* Info Alert */}
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              홈 화면에 표시되는 공지사항을 관리합니다. 드래그하여 순서를 변경할 수 있습니다.
            </AlertDescription>
          </Alert>

          {/* Announcements List */}
          <Card className='bg-card border-border'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <CardTitle className='text-card-foreground'>공지사항 목록</CardTitle>
              <Button onClick={handleAddNew}>
                <Plus className='h-4 w-4 mr-2' />
                새 공지사항
              </Button>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className='text-center py-12 text-muted-foreground'>
                  등록된 공지사항이 없습니다.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow className='border-border hover:bg-transparent'>
                        <TableHead className='w-24'>순서</TableHead>
                        <TableHead className='w-24'>이미지</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead className='max-w-xs'>내용</TableHead>
                        <TableHead className='w-24'>활성화</TableHead>
                        <TableHead className='w-32'>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={announcements.map((a) => a.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {announcements.map((announcement) => (
                          <SortableRow
                            key={announcement.id}
                            announcement={announcement}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleActive={handleToggleActive}
                          />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? '공지사항 수정' : '새 공지사항 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            {/* Image Upload */}
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>
                이미지 <span className='text-muted-foreground'>(선택사항)</span>
              </Label>
              {form.imagePreview ? (
                <div className='relative w-full aspect-video rounded-lg overflow-hidden bg-muted border border-border'>
                  <Image
                    src={form.imagePreview}
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
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder='공지사항 제목'
              />
            </div>

            {/* Content */}
            <div className='space-y-2'>
              <Label htmlFor='content' className='text-sm font-medium'>
                내용 <span className='text-muted-foreground'>(선택사항)</span>
              </Label>
              <Textarea
                id='content'
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder='공지사항 내용을 입력하세요'
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
                value={form.linkUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                placeholder='https://example.com'
              />
              <p className='text-xs text-muted-foreground'>
                공지사항 클릭 시 이동할 URL을 입력하세요.
              </p>
            </div>

            {/* Active Status */}
            <div className='flex items-center justify-between'>
              <Label htmlFor='isActive' className='text-sm font-medium'>
                활성화
              </Label>
              <Switch
                id='isActive'
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
