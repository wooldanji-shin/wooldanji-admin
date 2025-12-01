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
import { getUserRoles } from '@/lib/auth';

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

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ANSWERED'>('ALL');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

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

      // 현재 사용자 정보 및 권한 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      setCurrentUserId(user.id);
      const roles = await getUserRoles();
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

      // 각 문의의 답변 수 조회
      const inquiriesWithReplies = await Promise.all(
        (inquiriesData || []).map(async (inquiry) => {
          const { count } = await supabase
            .from('inquiry_replies')
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
        <AdminHeader title='문의 관리' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='문의 관리' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Info Alert */}
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              사용자가 작성한 문의사항을 확인하고 답변할 수 있습니다.
            </AlertDescription>
          </Alert>

          {/* Filters */}
          <Card className='bg-card border-border'>
            <CardContent className='pt-6'>
              <div className='flex flex-col sm:flex-row gap-4'>
                {/* 검색 */}
                <div className='flex-1 relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='제목, 내용, 사용자명, 이메일, 전화번호로 검색...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-10'
                  />
                </div>

                {/* 상태 필터 */}
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

          {/* Inquiries List */}
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-card-foreground'>
                문의 목록 ({filteredInquiries.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInquiries.length === 0 ? (
                <div className='text-center py-12 text-muted-foreground'>
                  {searchQuery || statusFilter !== 'ALL'
                    ? '검색 결과가 없습니다.'
                    : '등록된 문의가 없습니다.'}
                </div>
              ) : (
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow className='border-border hover:bg-transparent'>
                        <TableHead className='w-24'>상태</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead className='w-32'>작성자</TableHead>
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
                            <div className='flex flex-col gap-1'>
                              <span className='font-medium'>{inquiry.title}</span>
                              <span className='text-sm text-muted-foreground truncate max-w-md'>
                                {inquiry.content}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-col gap-1'>
                              <span className='text-sm font-medium'>
                                {inquiry.user?.name || '알 수 없음'}
                              </span>
                              {inquiry.user?.phoneNumber && (
                                <span className='text-xs text-muted-foreground'>
                                  {inquiry.user.phoneNumber}
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
