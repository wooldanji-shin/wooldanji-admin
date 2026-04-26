'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  Search,
  Eye,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='파트너 문의 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='파트너 문의 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-7xl mx-auto space-y-6'>
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              파트너 회원이 작성한 문의를 확인하고 답변할 수 있습니다.
            </AlertDescription>
          </Alert>

          <Card className='bg-card border-border'>
            <CardContent className='pt-6'>
              <div className='flex flex-col sm:flex-row gap-4'>
                <div className='flex-1 relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='상호명, 대표자명, 전화번호, 내용으로 검색...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-10'
                  />
                </div>

                <div className='flex gap-2'>
                  <Button
                    variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('ALL')}
                    size='sm'
                  >
                    전체 ({inquiries.length})
                  </Button>
                  <Button
                    variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('PENDING')}
                    size='sm'
                  >
                    답변 대기 ({inquiries.filter(i => i.status === 'PENDING').length})
                  </Button>
                  <Button
                    variant={statusFilter === 'ANSWERED' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('ANSWERED')}
                    size='sm'
                  >
                    답변 완료 ({inquiries.filter(i => i.status === 'ANSWERED').length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-card-foreground'>
                파트너 문의 목록 ({filteredInquiries.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInquiries.length === 0 ? (
                <div className='text-center py-12 text-muted-foreground'>
                  {searchQuery || statusFilter !== 'ALL'
                    ? '검색 결과가 없습니다.'
                    : '등록된 파트너 문의가 없습니다.'}
                </div>
              ) : (
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow className='border-border hover:bg-transparent'>
                        <TableHead className='w-24'>상태</TableHead>
                        <TableHead>내용</TableHead>
                        <TableHead className='w-40'>파트너</TableHead>
                        <TableHead className='w-40'>작성일</TableHead>
                        <TableHead className='w-24 text-center'>답변 수</TableHead>
                        <TableHead className='w-24 text-center'>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInquiries.map((inquiry) => (
                        <TableRow
                          key={inquiry.id}
                          className='border-border hover:bg-secondary/50 cursor-pointer'
                          onClick={() => handleInquiryClick(inquiry.id)}
                        >
                          <TableCell>{getStatusBadge(inquiry.status)}</TableCell>
                          <TableCell>
                            <span className='text-sm text-muted-foreground line-clamp-2 max-w-md'>
                              {inquiry.content}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-col gap-1'>
                              <span className='text-sm font-medium'>
                                {inquiry.partner?.businessName || '알 수 없음'}
                              </span>
                              {inquiry.partner?.representativeName && (
                                <span className='text-xs text-muted-foreground'>
                                  {inquiry.partner.representativeName}
                                </span>
                              )}
                              {inquiry.partner?.displayPhoneNumber && (
                                <span className='text-xs text-muted-foreground'>
                                  {inquiry.partner.displayPhoneNumber}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {formatDate(inquiry.createdAt)}
                          </TableCell>
                          <TableCell className='text-center'>
                            <div className='flex items-center justify-center gap-1'>
                              <MessageSquare className='h-4 w-4 text-muted-foreground' />
                              <span className='text-sm font-medium'>
                                {inquiry._replyCount || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className='text-center'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInquiryClick(inquiry.id);
                              }}
                            >
                              <Eye className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
