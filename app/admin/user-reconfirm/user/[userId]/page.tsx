'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { ChevronLeft } from 'lucide-react';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles, getSessionUser } from '@/lib/auth';
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
  const allImages: string[] = user
    ? [
        ...(user.confirmImageUrl ? [user.confirmImageUrl] : []),
        ...user.reconfirmHistory.map((h) => h.reConfirmImageUrl).filter((u): u is string => !!u),
      ]
    : [];
  const imgLb = useImageLightbox(allImages);
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
          const { data: { user: authUser } } = await getSessionUser();
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
    if (status === 'suspended') return <Badge variant="light" color="orange">보류</Badge>;
    if (status === 'inactive') return <Badge variant="light" color="gray">비활성</Badge>;
    if (status === 'pending') return <Badge variant="light" color="blue">재신청 대기</Badge>;
    if (status === 'rejected') return <Badge variant="light" color="orange">보류</Badge>;
    if (status === 'approve') return <Badge variant="light" color="green">승인</Badge>;
    return <Badge variant="light" color="gray">{status}</Badge>;
  };

  if (loading) {
    return <DetailSkeleton sections={3} />;
  }

  if (!user) {
    return (
      <PageShell>
        <AdminHeader title="보류 회원 상세" />
        <Text c="dimmed" ta="center" py={80}>회원 정보를 찾을 수 없습니다.</Text>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderTitle title='보류 회원 상세' onBack={() => router.push('/admin/user-reconfirm')} />

      <Stack gap="lg">

        {/* 회원 정보 */}
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="md">회원 정보</Title>
          <Stack gap="sm">
            <SimpleGrid cols={2} spacing="sm">
              <Field label="이름" value={user.name} />
              <Field label="이메일" value={user.email} />
              <Field label="전화번호" value={user.phoneNumber} />
              <Field label="생년월일" value={user.birthDay} />
            </SimpleGrid>
            <Field label="아파트" value={user.apartments?.name} />
            <SimpleGrid cols={2} spacing="sm">
              <Field label="동" value={user.buildingNumber} />
              <Field label="호" value={user.unit} />
            </SimpleGrid>
            <SimpleGrid cols={2} spacing="sm">
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
            </SimpleGrid>

            {user.suspensionReason && (
              <>
                <Divider />
                <div>
                  <Text size="sm" c="dimmed" mb={4}>보류 사유</Text>
                  <Text size="sm">{user.suspensionReason}</Text>
                </div>
              </>
            )}
          </Stack>
        </Paper>

        {/* 승인 사진 */}
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="md">승인 사진</Title>
          {user.confirmImageUrl ? (
            <Stack gap="xs">
              <Text size="sm" c="dimmed">최초 승인 시 제출 사진</Text>
              <ImageThumbnail
                src={user.confirmImageUrl}
                alt='승인 사진'
                onClick={() => imgLb.open(0)}
              />
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">등록된 사진이 없습니다.</Text>
          )}
        </Paper>

        {/* 재신청 이력 */}
        {user.reconfirmHistory.length > 0 && (
          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">재신청 이력</Title>
            <Stack gap="lg">
              {user.reconfirmHistory.map((history, index) => (
                <Stack key={history.id} gap="sm">
                  {index > 0 && <Divider />}
                  <Group gap="sm">
                    <Text size="sm" c="dimmed">{formatDate(history.createdAt)}</Text>
                    {getStatusBadge(history.status)}
                  </Group>

                  {/* 재신청 사진 */}
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">재신청 사진</Text>
                    <ImageThumbnail
                      src={history.reConfirmImageUrl}
                      alt='재신청 사진'
                      onClick={() => {
                        const idx = allImages.indexOf(history.reConfirmImageUrl);
                        imgLb.open(idx >= 0 ? idx : 0);
                      }}
                    />
                  </Stack>

                  {/* 거절 사유 */}
                  {history.rejectionReason && (
                    <div>
                      <Text size="sm" c="dimmed" mb={4}>보류 사유</Text>
                      <Paper p="sm" radius="sm" bg="var(--mantine-color-red-light)">
                        <Text size="sm" c="red">
                          {history.rejectionReason}
                        </Text>
                      </Paper>
                    </div>
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>
      <ImageLightbox {...imgLb.props} />
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
      <Text size="sm">{value ?? '-'}</Text>
    </div>
  );
}
