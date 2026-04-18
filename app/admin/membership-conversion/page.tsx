'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

type Application = {
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
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  apartments: {
    name: string;
  } | null;
};

type TabType = 'pending' | 'rejected';

export default function MembershipConversionPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // 승인 모달
  const [approveTarget, setApproveTarget] = useState<Application | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // 거절 모달
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/membership-conversion?status=${activeTab}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '조회 실패');
      setApplications((json.data as Application[]) ?? []);
    } catch (err) {
      console.error('신청 목록 조회 실패:', err);
      toast.error('목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproveLoading(true);
    try {
      const res = await fetch('/api/admin/approve-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: approveTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '승인 실패');
      toast.success('멤버십 전환이 승인되었습니다.');
      setApproveTarget(null);
      fetchApplications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인 중 오류가 발생했습니다.');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectLoading(true);
    try {
      const res = await fetch(`/api/admin/reject-membership/${rejectTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '거절 실패');
      toast.success('멤버십 전환 신청이 거절되었습니다.');
      setRejectTarget(null);
      setRejectionReason('');
      fetchApplications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '거절 중 오류가 발생했습니다.');
    } finally {
      setRejectLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  const getAddressDisplay = (app: Application) => {
    if (app.apartments) {
      const parts = [app.apartments.name];
      if (app.buildingNumber) parts.push(`${app.buildingNumber}동`);
      if (app.unit) parts.push(`${app.unit}호`);
      return parts.join(' ');
    }
    return app.detailAddress ? `${app.address} ${app.detailAddress}` : app.address;
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='멤버십 전환 신청' />

      <div className='flex-1 p-6 overflow-auto'>
        {/* 탭 */}
        <div className='flex gap-2 mb-6'>
          <Button
            variant={activeTab === 'pending' ? 'default' : 'outline'}
            onClick={() => setActiveTab('pending')}
          >
            검토 대기
          </Button>
          <Button
            variant={activeTab === 'rejected' ? 'default' : 'outline'}
            onClick={() => setActiveTab('rejected')}
          >
            거절 목록
          </Button>
        </div>

        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>신청자명</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>신청일</TableHead>
                  {activeTab === 'rejected' && <TableHead>거절 사유</TableHead>}
                  {activeTab === 'pending' && <TableHead className='text-center'>처리</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={activeTab === 'pending' ? 6 : 6} className='text-center py-10 text-muted-foreground'>
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeTab === 'pending' ? 6 : 6} className='text-center py-10 text-muted-foreground'>
                      {activeTab === 'pending' ? '검토 대기 중인 신청이 없습니다.' : '거절된 신청이 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow
                      key={app.id}
                      className='cursor-pointer hover:bg-secondary/50'
                      onClick={() => router.push(`/admin/membership-conversion/${app.id}`)}
                    >
                      <TableCell className='font-medium'>{app.name}</TableCell>
                      <TableCell>{app.userEmail}</TableCell>
                      <TableCell className='max-w-[200px] truncate' title={getAddressDisplay(app)}>
                        {getAddressDisplay(app)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={app.registrationType === 'APARTMENT' ? 'default' : 'secondary'}>
                          {app.registrationType === 'APARTMENT' ? '아파트' : '일반주택'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(app.createdAt)}</TableCell>
                      {activeTab === 'rejected' && (
                        <TableCell className='max-w-[150px] truncate text-muted-foreground' title={app.rejectionReason ?? ''}>
                          {app.rejectionReason ?? '-'}
                        </TableCell>
                      )}
                      {activeTab === 'pending' && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className='flex gap-1 justify-center'>
                            <Button
                              size='icon'
                              variant='ghost'
                              className='h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50'
                              onClick={() => setApproveTarget(app)}
                            >
                              <Check className='h-4 w-4' />
                            </Button>
                            <Button
                              size='icon'
                              variant='ghost'
                              className='h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50'
                              onClick={() => {
                                setRejectTarget(app);
                                setRejectionReason('');
                              }}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 승인 확인 모달 */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버십 전환 승인</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className='py-2 space-y-2 text-sm'>
              <div><span className='font-medium'>신청자:</span> {approveTarget.name}</div>
              <div><span className='font-medium'>이메일:</span> {approveTarget.userEmail}</div>
              <div><span className='font-medium'>주소:</span> {getAddressDisplay(approveTarget)}</div>
              <div><span className='font-medium'>타입:</span> {approveTarget.registrationType === 'APARTMENT' ? '아파트' : '일반주택'}</div>
              {approveTarget.registrationType === 'GENERAL' && (
                <p className='text-amber-600 text-xs mt-2'>
                  일반주택 신청은 승인 즉시 아파트 회원으로 활성화됩니다.
                </p>
              )}
              {approveTarget.registrationType === 'APARTMENT' && (
                <p className='text-blue-600 text-xs mt-2'>
                  아파트 신청은 승인 후 추가 검토(pending) 상태로 생성됩니다.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setApproveTarget(null)} disabled={approveLoading}>
              취소
            </Button>
            <Button onClick={handleApprove} disabled={approveLoading}>
              {approveLoading ? '처리 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거절 사유 입력 모달 */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버십 전환 거절</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className='py-2 space-y-4'>
              <div className='space-y-1 text-sm'>
                <div><span className='font-medium'>신청자:</span> {rejectTarget.name}</div>
                <div><span className='font-medium'>이메일:</span> {rejectTarget.userEmail}</div>
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
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectTarget(null)} disabled={rejectLoading}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleReject} disabled={rejectLoading}>
              {rejectLoading ? '처리 중...' : '거절'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
