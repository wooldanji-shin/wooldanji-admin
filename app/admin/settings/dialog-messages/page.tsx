'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { confirmModal } from '@/components/confirm-modal';
import { DetailSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  Save,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface DialogMessage {
  id: string;
  messageKey: string;
  title: string;
  content: string | null;
  description: string | null;
  createdAt: string;
}

type FormMode = 'list' | 'create' | 'edit';

export default function DialogMessagesPage() {
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<DialogMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<FormMode>('list');
  const [editingMessage, setEditingMessage] = useState<DialogMessage | null>(null);

  // Form states
  const [messageKey, setMessageKey] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    // Filter messages based on search query
    if (searchQuery.trim() === '') {
      setFilteredMessages(messages);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = messages.filter(
        (msg) =>
          msg.messageKey.toLowerCase().includes(query) ||
          msg.title.toLowerCase().includes(query) ||
          (msg.content && msg.content.toLowerCase().includes(query)) ||
          (msg.description && msg.description.toLowerCase().includes(query))
      );
      setFilteredMessages(filtered);
    }
  }, [searchQuery, messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('dialog_messages')
        .select('*')
        .order('createdAt', { ascending: false });

      if (fetchError) throw fetchError;

      setMessages(data || []);
      setFilteredMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('메시지를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMessageKey('');
    setTitle('');
    setContent('');
    setDescription('');
    setEditingMessage(null);
    setMode('list');
  };

  const handleCreate = () => {
    resetForm();
    setMode('create');
  };

  const handleEdit = (message: DialogMessage) => {
    setEditingMessage(message);
    setMessageKey(message.messageKey);
    setTitle(message.title);
    setContent(message.content || '');
    setDescription(message.description || '');
    setMode('edit');
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validation
      if (!messageKey.trim()) {
        toast.error('메시지 키를 입력해주세요.');
        return;
      }

      if (!title.trim()) {
        toast.error('제목을 입력해주세요.');
        return;
      }

      // Validate messageKey format (alphanumeric and underscores only)
      if (!/^[a-z0-9_]+$/.test(messageKey)) {
        toast.error('메시지 키는 영문 소문자, 숫자, 언더스코어(_)만 사용 가능합니다.');
        return;
      }

      if (mode === 'create') {
        // Check if messageKey already exists
        const { data: existing } = await supabase
          .from('dialog_messages')
          .select('id')
          .eq('messageKey', messageKey)
          .single();

        if (existing) {
          toast.error('이미 존재하는 메시지 키입니다.');
          return;
        }

        // Create new message
        const { error: insertError } = await supabase
          .from('dialog_messages')
          .insert({
            messageKey: messageKey.trim(),
            title: title.trim(),
            content: content.trim() || null,
            description: description.trim() || null,
          });

        if (insertError) throw insertError;

        toast.success('메시지가 성공적으로 추가되었습니다.');
      } else if (mode === 'edit' && editingMessage) {
        // Update existing message
        const { error: updateError } = await supabase
          .from('dialog_messages')
          .update({
            title: title.trim(),
            content: content.trim() || null,
            description: description.trim() || null,
          })
          .eq('id', editingMessage.id);

        if (updateError) throw updateError;

        toast.success('메시지가 성공적으로 수정되었습니다.');
      }

      // Reload messages and reset form
      await loadMessages();
      resetForm();
    } catch (err) {
      console.error('Error saving message:', err);
      toast.error('메시지를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (message: DialogMessage) => {
    if (
      !(await confirmModal({
        title: '메시지 삭제',
        message: `"${message.messageKey}" 메시지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
        confirmLabel: '삭제',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      setDeleting(message.id);

      const { error: deleteError } = await supabase
        .from('dialog_messages')
        .delete()
        .eq('id', message.id);

      if (deleteError) throw deleteError;

      toast.success('메시지가 성공적으로 삭제되었습니다.');

      // Reload messages
      await loadMessages();
    } catch (err) {
      console.error('Error deleting message:', err);
      toast.error('메시지를 삭제하는 중 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <DetailSkeleton sections={3} />;
  }

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle title="다이얼로그 메시지 관리" />
      </PageHeader>

      <PageContent>
        {/* List View */}
        {mode === 'list' && (
          <>
            {/* Search and Add Button */}
            <Group gap="sm">
              <TextInput
                type="text"
                placeholder="메시지 키, 설명, 제목, 내용으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<Search size={16} />}
                style={{ flex: 1 }}
                miw={240}
                maw={448}
              />
              <Button
                onClick={handleCreate}
                leftSection={<Plus size={16} />}
                style={{ flexShrink: 0 }}
              >
                새 메시지 추가
              </Button>
            </Group>

            {/* Messages List */}
            {filteredMessages.length === 0 ? (
              <Paper withBorder radius="md">
                <EmptyState
                  icon={MessageSquare}
                  title={searchQuery ? '검색 결과가 없습니다.' : '등록된 메시지가 없습니다.'}
                  action={
                    !searchQuery && (
                      <Button
                        onClick={handleCreate}
                        variant="default"
                        leftSection={<Plus size={16} />}
                      >
                        첫 메시지 추가하기
                      </Button>
                    )
                  }
                />
              </Paper>
            ) : (
              <Stack gap="md">
                {filteredMessages.map((message) => (
                  <Paper key={message.id} withBorder radius="md" p="lg">
                    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                      <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        {message.description && (
                          <Group gap="xs">
                            <Badge variant="light" color="blue" size="lg" radius="sm" tt="none">
                              {message.description}
                            </Badge>
                          </Group>
                        )}
                        <Title order={4}>{message.title}</Title>
                        {message.content && (
                          <Text size="sm" c="dimmed" lineClamp={3} style={{ whiteSpace: 'pre-wrap' }}>
                            {message.content}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed" ff="monospace">
                          Key: {message.messageKey}
                        </Text>
                      </Stack>
                      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                        <ActionIcon
                          variant="default"
                          size="lg"
                          aria-label="수정"
                          onClick={() => handleEdit(message)}
                        >
                          <Edit2 size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="default"
                          size="lg"
                          c="red"
                          aria-label="삭제"
                          onClick={() => handleDelete(message)}
                          disabled={deleting === message.id}
                        >
                          {deleting === message.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </>
        )}

        {/* Create/Edit Form */}
        {(mode === 'create' || mode === 'edit') && (
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Group justify="space-between" wrap="nowrap">
                <Title order={4}>{mode === 'create' ? '새 메시지 추가' : '메시지 수정'}</Title>
                <ActionIcon variant="subtle" color="gray" aria-label="닫기" onClick={resetForm}>
                  <X size={16} />
                </ActionIcon>
              </Group>

              {/* Message Key */}
              <TextInput
                id="messageKey"
                type="text"
                label="메시지 키"
                withAsterisk
                value={messageKey}
                onChange={(e) => setMessageKey(e.target.value.toLowerCase())}
                placeholder="예: door_opened_success"
                disabled={mode === 'edit'}
                description={
                  mode === 'edit'
                    ? '메시지 키는 수정할 수 없습니다.'
                    : '영문 소문자, 숫자, 언더스코어(_)만 사용 가능합니다. 예: door_opened_success'
                }
                inputWrapperOrder={['label', 'input', 'description']}
              />

              {/* Description */}
              <TextInput
                id="description"
                type="text"
                label={
                  <>
                    사용 시점 설명{' '}
                    <Text span c="dimmed" inherit>
                      (선택사항)
                    </Text>
                  </>
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 문이 성공적으로 열렸을 때 표시"
                description="이 메시지가 언제 사용되는지 설명을 입력하세요. (관리자용 메모)"
                inputWrapperOrder={['label', 'input', 'description']}
              />

              {/* Title */}
              <TextInput
                id="title"
                type="text"
                label="제목"
                withAsterisk
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 문이 열렸습니다!"
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
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="다이얼로그에 표시될 내용을 입력하세요"
                rows={5}
                styles={{ input: { resize: 'none' } }}
                description="줄바꿈이 그대로 반영됩니다."
                inputWrapperOrder={['label', 'input', 'description']}
              />

              {/* Action Buttons */}
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={resetForm} disabled={saving}>
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
            </Stack>
          </Paper>
        )}
      </PageContent>
    </PageShell>
  );
}
