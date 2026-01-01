'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    confirmImageUrl: string | null;
    buildingNumber: number | null;
    unit: number | null;
    apartmentId: string | null;
    user_roles?: { role: string }[];
    apartments: {
      id: string;
      name: string;
    } | null;
  };
};

// 보류 상태 사용자 (재신청 안 한 사람)
type SuspendedUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  confirmImageUrl: string | null;
  buildingNumber: number | null;
  unit: number | null;
  apartmentId: string | null;
  approvalStatus: string;
  suspensionReason: string | null;
  createdAt: string;
  user_roles?: { role: string }[];
  apartments: {
    id: string;
    name: string;
  } | null;
};

// 통합 타입
type CombinedItem = {
  type: 'reconfirm' | 'suspended';
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  apartmentName: string | null;
  buildingNumber: number | null;
  unit: number | null;
  userRoles?: { role: string }[];
  previousStatus: string;
  currentStatus: string;
  suspensionReason?: string | null;
  createdAt: string;
};

export default function UserReconfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
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

      // 매니저인 경우 아파트 ID 가져오기
      let apartmentIds: string[] = [];
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            apartmentIds = managerApartments.map(ma => ma.apartmentId);
          } else {
            setCombinedItems([]);
            setLoading(false);
            return;
          }
        }
      }

      // 1. 재신청 목록 가져오기
      let reconfirmQuery = supabase
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
            apartmentId,
            registrationType,
            user_roles(role),
            apartments:apartmentId(id, name)
          )
        `)
        .in('status', ['pending', 'rejected'])
        .not('user.registrationType', 'is', null)
        .eq('user.registrationType', 'APARTMENT');

      if (isManager && apartmentIds.length > 0) {
        reconfirmQuery = reconfirmQuery.in('user.apartmentId', apartmentIds);
      }

      const { data: reconfirmData, error: reconfirmError } = await reconfirmQuery
        .order('createdAt', { ascending: false });

      if (reconfirmError) throw reconfirmError;

      // 2. 보류 상태 사용자 가져오기 (재신청 안 한 사람)
      // 먼저 재신청한 사용자 ID 목록 가져오기
      const reconfirmUserIds = (reconfirmData || [])
        .filter((r: any) => r.user)
        .map((r: any) => r.user.id);

      let suspendedQuery = supabase
        .from('user')
        .select(`
          id,
          name,
          email,
          phoneNumber,
          confirmImageUrl,
          buildingNumber,
          unit,
          apartmentId,
          approvalStatus,
          suspensionReason,
          createdAt,
          registrationType,
          user_roles!inner(role),
          apartments:apartmentId(id, name)
        `)
        .eq('user_roles.role', 'APP_USER')
        .in('approvalStatus', ['suspended', 'inactive'])
        .eq('registrationType', 'APARTMENT');

      if (isManager && apartmentIds.length > 0) {
        suspendedQuery = suspendedQuery.in('apartmentId', apartmentIds);
      }

      const { data: suspendedData, error: suspendedError } = await suspendedQuery
        .order('createdAt', { ascending: false });

      if (suspendedError) throw suspendedError;

      // 재신청한 사용자 제외
      const suspendedUsers = (suspendedData || []).filter(
        (u: any) => !reconfirmUserIds.includes(u.id)
      );

      // 3. 통합 데이터 생성
      const combined: CombinedItem[] = [];

      // 재신청 데이터 추가
      (reconfirmData || []).forEach((r: any) => {
        if (r.user) {
          combined.push({
            type: 'reconfirm',
            id: r.id,
            userId: r.user.id,
            userName: r.user.name || '-',
            userEmail: r.user.email,
            userPhone: r.user.phoneNumber,
            apartmentName: r.user.apartments?.name || null,
            buildingNumber: r.user.buildingNumber,
            unit: r.user.unit,
            userRoles: r.user.user_roles,
            previousStatus: r.previousStatus,
            currentStatus: r.status,
            createdAt: r.createdAt,
          });
        }
      });

      // 보류 사용자 데이터 추가
      suspendedUsers.forEach((u: any) => {
        combined.push({
          type: 'suspended',
          id: u.id,
          userId: u.id,
          userName: u.name || '-',
          userEmail: u.email,
          userPhone: u.phoneNumber,
          apartmentName: u.apartments?.name || null,
          buildingNumber: u.buildingNumber,
          unit: u.unit,
          userRoles: u.user_roles,
          previousStatus: u.approvalStatus,
          currentStatus: u.approvalStatus,
          suspensionReason: u.suspensionReason,
          createdAt: u.createdAt,
        });
      });

      // 날짜순 정렬
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setCombinedItems(combined);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const getUserRole = (roles?: { role: string }[]) => {
    if (!roles || roles.length === 0) return '-';
    const roleMap: Record<string, string> = {
      'APP_USER': '앱 사용자',
      'APT_ADMIN': '아파트 관리자',
      'MANAGER': '매니저',
      'SUPER_ADMIN': '최고 관리자'
    };
    return roles.map(r => roleMap[r.role] || r.role).join(', ');
  };

  const handleRowClick = (item: CombinedItem) => {
    if (item.type === 'reconfirm') {
      router.push(`/admin/user-reconfirm/${item.id}`);
    } else {
      // 보류 사용자는 회원관리 페이지로 이동
      router.push(`/admin/users?search=${encodeURIComponent(item.userEmail)}`);
    }
  };

  const getStatusBadge = (status: string, type: 'previous' | 'current') => {
    if (status === 'suspended') {
      return <Badge className="bg-yellow-500 text-white">보류</Badge>;
    } else if (status === 'inactive') {
      return <Badge className="bg-gray-500 text-white">비활성</Badge>;
    } else if (status === 'pending') {
      return <Badge className="bg-blue-500 text-white">재신청 대기</Badge>;
    } else if (status === 'rejected') {
      return <Badge className="bg-red-500 text-white">거절</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const reconfirmCount = combinedItems.filter(i => i.type === 'reconfirm').length;
  const suspendedCount = combinedItems.filter(i => i.type === 'suspended').length;

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='승인보류/거절 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        <div className='text-sm text-muted-foreground flex gap-4'>
          <span>전체 {combinedItems.length}건</span>
          <span>•</span>
          <span>재신청 {reconfirmCount}건</span>
          <span>•</span>
          <span>보류/비활성 {suspendedCount}건</span>
        </div>

        {/* Combined Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto relative min-h-[400px]'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground'>
                      구분
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      이름
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      이메일
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      전화번호
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      아파트/동/호
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      권한
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      상태
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      보류사유
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      날짜
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : combinedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className='text-center py-12 text-muted-foreground'>
                        보류/거절 대상이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    combinedItems.map((item) => (
                      <TableRow
                        key={`${item.type}-${item.id}`}
                        className='border-border hover:bg-secondary/50 cursor-pointer'
                        onClick={() => handleRowClick(item)}
                      >
                        <TableCell>
                          {item.type === 'reconfirm' ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">재신청</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">보류중</Badge>
                          )}
                        </TableCell>
                        <TableCell className='font-medium text-card-foreground'>
                          {item.userName}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {item.userEmail}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {item.userPhone || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {item.apartmentName ? (
                            <span className='text-sm'>
                              {item.apartmentName}<br/>
                              {item.buildingNumber ? `${item.buildingNumber}동` : ''}
                              {item.unit ? ` ${item.unit}호` : ''}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {getUserRole(item.userRoles)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.currentStatus, 'current')}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm max-w-[150px] truncate'>
                          {item.suspensionReason || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatDate(item.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
