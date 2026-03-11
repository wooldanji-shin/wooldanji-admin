'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles } from '@/lib/auth';
import { toast } from 'sonner';

type SuspendedUserDetails = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  birthDay: string | null;
  confirmImageUrl: string | null;
  buildingNumber: number | null;
  unit: number | null;
  address: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
  regionDong: string | null;
  approvalStatus: string;
  suspensionReason: string | null;
  openDoorCount: number | null;
  rssLevel: number | null;
  platform: string | null;
  registrationType: string | null;
  createdAt: string;
  apartments: {
    id: string;
    name: string;
  } | null;
  reconfirmHistory: {
    id: string;
    reConfirmImageUrl: string;
    status: string;
    previousStatus: string;
    createdAt: string;
    rejectionReason: string | null;
  }[];
};

export default function SuspendedUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<SuspendedUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    params.then((p) => setUserId(p.userId));
  }, [params]);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      setLoading(true);

      try {
        const roles = await getUserRoles();
        const isManager = roles.includes('MANAGER');
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        if (!isManager && !isSuperAdmin) {
          toast.error('접근 권한이 없습니다.');
          router.push('/admin/dashboard');
          return;
        }

        const { data, error } = await supabase
          .from('user')
          .select(`
            id,
            name,
            email,
            phoneNumber,
            birthDay,
            confirmImageUrl,
            buildingNumber,
            unit,
            address,
            regionSido,
            regionSigungu,
            regionDong,
            approvalStatus,
            suspensionReason,
            openDoorCount,
            rssLevel,
            platform,
            registrationType,
            createdAt,
            apartmentId,
            apartments:apartmentId(id, name)
          `)
          .eq('id', userId)
          .single();

        if (error) throw error;

        // 매니저 권한 체크
        if (isManager && data.apartmentId) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { data: managerApartments } = await supabase
              .from('manager_apartments')
              .select('apartmentId')
              .eq('managerId', authUser.id)
              .eq('apartmentId', data.apartmentId);

            if (!managerApartments || managerApartments.length === 0) {
              toast.error('접근 권한이 없습니다.');
              router.push('/admin/user-reconfirm');
              return;
            }
          }
        }

        // 재신청 이력 조회
        const { data: historyData } = await supabase
          .from('user_reconfirm')
          .select('id, reConfirmImageUrl, status, previousStatus, createdAt, rejectionReason')
          .eq('userId', userId)
          .order('createdAt', { ascending: false });

        setUser({
          ...data,
          apartments: data.apartments as SuspendedUserDetails['apartments'],
          reconfirmHistory: (historyData || []) as SuspendedUserDetails['reconfirmHistory'],
        });
      } catch (err) {
        console.error('Failed to fetch user:', err);
        toast.error('회원 정보를 불러오는데 실패했습니다.');
        router.push('/admin/user-reconfirm');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, supabase, router]);

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleString('ko-KR');

  const getStatusBadge = (status: string) => {
    if (status === 'suspended') return <Badge className="bg-yellow-500 text-white">보류</Badge>;
    if (status === 'inactive') return <Badge className="bg-gray-500 text-white">비활성</Badge>;
    if (status === 'pending') return <Badge className="bg-blue-500 text-white">재신청 대기</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-500 text-white">거절</Badge>;
    if (status === 'approve') return <Badge className="bg-green-500 text-white">승인</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <AdminHeader title="보류 회원 상세" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full">
        <AdminHeader title="보류 회원 상세" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">회원 정보를 찾을 수 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AdminHeader title="보류 회원 상세" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/user-reconfirm')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Button>

        {/* 회원 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>회원 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="이름" value={user.name} />
              <Field label="이메일" value={user.email} />
              <Field label="전화번호" value={user.phoneNumber} />
              <Field label="생년월일" value={user.birthDay} />
            </div>
            <Field label="아파트" value={user.apartments?.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="동" value={user.buildingNumber} />
              <Field label="호" value={user.unit} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="주소" value={user.address} />
              <Field
                label="지역"
                value={[user.regionSido, user.regionSigungu, user.regionDong].filter(Boolean).join(' ') || undefined}
              />
              <Field label="회원유형" value={
                user.registrationType === 'APARTMENT' ? '아파트' :
                user.registrationType === 'GENERAL' ? '일반' : '-'
              } />
              <Field label="승인상태" value={
                user.approvalStatus === 'approve' ? '승인' :
                user.approvalStatus === 'pending' ? '대기' :
                user.approvalStatus === 'suspended' ? '보류' :
                user.approvalStatus === 'inactive' ? '비활성' :
                user.approvalStatus
              } />
              <Field label="문 연 횟수" value={user.openDoorCount} />
              <Field label="RSS 레벨" value={user.rssLevel} />
              <Field label="가입일" value={new Date(user.createdAt).toLocaleDateString('ko-KR')} />
              <Field label="플랫폼" value={user.platform} />
            </div>

            {user.suspensionReason && (
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-1">보류 사유</div>
                <div className="text-sm">{user.suspensionReason}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 승인 사진 */}
        <Card>
          <CardHeader>
            <CardTitle>승인 사진</CardTitle>
          </CardHeader>
          <CardContent>
            {user.confirmImageUrl ? (
              <div className="max-w-sm">
                <div className="text-sm text-muted-foreground mb-2">최초 승인 시 제출 사진</div>
                <div className="relative aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={user.confirmImageUrl}
                    alt="승인 사진"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">등록된 사진이 없습니다.</div>
            )}
          </CardContent>
        </Card>

        {/* 재신청 이력 */}
        {user.reconfirmHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>재신청 이력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {user.reconfirmHistory.map((history, index) => (
                <div key={history.id} className="space-y-3">
                  {index > 0 && <hr className="border-border" />}
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">{formatDate(history.createdAt)}</div>
                    {getStatusBadge(history.status)}
                  </div>

                  {/* 재신청 사진 */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">재신청 사진</div>
                    <div className="max-w-xs">
                      <div className="relative aspect-square bg-secondary rounded-lg overflow-hidden flex items-center justify-center">
                        <img
                          src={history.reConfirmImageUrl}
                          alt="재신청 사진"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 거절 사유 */}
                  {history.rejectionReason && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">거절 사유</div>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-900">
                        {history.rejectionReason}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm">{value ?? '-'}</div>
    </div>
  );
}
