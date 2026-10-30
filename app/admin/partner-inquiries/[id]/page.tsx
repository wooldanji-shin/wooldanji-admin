'use client';

import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
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
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirmModal } from '@/components/confirm-modal';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { StatusBadge } from '@/components/status-badge';
import { getSessionUser } from '@/lib/auth';

interface PartnerInquiry {
  id: string;
  content: string;
  imageUrls: string[] | null;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
  lastReplyAt: string;
  partnerUserId: string;
  partner?: {
    businessName: string | null;
    representativeName: string | null;
    displayPhoneNumber: string | null;
    businessAddress: string | null;
    businessDetailAddress: string | null;
    parkingInfo: string | null;
    directionsInfo: string | null;
    businessRegistrationNumber: string | null;
    categoryId: string | null;
    createdAt: string | null;
    category?: {
      name: string;
    } | null;
  };
}

interface PartnerInquiryReply {
  id: string;
  inquiryId: string;
  userId: string | null;
  content: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function PartnerInquiryDetailPage() {
  const params = useParams();
  const inquiryId = params.id as string;

  const [inquiry, setInquiry] = useState<PartnerInquiry | null>(null);
  const imgLb = useImageLightbox(inquiry?.imageUrls ?? []);
  const [replies, setReplies] = useState<PartnerInquiryReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyContent, setReplyContent] = useState('');
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

      const {
        data: { user },
      } = await getSessionUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      const { data: inquiryData, error: inquiryError } = await supabase
        .from('partner_inquiries')
        .select(`
          *,
          partner:partnerUserId (
            businessName,
            representativeName,
            displayPhoneNumber,
            businessAddress,
            businessDetailAddress,
            parkingInfo,
            directionsInfo,
            businessRegistrationNumber,
            categoryId,
            createdAt,
            category:categoryId(categoryName)
          )
        `)
        .eq('id', inquiryId)
        .single();

      if (inquiryError) throw inquiryError;

      setInquiry(inquiryData);

      // partner_inquiry_replies.userId는 FK가 없어 PostgREST join 불가.
      // 파트너 답변자 이름은 inquiry.partner.representativeName으로 표시.
      const { data: repliesData, error: repliesError } = await supabase
        .from('partner_inquiry_replies')
        .select('*')
        .eq('inquiryId', inquiryId)
        .order('createdAt', { ascending: true });

      if (repliesError) throw repliesError;

      setReplies(repliesData || []);
    } catch (err) {
      console.error('Error loading partner inquiry detail:', err);
      toast.error('파트너 문의 정보를 불러오는 중 오류가 발생했습니다.');
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

      const {
        data: { user },
      } = await getSessionUser();

      if (!user) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      if (isEditing && editingReplyId) {
        // 답변 수정
        const { error: updateError } = await supabase
          .from('partner_inquiry_replies')
          .update({
            content: replyContent.trim(),
          })
          .eq('id', editingReplyId);

        if (updateError) throw updateError;

        toast.success('답변이 수정되었습니다.');
      } else {
        // 답변 추가
        const { error: insertError } = await supabase
          .from('partner_inquiry_replies')
          .insert({
            inquiryId: inquiryId,
            userId: user.id,
            content: replyContent.trim(),
            isAdmin: true,
          });

        if (insertError) throw insertError;

        // 문의 상태 업데이트
        // new Date().toISOString()은 항상 UTC ISO-8601을 반환하므로
        // Flutter 측 toUtc().toIso8601String() 컨벤션과 동일한 결과값을 만든다.
        const { error: updateError } = await supabase
          .from('partner_inquiries')
          .update({
            status: 'ANSWERED',
            lastReplyAt: new Date().toISOString(),
          })
          .eq('id', inquiryId);

        if (updateError) throw updateError;

        // 푸시 알림 전송
        try {
          const notificationResponse = await fetch(
            '/api/partner-inquiries/send-reply-notification',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partnerUserId: inquiry?.partnerUserId,
                inquiryId: inquiryId,
                replyContent: replyContent.trim(),
              }),
            }
          );

          const notificationData = await notificationResponse.json();
          if (notificationData.success) {
            console.log('파트너 푸시 알림 전송 성공:', notificationData);
          } else {
            console.error('파트너 푸시 알림 전송 실패:', notificationData);
          }
        } catch (notifError) {
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
      toast.error(
        isEditing ? '답변 수정 중 오류가 발생했습니다.' : '답변 등록 중 오류가 발생했습니다.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleEditReply = (reply: PartnerInquiryReply) => {
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
    if (!(await confirmModal({ title: '답변 삭제', message: '이 답변을 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) return;

    try {
      const { error: deleteError } = await supabase
        .from('partner_inquiry_replies')
        .delete()
        .eq('id', replyId);

      if (deleteError) throw deleteError;

      // 답변이 삭제되면 문의 상태를 PENDING으로 변경
      const { error: updateError } = await supabase
        .from('partner_inquiries')
        .update({ status: 'PENDING' })
        .eq('id', inquiryId);

      if (updateError) throw updateError;

      toast.success('답변이 삭제되었습니다.');
      await loadInquiryDetail();
    } catch (err) {
      console.error('Error deleting reply:', err);
      toast.error('답변 삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm', { locale: ko });
  };

  if (loading) {
    return <DetailSkeleton sections={3} />;
  }

  if (!inquiry) {
    return (
      <PageShell>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ChevronLeft size={20} />
          </ActionIcon>
          <AdminHeader title="파트너 문의 상세" className="flex-1" />
        </Group>
        <Text py={48} ta="center" c="dimmed">
          문의를 찾을 수 없습니다.
        </Text>
      </PageShell>
    );
  }

  const hasAdminReply = replies.some((r) => r.isAdmin);

  return (
    <PageShell>
      <HeaderTitle title="파트너 문의 상세" onBack={() => router.back()} />

      <Flex direction={{ base: 'column', lg: 'row' }} gap="lg" align={{ base: 'stretch', lg: 'flex-start' }}>
        <Stack gap="lg" miw={0} style={{ flex: 1 }}>
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Group gap="xs">
                <Title order={4}>{inquiry.partner?.businessName ?? '파트너 문의'}</Title>
                <StatusBadge.Inquiry
                  status={inquiry.status === 'PENDING' ? 'pending' : 'answered'}
                />
              </Group>

              {/* Q. 본문 */}
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" radius="xl" size={32}>
                      <User size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={600}>
                        {inquiry.partner?.businessName ?? '파트너'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        문의 작성자
                      </Text>
                    </div>
                  </Group>
                  <Group gap={4} c="dimmed">
                    <Calendar size={16} />
                    <Text size="sm" c="dimmed">
                      {formatDate(inquiry.createdAt)}
                    </Text>
                  </Group>
                </Group>

                <Group gap="xs" align="flex-start" wrap="nowrap" pl={40}>
                  <Text fw={700} size="lg" c="blue">
                    Q.
                  </Text>
                  <Text size="sm" lh={1.65} style={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                    {inquiry.content}
                  </Text>
                </Group>
              </Stack>

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

          {replies.length > 0 && (
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                답변 내역 ({replies.length})
              </Title>
              <Stack gap="md">
                {replies.map((reply, index) => (
                  <div key={reply.id}>
                    {index > 0 && <Divider mb="md" />}
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
                                {reply.isAdmin ? '관리자' : inquiry?.partner?.representativeName || '파트너'}
                              </Text>
                              {reply.isAdmin && (
                                <Badge variant="light" size="xs">
                                  관리자
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {formatDate(reply.createdAt)}
                            </Text>
                          </div>
                        </Group>
                        {reply.isAdmin && (
                          <Group gap="xs">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              onClick={() => handleEditReply(reply)}
                              aria-label="답변 수정"
                            >
                              <Edit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteReply(reply.id)}
                              aria-label="답변 삭제"
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
                        withBorder={reply.isAdmin}
                      >
                        <Text size="sm" lh={1.65} style={{ whiteSpace: 'pre-wrap' }}>
                          {reply.content}
                        </Text>
                      </Paper>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </Paper>
          )}

          {/* 답변 작성 폼: 관리자 답변이 없거나 수정 모드일 때만 */}
          {(!hasAdminReply || isEditing) && (
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">
                {isEditing ? '답변 수정' : '답변 작성'}
              </Title>
              <Stack gap="md">
                <Textarea
                  placeholder="답변 내용을 입력하세요..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={6}
                />
                <Group justify="flex-end" gap="xs">
                  {isEditing && (
                    <Button variant="default" onClick={handleCancelEdit} disabled={sending}>
                      취소
                    </Button>
                  )}
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !replyContent.trim()}
                    leftSection={
                      sending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )
                    }
                  >
                    {sending
                      ? isEditing
                        ? '수정 중...'
                        : '전송 중...'
                      : isEditing
                        ? '답변 수정'
                        : '답변 보내기'}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}
        </Stack>

        {/* 우측: 문의한 파트너 정보 */}
        {inquiry.partner && (
          <Box component="aside" w={{ base: '100%', lg: 400 }} style={{ flexShrink: 0 }}>
            <Paper withBorder radius="md" p="lg">
              <Title order={4} mb="md">파트너 정보</Title>
              <PartnerInfoGrid partner={inquiry.partner} />
            </Paper>
          </Box>
        )}
      </Flex>
      <ImageLightbox {...imgLb.props} />
    </PageShell>
  );
}

// ============================================================
// PartnerInfoGrid
// ============================================================

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      <Text size="sm" component="div">
        {value ?? '-'}
      </Text>
    </div>
  );
}

function PartnerInfoGrid({
  partner,
}: {
  partner: {
    businessName: string | null;
    representativeName: string | null;
    displayPhoneNumber: string | null;
    businessAddress: string | null;
    businessDetailAddress: string | null;
    parkingInfo: string | null;
    directionsInfo: string | null;
    businessRegistrationNumber: string | null;
    categoryId: string | null;
    createdAt: string | null;
    category?: { categoryName: string } | null;
  };
}) {
  const fullAddress = [partner.businessAddress, partner.businessDetailAddress]
    .filter(Boolean)
    .join(' ');

  return (
    <Stack gap="sm">
      <SimpleGrid cols={2} spacing="sm">
        <Field label='상호명' value={partner.businessName} />
        <Field label='대표자명' value={partner.representativeName} />
        <Field label='전화번호' value={partner.displayPhoneNumber} />
        <Field label='카테고리' value={partner.category?.categoryName} />
      </SimpleGrid>
      <Field label='사업장 주소' value={fullAddress || undefined} />
      <Field label='주차 안내' value={partner.parkingInfo || undefined} />
      <Field label='오시는길' value={partner.directionsInfo || undefined} />
      <SimpleGrid cols={2} spacing="sm">
        <Field label='사업자등록번호' value={partner.businessRegistrationNumber} />
        <Field
          label='가입일'
          value={
            partner.createdAt
              ? new Date(partner.createdAt).toLocaleDateString('ko-KR')
              : undefined
          }
        />
      </SimpleGrid>
    </Stack>
  );
}
