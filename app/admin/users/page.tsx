'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';

// Mock data
const initialUsers = [
  {
    id: 1,
    name: '김철수',
    email: 'kim@example.com',
    phone: '010-1234-5678',
    status: '활성',
    joinDate: '2024-01-15',
  },
  {
    id: 2,
    name: '이영희',
    email: 'lee@example.com',
    phone: '010-2345-6789',
    status: '활성',
    joinDate: '2024-01-14',
  },
  {
    id: 3,
    name: '박민수',
    email: 'park@example.com',
    phone: '010-3456-7890',
    status: '비활성',
    joinDate: '2024-01-14',
  },
  {
    id: 4,
    name: '정수진',
    email: 'jung@example.com',
    phone: '010-4567-8901',
    status: '활성',
    joinDate: '2024-01-13',
  },
  {
    id: 5,
    name: '최동욱',
    email: 'choi@example.com',
    phone: '010-5678-9012',
    status: '활성',
    joinDate: '2024-01-12',
  },
  {
    id: 6,
    name: '강미래',
    email: 'kang@example.com',
    phone: '010-6789-0123',
    status: '활성',
    joinDate: '2024-01-11',
  },
  {
    id: 7,
    name: '윤서준',
    email: 'yoon@example.com',
    phone: '010-7890-1234',
    status: '비활성',
    joinDate: '2024-01-10',
  },
  {
    id: 8,
    name: '임하은',
    email: 'lim@example.com',
    phone: '010-8901-2345',
    status: '활성',
    joinDate: '2024-01-09',
  },
];

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users] = useState(initialUsers);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery)
  );

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='회원관리' />

      <div className='flex-1 p-6 space-y-6'>
        {/* Search and Actions */}
        <Card className='bg-card border-border'>
          <CardContent className='pt-6'>
            <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between'>
              <div className='relative flex-1 max-w-md w-full'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='이름, 이메일, 전화번호로 검색...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground'
                />
              </div>
              <Button className='bg-primary text-primary-foreground hover:bg-primary/90 gap-2'>
                <Plus className='h-4 w-4' />
                회원 추가
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
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
                      상태
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
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className='border-border hover:bg-secondary/50'
                    >
                      <TableCell className='font-medium text-card-foreground'>
                        {user.name}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {user.email}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {user.phone}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === '활성'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {user.joinDate}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary'
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsers.length === 0 && (
              <div className='text-center py-12 text-muted-foreground'>
                검색 결과가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <div className='text-sm text-muted-foreground'>
          총 {filteredUsers.length}명의 회원{' '}
          {searchQuery && `(전체 ${users.length}명 중)`}
        </div>
      </div>
    </div>
  );
}
