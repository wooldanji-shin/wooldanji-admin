'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
      !confirm(
        `"${message.messageKey}" 메시지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      )
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
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='다이얼로그 메시지 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='다이얼로그 메시지 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* List View */}
          {mode === 'list' && (
            <>
              {/* Search and Add Button */}
              <div className='flex items-center gap-3'>
                <div className='relative flex-1 max-w-md'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    type='text'
                    placeholder='메시지 키, 설명, 제목, 내용으로 검색...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-9'
                  />
                </div>
                <Button onClick={handleCreate} className='shrink-0'>
                  <Plus className='h-4 w-4 mr-2' />
                  새 메시지 추가
                </Button>
              </div>

              {/* Messages List */}
              {filteredMessages.length === 0 ? (
                <Card className='bg-card border-border'>
                  <CardContent className='flex flex-col items-center justify-center py-12'>
                    <MessageSquare className='h-12 w-12 text-muted-foreground mb-4' />
                    <p className='text-muted-foreground text-center'>
                      {searchQuery
                        ? '검색 결과가 없습니다.'
                        : '등록된 메시지가 없습니다.'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={handleCreate} variant='outline' className='mt-4'>
                        <Plus className='h-4 w-4 mr-2' />
                        첫 메시지 추가하기
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className='grid gap-4'>
                  {filteredMessages.map((message) => (
                    <Card key={message.id} className='bg-card border-border'>
                      <CardContent className='p-6'>
                        <div className='flex items-start justify-between gap-4'>
                          <div className='flex-1 min-w-0'>
                            {message.description && (
                              <div className='flex items-center gap-2 mb-3'>
                                <span className='px-2.5 py-1 rounded-md bg-primary/10 text-sm font-medium text-primary'>
                                  {message.description}
                                </span>
                              </div>
                            )}
                            <h3 className='font-semibold text-lg mb-2'>{message.title}</h3>
                            {message.content && (
                              <p className='text-muted-foreground text-sm whitespace-pre-wrap line-clamp-3 mb-2'>
                                {message.content}
                              </p>
                            )}
                            <p className='text-xs text-muted-foreground/50 font-mono'>
                              Key: {message.messageKey}
                            </p>
                          </div>
                          <div className='flex items-center gap-2 shrink-0'>
                            <Button
                              variant='outline'
                              size='icon'
                              onClick={() => handleEdit(message)}
                            >
                              <Edit2 className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='outline'
                              size='icon'
                              onClick={() => handleDelete(message)}
                              disabled={deleting === message.id}
                            >
                              {deleting === message.id ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                              ) : (
                                <Trash2 className='h-4 w-4 text-destructive' />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Create/Edit Form */}
          {(mode === 'create' || mode === 'edit') && (
            <Card className='bg-card border-border'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
                <CardTitle className='text-card-foreground'>
                  {mode === 'create' ? '새 메시지 추가' : '메시지 수정'}
                </CardTitle>
                <Button variant='ghost' size='icon' onClick={resetForm}>
                  <X className='h-4 w-4' />
                </Button>
              </CardHeader>
              <CardContent className='space-y-6'>
                {/* Message Key */}
                <div className='space-y-2'>
                  <Label htmlFor='messageKey' className='text-sm font-medium'>
                    메시지 키 <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    id='messageKey'
                    type='text'
                    value={messageKey}
                    onChange={(e) => setMessageKey(e.target.value.toLowerCase())}
                    placeholder='예: door_opened_success'
                    disabled={mode === 'edit'}
                    className={mode === 'edit' ? 'bg-muted' : ''}
                  />
                  <p className='text-xs text-muted-foreground'>
                    {mode === 'edit'
                      ? '메시지 키는 수정할 수 없습니다.'
                      : '영문 소문자, 숫자, 언더스코어(_)만 사용 가능합니다. 예: door_opened_success'}
                  </p>
                </div>

                {/* Description */}
                <div className='space-y-2'>
                  <Label htmlFor='description' className='text-sm font-medium'>
                    사용 시점 설명 <span className='text-muted-foreground'>(선택사항)</span>
                  </Label>
                  <Input
                    id='description'
                    type='text'
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder='예: 문이 성공적으로 열렸을 때 표시'
                  />
                  <p className='text-xs text-muted-foreground'>
                    이 메시지가 언제 사용되는지 설명을 입력하세요. (관리자용 메모)
                  </p>
                </div>

                {/* Title */}
                <div className='space-y-2'>
                  <Label htmlFor='title' className='text-sm font-medium'>
                    제목 <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    id='title'
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder='예: 문이 열렸습니다!'
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
                    placeholder='다이얼로그에 표시될 내용을 입력하세요'
                    rows={5}
                    className='resize-none'
                  />
                  <p className='text-xs text-muted-foreground'>
                    줄바꿈이 그대로 반영됩니다.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className='flex justify-end gap-3 pt-4'>
                  <Button variant='outline' onClick={resetForm} disabled={saving}>
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
