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
    apartments: {
      id: string;
      name: string;
    } | null;
  };
};

export default function UserReconfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  const [reconfirms, setReconfirms] = useState<UserReconfirmDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReconfirms = useCallback(async () => {
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

      let query = supabase
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
            apartments:apartmentId(id, name)
          )
        `)
        .eq('status', 'pending')
        .not('user.registrationType', 'is', null)
        .eq('user.registrationType', 'APARTMENT');

      // 매니저인 경우 자신이 관리하는 아파트의 재신청만 필터링
      if (isManager) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: managerApartments } = await supabase
            .from('manager_apartments')
            .select('apartmentId')
            .eq('managerId', user.id);

          if (managerApartments && managerApartments.length > 0) {
            const apartmentIds = managerApartments.map(ma => ma.apartmentId);
            query = query.in('user.apartmentId', apartmentIds);
          } else {
            // 관리하는 아파트가 없으면 빈 결과
            setReconfirms([]);
            setLoading(false);
            return;
          }
        }
      }

      const { data, error: fetchError } = await query
        .order('createdAt', { ascending: false });

      if (fetchError) throw fetchError;

      setReconfirms(data || []);
    } catch (err) {
      console.error('Failed to fetch reconfirms:', err);
      toast.error('재신청 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchReconfirms();
  }, [fetchReconfirms]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const handleRowClick = (reconfirmId: string) => {
    router.push(`/admin/user-reconfirm/${reconfirmId}`);
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='승인보류/거절 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        <div className='text-sm text-muted-foreground'>
          전체 {reconfirms.length}건의 재신청
        </div>

        {/* Reconfirms Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto relative min-h-[400px]'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
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
                      이전 상태
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      재신청일
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : reconfirms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-12 text-muted-foreground'>
                        재신청 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reconfirms.map((reconfirm) => (
                      <TableRow
                        key={reconfirm.id}
                        className='border-border hover:bg-secondary/50 cursor-pointer'
                        onClick={() => handleRowClick(reconfirm.id)}
                      >
                        <TableCell className='font-medium text-card-foreground'>
                          {reconfirm.user.name || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {reconfirm.user.email}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {reconfirm.user.phoneNumber || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {reconfirm.user.apartments ? (
                            <span className='text-sm'>
                              {reconfirm.user.apartments.name}<br/>
                              {reconfirm.user.buildingNumber ? `${reconfirm.user.buildingNumber}동` : ''}
                              {reconfirm.user.unit ? ` ${reconfirm.user.unit}호` : ''}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {reconfirm.previousStatus === 'suspended' ? (
                            <Badge variant="secondary">보류</Badge>
                          ) : reconfirm.previousStatus === 'inactive' ? (
                            <Badge variant="secondary">비활성</Badge>
                          ) : (
                            <Badge variant="outline">{reconfirm.previousStatus}</Badge>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatDate(reconfirm.createdAt)}
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
