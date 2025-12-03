'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  ArrowLeft,
  Send,
  User,
  Mail,
  Phone,
  Calendar,
  Image as ImageIcon,
  AlertCircle,
  Edit,
  Trash2,
  Home,
  Building2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Image from 'next/image';
import { getUserRoles } from '@/lib/auth';

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
    apartmentId: string | null;
    registrationType: 'APARTMENT' | 'GENERAL' | null;
    buildingNumber: number | null;
    unit: number | null;
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
            apartmentId,
            registrationType,
            buildingNumber,
            unit,
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
    if (!confirm('이 답변을 삭제하시겠습니까?')) {
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
      <div className='flex flex-col h-full'>
        <AdminHeader title='문의 상세' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='문의 상세' />
        <div className='flex-1 p-6'>
          <div className='max-w-5xl mx-auto'>
            <Button
              variant='ghost'
              onClick={() => router.back()}
              className='mb-4'
            >
              <ArrowLeft className='h-4 w-4 mr-2' />
              목록으로
            </Button>
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                이 문의에 접근할 권한이 없습니다. 매니저는 자신이 관리하는 아파트 회원의 문의만 확인할 수 있습니다.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='문의 상세' />
        <div className='flex-1 flex flex-col items-center justify-center gap-4'>
          <p className='text-muted-foreground'>문의를 찾을 수 없습니다.</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='문의 상세' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-5xl mx-auto space-y-6'>
          {/* Back Button */}
          <Button
            variant='ghost'
            onClick={() => router.back()}
            className='mb-2'
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            목록으로
          </Button>

          {/* Inquiry Detail */}
          <Card className='bg-card border-border'>
            <CardHeader>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1 space-y-2'>
                  <div className='flex items-center gap-2'>
                    <CardTitle className='text-card-foreground'>{inquiry.title}</CardTitle>
                    {getStatusBadge(inquiry.status)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* User Info Card - Background style */}
              <div className='bg-muted/50 rounded-lg p-4 space-y-3'>
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground'>
                  {inquiry.user?.name && (
                    <div className='flex items-center gap-2'>
                      <User className='h-4 w-4' />
                      <span>{inquiry.user.name}</span>
                    </div>
                  )}
                  {inquiry.user?.email && (
                    <div className='flex items-center gap-2'>
                      <Mail className='h-4 w-4' />
                      <span className='truncate'>{inquiry.user.email}</span>
                    </div>
                  )}
                  {inquiry.user?.phoneNumber && (
                    <div className='flex items-center gap-2'>
                      <Phone className='h-4 w-4' />
                      <span>{inquiry.user.phoneNumber}</span>
                    </div>
                  )}
                </div>

                {/* User Type Information */}
                <div className='pt-2 border-t border-border/50'>
                  {inquiry.user?.registrationType === 'APARTMENT' ? (
                    <div className='flex items-center gap-2 text-sm'>
                      <Home className='h-4 w-4 text-primary' />
                      <span className='font-medium'>아파트 회원:</span>
                      <span className='text-muted-foreground'>
                        {inquiry.user.apartments?.name || '정보 없음'}
                        {inquiry.user.buildingNumber && inquiry.user.unit && (
                          <>
                            {' '}
                            <Building2 className='h-3 w-3 inline mx-1' />
                            {inquiry.user.buildingNumber}동 {inquiry.user.unit}호
                          </>
                        )}
                      </span>
                    </div>
                  ) : inquiry.user?.registrationType === 'GENERAL' ? (
                    <div className='flex items-center gap-2 text-sm'>
                      <User className='h-4 w-4 text-muted-foreground' />
                      <span className='text-muted-foreground'>일반회원</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <Separator />

              {/* Content with User and Date */}
              <div className='space-y-4'>
                {/* Header: User name on left, Date on right */}
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center'>
                      <User className='h-4 w-4' />
                    </div>
                    <div>
                      <p className='text-sm font-semibold'>
                        {inquiry.user?.name || '알 수 없는 사용자'}
                      </p>
                      <p className='text-xs text-muted-foreground'>문의 작성자</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                    <Calendar className='h-4 w-4' />
                    <span>{formatDate(inquiry.createdAt)}</span>
                  </div>
                </div>

                {/* Q. Content */}
                <div className='pl-10 space-y-2'>
                  <div className='flex items-start gap-2'>
                    <span className='font-bold text-primary text-lg'>Q.</span>
                    <p className='text-sm whitespace-pre-wrap leading-relaxed flex-1'>
                      {inquiry.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Images */}
              {inquiry.imageUrls && inquiry.imageUrls.length > 0 && (
                <div className='space-y-3'>
                  <h3 className='font-semibold text-sm flex items-center gap-2'>
                    <ImageIcon className='h-4 w-4' />
                    첨부 이미지 ({inquiry.imageUrls.length}개)
                  </h3>
                  <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                    {inquiry.imageUrls.map((url, index) => (
                      <div
                        key={index}
                        className='relative aspect-square rounded-lg overflow-hidden bg-muted border border-border group'
                      >
                        <Image
                          src={url}
                          alt={`첨부 이미지 ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className='object-cover group-hover:scale-105 transition-transform'
                        />
                        <a
                          href={url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors'
                        >
                          <span className='text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium'>
                            크게 보기
                          </span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Replies */}
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            reply.isAdmin
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <User className='h-4 w-4' />
                          </div>
                          <div>
                            <p className='text-sm font-medium'>
                              {reply.isAdmin ? '관리자' : (reply.user?.name || '사용자')}
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
                        {/* 관리자 답변에만 수정/삭제 버튼 표시 */}
                        {reply.isAdmin && (
                          <div className='flex items-center gap-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleEditReply(reply)}
                            >
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
                      <div className={`ml-10 p-4 rounded-lg ${
                        reply.isAdmin
                          ? 'bg-primary/5 border border-primary/10'
                          : 'bg-muted'
                      }`}>
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

          {/* Reply Form - 관리자 답변이 없거나 수정 모드일 때만 표시 */}
          {(() => {
            const hasAdminReply = replies.some(r => r.isAdmin);

            if (!isEditing && hasAdminReply) {
              return null; // 이미 답변이 있고 수정 중이 아니면 폼 숨김
            }

            return (
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
                      <Button
                        variant='outline'
                        onClick={handleCancelEdit}
                        disabled={sending}
                      >
                        취소
                      </Button>
                    )}
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !replyContent.trim()}
                    >
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}
