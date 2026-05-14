'use client';

import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';
import { deleteFileFromStorage } from '@/lib/utils/storage';
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

// 소개내용 20자 초과 시 말줄임
const _NOTE_TRUNCATE_LENGTH = 20;

interface AdCategoryV2 {
  id: string;
  categoryName: string;
  iconUrl: string | null;
  note: string | null;
  isActive: boolean;
  orderIndex: number;
}

// 드래그 가능한 테이블 행
function SortableRow({
  category,
  onEdit,
  onDelete,
}: {
  category: AdCategoryV2;
  onEdit: (category: AdCategoryV2) => void;
  onDelete: (category: AdCategoryV2) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // note 20자 말줄임
  const truncatedNote = category.note
    ? category.note.length > _NOTE_TRUNCATE_LENGTH
      ? `${category.note.slice(0, _NOTE_TRUNCATE_LENGTH)}...`
      : category.note
    : '-';

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="border-border hover:bg-secondary/50"
    >
      {/* 드래그 핸들 + 순서 */}
      <TableCell>
        <div
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{category.orderIndex}</span>
        </div>
      </TableCell>

      {/* 카테고리명 + 아이콘 */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {category.iconUrl && (
            <img
              src={category.iconUrl}
              alt={`${category.categoryName} 아이콘`}
              className="w-6 h-6 object-contain"
            />
          )}
          {category.categoryName}
        </div>
      </TableCell>

      {/* 소개내용 (20자 말줄임) */}
      <TableCell className="text-sm text-muted-foreground max-w-[200px]">
        {truncatedNote}
      </TableCell>

      {/* 활성 여부 */}
      <TableCell>
        {category.isActive ? (
          <Badge className="bg-green-500">활성</Badge>
        ) : (
          <Badge variant="secondary">비활성</Badge>
        )}
      </TableCell>

      {/* 작업 버튼 */}
      <TableCell className="text-right">
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(category);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(category);
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// 폼 초기값
const _INITIAL_FORM = {
  categoryName: '',
  iconUrl: '',
  note: '',
  isActive: true,
  orderIndex: 1,
};

export default function AdCategoriesV2Page() {
  const supabase = createClient();

  const [categories, setCategories] = useState<AdCategoryV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdCategoryV2 | null>(null);
  const [uploadedIconUrl, setUploadedIconUrl] = useState('');
  const [form, setForm] = useState(_INITIAL_FORM);
  const [orderIndexError, setOrderIndexError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<AdCategoryV2 | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 카테고리 목록 조회
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      // ad_categories_v2는 Supabase 자동 타입에 아직 미포함이므로 any 캐스팅
      const { data, error } = await (supabase as any)
        .from('ad_categories_v2')
        .select('*')
        .order('orderIndex', { ascending: true });
      if (error) throw error;
      setCategories(data ?? []);
    } catch (err) {
      console.error('카테고리 목록 조회 실패:', err);
      toast.error('카테고리 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // orderIndex 중복 체크 (자기 자신 제외)
  const checkOrderIndexDuplicate = (orderIndex: number, excludeId?: string) => {
    return categories.some(
      (c) => c.orderIndex === orderIndex && c.id !== excludeId
    );
  };

  // 폼 필드 변경 헬퍼
  const handleFormChange = (field: keyof typeof _INITIAL_FORM, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // orderIndex 변경 + 중복 검증
  const handleOrderIndexChange = (value: number) => {
    handleFormChange('orderIndex', value);
    if (checkOrderIndexDuplicate(value, editingCategory?.id)) {
      setOrderIndexError('순서가 중복됩니다');
    } else {
      setOrderIndexError(null);
    }
  };

  // 저장 (생성/수정)
  const handleSave = async () => {
    if (!form.categoryName.trim()) {
      toast.error('카테고리 이름을 입력해주세요.');
      return;
    }
    if (checkOrderIndexDuplicate(form.orderIndex, editingCategory?.id)) {
      setOrderIndexError('순서가 중복됩니다');
      return;
    }
    setOrderIndexError(null);

    try {
      const payload = {
        categoryName: form.categoryName.trim(),
        iconUrl: form.iconUrl || null,
        note: form.note.trim() || null,
        isActive: form.isActive,
        orderIndex: form.orderIndex,
      };

      if (editingCategory) {
        // 수정 (ad_categories_v2 미타입 테이블 any 캐스팅)
        const { error } = await (supabase as any)
          .from('ad_categories_v2')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) throw error;
        toast.success('카테고리가 수정되었습니다.');
      } else {
        // 생성
        const { error } = await (supabase as any)
          .from('ad_categories_v2')
          .insert(payload);
        if (error) throw error;
        toast.success('카테고리가 추가되었습니다.');
      }

      setUploadedIconUrl('');
      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (err: any) {
      console.error('카테고리 저장 실패:', err);
      toast.error(err.message || '카테고리 저장에 실패했습니다.');
    }
  };

  // 삭제 확인 클릭
  const handleDeleteClick = (category: AdCategoryV2) => {
    setDeletingCategory(category);
    setDeleteDialog(true);
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;

    try {
      // Storage 아이콘 파일 삭제 (있는 경우)
      if (deletingCategory.iconUrl) {
        await deleteFileFromStorage(deletingCategory.iconUrl);
      }

      const { error } = await (supabase as any)
        .from('ad_categories_v2')
        .delete()
        .eq('id', deletingCategory.id);
      if (error) throw error;

      toast.success('카테고리가 삭제되었습니다.');
      setDeleteDialog(false);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err: any) {
      console.error('카테고리 삭제 실패:', err);
      toast.error(err.message || '카테고리 삭제에 실패했습니다.');
    }
  };

  // 수정 시작
  const handleEditClick = (category: AdCategoryV2) => {
    setEditingCategory(category);
    setUploadedIconUrl('');
    setForm({
      categoryName: category.categoryName,
      iconUrl: category.iconUrl ?? '',
      note: category.note ?? '',
      isActive: category.isActive,
      orderIndex: category.orderIndex,
    });
    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingCategory(null);
    setUploadedIconUrl('');
    setOrderIndexError(null);
    setForm({
      ..._INITIAL_FORM,
      orderIndex: categories.length + 1,
    });
  };

  // 다이얼로그 닫기 — 업로드만 하고 저장 안 한 이미지 정리
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      if (
        uploadedIconUrl &&
        uploadedIconUrl !== (editingCategory?.iconUrl ?? '')
      ) {
        try {
          const path = new URL(uploadedIconUrl).pathname.split('/').slice(2).join('/');
          await supabase.storage
            .from(path.split('/')[0])
            .remove([path.split('/').slice(1).join('/')]);
        } catch (err) {
          console.error('임시 업로드 파일 삭제 실패:', err);
        }
      }
      resetForm();
    }
    setIsDialogOpen(open);
  };

  // 드래그&드롭 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex).map(
      (c, idx) => ({ ...c, orderIndex: idx + 1 })
    );

    // 낙관적 UI 업데이트
    setCategories(reordered);

    try {
      // 1단계: 음수 임시값으로 중복 방지 후 최종 값 적용 (ad_categories_v2 미타입 테이블 any 캐스팅)
      await Promise.all(
        reordered.map((c, idx) =>
          (supabase as any)
            .from('ad_categories_v2')
            .update({ orderIndex: -(idx + 1) })
            .eq('id', c.id)
        )
      );
      await Promise.all(
        reordered.map((c) =>
          (supabase as any)
            .from('ad_categories_v2')
            .update({ orderIndex: c.orderIndex })
            .eq('id', c.id)
        )
      );
    } catch (err) {
      console.error('순서 변경 실패:', err);
      toast.error('순서 변경에 실패했습니다.');
      fetchCategories();
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <AdminHeader title="카테고리 관리 v2" />

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            드래그하여 카테고리 순서를 변경할 수 있습니다.
          </p>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            카테고리 추가
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground w-32">순서</TableHead>
                      <TableHead className="text-muted-foreground">카테고리명</TableHead>
                      <TableHead className="text-muted-foreground">소개내용</TableHead>
                      <TableHead className="text-muted-foreground">상태</TableHead>
                      <TableHead className="text-muted-foreground text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col gap-3 py-2">
                            <Skeleton className="h-4 w-2/3 mx-auto" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5 mx-auto" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          카테고리가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <SortableContext
                        items={categories.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {categories.map((category) => (
                          <SortableRow
                            key={category.id}
                            category={category}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 생성/수정 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? '카테고리 수정' : '카테고리 추가'}
            </DialogTitle>
            <DialogDescription>
              광고 카테고리 v2 정보를 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            {/* 카테고리명 */}
            <div className="space-y-2">
              <Label htmlFor="categoryName">카테고리 이름 *</Label>
              <Input
                id="categoryName"
                value={form.categoryName}
                onChange={(e) => handleFormChange('categoryName', e.target.value)}
                placeholder="필라테스, 영어학원 등"
              />
            </div>

            {/* 아이콘 업로드 */}
            <div className="space-y-2">
              <Label>아이콘</Label>
              <ImageUpload
                bucket="advertisements"
                storagePath="categories-v2/icons"
                value={form.iconUrl || ''}
                onChange={(url) => {
                  handleFormChange('iconUrl', url ?? '');
                  setUploadedIconUrl(url ?? '');
                }}
                accept="image/png,image/svg+xml"
                maxSizeMB={2}
                description="PNG 또는 SVG 파일, 최대 2MB"
              />
            </div>

            {/* 소개내용 (note) */}
            <div className="space-y-2">
              <Label htmlFor="note">소개내용</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => handleFormChange('note', e.target.value)}
                placeholder="카테고리에 대한 간단한 소개를 입력하세요."
                rows={3}
              />
            </div>

            {/* 표시 순서 */}
            <div className="space-y-2">
              <Label htmlFor="orderIndex">표시 순서 *</Label>
              <Input
                id="orderIndex"
                type="number"
                value={form.orderIndex}
                onChange={(e) => handleOrderIndexChange(parseInt(e.target.value) || 0)}
                placeholder="1"
                className={orderIndexError ? 'border-destructive' : ''}
              />
              {orderIndexError && (
                <p className="text-xs text-destructive">{orderIndexError}</p>
              )}
            </div>

            {/* 활성화 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  handleFormChange('isActive', checked as boolean)
                }
              />
              <Label htmlFor="isActive">활성화</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!!orderIndexError}>
              {editingCategory ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카테고리 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingCategory?.categoryName}</strong> 카테고리를
              삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
