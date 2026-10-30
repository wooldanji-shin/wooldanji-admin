'use client';

import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  ChevronLeft,
  Send,
  User,
  Calendar,
  Image as ImageIcon,
  AlertCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirmModal } from '@/components/confirm-modal';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getUserRoles } from '@/lib/auth';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';

interface Inquiry {
  id: string;
  title: string;
  content: string;
  imageUrls: string[] | null;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
  lastReplyAt: string;
  userId: string;
  user?: {
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    birthDay: string | null;
    apartmentId: string | null;
    registrationType: 'APARTMENT' | 'GENERAL' | null;
    buildingNumber: number | null;
    unit: number | null;
    address: string | null;
    regionSido: string | null;
    regionSigungu: string | null;
    regionDong: string | null;
    approvalStatus: string | null;
    openDoorCount: number | null;
    rssLevel: number | null;
    platform: string | null;
    createdAt: string | null;
    apartments?: {
      name: string;
    } | null;
  };
}

interface InquiryReply {
  id: string;
  inquiryId: string;
  userId: string | null;
  content: string;
  isAdmin: boolean;
  createdAt: string;
  user?: {
    name: string | null;
    email: string | null;
  };
}

export default function InquiryDetailPage() {
  const params = useParams();
  const inquiryId = params.id as string;

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const imgLb = useImageLightbox(inquiry?.imageUrls ?? []);
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [hasAccess, setHasAccess] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (inquiryId) {
      loadInquiryDetail();
    }
  }, [inquiryId]);

  const loadInquiryDetail = async () => {
    try {
      setLoading(true);

      // 현재 사용자 정보 및 권한 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      const roles = await getUserRoles();
      const isSuperAdmin = roles.includes('SUPER_ADMIN');
      const isManager = roles.includes('MANAGER');

      // 문의 상세 정보 조회
      const { data: inquiryData, error: inquiryError } = await supabase
        .from('inquiries')
        .select(`
          *,
          user:userId (
            name,
            email,
            phoneNumber,
            birthDay,
            apartmentId,
            registrationType,
            buildingNumber,
            unit,
            address,
            regionSido,
            regionSigungu,
            regionDong,
            approvalStatus,
            openDoorCount,
            rssLevel,
            platform,
            createdAt,
            apartments:apartmentId(name)
          )
        `)
        .eq('id', inquiryId)
        .single();

      if (inquiryError) throw inquiryError;

      // 권한 체크: MANAGER인 경우 자신이 관리하는 아파트의 회원인지 확인
      if (isManager && !isSuperAdmin) {
        const { data: managerApartments, error: aptError } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', user.id);

        if (aptError) throw aptError;

        const apartmentIds = managerApartments?.map(apt => apt.apartmentId) || [];
        const userApartmentId = inquiryData.user?.apartmentId;

        // 문의 작성자가 매니저가 관리하는 아파트의 회원이 아니면 접근 불가
        if (!userApartmentId || !apartmentIds.includes(userApartmentId)) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
      }

      setInquiry(inquiryData);

      // 답변 목록 조회
      const { data: repliesData, error: repliesError } = await supabase
        .from('inquiry_replies')
        .select(`
          *,
          user:userId (
            name,
            email
          )
        `)
        .eq('inquiryId', inquiryId)
        .order('createdAt', { ascending: true });

      if (repliesError) throw repliesError;

      setReplies(repliesData || []);
    } catch (err) {
      console.error('Error loading inquiry detail:', err);
      toast.error('문의 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      toast.error('답변 내용을 입력해주세요.');
      return;
    }

    try {
      setSending(true);

      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      if (isEditing && editingReplyId) {
        // 답변 수정
        const { error: updateError } = await supabase
          .from('inquiry_replies')
          .update({
            content: replyContent.trim(),
          })
          .eq('id', editingReplyId);

        if (updateError) throw updateError;

        toast.success('답변이 수정되었습니다.');
      } else {
        // 답변 추가
        const { error: insertError } = await supabase
          .from('inquiry_replies')
          .insert({
            inquiryId: inquiryId,
            userId: user.id,
            content: replyContent.trim(),
            isAdmin: true,
          });

        if (insertError) throw insertError;

        // 문의 상태 업데이트 (답변 완료로 변경)
        const { error: updateError } = await supabase
          .from('inquiries')
          .update({
            status: 'ANSWERED',
            lastReplyAt: new Date().toISOString(),
          })
          .eq('id', inquiryId);

        if (updateError) throw updateError;

        // 푸시 알림 전송
        try {
          const notificationResponse = await fetch('/api/inquiries/send-reply-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: inquiry?.userId,
              inquiryId: inquiryId,
              replyContent: replyContent.trim(),
            }),
          });

          const notificationData = await notificationResponse.json();

          if (notificationData.success) {
            console.log('푸시 알림 전송 성공:', notificationData);
          } else {
            console.error('푸시 알림 전송 실패:', notificationData);
          }
        } catch (notifError) {
          // 알림 전송 실패해도 답변 등록은 성공으로 처리
          console.error('푸시 알림 전송 중 오류:', notifError);
        }

        toast.success('답변이 등록되었습니다.');
      }

      setReplyContent('');
      setIsEditing(false);
      setEditingReplyId(null);
      await loadInquiryDetail();
    } catch (err) {
      console.error('Error sending reply:', err);
      toast.error(isEditing ? '답변 수정 중 오류가 발생했습니다.' : '답변 등록 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleEditReply = (reply: InquiryReply) => {
    setIsEditing(true);
    setEditingReplyId(reply.id);
    setReplyContent(reply.content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingReplyId(null);
    setReplyContent('');
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!(await confirmModal({ title: '답변 삭제', message: '이 답변을 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) {
      return;
    }

    try {
      console.log('[답변 삭제] 시작:', replyId);

      const { data: deleteData, error: deleteError } = await supabase
        .from('inquiry_replies')
        .delete()
        .eq('id', replyId)
        .select();

      console.log('[답변 삭제] 결과:', { deleteData, deleteError });

      if (deleteError) throw deleteError;

      // 답변이 삭제되면 문의 상태를 PENDING으로 변경
      const { error: updateError } = await supabase
        .from('inquiries')
        .update({
          status: 'PENDING',
        })
        .eq('id', inquiryId);

      if (updateError) throw updateError;

      toast.success('답변이 삭제되었습니다.');

      // 데이터 새로고침
      await loadInquiryDetail();

      console.log('[답변 삭제] 완료 - 데이터 새로고침됨');
    } catch (err) {
      console.error('Error deleting reply:', err);
      toast.error('답변 삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm', { locale: ko });
  };

  const getStatusBadge = (status: 'PENDING' | 'ANSWERED') => {
    if (status === 'PENDING') {
      return (
        <Badge variant="light" color="yellow">
          답변 대기
        </Badge>
      );
    }
    return (
      <Badge variant="light" color="green">
        답변 완료
      </Badge>
    );
  };

  if (loading) {
    return <DetailSkeleton sections={3} />;
  }

  if (!hasAccess) {
    return (
      <PageShell>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant='subtle' color='gray' onClick={() => router.back()} aria-label='뒤로가기'>
            <ChevronLeft size={20} />
          </ActionIcon>
          <Box flex={1}>
            <AdminHeader title='문의 상세' />
          </Box>
        </Group>
        <Alert color='red' variant='light' icon={<AlertCircle size={16} />}>
          이 문의에 접근할 권한이 없습니다. 매니저는 자신이 관리하는 아파트 회원의 문의만 확인할 수 있습니다.
        </Alert>
      </PageShell>
    );
  }

  if (!inquiry) {
    return (
      <PageShell>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant='subtle' color='gray' onClick={() => router.back()} aria-label='뒤로가기'>
            <ChevronLeft size={20} />
          </ActionIcon>
          <Box flex={1}>
            <AdminHeader title='문의 상세' />
          </Box>
        </Group>
        <Text py={48} ta='center' c='dimmed'>문의를 찾을 수 없습니다.</Text>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderTitle title='문의 상세' onBack={() => router.back()} />

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align={{ base: 'stretch', lg: 'flex-start' }}>
        <Stack gap="lg" miw={0} style={{ flex: 1 }}>

          {/* Inquiry Detail */}
          <Paper withBorder radius="md" p="lg">
            <Group gap="xs" mb="lg">
              <Title order={4}>{inquiry.title}</Title>
              {getStatusBadge(inquiry.status)}
            </Group>
            <Stack gap="lg">
              {/* Content with User and Date */}
              <Stack gap="md">
                {/* Header: User name on left, Date on right */}
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="blue" radius="xl" size={32}>
                      <User size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={600}>
                        {inquiry.user?.name || '알 수 없는 사용자'}
                      </Text>
                      <Text size="xs" c="dimmed">문의 작성자</Text>
                    </div>
                  </Group>
                  <Group gap={4} c="dimmed">
                    <Calendar size={16} />
                    <Text size="sm" c="dimmed">{formatDate(inquiry.createdAt)}</Text>
                  </Group>
                </Group>

                {/* Q. Content */}
                <Group gap="xs" align="flex-start" wrap="nowrap" pl={40}>
                  <Text fw={700} c="blue" size="lg" lh={1.4}>Q.</Text>
                  <Text size="sm" lh={1.7} style={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                    {inquiry.content}
                  </Text>
                </Group>
              </Stack>

              {/* Images */}
              {inquiry.imageUrls && inquiry.imageUrls.length > 0 && (
                <Stack gap="sm">
                  <Group gap="xs">
                    <ImageIcon size={16} />
                    <Text size="sm" fw={600}>
                      첨부 이미지 ({inquiry.imageUrls.length}개)
                    </Text>
                  </Group>
                  <Group gap="xs">
                    {inquiry.imageUrls.map((url, index) => (
                      <ImageThumbnail
                        key={index}
                        src={url}
                        alt={`첨부 이미지 ${index + 1}`}
                        onClick={() => imgLb.open(index)}
                      />
                    ))}
                  </Group>
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Replies */}
          {replies.length > 0 && (
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">답변 내역 ({replies.length})</Title>
              <Stack gap="md">
                {replies.map((reply, index) => (
                  <div key={reply.id}>
                    {index > 0 && <Divider my="md" />}
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start" gap="md">
                        <Group gap="xs">
                          <ThemeIcon
                            variant="light"
                            color={reply.isAdmin ? 'blue' : 'gray'}
                            radius="xl"
                            size={32}
                          >
                            <User size={16} />
                          </ThemeIcon>
                          <div>
                            <Group gap="xs">
                              <Text size="sm" fw={500}>
                                {reply.isAdmin ? '관리자' : (reply.user?.name || '사용자')}
                              </Text>
                              {reply.isAdmin && (
                                <Badge variant='light' color='gray' size='sm'>
                                  관리자
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {formatDate(reply.createdAt)}
                            </Text>
                          </div>
                        </Group>
                        {/* 관리자 답변에만 수정/삭제 버튼 표시 */}
                        {reply.isAdmin && (
                          <Group gap="xs">
                            <ActionIcon
                              variant='subtle'
                              color='gray'
                              aria-label='수정'
                              onClick={() => handleEditReply(reply)}
                            >
                              <Edit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant='subtle'
                              color='red'
                              aria-label='삭제'
                              onClick={() => handleDeleteReply(reply.id)}
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
                          </Group>
                        )}
                      </Group>
                      <Paper
                        ml={40}
                        p="md"
                        radius="md"
                        bg={reply.isAdmin ? 'var(--mantine-color-blue-light)' : 'var(--app-bg-muted)'}
                      >
                        <Text size="sm" lh={1.7} style={{ whiteSpace: 'pre-wrap' }}>
                          {reply.content}
                        </Text>
                      </Paper>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Reply Form - 관리자 답변이 없거나 수정 모드일 때만 표시 */}
          {(() => {
            const hasAdminReply = replies.some(r => r.isAdmin);

            if (!isEditing && hasAdminReply) {
              return null; // 이미 답변이 있고 수정 중이 아니면 폼 숨김
            }

            return (
              <Paper withBorder radius="md" p="lg">
                <Title order={4} mb="md">
                  {isEditing ? '답변 수정' : '답변 작성'}
                </Title>
                <Stack gap="md">
                  <Textarea
                    placeholder='답변 내용을 입력하세요...'
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={6}
                  />
                  <Group justify="flex-end" gap="xs">
                    {isEditing && (
                      <Button
                        variant='default'
                        onClick={handleCancelEdit}
                        disabled={sending}
                      >
                        취소
                      </Button>
                    )}
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !replyContent.trim()}
                      leftSection={
                        sending ? (
                          <Loader2 size={16} className='animate-spin' />
                        ) : (
                          <Send size={16} />
                        )
                      }
                    >
                      {sending
                        ? (isEditing ? '수정 중...' : '전송 중...')
                        : (isEditing ? '답변 수정' : '답변 보내기')}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            );
          })()}
        </Stack>

        {/* 우측: 문의 작성자 정보 */}
        {inquiry.user && (
          <Box component="aside" w={{ base: '100%', lg: 400 }} style={{ flexShrink: 0 }}>
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">작성자 정보</Title>
              <UserInfoGrid user={inquiry.user} />
            </Paper>
          </Box>
        )}
      </Flex>
      <ImageLightbox {...imgLb.props} />
    </PageShell>
  );
}

// ============================================================
// UserInfoGrid
// ============================================================

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text size='xs' c='dimmed' mb={2}>{label}</Text>
      <Text size='sm'>{value ?? '-'}</Text>
    </div>
  );
}

function UserInfoGrid({ user }: {
  user: {
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    birthDay: string | null;
    apartmentId: string | null;
    registrationType: 'APARTMENT' | 'GENERAL' | null;
    buildingNumber: number | null;
    unit: number | null;
    address: string | null;
    regionSido: string | null;
    regionSigungu: string | null;
    regionDong: string | null;
    approvalStatus: string | null;
    openDoorCount: number | null;
    rssLevel: number | null;
    platform: string | null;
    createdAt: string | null;
    apartments?: { name: string } | null;
  };
}) {
  const registrationTypeLabel =
    user.registrationType === 'APARTMENT' ? '아파트' :
    user.registrationType === 'GENERAL' ? '일반' : '-';

  const approvalStatusLabel =
    user.approvalStatus === 'approve' ? '승인' :
    user.approvalStatus === 'pending' ? '대기' :
    user.approvalStatus === 'suspended' ? '보류' :
    user.approvalStatus === 'inactive' ? '비활성' :
    user.approvalStatus ?? '-';

  return (
    <Stack gap='sm'>
      <SimpleGrid cols={2} spacing='sm'>
        <Field label='이름' value={user.name} />
        <Field label='이메일' value={user.email} />
        <Field label='전화번호' value={user.phoneNumber} />
        <Field label='생년월일' value={user.birthDay} />
      </SimpleGrid>
      <Field label='아파트' value={user.apartments?.name} />
      <SimpleGrid cols={2} spacing='sm'>
        <Field label='동' value={user.buildingNumber} />
        <Field label='호' value={user.unit} />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing='sm'>
        <Field label='주소' value={user.address} />
        <Field
          label='지역'
          value={[user.regionSido, user.regionSigungu, user.regionDong].filter(Boolean).join(' ') || undefined}
        />
        <Field label='회원유형' value={registrationTypeLabel} />
        <Field label='승인상태' value={approvalStatusLabel} />
        <Field label='문 연 횟수' value={user.openDoorCount} />
        <Field label='RSS 레벨' value={user.rssLevel} />
        <Field label='가입일' value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : undefined} />
        <Field label='플랫폼' value={user.platform} />
      </SimpleGrid>
    </Stack>
  );
}
