'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  Save,
  AlertCircle,
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
import { ImageUpload } from '@/components/image-upload';

interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
}

interface BannerForm {
  linkUrl: string;
  imageUrl: string;
  orderIndex: number;
  isActive: boolean;
}

const BUCKET_NAME = 'home-content';
const BANNERS_FOLDER = 'banners';

function SortableRow({ banner, onEdit, onDelete, onToggleActive }: {
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: banner.id });

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
          <span className='font-medium'>{banner.orderIndex}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className='relative w-32 h-20 rounded overflow-hidden bg-muted'>
          <Image
            src={banner.imageUrl}
            alt={`배너 ${banner.orderIndex}`}
            fill
            className='object-cover'
          />
        </div>
      </TableCell>
      <TableCell className='max-w-xs truncate'>
        {banner.linkUrl ? (
          <a
            href={banner.linkUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {banner.linkUrl}
          </a>
        ) : (
          <span className='text-muted-foreground'>링크 없음</span>
        )}
      </TableCell>
      <TableCell>
        <Switch
          checked={banner.isActive}
          onCheckedChange={(checked) => onToggleActive(banner.id, checked)}
        />
      </TableCell>
      <TableCell>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={(e) => {
              e.stopPropagation();
              onEdit(banner);
            }}
          >
            <Edit className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={(e) => {
              e.stopPropagation();
              onDelete(banner.id);
            }}
          >
            <Trash2 className='h-4 w-4 text-destructive' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>({
    linkUrl: '',
    imageUrl: '',
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
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('home_banners')
        .select('*')
        .order('orderIndex', { ascending: true });

      if (fetchError) throw fetchError;

      setBanners(data || []);
    } catch (err) {
      console.error('Error loading banners:', err);
      toast.error('배너를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = banners.findIndex((b) => b.id === active.id);
    const newIndex = banners.findIndex((b) => b.id === over.id);

    const newOrder = arrayMove(banners, oldIndex, newIndex);
    setBanners(newOrder);

    try {
      const updates = newOrder.map((banner, index) => ({
        id: banner.id,
        orderIndex: index,
      }));

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('home_banners')
          .update({ orderIndex: update.orderIndex })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      toast.success('순서가 업데이트되었습니다.');
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error('순서 업데이트 중 오류가 발생했습니다.');
      loadBanners();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('home_banners')
        .update({ isActive })
        .eq('id', id);

      if (updateError) throw updateError;

      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive } : b))
      );

      toast.success('활성화 상태가 변경되었습니다.');
    } catch (err) {
      console.error('Error toggling active:', err);
      toast.error('활성화 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleAddNew = () => {
    const maxOrderIndex = banners.length > 0
      ? Math.max(...banners.map((b) => b.orderIndex))
      : -1;

    setEditingBanner(null);
    setForm({
      linkUrl: '',
      imageUrl: '',
      orderIndex: maxOrderIndex + 1,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      linkUrl: banner.linkUrl || '',
      imageUrl: banner.imageUrl,
      orderIndex: banner.orderIndex,
      isActive: banner.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // 이미지는 필수
      if (!form.imageUrl) {
        toast.error('배너 이미지를 업로드해주세요.');
        return;
      }

      const bannerData = {
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl.trim() || null,
        orderIndex: form.orderIndex,
        isActive: form.isActive,
      };

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from('home_banners')
          .update(bannerData)
          .eq('id', editingBanner.id);

        if (updateError) throw updateError;

        toast.success('배너가 수정되었습니다.');
      } else {
        const { error: insertError } = await supabase
          .from('home_banners')
          .insert(bannerData);

        if (insertError) throw insertError;

        toast.success('배너가 등록되었습니다.');
      }

      await loadBanners();
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving banner:', err);
      toast.error('배너 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 배너를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('home_banners')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('배너가 삭제되었습니다.');
      await loadBanners();
    } catch (err) {
      console.error('Error deleting banner:', err);
      toast.error('배너 삭제 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setForm({
      linkUrl: '',
      imageUrl: '',
      orderIndex: 0,
      isActive: true,
    });
    setEditingBanner(null);
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='홈 배너 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='홈 배너 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* Info Alert */}
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              홈 화면 상단에 표시되는 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다.
            </AlertDescription>
          </Alert>

          {/* Banners List */}
          <Card className='bg-card border-border'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <CardTitle className='text-card-foreground'>배너 목록</CardTitle>
              <Button onClick={handleAddNew}>
                <Plus className='h-4 w-4 mr-2' />
                새 배너
              </Button>
            </CardHeader>
            <CardContent>
              {banners.length === 0 ? (
                <div className='text-center py-12 text-muted-foreground'>
                  등록된 배너가 없습니다.
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
                        <TableHead className='w-32'>이미지</TableHead>
                        <TableHead>링크 URL</TableHead>
                        <TableHead className='w-24'>활성화</TableHead>
                        <TableHead className='w-32'>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={banners.map((b) => b.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {banners.map((banner) => (
                          <SortableRow
                            key={banner.id}
                            banner={banner}
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
              {editingBanner ? '배너 수정' : '새 배너 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            {/* Image Upload */}
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>
                배너 이미지 <span className='text-destructive'>*</span>
              </Label>
              <ImageUpload
                bucket={BUCKET_NAME}
                storagePath={BANNERS_FOLDER}
                value={form.imageUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                accept='image/*'
                maxSizeMB={5}
                description='배너 이미지를 업로드하세요 (권장: 가로형 이미지)'
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
                배너 클릭 시 이동할 URL을 입력하세요.
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
            <Button onClick={handleSave} disabled={saving || !form.imageUrl}>
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
