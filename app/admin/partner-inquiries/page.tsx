'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { DataToolbar, DataToolbarSearch, DataToolbarFilters } from '@/components/data-toolbar';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { cn } from '@/lib/utils';

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

  const getStatusBadge = (status: 'PENDING' | 'ANSWERED') => {
    if (status === 'PENDING') {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          답변 대기
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
        답변 완료
      </Badge>
    );
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
            <DataToolbar>
              <DataToolbarSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="상호명, 대표자명, 전화번호, 내용 검색..."
              />
              <DataToolbarFilters>
                {filterOptions.map((opt) => {
                  const count =
                    opt.value === 'ALL'
                      ? inquiries.length
                      : inquiries.filter((i) => i.status === opt.value).length;
                  const isActive = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={cn(
                        'inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                      )}
                    >
                      {opt.label}
                      <span
                        className={cn(
                          'tabular-nums',
                          isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </DataToolbarFilters>
            </DataToolbar>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">상태</TableHead>
                  <TableHead>내용</TableHead>
                  <TableHead className="w-44">파트너</TableHead>
                  <TableHead className="w-44">작성일</TableHead>
                  <TableHead className="w-24 text-center">답변</TableHead>
                  <TableHead className="w-20 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInquiries.map((inquiry) => (
                  <TableRow
                    key={inquiry.id}
                    className="cursor-pointer"
                    onClick={() => handleInquiryClick(inquiry.id)}
                  >
                    <TableCell>
                      <StatusBadge.Inquiry
                        status={inquiry.status === 'PENDING' ? 'pending' : 'answered'}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">
                        {inquiry.content}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {inquiry.partner?.businessName || '알 수 없음'}
                        </span>
                        {inquiry.partner?.representativeName && (
                          <span className="text-xs text-muted-foreground">
                            {inquiry.partner.representativeName}
                          </span>
                        )}
                        {inquiry.partner?.displayPhoneNumber && (
                          <span className="text-xs text-muted-foreground">
                            {inquiry.partner.displayPhoneNumber}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inquiry.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium tabular-nums">
                          {inquiry._replyCount || 0}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInquiryClick(inquiry.id);
                        }}
                        aria-label="상세 보기"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
