'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Check, X } from 'lucide-react';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { toast } from 'sonner';

type ApplicationDetail = {
  id: string;
  partnerUserId: string;
  userEmail: string;
  name: string;
  phoneNumber: string;
  birthDay: string | null;
  address: string;
  detailAddress: string | null;
  apartmentId: string | null;
  buildingNumber: number | null;
  unit: number | null;
  registrationType: string;
  regionSido: string | null;
  regionSigungu: string | null;
  regionDong: string | null;
  confirmImageUrl: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  apartments: {
    name: string;
  } | null;
};

export default function MembershipConversionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const imgLb = useImageLightbox(application?.confirmImageUrl ? [application.confirmImageUrl] : []);
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState('');

  // 승인 모달
  const [approveDialog, setApproveDialog] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  // 거절 모달
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    params.then((p) => setApplicationId(p.id));
  }, [params]);

  useEffect(() => {
    if (!applicationId) return;

    const fetchApplication = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/membership-conversion/${applicationId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? '조회 실패');
        setApplication(json.data as ApplicationDetail);
      } catch (err) {
        console.error('신청 상세 조회 실패:', err);
        toast.error('신청 정보를 불러오는데 실패했습니다.');
        router.push('/admin/membership-conversion');
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [applicationId, router]);

  const handleApprove = async () => {
    if (!application) return;
    setApproveLoading(true);
    try {
      const res = await fetch('/api/admin/approve-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '승인 실패');
      toast.success('멤버십 전환이 승인되었습니다.');
      router.push('/admin/membership-conversion');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인 중 오류가 발생했습니다.');
    } finally {
      setApproveLoading(false);
      setApproveDialog(false);
    }
  };

  const handleReject = async () => {
    if (!application) return;
    setRejectLoading(true);
    try {
      const res = await fetch(`/api/admin/reject-membership/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '거절 실패');
      toast.success('멤버십 전환 신청이 거절되었습니다.');
      router.push('/admin/membership-conversion');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '거절 중 오류가 발생했습니다.');
    } finally {
      setRejectLoading(false);
      setRejectDialog(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getAddressDisplay = (app: ApplicationDetail) => {
    if (app.apartments) {
      const parts = [app.apartments.name];
      if (app.buildingNumber) parts.push(`${app.buildingNumber}동`);
      if (app.unit) parts.push(`${app.unit}호`);
      return parts.join(' ');
    }
    return app.detailAddress ? `${app.address} ${app.detailAddress}` : app.address;
  };

  const getRegion = (app: ApplicationDetail) => {
    const parts = [app.regionSido, app.regionSigungu, app.regionDong].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title='멤버십 전환 신청 상세' />
        <div className="flex w-full items-center justify-center py-20">
          <div className="flex w-full max-w-sm flex-col gap-3 mx-auto"><Skeleton className="h-4 w-2/3 mx-auto" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title='멤버십 전환 신청 상세' />
        <div className="flex w-full items-center justify-center py-20">
          <div className='text-muted-foreground'>신청 정보를 찾을 수 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={() => router.push('/admin/membership-conversion')}
          aria-label='뒤로가기'
        >
          <ChevronLeft className='h-5 w-5' />
        </Button>
        <AdminHeader title='멤버십 전환 신청 상세' className='flex-1' />
      </div>

      <div className="flex flex-col gap-6">
        {/* 신청자 정보 */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>신청자 정보</CardTitle>
              <div className='flex items-center gap-2'>
                <Badge variant={application.registrationType === 'APARTMENT' ? 'default' : 'secondary'}>
                  {application.registrationType === 'APARTMENT' ? '아파트' : '일반주택'}
                </Badge>
                <Badge
                  variant={
                    application.status === 'pending' ? 'outline' :
                    application.status === 'approved' ? 'default' : 'destructive'
                  }
                >
                  {application.status === 'pending' ? '검토 대기' :
                   application.status === 'approved' ? '승인' : '거절'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <div className='text-sm text-muted-foreground'>이름</div>
                <div className='font-medium'>{application.name}</div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>이메일</div>
                <div className='font-medium'>{application.userEmail}</div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>전화번호</div>
                <div className='font-medium'>{application.phoneNumber || '-'}</div>
              </div>
              <div>
                <div className='text-sm text-muted-foreground'>생년월일</div>
                <div className='font-medium'>{application.birthDay || '-'}</div>
              </div>
              <div className='col-span-2'>
                <div className='text-sm text-muted-foreground'>주소</div>
                <div className='font-medium'>{getAddressDisplay(application)}</div>
              </div>
              {application.registrationType === 'GENERAL' && (
                <div className='col-span-2'>
                  <div className='text-sm text-muted-foreground'>지역</div>
                  <div className='font-medium'>{getRegion(application)}</div>
                </div>
              )}
              <div>
                <div className='text-sm text-muted-foreground'>신청일</div>
                <div className='font-medium'>{formatDate(application.createdAt)}</div>
              </div>
              {application.reviewedAt && (
                <div>
                  <div className='text-sm text-muted-foreground'>처리일</div>
                  <div className='font-medium'>{formatDate(application.reviewedAt)}</div>
                </div>
              )}
            </div>

            {application.rejectionReason && (
              <div>
                <div className='text-sm text-muted-foreground'>거절 사유</div>
                <div className='mt-1 p-3 bg-red-50 border border-red-200 rounded-md text-red-900'>
                  {application.rejectionReason}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 신청 사진 */}
        <Card>
          <CardHeader>
            <CardTitle>신청 사진</CardTitle>
          </CardHeader>
          <CardContent>
            {application.confirmImageUrl ? (
              <ImageThumbnail
                src={application.confirmImageUrl}
                alt='신청 인증 사진'
                onClick={() => imgLb.open(0)}
              />
            ) : (
              <p className='text-sm text-muted-foreground'>사진 없음</p>
            )}
          </CardContent>
        </Card>

        {/* 승인/거절 버튼 (pending 상태일 때만) */}
        {application.status === 'pending' && (
          <div className='flex gap-4 justify-end'>
            <Button
              variant='destructive'
              size='lg'
              onClick={() => setRejectDialog(true)}
              className='gap-2'
            >
              <X className='h-5 w-5' />
              거절
            </Button>
            <Button
              size='lg'
              onClick={() => setApproveDialog(true)}
              className='gap-2 bg-green-600 hover:bg-green-700'
            >
              <Check className='h-5 w-5' />
              승인
            </Button>
          </div>
        )}
      </div>

      {/* 승인 확인 모달 */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버십 전환 승인</DialogTitle>
          </DialogHeader>
          <div className='py-2 space-y-2 text-sm'>
            <div><span className='font-medium'>신청자:</span> {application.name}</div>
            <div><span className='font-medium'>이메일:</span> {application.userEmail}</div>
            <div><span className='font-medium'>주소:</span> {getAddressDisplay(application)}</div>
            {application.registrationType === 'GENERAL' && (
              <p className='text-amber-600 text-xs mt-2'>
                일반주택 신청은 승인 즉시 아파트 회원으로 활성화됩니다.
              </p>
            )}
            {application.registrationType === 'APARTMENT' && (
              <p className='text-blue-600 text-xs mt-2'>
                아파트 신청은 승인 후 추가 검토(pending) 상태로 생성됩니다.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setApproveDialog(false)} disabled={approveLoading}>
              취소
            </Button>
            <Button onClick={handleApprove} disabled={approveLoading}>
              {approveLoading ? '처리 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거절 사유 입력 모달 */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버십 전환 거절</DialogTitle>
          </DialogHeader>
          <div className='py-2 space-y-4'>
            <div className='space-y-1 text-sm'>
              <div><span className='font-medium'>신청자:</span> {application.name}</div>
              <div><span className='font-medium'>이메일:</span> {application.userEmail}</div>
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>거절 사유 (선택)</label>
              <Textarea
                placeholder='거절 사유를 입력해주세요.'
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectDialog(false)} disabled={rejectLoading}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleReject} disabled={rejectLoading}>
              {rejectLoading ? '처리 중...' : '거절'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImageLightbox {...imgLb.props} />
    </div>
  );
}
