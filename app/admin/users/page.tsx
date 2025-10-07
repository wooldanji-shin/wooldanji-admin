'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, MoreVertical, Check, X, Eye, ChevronLeft, ChevronRight, Image as ImageIcon, AlertCircle, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UserFullDetails } from '@/lib/supabase/types';

const ITEMS_PER_PAGE = 10;

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [users, setUsers] = useState<UserFullDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserFullDetails | null>(null);

  const searchQuery = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');

  // 초기 로드시 URL의 검색어를 input에 설정
  useEffect(() => {
    setSearchInput(searchQuery);
  }, []);

  const fetchUsers = useCallback(async () => {
    // 초기 로딩이 아닌 경우 로딩 표시 안 함 (검색이나 페이지네이션)
    if (initialLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      let query = supabase
        .from('user')
        .select(`
          *,
          user_roles(id, role, createdAt),
          apartments:apartmentId(id, name, address)
        `, { count: 'exact' });

      // 검색 필터링
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phoneNumber.ilike.%${searchQuery}%`);
      }

      // 페이지네이션
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error: fetchError, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('회원 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [searchQuery, currentPage, supabase, initialLoading]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateSearchParams = (params: Record<string, string>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });

    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`/admin/users${query}`);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);

    // 이전 타이머 취소
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 디바운스 적용 (500ms)
    debounceTimer.current = setTimeout(() => {
      updateSearchParams({ search: value, page: '1' });
    }, 500);
  };

  // 컴포넌트 언마운트시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: newPage.toString() });
  };

  const handleApprovalStatusChange = async (userId: string, status: 'approve' | 'pending') => {
    try {
      const response = await fetch(`/api/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update approval status');
      }

      // 목록 갱신
      fetchUsers();
    } catch (err) {
      console.error('Failed to update approval status:', err);
      setError('승인 상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteClick = (user: UserFullDetails) => {
    setDeletingUser(user);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    try {
      const { error } = await supabase
        .from('user')
        .delete()
        .eq('id', deletingUser.id);

      if (error) throw error;

      setDeleteDialog(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError('회원 삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const getApprovalBadge = (status: string | null) => {
    switch (status) {
      case 'approve':
        return <Badge className="bg-green-500 text-white">승인</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary">대기</Badge>;
    }
  };

  const getRegistrationTypeBadge = (type: string | null) => {
    switch (type) {
      case 'APARTMENT':
        return <Badge className="bg-blue-500 text-white">아파트</Badge>;
      case 'GENERAL':
        return <Badge variant="outline">일반</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const getUserRole = (roles?: any[]) => {
    if (!roles || roles.length === 0) return '-';
    const roleMap: Record<string, string> = {
      'APP_USER': '앱 사용자',
      'APT_ADMIN': '아파트 관리자',
      'REGION_ADMIN': '지역 관리자',
      'SUPER_ADMIN': '최고 관리자'
    };
    return roles.map(r => roleMap[r.role] || r.role).join(', ');
  };

  const getRegisterMethodBadge = (method: string | null) => {
    switch (method?.toLowerCase()) {
      case 'google':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Google</Badge>;
      case 'kakao':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Kakao</Badge>;
      case 'local':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Email</Badge>;
      default:
        return null;
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='회원관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* Search and Stats */}
        <Card className='bg-card border-border'>
          <CardContent className='pt-6'>
            <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between'>
              <div className='relative flex-1 max-w-md w-full'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='이름, 이메일, 전화번호로 검색...'
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                  className='pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground'
                />
              </div>
              <div className='text-sm text-muted-foreground'>
                전체 {totalCount}명
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Users Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto relative min-h-[400px]'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground w-12'>
                      사진
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
                      회원유형
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      아파트/동/호
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      역할
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      승인상태
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      가입일
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right'>
                      작업
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialLoading && loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className='text-center py-12 text-muted-foreground'>
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className='text-center py-12 text-muted-foreground'>
                        {searchQuery ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow
                        key={user.id}
                        className='border-border hover:bg-secondary/50'
                      >
                        <TableCell>
                          {user.confirmImageUrl ? (
                            <button
                              onClick={() => setImagePreview(user.confirmImageUrl)}
                              className='w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center hover:opacity-80 transition-opacity'
                            >
                              <img
                                src={user.confirmImageUrl}
                                alt={user.name || ''}
                                className='w-full h-full object-cover'
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.innerHTML = '<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                                }}
                              />
                            </button>
                          ) : (
                            <div className='w-10 h-10 rounded-full bg-secondary flex items-center justify-center'>
                              <ImageIcon className='w-5 h-5 text-muted-foreground' />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='font-medium text-card-foreground'>
                          {user.name || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          <div className='flex items-center gap-2'>
                            <span>{user.email}</span>
                            {getRegisterMethodBadge(user.registerMethod)}
                          </div>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {user.phoneNumber || '-'}
                        </TableCell>
                        <TableCell>
                          {getRegistrationTypeBadge(user.registrationType)}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {user.registrationType === 'APARTMENT' && user.apartments ? (
                            <span className='text-sm'>
                              {user.apartments.name}<br/>
                              {user.buildingNumber ? `${user.buildingNumber}동` : ''}
                              {user.unit ? `${user.unit}호` : ''}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {getUserRole(user.user_roles)}
                        </TableCell>
                        <TableCell>
                          {getApprovalBadge(user.approvalStatus)}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary'
                              >
                                <MoreVertical className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              {user.confirmImageUrl && (
                                <DropdownMenuItem onClick={() => setImagePreview(user.confirmImageUrl)}>
                                  <Eye className='mr-2 h-4 w-4' />
                                  인증 사진 보기
                                </DropdownMenuItem>
                              )}
                              {user.approvalStatus !== 'approve' ? (
                                <DropdownMenuItem
                                  onClick={() => handleApprovalStatusChange(user.id, 'approve')}
                                  className='text-green-600'
                                >
                                  <Check className='mr-2 h-4 w-4' />
                                  승인하기
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleApprovalStatusChange(user.id, 'pending')}
                                  className='text-orange-600'
                                >
                                  <X className='mr-2 h-4 w-4' />
                                  승인 취소
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(user)}
                                className='text-destructive'
                              >
                                <Trash2 className='mr-2 h-4 w-4' />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between'>
            <div className='text-sm text-muted-foreground'>
              {currentPage} / {totalPages} 페이지
            </div>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className='h-4 w-4' />
                이전
              </Button>
              <div className='flex gap-1'>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => handlePageChange(pageNum)}
                      className='w-10'
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                다음
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className='fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8'
          onClick={() => setImagePreview(null)}
        >
          <div className='relative max-w-4xl max-h-[85vh] flex items-center justify-center'>
            <img
              src={imagePreview}
              alt='인증 사진'
              className='max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl'
            />
            <Button
              variant='secondary'
              size='icon'
              className='absolute top-4 right-4 rounded-full shadow-lg'
              onClick={(e) => {
                e.stopPropagation();
                setImagePreview(null);
              }}
            >
              <X className='h-5 w-5' />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회원 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingUser?.name || deletingUser?.email}</strong>님을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없으며, 해당 회원의 모든 데이터가 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialog(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}