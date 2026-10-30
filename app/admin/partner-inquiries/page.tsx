'use client';

import { ActionIcon, Divider, Group, Stack, Table, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import { MessageSquare, Eye, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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

interface PartnerInquiry {
  id: string;
  content: string;
  imageUrls: string[] | null;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
  lastReplyAt: string;
  partnerUserId: string;
  partner?: {
    businessName: string | null;
    representativeName: string | null;
    displayPhoneNumber: string | null;
  };
  _replyCount?: number;
}

export default function PartnerInquiriesPage() {
  const [inquiries, setInquiries] = useState<PartnerInquiry[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<PartnerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ANSWERED'>('ALL');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadInquiries();
  }, []);

  useEffect(() => {
    filterInquiries();
  }, [inquiries, searchQuery, statusFilter]);

  const loadInquiries = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      // SUPER_ADMIN/MANAGER 모두 모든 파트너 문의 접근 (파트너는 아파트 소속 없음)
      const { data: inquiriesData, error: fetchError } = await supabase
        .from('partner_inquiries')
        .select(`
          *,
          partner:partnerUserId (
            businessName,
            representativeName,
            displayPhoneNumber
          )
        `)
        .order('lastReplyAt', { ascending: false });

      if (fetchError) throw fetchError;

      // 각 문의의 답변 수 조회
      const inquiriesWithReplies = await Promise.all(
        (inquiriesData || []).map(async (inquiry) => {
          const { count } = await supabase
            .from('partner_inquiry_replies')
            .select('*', { count: 'exact', head: true })
            .eq('inquiryId', inquiry.id);

          return {
            ...inquiry,
            _replyCount: count || 0,
          };
        })
      );

      setInquiries(inquiriesWithReplies);
    } catch (err) {
      console.error('Error loading partner inquiries:', err);
      toast.error('파트너 문의 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterInquiries = () => {
    let filtered = inquiries;

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((inquiry) => inquiry.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((inquiry) => {
        const contentMatch = inquiry.content?.toLowerCase().includes(query);
        const businessMatch = inquiry.partner?.businessName?.toLowerCase().includes(query);
        const repMatch = inquiry.partner?.representativeName?.toLowerCase().includes(query);
        const phoneMatch = inquiry.partner?.displayPhoneNumber?.toLowerCase().includes(query);

        return contentMatch || businessMatch || repMatch || phoneMatch;
      });
    }

    setFilteredInquiries(filtered);
  };

  const handleInquiryClick = (inquiryId: string) => {
    router.push(`/admin/partner-inquiries/${inquiryId}`);
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
          title="파트너 문의 관리"
          description="파트너가 작성한 문의를 확인하고 답변합니다."
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
                  placeholder="상호명, 대표자명, 전화번호, 내용 검색..."
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
                  : '등록된 파트너 문의가 없습니다'
              }
            />
          ) : (
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={112}>상태</Table.Th>
                  <Table.Th>내용</Table.Th>
                  <Table.Th w={176}>파트너</Table.Th>
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
                      <Text size="sm" c="dimmed" maw={448} lineClamp={2}>
                        {inquiry.content}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>
                          {inquiry.partner?.businessName || '알 수 없음'}
                        </Text>
                        {inquiry.partner?.representativeName && (
                          <Text size="xs" c="dimmed">
                            {inquiry.partner.representativeName}
                          </Text>
                        )}
                        {inquiry.partner?.displayPhoneNumber && (
                          <Text size="xs" c="dimmed">
                            {inquiry.partner.displayPhoneNumber}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td c="dimmed">{formatDate(inquiry.createdAt)}</Table.Td>
                    <Table.Td ta="center">
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
