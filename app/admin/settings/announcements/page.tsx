'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { confirmModal } from '@/components/confirm-modal';
import { TableSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Input,
  Modal,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
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

function SortableRow({ announcement, onEdit, onDelete, onToggleActive, toggling }: {
  announcement: Announcement;
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  toggling: boolean;
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
    <Table.Tr ref={setNodeRef} style={style} {...attributes}>
      <Table.Td>
        <Group gap="xs" wrap="nowrap" style={{ cursor: 'grab' }} {...listeners}>
          <Box c="dimmed" style={{ display: 'flex' }}>
            <GripVertical size={16} />
          </Box>
          <Text fw={500} size="sm">
            {announcement.orderIndex}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        {announcement.imageUrl && (
          <Box
            pos="relative"
            w={64}
            h={64}
            bg="var(--app-bg-muted)"
            style={{ overflow: 'hidden', borderRadius: 'var(--mantine-radius-sm)' }}
          >
            <Image
              src={announcement.imageUrl}
              alt={announcement.title || '공지사항 이미지'}
              fill
              className="object-cover"
            />
          </Box>
        )}
      </Table.Td>
      <Table.Td fw={500}>
        {announcement.title || (
          <Text span c="dimmed" inherit>
            제목 없음
          </Text>
        )}
      </Table.Td>
      <Table.Td maw={320}>
        <Text size="sm" truncate>
          {announcement.content || (
            <Text span c="dimmed" inherit>
              내용 없음
            </Text>
          )}
        </Text>
      </Table.Td>
      <Table.Td>
        <Switch
          checked={announcement.isActive}
          onChange={(e) => onToggleActive(announcement.id, e.currentTarget.checked)}
          disabled={toggling}
        />
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="수정"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(announcement);
            }}
          >
            <Edit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label="삭제"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(announcement.id);
            }}
          >
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
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
    setTogglingId(id);
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
    } finally {
      setTogglingId(null);
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
          const MAX_SIZE = 2560; // 레티나 디스플레이 대응
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
    if (!(await confirmModal({ title: '공지 삭제', message: '이 공지사항을 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) {
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

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="공지사항 관리"
          description="홈 화면에 노출되는 공지사항을 관리합니다."
        />
      </PageHeader>

      <PageContent>
        {/* Info Alert */}
        <Alert variant="light" color="gray" icon={<AlertCircle size={16} />}>
          홈 화면에 표시되는 공지사항을 관리합니다. 드래그하여 순서를 변경할 수 있습니다.
        </Alert>

        {/* Announcements List */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between" wrap="nowrap">
              <Title order={4}>공지사항 목록</Title>
              <Button onClick={handleAddNew} leftSection={<Plus size={16} />}>
                새 공지사항
              </Button>
            </Group>
            {loading ? (
              <TableSkeleton rows={8} columns={6} />
            ) : announcements.length === 0 ? (
              <Text c="dimmed" ta="center" py={48}>
                등록된 공지사항이 없습니다.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={720} type="native">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={96}>순서</Table.Th>
                        <Table.Th w={96}>이미지</Table.Th>
                        <Table.Th>제목</Table.Th>
                        <Table.Th maw={320}>내용</Table.Th>
                        <Table.Th w={96}>활성화</Table.Th>
                        <Table.Th w={128}>작업</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
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
                            toggling={togglingId === announcement.id}
                          />
                        ))}
                      </SortableContext>
                    </Table.Tbody>
                  </Table>
                </DndContext>
              </Table.ScrollContainer>
            )}
          </Stack>
        </Paper>

        {/* Add/Edit Dialog */}
        <Modal
          opened={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={editingAnnouncement ? '공지사항 수정' : '새 공지사항 등록'}
          size={672}
        >
          <Stack gap="lg">
            {/* Image Upload */}
            <Input.Wrapper
              label={
                <>
                  이미지{' '}
                  <Text span c="dimmed" inherit>
                    (선택사항)
                  </Text>
                </>
              }
            >
              {form.imagePreview ? (
                <Box
                  pos="relative"
                  w="100%"
                  bg="var(--app-bg-muted)"
                  style={{
                    aspectRatio: '16 / 9',
                    overflow: 'hidden',
                    borderRadius: 'var(--mantine-radius-md)',
                    border: '1px solid var(--app-divider)',
                  }}
                >
                  <Image src={form.imagePreview} alt="Preview" fill className="object-contain" />
                  <ActionIcon
                    color="red"
                    size="lg"
                    aria-label="이미지 제거"
                    onClick={removeImage}
                    pos="absolute"
                    top={8}
                    right={8}
                    style={{ zIndex: 10 }}
                  >
                    <X size={16} />
                  </ActionIcon>
                </Box>
              ) : (
                <Box
                  pos="relative"
                  p="xl"
                  bg={dragActive ? 'var(--mantine-color-blue-light)' : undefined}
                  style={{
                    border: `2px dashed ${
                      dragActive
                        ? 'var(--mantine-color-blue-filled)'
                        : 'var(--app-divider)'
                    }`,
                    borderRadius: 'var(--mantine-radius-md)',
                    transition: 'border-color 150ms, background-color 150ms',
                  }}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="imageUpload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileInput}
                  />
                  <label htmlFor="imageUpload" style={{ cursor: 'pointer', display: 'block' }}>
                    <Stack align="center" gap={4}>
                      <Box c="dimmed" mb="sm">
                        <Upload size={48} />
                      </Box>
                      <Text size="sm" fw={500} ta="center">
                        이미지를 드래그하거나 클릭하여 업로드
                      </Text>
                      <Text size="xs" c="dimmed" ta="center">
                        PNG, JPG, GIF (최대 5MB)
                      </Text>
                    </Stack>
                  </label>
                </Box>
              )}
            </Input.Wrapper>

            {/* Title */}
            <TextInput
              id="title"
              type="text"
              label={
                <>
                  제목{' '}
                  <Text span c="dimmed" inherit>
                    (선택사항)
                  </Text>
                </>
              }
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="공지사항 제목"
            />

            {/* Content */}
            <Textarea
              id="content"
              label={
                <>
                  내용{' '}
                  <Text span c="dimmed" inherit>
                    (선택사항)
                  </Text>
                </>
              }
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="공지사항 내용을 입력하세요"
              rows={4}
              styles={{ input: { resize: 'none' } }}
            />

            {/* Link URL */}
            <TextInput
              id="linkUrl"
              type="url"
              label={
                <>
                  링크 URL{' '}
                  <Text span c="dimmed" inherit>
                    (선택사항)
                  </Text>
                </>
              }
              value={form.linkUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
              placeholder="https://example.com"
              description="공지사항 클릭 시 이동할 URL을 입력하세요."
              inputWrapperOrder={['label', 'input', 'description']}
            />

            {/* Active Status */}
            <Switch
              id="isActive"
              label="활성화"
              labelPosition="left"
              checked={form.isActive}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setForm((prev) => ({ ...prev, isActive: checked }));
              }}
              styles={{ body: { justifyContent: 'space-between' } }}
            />
          </Stack>

          <Group justify="flex-end" mt="lg">
            <Button
              variant="default"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              leftSection={
                saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />
              }
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Group>
        </Modal>
      </PageContent>
    </PageShell>
  );
}
