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

interface HomeSection {
  id: string;
  sectionType: 'AD_CATEGORY' | 'NOTIFICATION' | 'ANNOUNCEMENT' | 'EVENT';
  orderIndex: number;
  adCategoryId: string | null;
  isActive: boolean;
  autoSelectStartTime: string | null;
  autoSelectEndTime: string | null;
  autoSelectStartDate: string | null;
  autoSelectEndDate: string | null;
  // Fields for fixed sections
  iconUrl?: string | null;
  displayName?: string | null;
  // Fields from ad_categories (for AD_CATEGORY type only)
  categoryName?: string;
  adCategoryIconUrl?: string | null;
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
    
    if (section.displayName) {
      return section.displayName;
    }

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
        {section.autoSelectStartTime ? (
          <div className='flex flex-col text-sm'>
            <div className='flex items-center gap-1'>
              <Calendar className='h-3 w-3 text-muted-foreground' />
              <span>
                {section.autoSelectStartDate || '상시'} ~ {section.autoSelectEndDate || '상시'}
              </span>
            </div>
            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3 text-muted-foreground' />
              <span>
                {formatTime(section.autoSelectStartTime)} ~ {formatTime(section.autoSelectEndTime)}
              </span>
            </div>
          </div>
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
          {section.sectionType === 'AD_CATEGORY' && !section.isFixed && (
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [currentId, setCurrentId] = useState<string>('');
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string>('');
  const [form, setForm] = useState({
    categoryName: '',
    iconUrl: '',
    orderIndex: 0,
    isActive: true,
    useSchedule: false,
    autoSelectStartDate: '',
    autoSelectEndDate: '',
    autoSelectStartTime: '09:00',
    autoSelectEndTime: '18:00',
  });
  const [orderIndexError, setOrderIndexError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingSection, setDeletingSection] = useState<HomeSection | null>(null);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const { data: homeSections, error: sectionsError } = await supabase
        .from('home_sections')
        .select('*')
        .order('orderIndex', { ascending: true });
      if (sectionsError) throw sectionsError;

      const adCategoryIds = homeSections
        .filter(s => s.sectionType === 'AD_CATEGORY' && s.adCategoryId)
        .map(s => s.adCategoryId!);

      let adCategories: any[] = [];
      if (adCategoryIds.length > 0) {
        const { data: cats, error: categoriesError } = await supabase
          .from('ad_categories')
          .select('id, categoryName, iconUrl')
          .in('id', adCategoryIds);
        if (categoriesError) throw categoriesError;
        adCategories = cats;
      }
      
      const dbSections = homeSections.map((section: any) => {
          if (section.sectionType === 'AD_CATEGORY') {
            const category = adCategories.find(cat => cat.id === section.adCategoryId);
            return { ...section, categoryName: category?.categoryName, adCategoryIconUrl: category?.iconUrl, isFixed: false };
          }
          return { ...section, isFixed: true, displayName: section.displayName };
      });
      
      const sectionTypesInDB = new Set(dbSections.map(s => s.sectionType));
      const fixedSectionsToAdd:any[] = [];
      const fixedSectionTypes = ['NOTIFICATION', 'ANNOUNCEMENT', 'EVENT'];
      
      fixedSectionTypes.forEach(type => {
        if (!sectionTypesInDB.has(type)) {
          fixedSectionsToAdd.push({
            id: `${type.toLowerCase()}-placeholder`,
            sectionType: type,
            displayName: type === 'NOTIFICATION' ? '알림' : type === 'ANNOUNCEMENT' ? '공지사항' : '이벤트',
            isFixed: true,
            orderIndex: dbSections.length + fixedSectionsToAdd.length + 1,
            isActive: false, // Default to inactive if not in DB
            adCategoryId: null,
          });
        }
      });

      const allSections = [...dbSections, ...fixedSectionsToAdd].sort((a,b) => a.orderIndex - b.orderIndex);
      
      setSections(allSections);

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

  const validateSchedule = useCallback((currentForm: typeof form, currentSectionId?: string) => {
    if (!currentForm.useSchedule) {
      setScheduleError(null);
      return;
    }

    const { autoSelectStartDate, autoSelectEndDate, autoSelectStartTime, autoSelectEndTime } = currentForm;

    if (!autoSelectStartDate || !autoSelectEndDate || !autoSelectStartTime || !autoSelectEndTime) {
      setScheduleError('스케줄을 사용하려면 모든 기간과 시간을 입력해야 합니다.');
      return;
    }

    const newStart = new Date(`${autoSelectStartDate}T${autoSelectStartTime}`);
    const newEnd = new Date(`${autoSelectEndDate}T${autoSelectEndTime}`);

    if (newStart >= newEnd) {
      setScheduleError('시작 시점은 종료 시점보다 빨라야 합니다.');
      return;
    }

    for (const section of sections) {
      if (section.id === currentSectionId) continue;
      if (!section.autoSelectStartTime) continue;
      
      const existingStart = new Date(`${section.autoSelectStartDate}T${section.autoSelectStartTime}`);
      const existingEnd = new Date(`${section.autoSelectEndDate}T${section.autoSelectEndTime}`);

      // Check for overlap: (StartA < EndB) and (StartB < EndA)
      if (newStart < existingEnd && existingStart < newEnd) {
        setScheduleError(`'${section.categoryName || section.displayName}' 섹션의 스케줄과 겹칩니다.`);
        return;
      }
    }

    setScheduleError(null);
  }, [sections]);


  useEffect(() => {
    validateSchedule(form, editingSection?.id);
  }, [form.useSchedule, form.autoSelectStartDate, form.autoSelectEndDate, form.autoSelectStartTime, form.autoSelectEndTime, validateSchedule, editingSection, form]);


  // orderIndex 중복 체크
  const checkOrderIndexDuplicate = (orderIndex: number, excludeId?: string) => {
    return sections.some(s => s.orderIndex === orderIndex && !s.id.includes('placeholder') && s.id !== excludeId);
  };

  // 카테고리/섹션 생성/수정
  const handleSave = async () => {
    if (checkOrderIndexDuplicate(form.orderIndex, editingSection?.id)) {
      setOrderIndexError('순서가 중복됩니다');
      return;
    }
    setOrderIndexError(null);

    if (scheduleError) {
      toast.error('스케줄이 중복됩니다. 확인 후 다시 시도해주세요.');
      return;
    }

    try {
      const isCreatingAdCategory = !editingSection && !deletingSection;
      let adCategoryIdToLink = editingSection?.adCategoryId;

      // 1. 광고 카테고리 생성 (필요한 경우)
      if (isCreatingAdCategory) {
        if (!form.categoryName) {
          toast.error('카테고리 이름을 입력해주세요.');
          return;
        }
        const { data: newCategory, error: catError } = await supabase
          .from('ad_categories')
          .insert({ categoryName: form.categoryName, iconUrl: form.iconUrl || null, isActive: form.isActive })
          .select().single();
        if (catError) throw catError;
        adCategoryIdToLink = newCategory.id;
      } else if (editingSection?.sectionType === 'AD_CATEGORY' && !editingSection.isFixed) {
        // 광고 카테고리 정보 업데이트 (이름 제외)
        const { error: catUpdateError } = await supabase
          .from('ad_categories')
          .update({ iconUrl: form.iconUrl || null, isActive: form.isActive })
          .eq('id', editingSection.adCategoryId!);
        if (catUpdateError) throw catUpdateError;
      }

      // 2. home_sections 생성 또는 업데이트
      const sectionData: any = {
        orderIndex: form.orderIndex,
        isActive: form.isActive,
        autoSelectStartDate: form.useSchedule ? form.autoSelectStartDate : null,
        autoSelectEndDate: form.useSchedule ? form.autoSelectEndDate : null,
        autoSelectStartTime: form.useSchedule ? form.autoSelectStartTime : null,
        autoSelectEndTime: form.useSchedule ? form.autoSelectEndTime : null,
      };

      if (editingSection?.isFixed || isCreatingAdCategory) {
        sectionData.displayName = editingSection?.displayName || form.categoryName;
        sectionData.iconUrl = form.iconUrl || null;
      }
      
      if(isCreatingAdCategory){
        sectionData.sectionType = 'AD_CATEGORY';
        sectionData.adCategoryId = adCategoryIdToLink;
      }


      if (editingSection) {
        if (editingSection.id.includes('placeholder')) {
          // This is a fixed section that doesn't exist in the DB yet, so insert it.
          sectionData.sectionType = editingSection.sectionType;
          sectionData.displayName = editingSection.displayName;
          const { error } = await supabase.from('home_sections').insert(sectionData);
          if (error) throw error;
        } else {
          // Update existing section
          const { error } = await supabase.from('home_sections').update(sectionData).eq('id', editingSection.id);
          if (error) throw error;
        }
      } else { // Crate new AD_CATEGORY section
         const { error } = await supabase.from('home_sections').insert(sectionData);
         if (error) throw error;
      }


      setUploadedIconUrl('');
      setIsDialogOpen(false);
      resetForm();
      fetchSections();
      toast.success('섹션이 성공적으로 저장되었습니다.');

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
    if (!deletingSection || !deletingSection.adCategoryId) return;

    try {
      // ad_categories에서 삭제 -> home_sections는 ON DELETE CASCADE로 자동 삭제됨
      const { error: deleteError } = await supabase
        .from('ad_categories')
        .delete()
        .eq('id', deletingSection.adCategoryId);

      if (deleteError) throw deleteError;
      
      toast.success('카테고리가 성공적으로 삭제되었습니다.');
      setDeleteDialog(false);
      setDeletingSection(null);
      fetchSections();
    } catch (err:any) {
      console.error('Failed to delete category:', err);
      toast.error(err.message || '카테고리 삭제에 실패했습니다.');
    }
  };

  // 드래그&드롭 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const newSections = arrayMove(sections, oldIndex, newIndex);

    const updatedSections = newSections.map((section, index) => ({
      ...section,
      orderIndex: index + 1,
    }));
    setSections(updatedSections);

    try {
      const updates = updatedSections
        .filter(s => !s.id.includes('placeholder'))
        .map(s => supabase.from('home_sections').update({ orderIndex: s.orderIndex }).eq('id', s.id));
      
      const results = await Promise.all(updates);
      results.forEach(res => { if(res.error) throw res.error; });

    } catch (err) {
      console.error('Failed to update order:', err);
      toast.error('순서 변경에 실패했습니다.');
      fetchSections();
    }
  };

  // 편집 시작
  const handleEditClick = (section: HomeSection) => {
    setEditingSection(section);
    setUploadedIconUrl('');
    setCurrentId(section.id);
    
    const useSchedule = !!section.autoSelectStartTime;

    setForm({
      categoryName: section.categoryName || '',
      iconUrl: section.isFixed ? section.iconUrl || '' : section.adCategoryIconUrl || '',
      orderIndex: section.orderIndex,
      isActive: section.isActive,
      useSchedule: useSchedule,
      autoSelectStartDate: section.autoSelectStartDate || '',
      autoSelectEndDate: section.autoSelectEndDate || '',
      autoSelectStartTime: section.autoSelectStartTime?.substring(0, 5) || '09:00',
      autoSelectEndTime: section.autoSelectEndTime?.substring(0, 5) || '18:00',
    });

    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingSection(null);
    setCurrentId(`new_category_${Date.now()}`);
    setUploadedIconUrl('');
    setOrderIndexError(null);
    setScheduleError(null);
    setForm({
      categoryName: '',
      iconUrl: '',
      orderIndex: sections.length + 1,
      isActive: true,
      useSchedule: false,
      autoSelectStartDate: '',
      autoSelectEndDate: '',
      autoSelectStartTime: '09:00',
      autoSelectEndTime: '18:00',
    });
  };

  const handleFormChange = (field: keyof typeof form, value: any) => {
    setForm(prev => ({...prev, [field]: value}));
  }

  // orderIndex 변경 시 중복 체크
  const handleOrderIndexChange = (value: number) => {
    handleFormChange('orderIndex', value);
    if (checkOrderIndexDuplicate(value, editingSection?.id)) {
      setOrderIndexError('순서가 중복됩니다');
    } else {
      setOrderIndexError(null);
    }
  };

  // 다이얼로그 닫기 처리
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      if (uploadedIconUrl && uploadedIconUrl !== (editingSection?.iconUrl || editingSection?.adCategoryIconUrl || '')) {
        try {
          const path = new URL(uploadedIconUrl).pathname.split('/').slice(2).join('/');
          await supabase.storage.from(path.split('/')[0]).remove([path.split('/').slice(1).join('/')]);
        } catch (err) {
          console.error('Failed to delete uploaded icon:', err);
        }
      }
      resetForm();
    }
    setIsDialogOpen(open);
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='홈 섹션 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        <div className='flex justify-between items-center'>
          <p className='text-sm text-muted-foreground'>
            드래그하여 섹션 순서를 변경할 수 있습니다.
          </p>
          <Button onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}>
            <Plus className='h-4 w-4 mr-2' />
            광고 카테고리 추가
          </Button>
        </div>

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
                      <TableHead className='text-muted-foreground'>자동 선택 스케줄</TableHead>
                      <TableHead className='text-muted-foreground'>상태</TableHead>
                      <TableHead className='text-muted-foreground text-right'>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className='text-center py-12 text-muted-foreground'>
                          로딩 중...
                        </TableCell>
                      </TableRow>
                    ) : sections.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className='text-center py-12 text-muted-foreground'>
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>
              {editingSection ? '섹션 수정' : '광고 카테고리 추가'}
            </DialogTitle>
            <DialogDescription>
              {editingSection?.isFixed 
                ? "고정 섹션의 순서, 아이콘, 스케줄 등을 수정합니다."
                : "새로운 광고 카테고리를 추가하거나 기존 카테고리 정보를 수정합니다."
              }
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4 max-h-[70vh] overflow-y-auto'>
            
            {editingSection?.isFixed ? (
               <div className='space-y-2'>
                <Label>섹션 타입</Label>
                <Input value={editingSection.displayName || ''} disabled className='bg-muted' />
              </div>
            ) : (
              <div className='space-y-2'>
                <Label htmlFor='categoryName'>카테고리 이름 *</Label>
                <Input
                  id='categoryName'
                  value={form.categoryName}
                  onChange={(e) => handleFormChange('categoryName', e.target.value)}
                  placeholder='필라테스, 영어학원 등'
                  disabled={!!editingSection}
                />
                {editingSection && <p className='text-xs text-muted-foreground'>카테고리 이름은 변경할 수 없습니다.</p>}
              </div>
            )}

            <div className='space-y-2'>
              <Label>아이콘</Label>
              <ImageUpload
                bucket='advertisements'
                storagePath={editingSection?.isFixed ? 'sections/icons' : 'categories/icons'}
                value={form.iconUrl || ''}
                onChange={(url) => handleFormChange('iconUrl', url)}
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
                value={form.orderIndex || 0}
                onChange={(e) => handleOrderIndexChange(parseInt(e.target.value) || 0)}
                placeholder='1'
                className={orderIndexError ? 'border-destructive' : ''}
              />
              {orderIndexError && <p className='text-xs text-destructive'>{orderIndexError}</p>}
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox
                id='isActive'
                checked={form.isActive}
                onCheckedChange={(checked) => handleFormChange('isActive', checked as boolean)}
              />
              <Label htmlFor='isActive'>활성화</Label>
            </div>

            <div className='border-t pt-4 space-y-4'>
              <h4 className='font-medium'>자동 선택 스케줄 설정</h4>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='useSchedule'
                  checked={form.useSchedule}
                  onCheckedChange={(checked) => handleFormChange('useSchedule', checked as boolean)}
                />
                <Label htmlFor='useSchedule'>스케줄 사용</Label>
              </div>

              {form.useSchedule && (
                <div className='space-y-4 rounded-md border p-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='autoSelectStartDate'>시작 날짜</Label>
                      <Input
                        id='autoSelectStartDate'
                        type='date'
                        value={form.autoSelectStartDate || ''}
                        onChange={(e) => handleFormChange('autoSelectStartDate', e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='autoSelectEndDate'>종료 날짜</Label>
                      <Input
                        id='autoSelectEndDate'
                        type='date'
                        value={form.autoSelectEndDate || ''}
                        onChange={(e) => handleFormChange('autoSelectEndDate', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='autoSelectStartTime'>시작 시간</Label>
                      <Input
                        id='autoSelectStartTime'
                        type='time'
                        value={form.autoSelectStartTime || ''}
                        onChange={(e) => handleFormChange('autoSelectStartTime', e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='autoSelectEndTime'>종료 시간</Label>
                      <Input
                        id='autoSelectEndTime'
                        type='time'
                        value={form.autoSelectEndTime || ''}
                        onChange={(e) => handleFormChange('autoSelectEndTime', e.target.value)}
                      />
                    </div>
                  </div>
                  {scheduleError && <p className='text-sm text-destructive'>{scheduleError}</p>}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => handleDialogClose(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!!orderIndexError || !!scheduleError}>
              {editingSection ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카테고리 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingSection?.categoryName}</strong> 카테고리를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 연관된 홈 섹션도 함께 삭제됩니다.
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
