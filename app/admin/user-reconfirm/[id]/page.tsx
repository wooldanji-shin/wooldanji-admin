'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles } from '@/lib/auth';
import { toast } from 'sonner';

type UserReconfirmDetails = {
  id: string;
  userId: string;
  reConfirmImageUrl: string;
  status: string;
  previousStatus: string;
  createdAt: string;
  rejectionReason: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    confirmImageUrl: string | null;
    buildingNumber: number | null;
    unit: number | null;
    suspensionReason: string | null;
    apartments: {
      id: string;
      name: string;
    } | null;
  };
};

export default function UserReconfirmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();

  const [reconfirm, setReconfirm] = useState<UserReconfirmDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [reconfirmId, setReconfirmId] = useState<string>('');

  useEffect(() => {
    params.then((p) => setReconfirmId(p.id));
  }, [params]);

  useEffect(() => {
    if (!reconfirmId) return;

    const fetchReconfirm = async () => {
      setLoading(true);

      try {
        // 현재 사용자 역할 확인
        const roles = await getUserRoles();
        const isManager = roles.includes('MANAGER');
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        if (!isManager && !isSuperAdmin) {
          toast.error('접근 권한이 없습니다.');
          router.push('/admin/dashboard');
          return;
        }

        const { data, error } = await supabase
          .from('user_reconfirm')
          .select(`
            *,
            user:userId(
              id,
              name,
              email,
              phoneNumber,
              confirmImageUrl,
              buildingNumber,
              unit,
              suspensionReason,
              apartmentId,
              apartments:apartmentId(id, name)
            )
          `)
          .eq('id', reconfirmId)
          .single();

        if (error) throw error;

        // 매니저인 경우 자신이 관리하는 아파트인지 확인
        if (isManager && data.user.apartmentId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: managerApartments } = await supabase
              .from('manager_apartments')
              .select('apartmentId')
              .eq('managerId', user.id)
              .eq('apartmentId', data.user.apartmentId);

            if (!managerApartments || managerApartments.length === 0) {
              toast.error('접근 권한이 없습니다.');
              router.push('/admin/user-reconfirm');
              return;
            }
          }
        }

        setReconfirm(data);
      } catch (err) {
        console.error('Failed to fetch reconfirm:', err);
        toast.error('재신청 정보를 불러오는데 실패했습니다.');
        router.push('/admin/user-reconfirm');
      } finally {
        setLoading(false);
      }
    };

    fetchReconfirm();
  }, [reconfirmId, supabase, router]);

  const handleApprove = async () => {
    if (!reconfirm) return;

    setProcessing(true);

    try {
      const response = await fetch(`/api/user-reconfirm/${reconfirm.id}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve reconfirm');
      }

      toast.success('재신청이 승인되었습니다.');
      router.push('/admin/user-reconfirm');
    } catch (err) {
      console.error('Failed to approve reconfirm:', err);
      toast.error('재신청 승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reconfirm) return;

    if (!rejectionReason.trim()) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/user-reconfirm/${reconfirm.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject reconfirm');
      }

      toast.success('재신청이 거절되었습니다.');
      router.push('/admin/user-reconfirm');
    } catch (err) {
      console.error('Failed to reject reconfirm:', err);
      toast.error('재신청 거절에 실패했습니다.');
    } finally {
      setProcessing(false);
      setRejectDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='재신청 상세' />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-muted-foreground'>로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!reconfirm) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='재신청 상세' />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-muted-foreground'>재신청 정보를 찾을 수 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='재신청 상세' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Back Button */}
        <Button
          variant='ghost'
          onClick={() => router.push('/admin/user-reconfirm')}
          className='gap-2'
        >
          <ArrowLeft className='h-4 w-4' />
          목록으로
        </Button>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle>회원 정보</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <div className='text-sm text-muted-foreground'>이름</div>
                <div className='font-medium'>{reconfirm.user.name}</div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>이메일</div>
                <div className='font-medium'>{reconfirm.user.email}</div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>전화번호</div>
                <div className='font-medium'>{reconfirm.user.phoneNumber || '-'}</div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>아파트/동/호</div>
                <div className='font-medium'>
                  {reconfirm.user.apartments ? (
                    <>
                      {reconfirm.user.apartments.name}
                      {reconfirm.user.buildingNumber && ` ${reconfirm.user.buildingNumber}동`}
                      {reconfirm.user.unit && ` ${reconfirm.user.unit}호`}
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>이전 상태</div>
                <div>
                  {reconfirm.previousStatus === 'suspended' ? (
                    <Badge variant="secondary">보류</Badge>
                  ) : reconfirm.previousStatus === 'inactive' ? (
                    <Badge variant="secondary">비활성</Badge>
                  ) : (
                    <Badge variant="outline">{reconfirm.previousStatus}</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>재신청일</div>
                <div className='font-medium'>{formatDate(reconfirm.createdAt)}</div>
              </div>
            </div>
            {reconfirm.user.suspensionReason && (
              <div>
                <div className='text-sm text-muted-foreground'>보류 사유</div>
                <div className='mt-1 p-3 bg-secondary rounded-md'>
                  {reconfirm.user.suspensionReason}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Images Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>인증 사진 비교</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Original Image */}
              <div>
                <div className='text-sm font-medium mb-2 text-muted-foreground'>
                  원래 사진
                </div>
                {reconfirm.user.confirmImageUrl ? (
                  <div className='relative aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center'>
                    <img
                      src={reconfirm.user.confirmImageUrl}
                      alt='원래 인증 사진'
                      className='w-full h-full object-contain'
                    />
                  </div>
                ) : (
                  <div className='aspect-square bg-secondary rounded-lg flex items-center justify-center'>
                    <span className='text-muted-foreground'>사진 없음</span>
                  </div>
                )}
              </div>

              {/* Reconfirm Image */}
              <div>
                <div className='text-sm font-medium mb-2 text-muted-foreground'>
                  재신청 사진
                </div>
                <div className='relative aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center'>
                  <img
                    src={reconfirm.reConfirmImageUrl}
                    alt='재신청 사진'
                    className='w-full h-full object-contain'
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className='flex gap-4 justify-end'>
          <Button
            variant='destructive'
            size='lg'
            onClick={() => setRejectDialog(true)}
            disabled={processing}
            className='gap-2'
          >
            <X className='h-5 w-5' />
            거절
          </Button>
          <Button
            variant='default'
            size='lg'
            onClick={handleApprove}
            disabled={processing}
            className='gap-2 bg-green-600 hover:bg-green-700'
          >
            <Check className='h-5 w-5' />
            승인
          </Button>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>재신청 거절</DialogTitle>
            <DialogDescription>
              <strong>{reconfirm.user.name || reconfirm.user.email}</strong>님의 재신청을 거절하시겠습니까?
              <br />
              거절 사유를 입력해주세요. 사용자는 이 사유를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className='py-4'>
            <textarea
              className='w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary'
              placeholder='거절 사유를 입력해주세요...'
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectDialog(false)} disabled={processing}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleReject} disabled={processing}>
              거절
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
