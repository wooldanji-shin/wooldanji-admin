'use client';

import { ActionIcon, Divider, Group, Stack, Table, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import { MessageSquare, Eye, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getSessionUser } from '@/lib/auth';
import { useAuthUser } from '@/components/auth-user-context';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbarSearch } from '@/components/data-toolbar';
import { FilterChips, FilterRow } from '@/components/filter-chips';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';

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
  };
  _replyCount?: number;
}

/** 답변 수 조회 시 in() 으로 한 번에 넘기는 문의 id 수 — uuid 36자 기준 URL이 약 3.7KB를 넘지 않게 한다 */
const REPLY_COUNT_ID_CHUNK = 100;
/** PostgREST가 한 요청에 돌려주는 최대 행 수(기본 1000) — 넘치면 다음 범위를 이어서 받는다 */
const REPLY_COUNT_PAGE_SIZE = 1000;

/**
 * 문의 id 목록의 답변 수를 묶어서 조회해 { 문의 id → 답변 수 } 로 돌려준다.
 * 예전처럼 문의마다 count 요청을 보내지 않고, 답변 행의 inquiryId만 받아 화면에서 센다.
 * 조회에 실패한 묶음은 예전(문의별 count 실패 시 0건)과 같이 0건으로 둔다.
 */
async function fetchReplyCounts(
  supabase: ReturnType<typeof createClient>,
  inquiryIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (inquiryIds.length === 0) return counts;

  const chunks: string[][] = [];
  for (let i = 0; i < inquiryIds.length; i += REPLY_COUNT_ID_CHUNK) {
    chunks.push(inquiryIds.slice(i, i + REPLY_COUNT_ID_CHUNK));
  }

  await Promise.all(
    chunks.map(async (chunk: string[]): Promise<void> => {
      let from = 0;
      let fetched = 0;
      // 한 묶음의 답변이 최대 행 수를 넘으면 범위를 옮겨 가며 끝까지 받는다 (정렬을 고정해야 범위가 어긋나지 않는다)
      while (true) {
        const { data, count } = await supabase
          .from('inquiry_replies')
          .select('inquiryId', { count: 'exact' })
          .in('inquiryId', chunk)
          .order('inquiryId')
          .order('id')
          .range(from, from + REPLY_COUNT_PAGE_SIZE - 1);

        const rows = (data ?? []) as { inquiryId: string }[];
        rows.forEach((row: { inquiryId: string }) => {
          counts.set(row.inquiryId, (counts.get(row.inquiryId) ?? 0) + 1);
        });

        fetched += rows.length;
        if (rows.length === 0 || count === null || fetched >= count) break;
        from += REPLY_COUNT_PAGE_SIZE;
      }
    }),
  );

  return counts;
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ANSWERED'>('ALL');
  const [, setUserRoles] = useState<string[]>([]);
  const [, setCurrentUserId] = useState<string>('');

  const supabase = createClient();
  const router = useRouter();
  const authUser = useAuthUser();

  useEffect(() => {
    loadInquiries();
  }, []);

  useEffect(() => {
    filterInquiries();
  }, [inquiries, searchQuery, statusFilter]);

  const loadInquiries = async () => {
    try {
      setLoading(true);

      // 현재 사용자 정보 및 권한 가져오기
      const { data: { user } } = await getSessionUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      setCurrentUserId(user.id);
      // AuthGuard가 이미 확인한 권한을 재사용한다 (user_roles를 다시 조회하지 않는다)
      const roles = authUser.roles;
      setUserRoles(roles);

      const isSuperAdmin = roles.includes('SUPER_ADMIN');
      const isManager = roles.includes('MANAGER');

      // SUPER_ADMIN: 모든 문의 조회
      // MANAGER: 자신이 등록한 아파트의 회원들의 문의만 조회
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          user:userId (
            name,
            email,
            phoneNumber,
            apartmentId
          )
        `);

      // MANAGER인 경우: 자신이 관리하는 아파트의 회원들 문의만 조회
      if (isManager && !isSuperAdmin) {
        // 매니저가 관리하는 아파트 목록 조회
        const { data: managerApartments, error: aptError } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', user.id);

        if (aptError) throw aptError;

        const apartmentIds = managerApartments?.map(apt => apt.apartmentId) || [];

        if (apartmentIds.length === 0) {
          // 관리하는 아파트가 없으면 빈 배열 반환
          setInquiries([]);
          setLoading(false);
          return;
        }

        // 해당 아파트에 속한 사용자들의 문의만 조회
        const { data: usersInApartments, error: usersError } = await supabase
          .from('user')
          .select('id')
          .in('apartmentId', apartmentIds);

        if (usersError) throw usersError;

        const userIds = usersInApartments?.map(u => u.id) || [];

        if (userIds.length === 0) {
          setInquiries([]);
          setLoading(false);
          return;
        }

        query = query.in('userId', userIds);
      }

      const { data: inquiriesData, error: fetchError } = await query
        .order('lastReplyAt', { ascending: false });

      console.log('📋 [문의 목록] 조회 결과:', {
        isSuperAdmin,
        isManager,
        inquiriesCount: inquiriesData?.length || 0,
        inquiriesData,
        error: fetchError
      });

      if (fetchError) throw fetchError;

      // 각 문의의 답변 수 조회 — 문의마다 한 번씩 세지 않고 묶어서 조회한 뒤 화면에서 집계
      const replyCounts = await fetchReplyCounts(
        supabase,
        (inquiriesData || []).map((inquiry) => inquiry.id as string),
      );

      const inquiriesWithReplies = (inquiriesData || []).map((inquiry) => ({
        ...inquiry,
        _replyCount: replyCounts.get(inquiry.id) || 0,
      }));

      setInquiries(inquiriesWithReplies);
    } catch (err) {
      console.error('Error loading inquiries:', err);
      toast.error('문의 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterInquiries = () => {
    let filtered = inquiries;

    // 상태 필터링
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((inquiry) => inquiry.status === statusFilter);
    }

    // 검색어 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((inquiry) => {
        const titleMatch = inquiry.title?.toLowerCase().includes(query);
        const contentMatch = inquiry.content?.toLowerCase().includes(query);
        const userNameMatch = inquiry.user?.name?.toLowerCase().includes(query);
        const userEmailMatch = inquiry.user?.email?.toLowerCase().includes(query);
        const userPhoneMatch = inquiry.user?.phoneNumber?.toLowerCase().includes(query);

        return titleMatch || contentMatch || userNameMatch || userEmailMatch || userPhoneMatch;
      });
    }

    setFilteredInquiries(filtered);
  };

  const handleInquiryClick = (inquiryId: string) => {
    router.push(`/admin/inquiries/${inquiryId}`);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm', { locale: ko });
  };

  const filterOptions: { value: 'ALL' | 'PENDING' | 'ANSWERED'; label: string }[] = [
    { value: 'ALL', label: '전체' },
    { value: 'PENDING', label: '답변 대기' },
    { value: 'ANSWERED', label: '답변 완료' },
  ];

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="문의 관리"
          description="사용자가 작성한 문의사항을 확인하고 답변합니다."
        />
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <Stack gap="md">
              <Group gap="xs">
                <DataToolbarSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="제목, 내용, 작성자, 연락처 검색..."
                />
              </Group>

              <Divider />

              <FilterRow label="답변 상태">
                <FilterChips
                  options={filterOptions.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    count:
                      opt.value === 'ALL'
                        ? inquiries.length
                        : inquiries.filter((i) => i.status === opt.value).length,
                  }))}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </FilterRow>
            </Stack>
          }
        >
          {loading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : filteredInquiries.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title={
                searchQuery || statusFilter !== 'ALL'
                  ? '검색 결과가 없습니다'
                  : '등록된 문의가 없습니다'
              }
              description={
                searchQuery || statusFilter !== 'ALL'
                  ? '검색어 또는 필터를 변경해 보세요.'
                  : '새 문의가 등록되면 여기에 표시됩니다.'
              }
            />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={112}>상태</Table.Th>
                  <Table.Th>제목</Table.Th>
                  <Table.Th w={160}>작성자</Table.Th>
                  <Table.Th w={176}>작성일</Table.Th>
                  <Table.Th w={96} ta="center">답변</Table.Th>
                  <Table.Th w={80} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredInquiries.map((inquiry) => (
                  <Table.Tr
                    key={inquiry.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleInquiryClick(inquiry.id)}
                  >
                    <Table.Td>
                      <StatusBadge.Inquiry
                        status={inquiry.status === 'PENDING' ? 'pending' : 'answered'}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>{inquiry.title}</Text>
                        <Text size="xs" c="dimmed" maw={448} truncate>
                          {inquiry.content}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>
                          {inquiry.user?.name || '알 수 없음'}
                        </Text>
                        {inquiry.user?.phoneNumber && (
                          <Text size="xs" c="dimmed">
                            {inquiry.user.phoneNumber}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td c="dimmed">
                      {formatDate(inquiry.createdAt)}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center" wrap="nowrap">
                        <MessageSquare size={14} color="var(--mantine-color-dimmed)" />
                        <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {inquiry._replyCount || 0}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInquiryClick(inquiry.id);
                        }}
                        aria-label="상세 보기"
                      >
                        <Eye size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
