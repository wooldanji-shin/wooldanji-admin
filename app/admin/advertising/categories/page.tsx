'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';

interface AdCategory {
  id: string;
  categoryName: string;
  iconUrl: string | null;
  orderIndex: number;
  weekdayEnabled: boolean;
  weekdayStartTime: string | null;
  weekdayEndTime: string | null;
  weekendEnabled: boolean;
  weekendStartTime: string | null;
  weekendEndTime: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdCategoriesPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<AdCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 시간 포맷팅 함수 (HH:MM:SS -> HH:MM)
  const formatTime = (time: string | null) => {
    if (!time) return '';
    return time.substring(0, 5); // HH:MM만 반환
  };

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdCategory | null>(null);
  const [currentCategoryId, setCurrentCategoryId] = useState<string>(''); // 현재 편집 중인 카테고리 ID (신규는 UUID)
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string>(''); // 업로드된 아이콘 추적
  const [form, setForm] = useState({
    categoryName: '',
    iconUrl: '',
    orderIndex: 0,
    weekdayEnabled: true,
    weekdayAllDay: false,
    weekdayStartTime: '09:00',
    weekdayEndTime: '18:00',
    weekendEnabled: true,
    weekendAllDay: false,
    weekendStartTime: '10:00',
    weekendEndTime: '17:00',
    isActive: true,
  });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<AdCategory | null>(null);

  // 카테고리 목록 조회
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('ad_categories')
        .select('*')
        .order('orderIndex', { ascending: true });

      if (fetchError) throw fetchError;

      setCategories(data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('카테고리 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 카테고리 생성/수정
  const handleSave = async () => {
    if (!form.categoryName) {
      setError('카테고리 이름을 입력해주세요.');
      return;
    }

    try {
      const categoryData = {
        categoryName: form.categoryName,
        iconUrl: form.iconUrl || null,
        orderIndex: form.orderIndex,
        weekdayEnabled: form.weekdayEnabled,
        weekdayStartTime: form.weekdayEnabled && !form.weekdayAllDay ? form.weekdayStartTime : null,
        weekdayEndTime: form.weekdayEnabled && !form.weekdayAllDay ? form.weekdayEndTime : null,
        weekendEnabled: form.weekendEnabled,
        weekendStartTime: form.weekendEnabled && !form.weekendAllDay ? form.weekendStartTime : null,
        weekendEndTime: form.weekendEnabled && !form.weekendAllDay ? form.weekendEndTime : null,
        isActive: form.isActive,
      };

      if (editingCategory) {
        // 수정
        const { error: updateError } = await supabase
          .from('ad_categories')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (updateError) throw updateError;
      } else {
        // 생성
        const { error: insertError } = await supabase
          .from('ad_categories')
          .insert(categoryData);

        if (insertError) throw insertError;
      }

      // 저장 성공 시 uploadedIconUrl 초기화 (다이얼로그 닫힐 때 삭제 방지)
      setUploadedIconUrl('');
      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (err: any) {
      console.error('Failed to save category:', err);
      setError(err.message || '카테고리 저장에 실패했습니다.');
    }
  };

  // 카테고리 삭제
  const handleDeleteClick = (category: AdCategory) => {
    setDeletingCategory(category);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;

    try {
      const { error: deleteError } = await supabase
        .from('ad_categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (deleteError) throw deleteError;

      setDeleteDialog(false);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      setError('카테고리 삭제에 실패했습니다.');
    }
  };

  // 순서 변경
  const handleMoveOrder = async (category: AdCategory, direction: 'up' | 'down') => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === categories.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetCategory = categories[targetIndex];

    try {
      // 두 카테고리의 orderIndex를 교환
      await supabase
        .from('ad_categories')
        .update({ orderIndex: targetCategory.orderIndex })
        .eq('id', category.id);

      await supabase
        .from('ad_categories')
        .update({ orderIndex: category.orderIndex })
        .eq('id', targetCategory.id);

      fetchCategories();
    } catch (err) {
      console.error('Failed to change order:', err);
      setError('순서 변경에 실패했습니다.');
    }
  };

  // 편집 시작
  const handleEditClick = (category: AdCategory) => {
    console.log('🟡 [Categories] 편집 시작', {
      categoryId: category.id,
      categoryIconUrl: category.iconUrl,
    });

    setEditingCategory(category);
    setCurrentCategoryId(category.id);
    setUploadedIconUrl(''); // 기존 이미지는 추적하지 않음 (새로 업로드된 것만 추적)
    setForm({
      categoryName: category.categoryName,
      iconUrl: category.iconUrl || '',
      orderIndex: category.orderIndex,
      weekdayEnabled: category.weekdayEnabled,
      weekdayAllDay: !category.weekdayStartTime && !category.weekdayEndTime,
      weekdayStartTime: formatTime(category.weekdayStartTime) || '09:00',
      weekdayEndTime: formatTime(category.weekdayEndTime) || '18:00',
      weekendEnabled: category.weekendEnabled,
      weekendAllDay: !category.weekendStartTime && !category.weekendEndTime,
      weekendStartTime: formatTime(category.weekendStartTime) || '10:00',
      weekendEndTime: formatTime(category.weekendEndTime) || '17:00',
      isActive: category.isActive,
    });
    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingCategory(null);
    // 새 카테고리를 위한 고유 ID 생성
    const newId = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCurrentCategoryId(newId);
    setUploadedIconUrl('');
    setForm({
      categoryName: '',
      iconUrl: '',
      orderIndex: categories.length,
      weekdayEnabled: true,
      weekdayAllDay: false,
      weekdayStartTime: '09:00',
      weekdayEndTime: '18:00',
      weekendEnabled: true,
      weekendAllDay: false,
      weekendStartTime: '10:00',
      weekendEndTime: '17:00',
      isActive: true,
    });
  };

  // 다이얼로그 닫기 처리 (취소 시 새로 업로드된 이미지만 삭제)
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      console.log('🟡 [Categories] 다이얼로그 닫기', {
        uploadedIconUrl,
        editingCategoryIconUrl: editingCategory?.iconUrl || '',
        willDelete: uploadedIconUrl && uploadedIconUrl !== (editingCategory?.iconUrl || ''),
      });

      // 새로 업로드된 이미지가 있고, 기존 이미지와 다른 경우에만 삭제
      if (uploadedIconUrl && uploadedIconUrl !== (editingCategory?.iconUrl || '')) {
        try {
          const bucket = 'advertisements';
          const urlParts = uploadedIconUrl.split('/');
          const storagePathIndex = urlParts.indexOf('advertisements');
          if (storagePathIndex !== -1) {
            const path = urlParts.slice(storagePathIndex + 1).join('/');
            console.log('🟡 [Categories] 미사용 이미지 삭제', { path });
            await supabase.storage.from(bucket).remove([path]);
            console.log('🟢 [Categories] 미사용 이미지 삭제 완료', path);
          }
        } catch (err) {
          console.error('🔴 [Categories] Failed to delete uploaded icon:', err);
        }
      }
      setUploadedIconUrl('');
    }
    setIsDialogOpen(open);
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='광고 카테고리 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Actions */}
        <div className='flex justify-end'>
          <Button onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}>
            <Plus className='h-4 w-4 mr-2' />
            카테고리 추가
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Categories Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground w-20'>순서</TableHead>
                    <TableHead className='text-muted-foreground'>카테고리</TableHead>
                    <TableHead className='text-muted-foreground'>평일 노출</TableHead>
                    <TableHead className='text-muted-foreground'>주말 노출</TableHead>
                    <TableHead className='text-muted-foreground'>상태</TableHead>
                    <TableHead className='text-muted-foreground text-right'>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                        카테고리가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category, index) => (
                      <TableRow key={category.id} className='border-border hover:bg-secondary/50'>
                        <TableCell>
                          <div className='flex items-center gap-1'>
                            <span className='font-medium'>{category.orderIndex}</span>
                            <div className='flex flex-col ml-2'>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-5 w-5 p-0'
                                onClick={() => handleMoveOrder(category, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className='h-3 w-3' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-5 w-5 p-0'
                                onClick={() => handleMoveOrder(category, 'down')}
                                disabled={index === categories.length - 1}
                              >
                                <ArrowDown className='h-3 w-3' />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className='font-medium'>{category.categoryName}</TableCell>
                        <TableCell>
                          {category.weekdayEnabled ? (
                            <div className='flex items-center gap-2 text-sm'>
                              <Clock className='h-4 w-4 text-muted-foreground' />
                              {formatTime(category.weekdayStartTime)} ~ {formatTime(category.weekdayEndTime)}
                            </div>
                          ) : (
                            <Badge variant='secondary'>비활성</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.weekendEnabled ? (
                            <div className='flex items-center gap-2 text-sm'>
                              <Calendar className='h-4 w-4 text-muted-foreground' />
                              {formatTime(category.weekendStartTime)} ~ {formatTime(category.weekendEndTime)}
                            </div>
                          ) : (
                            <Badge variant='secondary'>비활성</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.isActive ? (
                            <Badge className='bg-green-500'>활성</Badge>
                          ) : (
                            <Badge variant='secondary'>비활성</Badge>
                          )}
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleEditClick(category)}
                            >
                              <Edit className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDeleteClick(category)}
                              className='text-destructive hover:text-destructive'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>{editingCategory ? '카테고리 수정' : '카테고리 추가'}</DialogTitle>
            <DialogDescription>
              광고 카테고리 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4 max-h-[70vh] overflow-y-auto'>
            <div className='space-y-2'>
              <Label htmlFor='categoryName'>카테고리 이름 *</Label>
              <Input
                id='categoryName'
                value={form.categoryName}
                onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                placeholder='필라테스, 영어학원 등'
              />
            </div>

            <div className='space-y-2'>
              <Label>카테고리 아이콘</Label>
              <ImageUpload
                bucket='advertisements'
                storagePath='categories/icons'
                fileName={currentCategoryId}
                value={form.iconUrl}
                onChange={(url) => {
                  console.log('🟡 [Categories] ImageUpload onChange 호출', {
                    newUrl: url,
                    currentFormIconUrl: form.iconUrl,
                    currentUploadedIconUrl: uploadedIconUrl,
                    editingCategory: editingCategory?.id,
                    editingCategoryIconUrl: editingCategory?.iconUrl,
                  });
                  setForm({ ...form, iconUrl: url });
                  setUploadedIconUrl(url);
                }}
                accept='image/png,image/svg+xml'
                maxSizeMB={2}
                previewSize='sm'
                description='PNG 또는 SVG 파일, 최대 2MB'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='orderIndex'>표시 순서</Label>
              <Input
                id='orderIndex'
                type='number'
                value={form.orderIndex}
                onChange={(e) => setForm({ ...form, orderIndex: parseInt(e.target.value) || 0 })}
                placeholder='0'
              />
              <p className='text-xs text-muted-foreground'>숫자가 작을수록 상단에 표시됩니다.</p>
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox
                id='isActive'
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked as boolean })}
              />
              <Label htmlFor='isActive'>활성화</Label>
            </div>

            <div className='border-t pt-4 space-y-4'>
              <h4 className='font-medium'>평일 노출 설정</h4>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='weekdayEnabled'
                  checked={form.weekdayEnabled}
                  onCheckedChange={(checked) => setForm({ ...form, weekdayEnabled: checked as boolean })}
                />
                <Label htmlFor='weekdayEnabled'>평일 노출</Label>
              </div>

              {form.weekdayEnabled && (
                <div className='space-y-4'>
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      id='weekdayAllDay'
                      checked={form.weekdayAllDay}
                      onCheckedChange={(checked) => setForm({ ...form, weekdayAllDay: checked as boolean })}
                    />
                    <Label htmlFor='weekdayAllDay'>하루종일 노출</Label>
                  </div>

                  {!form.weekdayAllDay && (
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='weekdayStartTime'>시작 시간</Label>
                        <Input
                          id='weekdayStartTime'
                          type='time'
                          value={form.weekdayStartTime}
                          onChange={(e) => setForm({ ...form, weekdayStartTime: e.target.value })}
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='weekdayEndTime'>종료 시간</Label>
                        <Input
                          id='weekdayEndTime'
                          type='time'
                          value={form.weekdayEndTime}
                          onChange={(e) => setForm({ ...form, weekdayEndTime: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='border-t pt-4 space-y-4'>
              <h4 className='font-medium'>주말 노출 설정</h4>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='weekendEnabled'
                  checked={form.weekendEnabled}
                  onCheckedChange={(checked) => setForm({ ...form, weekendEnabled: checked as boolean })}
                />
                <Label htmlFor='weekendEnabled'>주말 노출</Label>
              </div>

              {form.weekendEnabled && (
                <div className='space-y-4'>
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      id='weekendAllDay'
                      checked={form.weekendAllDay}
                      onCheckedChange={(checked) => setForm({ ...form, weekendAllDay: checked as boolean })}
                    />
                    <Label htmlFor='weekendAllDay'>하루종일 노출</Label>
                  </div>

                  {!form.weekendAllDay && (
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <Label htmlFor='weekendStartTime'>시작 시간</Label>
                        <Input
                          id='weekendStartTime'
                          type='time'
                          value={form.weekendStartTime}
                          onChange={(e) => setForm({ ...form, weekendStartTime: e.target.value })}
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='weekendEndTime'>종료 시간</Label>
                        <Input
                          id='weekendEndTime'
                          type='time'
                          value={form.weekendEndTime}
                          onChange={(e) => setForm({ ...form, weekendEndTime: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>
              {editingCategory ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카테고리 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingCategory?.categoryName}</strong> 카테고리를 삭제하시겠습니까?
              <br />
              이 카테고리에 속한 광고들은 카테고리가 NULL로 설정됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialog(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
