'use client';

import { AdminHeader } from '@/components/admin-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';

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
      } = await supabase.auth.getUser();
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
      } = await supabase.auth.getUser();

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
    if (!confirm('이 답변을 삭제하시겠습니까?')) return;

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

  const getStatusBadge = (status: 'PENDING' | 'ANSWERED') => {
    if (status === 'PENDING') {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          답변 대기
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
        답변 완료
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='icon-sm' onClick={() => router.back()} aria-label='뒤로가기'>
            <ChevronLeft className='h-5 w-5' />
          </Button>
          <AdminHeader title='파트너 문의 상세' className='flex-1' />
        </div>
        <Skeleton className='h-32 w-full' />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='icon-sm' onClick={() => router.back()} aria-label='뒤로가기'>
            <ChevronLeft className='h-5 w-5' />
          </Button>
          <AdminHeader title='파트너 문의 상세' className='flex-1' />
        </div>
        <p className='py-12 text-center text-muted-foreground'>문의를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const hasAdminReply = replies.some((r) => r.isAdmin);

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='icon-sm' onClick={() => router.back()} aria-label='뒤로가기'>
          <ChevronLeft className='h-5 w-5' />
        </Button>
        <AdminHeader title='파트너 문의 상세' className='flex-1' />
      </div>

      <div className="flex flex-col gap-6">
        <div className='space-y-6'>

          <Card className='bg-card border-border'>
            <CardHeader>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1 space-y-2'>
                  <div className='flex items-center gap-2'>
                    <CardTitle className='text-card-foreground'>
                      {inquiry.partner?.businessName ?? '파트너 문의'}
                    </CardTitle>
                    {getStatusBadge(inquiry.status)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              {inquiry.partner && <PartnerInfoGrid partner={inquiry.partner} />}

              <Separator />

              {/* Q. 본문 */}
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center'>
                      <User className='h-4 w-4' />
                    </div>
                    <div>
                      <p className='text-sm font-semibold'>
                        {inquiry.partner?.businessName ?? '파트너'}
                      </p>
                      <p className='text-xs text-muted-foreground'>문의 작성자</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                    <Calendar className='h-4 w-4' />
                    <span>{formatDate(inquiry.createdAt)}</span>
                  </div>
                </div>

                <div className='pl-10 space-y-2'>
                  <div className='flex items-start gap-2'>
                    <span className='font-bold text-primary text-lg'>Q.</span>
                    <p className='text-sm whitespace-pre-wrap leading-relaxed flex-1'>
                      {inquiry.content}
                    </p>
                  </div>
                </div>
              </div>

              {inquiry.imageUrls && inquiry.imageUrls.length > 0 && (
                <div className='space-y-3'>
                  <h3 className='font-semibold text-sm flex items-center gap-2'>
                    <ImageIcon className='h-4 w-4' />
                    첨부 이미지 ({inquiry.imageUrls.length}개)
                  </h3>
                  <div className='flex flex-wrap gap-2'>
                    {inquiry.imageUrls.map((url, index) => (
                      <ImageThumbnail
                        key={index}
                        src={url}
                        alt={`첨부 이미지 ${index + 1}`}
                        onClick={() => imgLb.open(index)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {replies.length > 0 && (
            <Card className='bg-card border-border'>
              <CardHeader>
                <CardTitle className='text-card-foreground'>답변 내역 ({replies.length})</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {replies.map((reply, index) => (
                  <div key={reply.id}>
                    {index > 0 && <Separator className='my-4' />}
                    <div className='space-y-3'>
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex items-center gap-2'>
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              reply.isAdmin
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <User className='h-4 w-4' />
                          </div>
                          <div>
                            <p className='text-sm font-medium'>
                              {reply.isAdmin ? '관리자' : inquiry?.partner?.representativeName || '파트너'}
                              {reply.isAdmin && (
                                <Badge variant='outline' className='ml-2 text-xs'>
                                  관리자
                                </Badge>
                              )}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {formatDate(reply.createdAt)}
                            </p>
                          </div>
                        </div>
                        {reply.isAdmin && (
                          <div className='flex items-center gap-2'>
                            <Button variant='ghost' size='sm' onClick={() => handleEditReply(reply)}>
                              <Edit className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDeleteReply(reply.id)}
                            >
                              <Trash2 className='h-4 w-4 text-destructive' />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div
                        className={`ml-10 p-4 rounded-lg ${
                          reply.isAdmin ? 'bg-primary/5 border border-primary/10' : 'bg-muted'
                        }`}
                      >
                        <p className='text-sm whitespace-pre-wrap leading-relaxed'>
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 답변 작성 폼: 관리자 답변이 없거나 수정 모드일 때만 */}
          {(!hasAdminReply || isEditing) && (
            <Card className='bg-card border-border'>
              <CardHeader>
                <CardTitle className='text-card-foreground'>
                  {isEditing ? '답변 수정' : '답변 작성'}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <Textarea
                  placeholder='답변 내용을 입력하세요...'
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={6}
                  className='resize-none'
                />
                <div className='flex justify-end gap-2'>
                  {isEditing && (
                    <Button variant='outline' onClick={handleCancelEdit} disabled={sending}>
                      취소
                    </Button>
                  )}
                  <Button onClick={handleSendReply} disabled={sending || !replyContent.trim()}>
                    {sending ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        {isEditing ? '수정 중...' : '전송 중...'}
                      </>
                    ) : (
                      <>
                        <Send className='mr-2 h-4 w-4' />
                        {isEditing ? '답변 수정' : '답변 보내기'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ImageLightbox {...imgLb.props} />
    </div>
  );
}

// ============================================================
// PartnerInfoGrid
// ============================================================

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className='text-xs text-muted-foreground mb-0.5'>{label}</div>
      <div className='text-sm'>{value ?? '-'}</div>
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
    <div className='space-y-3'>
      <div className='grid grid-cols-2 gap-3'>
        <Field label='상호명' value={partner.businessName} />
        <Field label='대표자명' value={partner.representativeName} />
        <Field label='전화번호' value={partner.displayPhoneNumber} />
        <Field label='카테고리' value={partner.category?.categoryName} />
      </div>
      <Field label='사업장 주소' value={fullAddress || undefined} />
      <Field label='주차 안내' value={partner.parkingInfo || undefined} />
      <div className='grid grid-cols-2 gap-3'>
        <Field label='사업자등록번호' value={partner.businessRegistrationNumber} />
        <Field
          label='가입일'
          value={
            partner.createdAt
              ? new Date(partner.createdAt).toLocaleDateString('ko-KR')
              : undefined
          }
        />
      </div>
    </div>
  );
}
