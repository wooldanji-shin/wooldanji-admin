'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { TableSkeleton } from '@/components/skeletons';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles, getSessionUser } from '@/lib/auth';
import { toast } from 'sonner';

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
  isPartner?: boolean;
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
        const { data: { user } } = await getSessionUser();
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

      // 파트너 userId 목록 조회
      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('userId');
      const partnerUserIds = new Set((partnerData || []).map((p: any) => p.userId));

      // 1. 재신청 목록 가져오기
      let reconfirmQuery = supabase
        .from('user_reconfirm')
        .select(`
          id,
          status,
          previousStatus,
          rejectionReason,
          createdAt,
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
            suspensionReason: r.rejectionReason || null,
            createdAt: r.createdAt,
            isPartner: partnerUserIds.has(r.user.id),
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
          isPartner: partnerUserIds.has(u.id),
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
      router.push(`/admin/user-reconfirm/user/${item.userId}`);
    }
  };

  const getStatusBadge = (status: string, type: 'previous' | 'current') => {
    if (status === 'suspended') {
      return <Badge variant="light" color="orange">보류</Badge>;
    } else if (status === 'inactive') {
      return <Badge variant="light" color="gray">비활성</Badge>;
    } else if (status === 'pending') {
      return <Badge variant="light" color="blue">재신청 대기</Badge>;
    } else if (status === 'rejected') {
      return <Badge variant="light" color="orange">보류</Badge>;
    }
    return <Badge variant="light" color="gray">{status}</Badge>;
  };

  const reconfirmCount = combinedItems.filter(i => i.type === 'reconfirm').length;
  const suspendedCount = combinedItems.filter(i => i.type === 'suspended').length;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="승인보류 관리"
          description="재신청·보류 회원을 한곳에서 검토합니다."
        />
      </PageHeader>

      <PageContent>
        {/* Combined Table */}
        <DataTableShell
          summary={
            <Group gap="md">
              <Text size="sm" c="dimmed">전체 {combinedItems.length}건</Text>
              <Text size="sm" c="dimmed">•</Text>
              <Text size="sm" c="dimmed">재신청 {reconfirmCount}건</Text>
              <Text size="sm" c="dimmed">•</Text>
              <Text size="sm" c="dimmed">보류/비활성 {suspendedCount}건</Text>
            </Group>
          }
        >
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>구분</Table.Th>
                <Table.Th>이름</Table.Th>
                <Table.Th>전화번호</Table.Th>
                <Table.Th>아파트/동/호</Table.Th>
                <Table.Th>권한</Table.Th>
                <Table.Th>상태</Table.Th>
                <Table.Th>보류사유</Table.Th>
                <Table.Th>날짜</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={8} p={0}>
                    <TableSkeleton rows={8} columns={8} showHeader={false} />
                  </Table.Td>
                </Table.Tr>
              ) : combinedItems.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} ta="center" py={48} c="dimmed">
                    보류 대상이 없습니다.
                  </Table.Td>
                </Table.Tr>
              ) : (
                combinedItems.map((item) => (
                  <Table.Tr
                    key={`${item.type}-${item.id}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(item)}
                  >
                    <Table.Td>
                      {item.type === 'reconfirm' ? (
                        <Badge variant="light" color="blue">재신청</Badge>
                      ) : (
                        <Badge variant="light" color="orange">보류중</Badge>
                      )}
                    </Table.Td>
                    <Table.Td fw={500}>
                      <Group gap="xs" wrap="nowrap">
                        {item.userName}
                        {item.isPartner && (
                          <Badge variant="light" color="grape" size="sm">파트너</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {item.userPhone || '-'}
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {item.apartmentName ? (
                        <Text size="sm" c="dimmed">
                          {item.apartmentName}<br/>
                          {item.buildingNumber ? `${item.buildingNumber}동` : ''}
                          {item.unit ? ` ${item.unit}호` : ''}
                        </Text>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td c="dimmed" fz="sm">
                      {getUserRole(item.userRoles)}
                    </Table.Td>
                    <Table.Td>
                      {getStatusBadge(item.currentStatus, 'current')}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        label={item.suspensionReason}
                        multiline
                        maw={320}
                        disabled={!item.suspensionReason}
                      >
                        <Text size="sm" c="dimmed" maw={150} truncate>
                          {item.suspensionReason || '-'}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {formatDate(item.createdAt)}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
