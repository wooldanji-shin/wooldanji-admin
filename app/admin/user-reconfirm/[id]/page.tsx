'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { HeaderTitle } from '@/components/header-title';
import { PageShell } from '@/components/page-shell';
import { DetailSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { ChevronLeft, Check, X } from 'lucide-react';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles, getSessionUser } from '@/lib/auth';
import { toast } from 'sonner';
import { networkFailedMessage, readApiErrorMessage } from '@/lib/utils/api-error';

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
  const imgLb = useImageLightbox(
    reconfirm
      ? [reconfirm.user.confirmImageUrl, reconfirm.reConfirmImageUrl].filter((u): u is string => !!u)
      : []
  );
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
          const { data: { user } } = await getSessionUser();
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
        toast.error((await readApiErrorMessage(response)) ?? '재신청 승인 처리 중 문제가 생겼습니다. 화면을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('재신청이 승인되었습니다.');
      router.push('/admin/user-reconfirm');
    } catch (err) {
      console.error('Failed to approve reconfirm:', err);
      toast.error(networkFailedMessage('재신청을 승인하지 못했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!reconfirm) return;

    if (!rejectionReason.trim()) {
      toast.error('보류 사유를 입력해주세요.');
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
        toast.error((await readApiErrorMessage(response)) ?? '재신청 보류 처리 중 문제가 생겼습니다. 화면을 새로고침해 반영 여부를 확인한 뒤 다시 시도해 주세요.');
        return;
      }

      toast.success('재신청이 보류 처리되었습니다.');
      router.push('/admin/user-reconfirm');
    } catch (err) {
      console.error('Failed to reject reconfirm:', err);
      toast.error(networkFailedMessage('재신청을 보류 처리하지 못했습니다.'));
    } finally {
      setProcessing(false);
      setRejectDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return <DetailSkeleton sections={2} />;
  }

  if (!reconfirm) {
    return (
      <PageShell>
        <AdminHeader title='재신청 상세' />
        <Text c="dimmed" ta="center" py={80}>재신청 정보를 찾을 수 없습니다.</Text>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderTitle title='재신청 상세' onBack={() => router.push('/admin/user-reconfirm')} />

      <Stack gap="lg">

        {/* User Info */}
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="md">회원 정보</Title>
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="sm" c="dimmed">이름</Text>
                <Text fw={500}>{reconfirm.user.name}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">이메일</Text>
                <Text fw={500}>{reconfirm.user.email}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">전화번호</Text>
                <Text fw={500}>{reconfirm.user.phoneNumber || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">아파트/동/호</Text>
                <Text fw={500}>
                  {reconfirm.user.apartments ? (
                    <>
                      {reconfirm.user.apartments.name}
                      {reconfirm.user.buildingNumber && ` ${reconfirm.user.buildingNumber}동`}
                      {reconfirm.user.unit && ` ${reconfirm.user.unit}호`}
                    </>
                  ) : (
                    '-'
                  )}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">이전 상태</Text>
                <div>
                  {reconfirm.previousStatus === 'suspended' ? (
                    <Badge variant="light" color="orange">보류</Badge>
                  ) : reconfirm.previousStatus === 'inactive' ? (
                    <Badge variant="light" color="gray">비활성</Badge>
                  ) : (
                    <Badge variant="light" color="gray">{reconfirm.previousStatus}</Badge>
                  )}
                </div>
              </div>
              <div>
                <Text size="sm" c="dimmed">재신청일</Text>
                <Text fw={500}>{formatDate(reconfirm.createdAt)}</Text>
              </div>
            </SimpleGrid>
            {(reconfirm.user.suspensionReason || reconfirm.previousStatus === 'inactive') && (
              <div>
                <Text size="sm" c="dimmed">이전 보류 사유</Text>
                <Paper mt={4} p="sm" radius="sm" bg="var(--app-bg-muted)">
                  <Text size="sm">
                    {reconfirm.previousStatus === 'inactive'
                      ? '30일동안 이용내역이 없어 비활성화 되었습니다.'
                      : reconfirm.user.suspensionReason}
                  </Text>
                </Paper>
              </div>
            )}
            {reconfirm.rejectionReason && (
              <div>
                <Text size="sm" c="dimmed">재신청 보류 사유</Text>
                <Paper mt={4} p="sm" radius="sm" bg="var(--mantine-color-red-light)">
                  <Text size="sm" c="red">
                    {reconfirm.rejectionReason}
                  </Text>
                </Paper>
              </div>
            )}
          </Stack>
        </Paper>

        {/* Images Comparison */}
        <Paper withBorder radius="md" p="lg">
          <Title order={4} mb="md">인증 사진 비교</Title>
          <Group gap="lg" align="flex-start">
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">원래 사진</Text>
              {reconfirm.user.confirmImageUrl ? (
                <ImageThumbnail
                  src={reconfirm.user.confirmImageUrl}
                  alt='원래 인증 사진'
                  onClick={() => imgLb.open(0)}
                />
              ) : (
                <Text size="sm" c="dimmed">사진 없음</Text>
              )}
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">재신청 사진</Text>
              <ImageThumbnail
                src={reconfirm.reConfirmImageUrl}
                alt='재신청 사진'
                onClick={() => imgLb.open(reconfirm.user.confirmImageUrl ? 1 : 0)}
              />
            </Stack>
          </Group>
        </Paper>

        {/* Action Buttons */}
        {reconfirm.status === 'pending' && (
          <Group justify="flex-end" gap="md">
            <Button
              color='red'
              size='md'
              onClick={() => setRejectDialog(true)}
              disabled={processing}
              leftSection={<X size={20} />}
            >
              보류
            </Button>
            <Button
              color='green'
              size='md'
              onClick={handleApprove}
              disabled={processing}
              leftSection={<Check size={20} />}
            >
              승인
            </Button>
          </Group>
        )}
      </Stack>

      {/* Reject Dialog */}
      <Modal opened={rejectDialog} onClose={() => setRejectDialog(false)} title='재신청 보류'>
        <Text size='sm' c='dimmed'>
          <strong>{reconfirm.user.name || reconfirm.user.email}</strong>님의 재신청을 보류 처리하시겠습니까?
          <br />
          보류 사유를 입력해주세요. 사용자는 이 사유를 확인할 수 있습니다.
        </Text>
        <Textarea
          mt='md'
          minRows={4}
          autosize
          placeholder='보류 사유를 입력해주세요...'
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
        />
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setRejectDialog(false)} disabled={processing}>
            취소
          </Button>
          <Button color='red' onClick={handleReject} disabled={processing}>
            보류
          </Button>
        </Group>
      </Modal>
      <ImageLightbox {...imgLb.props} />
    </PageShell>
  );
}
