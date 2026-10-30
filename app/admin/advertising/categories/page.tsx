'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { PageContent, PageShell } from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { TableSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Input,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
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
    <Table.Tr
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <Table.Td>
        <Group
          gap='xs'
          wrap='nowrap'
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          {...listeners}
        >
          <Text c='dimmed' component='span' style={{ display: 'flex' }}>
            <GripVertical size={16} />
          </Text>
          <Text component='span' size='sm' fw={500}>{section.orderIndex}</Text>
        </Group>
      </Table.Td>
      <Table.Td fw={500}>
        <Group gap='xs' wrap='nowrap'>
          {(section.adCategoryIconUrl || section.iconUrl) && (
            <img
              src={section.adCategoryIconUrl || section.iconUrl || ''}
              alt="섹션 아이콘"
              className="w-6 h-6 object-contain"
            />
          )}
          {getSectionLabel()}
          {section.isFixed && (
            <Badge variant='light' color='gray' size='sm'>고정</Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        {section.autoSelectStartTime ? (
          <Stack gap={2}>
            <Group gap={4} wrap='nowrap'>
              <Text c='dimmed' component='span' style={{ display: 'flex' }}>
                <Calendar size={12} />
              </Text>
              <Text size='sm' component='span'>
                {section.autoSelectStartDate || '상시'} ~ {section.autoSelectEndDate || '상시'}
              </Text>
            </Group>
            <Group gap={4} wrap='nowrap'>
              <Text c='dimmed' component='span' style={{ display: 'flex' }}>
                <Clock size={12} />
              </Text>
              <Text size='sm' component='span'>
                {formatTime(section.autoSelectStartTime)} ~ {formatTime(section.autoSelectEndTime)}
              </Text>
            </Group>
          </Stack>
        ) : (
          <Text component='span' size='sm' c='dimmed'>-</Text>
        )}
      </Table.Td>
      <Table.Td>
        {section.isActive ? (
          <Badge variant='light' color='green'>활성</Badge>
        ) : (
          <Badge variant='light' color='gray'>비활성</Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify='flex-end' wrap='nowrap' onClick={(e) => e.stopPropagation()}>
          <ActionIcon
            variant='subtle'
            color='gray'
            aria-label='수정'
            onClick={(e) => {
              e.stopPropagation();
              onEdit(section);
            }}
          >
            <Edit size={16} />
          </ActionIcon>
          {section.sectionType === 'AD_CATEGORY' && !section.isFixed && (
            <ActionIcon
              variant='subtle'
              color='red'
              aria-label='삭제'
              onClick={(e) => {
                e.stopPropagation();
                onDelete(section);
              }}
            >
              <Trash2 size={16} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
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
  const [, setCurrentId] = useState<string>('');
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
  const [deleting, setDeleting] = useState(false);

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

      // 날짜 범위가 겹치는지 먼저 확인
      const newStartDate = new Date(autoSelectStartDate);
      const newEndDate = new Date(autoSelectEndDate);
      const existingStartDate = new Date(section.autoSelectStartDate!);
      const existingEndDate = new Date(section.autoSelectEndDate!);

      // 날짜 범위가 겹치지 않으면 패스
      if (newEndDate < existingStartDate || existingEndDate < newStartDate) {
        continue;
      }

      // 날짜 범위가 겹칠 때만 시간 체크
      const newStartTimeMinutes = parseInt(autoSelectStartTime.split(':')[0]) * 60 + parseInt(autoSelectStartTime.split(':')[1]);
      const newEndTimeMinutes = parseInt(autoSelectEndTime.split(':')[0]) * 60 + parseInt(autoSelectEndTime.split(':')[1]);
      const existingStartTimeMinutes = parseInt(section.autoSelectStartTime.split(':')[0]) * 60 + parseInt(section.autoSelectStartTime.split(':')[1]);
      const existingEndTimeMinutes = parseInt(section.autoSelectEndTime.split(':')[0]) * 60 + parseInt(section.autoSelectEndTime.split(':')[1]);

      // 시간이 겹치는지 확인: (StartA < EndB) and (StartB < EndA)
      if (newStartTimeMinutes < existingEndTimeMinutes && existingStartTimeMinutes < newEndTimeMinutes) {
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

      // 고정 섹션(NOTIFICATION, ANNOUNCEMENT, EVENT)인 경우에만 iconUrl과 displayName 설정
      // AD_CATEGORY는 ad_categories 테이블의 iconUrl을 사용하므로 home_sections에는 NULL이어야 함
      if (editingSection?.isFixed) {
        sectionData.displayName = editingSection?.displayName;
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

    setDeleting(true);
    try {
      // Storage에서 아이콘 이미지 삭제 (있는 경우)
      const iconUrl = deletingSection.iconUrl || deletingSection.adCategoryIconUrl;
      if (iconUrl) {
        await deleteFileFromStorage(iconUrl);
      }

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
    } finally {
      setDeleting(false);
    }
  };

  // 드래그&드롭 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const newSections = arrayMove(sections, oldIndex, newIndex);

    // placeholder를 제외한 실제 DB 섹션만 필터링
    const dbSections = newSections.filter(s => !s.id.includes('placeholder'));

    // DB 섹션의 orderIndex를 연속된 숫자로 재계산
    const updatedDbSections = dbSections.map((section, index) => ({
      ...section,
      orderIndex: index + 1,
    }));

    // UI에 표시할 전체 섹션 업데이트 (placeholder 포함)
    const updatedSections = newSections.map((section) => {
      if (section.id.includes('placeholder')) {
        return section; // placeholder는 orderIndex 유지
      }
      const dbSection = updatedDbSections.find(s => s.id === section.id);
      return dbSection || section;
    });

    setSections(updatedSections);

    try {
      // 1단계: 모든 섹션의 orderIndex를 임시 값(음수)으로 변경하여 중복 방지
      const tempUpdates = updatedDbSections.map((s, idx) =>
        supabase.from('home_sections').update({ orderIndex: -(idx + 1) }).eq('id', s.id)
      );
      const tempResults = await Promise.all(tempUpdates);
      tempResults.forEach(res => { if(res.error) throw res.error; });

      // 2단계: 실제 orderIndex 값으로 업데이트
      const finalUpdates = updatedDbSections.map(s =>
        supabase.from('home_sections').update({ orderIndex: s.orderIndex }).eq('id', s.id)
      );
      const finalResults = await Promise.all(finalUpdates);
      finalResults.forEach(res => { if(res.error) throw res.error; });

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
    <PageShell>
      <AdminHeader title='홈 섹션 관리' />

      <PageContent>
        <Group justify='space-between' align='center'>
          <Text size='sm' c='dimmed'>
            드래그하여 섹션 순서를 변경할 수 있습니다.
          </Text>
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            광고 카테고리 추가
          </Button>
        </Group>

        <DataTableShell>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table highlightOnHover verticalSpacing='sm' horizontalSpacing='md'>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={128}>순서</Table.Th>
                  <Table.Th>섹션</Table.Th>
                  <Table.Th>자동 선택 스케줄</Table.Th>
                  <Table.Th>상태</Table.Th>
                  <Table.Th ta='right'>작업</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={5} p={0}>
                      <TableSkeleton rows={8} columns={5} showHeader={false} />
                    </Table.Td>
                  </Table.Tr>
                ) : sections.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={5} ta='center' py={48} c='dimmed'>
                      섹션이 없습니다.
                    </Table.Td>
                  </Table.Tr>
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
              </Table.Tbody>
            </Table>
          </DndContext>
        </DataTableShell>
      </PageContent>

      <Modal
        opened={isDialogOpen}
        onClose={() => handleDialogClose(false)}
        title={editingSection ? '섹션 수정' : '광고 카테고리 추가'}
        size={600}
      >
        <Stack gap='md'>
          <Text size='sm' c='dimmed'>
            {editingSection?.isFixed 
              ? "고정 섹션의 순서, 아이콘, 스케줄 등을 수정합니다."
              : "새로운 광고 카테고리를 추가하거나 기존 카테고리 정보를 수정합니다."
            }
          </Text>

          {editingSection?.isFixed ? (
            <TextInput label='섹션 타입' value={editingSection.displayName || ''} disabled />
          ) : (
            <TextInput
              id='categoryName'
              label='카테고리 이름 *'
              value={form.categoryName}
              onChange={(e) => handleFormChange('categoryName', e.target.value)}
              placeholder='필라테스, 영어학원 등'
              disabled={!!editingSection}
              description={editingSection ? '카테고리 이름은 변경할 수 없습니다.' : undefined}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
            />
          )}

          <Input.Wrapper label='아이콘'>
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
          </Input.Wrapper>

          <TextInput
            id='orderIndex'
            label='표시 순서 *'
            type='number'
            value={form.orderIndex || 0}
            onChange={(e) => handleOrderIndexChange(parseInt(e.target.value) || 0)}
            placeholder='1'
            error={orderIndexError}
          />

          <Checkbox
            id='isActive'
            label='활성화'
            checked={form.isActive}
            onChange={(e) => handleFormChange('isActive', e.currentTarget.checked)}
          />

          <Divider />

          <Stack gap='md'>
            <Title order={5}>자동 선택 스케줄 설정</Title>
            <Checkbox
              id='useSchedule'
              label='스케줄 사용'
              checked={form.useSchedule}
              onChange={(e) => handleFormChange('useSchedule', e.currentTarget.checked)}
            />

            {form.useSchedule && (
              <Paper withBorder radius='md' p='md'>
                <Stack gap='md'>
                  <SimpleGrid cols={2} spacing='md'>
                    <TextInput
                      id='autoSelectStartDate'
                      label='시작 날짜'
                      type='date'
                      value={form.autoSelectStartDate || ''}
                      onChange={(e) => handleFormChange('autoSelectStartDate', e.target.value)}
                    />
                    <TextInput
                      id='autoSelectEndDate'
                      label='종료 날짜'
                      type='date'
                      value={form.autoSelectEndDate || ''}
                      onChange={(e) => handleFormChange('autoSelectEndDate', e.target.value)}
                    />
                  </SimpleGrid>
                  <SimpleGrid cols={2} spacing='md'>
                    <TextInput
                      id='autoSelectStartTime'
                      label='시작 시간'
                      type='time'
                      value={form.autoSelectStartTime || ''}
                      onChange={(e) => handleFormChange('autoSelectStartTime', e.target.value)}
                    />
                    <TextInput
                      id='autoSelectEndTime'
                      label='종료 시간'
                      type='time'
                      value={form.autoSelectEndTime || ''}
                      onChange={(e) => handleFormChange('autoSelectEndTime', e.target.value)}
                    />
                  </SimpleGrid>
                  {scheduleError && <Text size='sm' c='red'>{scheduleError}</Text>}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => handleDialogClose(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!!orderIndexError || !!scheduleError}>
            {editingSection ? '수정' : '생성'}
          </Button>
        </Group>
      </Modal>

      <Modal opened={deleteDialog} onClose={() => setDeleteDialog(false)} title='카테고리 삭제' closeOnClickOutside={!deleting} closeOnEscape={!deleting}>
        <Text size='sm' c='dimmed'>
          정말로 <strong>{deletingSection?.categoryName}</strong> 카테고리를 삭제하시겠습니까?
          <br />
          이 작업은 되돌릴 수 없으며, 연관된 홈 섹션도 함께 삭제됩니다.
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDeleteDialog(false)} disabled={deleting}>
            취소
          </Button>
          <Button color='red' onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
