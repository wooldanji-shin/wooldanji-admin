'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  Calendar,
  GripVertical,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';
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

interface AdCategory {
  id: string;
  categoryName: string;
  iconUrl: string | null;
  weekdayEnabled: boolean;
  weekdayStartTime: string | null;
  weekdayEndTime: string | null;
  weekendEnabled: boolean;
  weekendStartTime: string | null;
  weekendEndTime: string | null;
  isActive: boolean;
  createdAt: string;
}

interface HomeSection {
  id: string;
  sectionType: 'AD_CATEGORY' | 'NOTIFICATION' | 'ANNOUNCEMENT' | 'EVENT';
  orderIndex: number;
  adCategoryId: string | null;
  isActive: boolean;
  // Fields for fixed sections (NOTIFICATION, ANNOUNCEMENT, EVENT)
  iconUrl?: string | null;
  displayName?: string | null;
  // Fields from ad_categories (for AD_CATEGORY type only)
  categoryName?: string;
  adCategoryIconUrl?: string | null;
  weekdayEnabled?: boolean;
  weekdayStartTime?: string | null;
  weekdayEndTime?: string | null;
  weekendEnabled?: boolean;
  weekendStartTime?: string | null;
  weekendEndTime?: string | null;
  isFixed?: boolean;
}

function SortableRow({ section, onEdit, onDelete }: {
  section: HomeSection;
  onEdit: (section: HomeSection) => void;
  onDelete: (section: HomeSection) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  const getSectionLabel = () => {
    if (section.sectionType === 'AD_CATEGORY') {
      return section.categoryName || '광고 카테고리';
    }

    // 고정 섹션: 기본 표시명만 사용 (수정 불가)
    switch (section.sectionType) {
      case 'NOTIFICATION':
        return '알림';
      case 'ANNOUNCEMENT':
        return '공지사항';
      case 'EVENT':
        return '이벤트';
      default:
        return section.sectionType;
    }
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
          <span className='font-medium'>{section.orderIndex}</span>
        </div>
      </TableCell>
      <TableCell className='font-medium'>
        <div className='flex items-center gap-2'>
          {/* 아이콘 표시: AD_CATEGORY는 adCategoryIconUrl, 고정 섹션은 iconUrl */}
          {(section.adCategoryIconUrl || section.iconUrl) && (
            <img
              src={section.adCategoryIconUrl || section.iconUrl || ''}
              alt="섹션 아이콘"
              className="w-6 h-6 object-contain"
            />
          )}
          {getSectionLabel()}
          {section.isFixed && (
            <Badge variant='secondary' className='text-xs'>고정</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {section.sectionType === 'AD_CATEGORY' ? (
          section.weekdayEnabled ? (
            <div className='flex items-center gap-2 text-sm'>
              <Clock className='h-4 w-4 text-muted-foreground' />
              {formatTime(section.weekdayStartTime)} ~ {formatTime(section.weekdayEndTime)}
            </div>
          ) : (
            <Badge variant='secondary'>비활성</Badge>
          )
        ) : (
          <span className='text-muted-foreground'>-</span>
        )}
      </TableCell>
      <TableCell>
        {section.sectionType === 'AD_CATEGORY' ? (
          section.weekendEnabled ? (
            <div className='flex items-center gap-2 text-sm'>
              <Calendar className='h-4 w-4 text-muted-foreground' />
              {formatTime(section.weekendStartTime)} ~ {formatTime(section.weekendEndTime)}
            </div>
          ) : (
            <Badge variant='secondary'>비활성</Badge>
          )
        ) : (
          <span className='text-muted-foreground'>-</span>
        )}
      </TableCell>
      <TableCell>
        {section.isActive ? (
          <Badge className='bg-green-500'>활성</Badge>
        ) : (
          <Badge variant='secondary'>비활성</Badge>
        )}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2' onClick={(e) => e.stopPropagation()}>
          {/* 모든 섹션에 수정 버튼 표시 */}
          <Button
            variant='ghost'
            size='sm'
            onClick={(e) => {
              e.stopPropagation();
              onEdit(section);
            }}
          >
            <Edit className='h-4 w-4' />
          </Button>
          {/* 삭제는 AD_CATEGORY만 가능 */}
          {section.sectionType === 'AD_CATEGORY' && (
            <Button
              variant='ghost'
              size='sm'
              onClick={(e) => {
                e.stopPropagation();
                onDelete(section);
              }}
              className='text-destructive hover:text-destructive'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdCategoriesPage() {
  const supabase = createClient();

  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [currentCategoryId, setCurrentCategoryId] = useState<string>('');
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string>('');
  const [form, setForm] = useState({
    categoryName: '',
    displayName: '', // 고정 섹션용
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
  const [orderIndexError, setOrderIndexError] = useState<string | null>(null);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingSection, setDeletingSection] = useState<HomeSection | null>(null);

  // 섹션 목록 조회 (ad_categories + home_sections 통합)
  const fetchSections = useCallback(async () => {
    setLoading(true);

    try {
      // 1. home_sections 조회 (새로운 iconUrl, displayName 컬럼 포함)
      const { data: homeSections, error: sectionsError } = await supabase
        .from('home_sections')
        .select('*')
        .order('orderIndex', { ascending: true });

      if (sectionsError) throw sectionsError;

      // 2. ad_categories 조회
      const { data: adCategories, error: categoriesError } = await supabase
        .from('ad_categories')
        .select('*');

      if (categoriesError) throw categoriesError;

      // 3. home_sections와 ad_categories 병합
      const mergedSections: HomeSection[] = (homeSections || []).map((section: any) => {
        if (section.sectionType === 'AD_CATEGORY') {
          const category = (adCategories || []).find((cat: any) => cat.id === section.adCategoryId);
          return {
            ...section,
            categoryName: category?.categoryName,
            adCategoryIconUrl: category?.iconUrl, // AD_CATEGORY의 아이콘은 ad_categories에서
            weekdayEnabled: category?.weekdayEnabled,
            weekdayStartTime: category?.weekdayStartTime,
            weekdayEndTime: category?.weekdayEndTime,
            weekendEnabled: category?.weekendEnabled,
            weekendStartTime: category?.weekendStartTime,
            weekendEndTime: category?.weekendEndTime,
            isFixed: false,
          };
        } else {
          // 고정 섹션 (NOTIFICATION, ANNOUNCEMENT, EVENT)
          // iconUrl, displayName은 home_sections 테이블에서 직접 가져옴
          return {
            ...section,
            isFixed: true,
          };
        }
      });

      setSections(mergedSections);
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      toast.error('섹션 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // orderIndex 중복 체크
  const checkOrderIndexDuplicate = (orderIndex: number, excludeId?: string) => {
    return sections.some(s => s.orderIndex === orderIndex && s.id !== excludeId);
  };

  // 카테고리/섹션 생성/수정
  const handleSave = async () => {
    // orderIndex 중복 체크
    if (checkOrderIndexDuplicate(form.orderIndex, editingSection?.id)) {
      setOrderIndexError('순서가 중복됩니다');
      return;
    }
    setOrderIndexError(null);

    try {
      if (editingSection?.sectionType === 'AD_CATEGORY') {
        // AD_CATEGORY 섹션 수정
        if (!form.categoryName) {
          toast.error('카테고리 이름을 입력해주세요.');
          return;
        }

        const categoryData = {
          categoryName: form.categoryName,
          iconUrl: form.iconUrl || null,
          weekdayEnabled: form.weekdayEnabled,
          weekdayStartTime: form.weekdayEnabled && !form.weekdayAllDay ? form.weekdayStartTime : null,
          weekdayEndTime: form.weekdayEnabled && !form.weekdayAllDay ? form.weekdayEndTime : null,
          weekendEnabled: form.weekendEnabled,
          weekendStartTime: form.weekendEnabled && !form.weekendAllDay ? form.weekendStartTime : null,
          weekendEndTime: form.weekendEnabled && !form.weekendAllDay ? form.weekendEndTime : null,
          isActive: form.isActive,
        };

        if (editingSection) {
          // 수정
          const { error: updateError } = await supabase
            .from('ad_categories')
            .update(categoryData)
            .eq('id', editingSection.adCategoryId!);

          if (updateError) throw updateError;

          // home_sections의 orderIndex도 업데이트
          const { error: sectionUpdateError } = await supabase
            .from('home_sections')
            .update({ orderIndex: form.orderIndex })
            .eq('id', editingSection.id);

          if (sectionUpdateError) throw sectionUpdateError;
        } else {
          // 생성
          const { data: newCategory, error: insertError } = await supabase
            .from('ad_categories')
            .insert(categoryData)
            .select()
            .single();

          if (insertError) throw insertError;

          // home_sections에도 추가
          const { error: sectionInsertError } = await supabase
            .from('home_sections')
            .insert({
              sectionType: 'AD_CATEGORY',
              orderIndex: form.orderIndex,
              adCategoryId: newCategory.id,
              isActive: form.isActive,
            });

          if (sectionInsertError) throw sectionInsertError;
        }
      } else {
        // 고정 섹션 (NOTIFICATION, ANNOUNCEMENT, EVENT) 수정
        // 아이콘만 변경 가능
        const sectionData: any = {
          iconUrl: form.iconUrl || null,
          orderIndex: form.orderIndex,
          isActive: form.isActive,
        };

        const { error: updateError } = await supabase
          .from('home_sections')
          .update(sectionData)
          .eq('id', editingSection!.id);

        if (updateError) throw updateError;
      }

      setUploadedIconUrl('');
      setIsDialogOpen(false);
      resetForm();
      fetchSections();
    } catch (err: any) {
      console.error('Failed to save section:', err);
      toast.error(err.message || '섹션 저장에 실패했습니다.');
    }
  };

  // 카테고리 삭제
  const handleDeleteClick = (section: HomeSection) => {
    setDeletingSection(section);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSection) return;

    try {
      // ad_categories 삭제 (CASCADE로 home_sections도 자동 삭제)
      const { error: deleteError } = await supabase
        .from('ad_categories')
        .delete()
        .eq('id', deletingSection.adCategoryId!);

      if (deleteError) throw deleteError;

      setDeleteDialog(false);
      setDeletingSection(null);
      fetchSections();
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast.error('카테고리 삭제에 실패했습니다.');
    }
  };

  // 드래그&드롭 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    const newSections = arrayMove(sections, oldIndex, newIndex);

    // orderIndex 재설정
    const updatedSections = newSections.map((section, index) => ({
      ...section,
      orderIndex: index + 1,
    }));

    setSections(updatedSections);

    // DB 업데이트 - UNIQUE 제약조건 충돌 방지를 위해 2단계로 진행
    try {
      // 1단계: 모든 orderIndex를 임시 음수 값으로 변경 (충돌 방지)
      for (let i = 0; i < updatedSections.length; i++) {
        await supabase
          .from('home_sections')
          .update({ orderIndex: -(i + 1) })
          .eq('id', updatedSections[i].id);
      }

      // 2단계: 최종 orderIndex 값으로 변경
      for (const section of updatedSections) {
        await supabase
          .from('home_sections')
          .update({ orderIndex: section.orderIndex })
          .eq('id', section.id);
      }
    } catch (err) {
      console.error('Failed to update order:', err);
      toast.error('순서 변경에 실패했습니다.');
      fetchSections(); // 실패 시 다시 조회
    }
  };

  // 편집 시작
  const handleEditClick = (section: HomeSection) => {
    setEditingSection(section);
    setUploadedIconUrl('');

    if (section.sectionType === 'AD_CATEGORY') {
      // AD_CATEGORY 섹션 편집
      setCurrentCategoryId(section.adCategoryId || '');
      setForm({
        categoryName: section.categoryName || '',
        displayName: '',
        iconUrl: section.adCategoryIconUrl || '',
        orderIndex: section.orderIndex,
        weekdayEnabled: section.weekdayEnabled || false,
        weekdayAllDay: !section.weekdayStartTime && !section.weekdayEndTime,
        weekdayStartTime: section.weekdayStartTime?.substring(0, 5) || '09:00',
        weekdayEndTime: section.weekdayEndTime?.substring(0, 5) || '18:00',
        weekendEnabled: section.weekendEnabled || false,
        weekendAllDay: !section.weekendStartTime && !section.weekendEndTime,
        weekendStartTime: section.weekendStartTime?.substring(0, 5) || '10:00',
        weekendEndTime: section.weekendEndTime?.substring(0, 5) || '17:00',
        isActive: section.isActive,
      });
    } else {
      // 고정 섹션 (NOTIFICATION, ANNOUNCEMENT, EVENT) 편집
      // 아이콘만 변경 가능, 표시명은 기본값 고정
      setCurrentCategoryId(section.id); // 고정 섹션은 section.id 사용
      setForm({
        categoryName: '',
        displayName: '', // 사용하지 않음
        iconUrl: section.iconUrl || '',
        orderIndex: section.orderIndex,
        weekdayEnabled: false,
        weekdayAllDay: false,
        weekdayStartTime: '09:00',
        weekdayEndTime: '18:00',
        weekendEnabled: false,
        weekendAllDay: false,
        weekendStartTime: '10:00',
        weekendEndTime: '17:00',
        isActive: section.isActive,
      });
    }

    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingSection(null);
    const newId = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCurrentCategoryId(newId);
    setUploadedIconUrl('');
    setOrderIndexError(null);
    setForm({
      categoryName: '',
      displayName: '',
      iconUrl: '',
      orderIndex: sections.length + 1,
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

  // orderIndex 변경 시 중복 체크
  const handleOrderIndexChange = (value: number) => {
    setForm({ ...form, orderIndex: value });
    if (checkOrderIndexDuplicate(value, editingSection?.id)) {
      setOrderIndexError('순서가 중복됩니다');
    } else {
      setOrderIndexError(null);
    }
  };

  // 다이얼로그 닫기 처리
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      if (uploadedIconUrl && uploadedIconUrl !== (editingSection?.iconUrl || '')) {
        try {
          const bucket = 'advertisements';
          const urlParts = uploadedIconUrl.split('/');
          const storagePathIndex = urlParts.indexOf('advertisements');
          if (storagePathIndex !== -1) {
            const path = urlParts.slice(storagePathIndex + 1).join('/');
            await supabase.storage.from(bucket).remove([path]);
          }
        } catch (err) {
          console.error('Failed to delete uploaded icon:', err);
        }
      }
      setUploadedIconUrl('');
      setOrderIndexError(null);
    }
    setIsDialogOpen(open);
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='홈 섹션 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Actions */}
        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground'>
            드래그하여 섹션 순서를 변경할 수 있습니다
          </p>
          <Button onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}>
            <Plus className='h-4 w-4 mr-2' />
            광고 카테고리 추가
          </Button>
        </div>

        {/* Sections Table with Drag & Drop */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow className='border-border hover:bg-transparent'>
                      <TableHead className='text-muted-foreground w-32'>순서</TableHead>
                      <TableHead className='text-muted-foreground'>섹션</TableHead>
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
                    ) : sections.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                          섹션이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <SortableContext
                        items={sections.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {sections.map((section) => (
                          <SortableRow
                            key={section.id}
                            section={section}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>
              {editingSection
                ? editingSection.sectionType === 'AD_CATEGORY'
                  ? '카테고리 수정'
                  : '섹션 수정'
                : '카테고리 추가'}
            </DialogTitle>
            <DialogDescription>
              {editingSection?.sectionType === 'AD_CATEGORY'
                ? '광고 카테고리 정보를 입력합니다.'
                : '섹션 정보를 입력합니다.'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4 max-h-[70vh] overflow-y-auto'>
            {/* AD_CATEGORY 타입: 카테고리 이름 */}
            {editingSection?.sectionType === 'AD_CATEGORY' && (
              <div className='space-y-2'>
                <Label htmlFor='categoryName'>카테고리 이름 *</Label>
                <Input
                  id='categoryName'
                  value={form.categoryName}
                  onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                  placeholder='필라테스, 영어학원 등'
                />
              </div>
            )}

            {/* 고정 섹션: 섹션 타입 표시 (읽기 전용) */}
            {editingSection?.sectionType !== 'AD_CATEGORY' && (
              <div className='space-y-2'>
                <Label>섹션 타입</Label>
                <Input
                  value={
                    editingSection?.sectionType === 'NOTIFICATION'
                      ? '알림'
                      : editingSection?.sectionType === 'ANNOUNCEMENT'
                      ? '공지사항'
                      : editingSection?.sectionType === 'EVENT'
                      ? '이벤트'
                      : ''
                  }
                  disabled
                  className='bg-muted'
                />
                <p className='text-xs text-muted-foreground'>
                  섹션 타입은 변경할 수 없습니다.
                </p>
              </div>
            )}

            <div className='space-y-2'>
              <Label>
                {editingSection?.sectionType === 'AD_CATEGORY'
                  ? '카테고리 아이콘'
                  : '섹션 아이콘'}
              </Label>
              <ImageUpload
                bucket='advertisements'
                storagePath={
                  editingSection?.sectionType === 'AD_CATEGORY'
                    ? 'categories/icons'
                    : 'sections/icons'
                }
                value={form.iconUrl}
                onChange={(url) => {
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
              <Label htmlFor='orderIndex'>표시 순서 *</Label>
              <Input
                id='orderIndex'
                type='number'
                value={form.orderIndex}
                onChange={(e) => handleOrderIndexChange(parseInt(e.target.value) || 0)}
                placeholder='1'
                className={orderIndexError ? 'border-destructive' : ''}
              />
              {orderIndexError ? (
                <p className='text-xs text-destructive'>{orderIndexError}</p>
              ) : (
                <p className='text-xs text-muted-foreground'>숫자가 작을수록 상단에 표시됩니다.</p>
              )}
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox
                id='isActive'
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked as boolean })}
              />
              <Label htmlFor='isActive'>활성화</Label>
            </div>

            {/* 시간 설정은 AD_CATEGORY 타입일 때만 표시 */}
            {editingSection?.sectionType === 'AD_CATEGORY' && (
              <>
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
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!!orderIndexError}>
              {editingSection ? '수정' : '생성'}
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
              정말로 <strong>{deletingSection?.categoryName}</strong> 카테고리를 삭제하시겠습니까?
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
