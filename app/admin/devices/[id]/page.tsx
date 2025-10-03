'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Mock device data
const deviceData = {
  1: {
    address: '서울시 강남구 테헤란로 123',
    apartmentName: '강남타워',
    dong: '101',
    households: 150,
    registeredDate: '2024-01-15 14:30',
    installLocation: '1층 로비',
    entranceDoorNumber: 'A-001',
    doorPassword: '1234',
    macAddress: '00:1B:44:11:3A:B7',
    buildings: ['101', '102', '103', '104'],
  },
};

// Mock registered users data by line
const registeredUsers = {
  12: [
    {
      id: 1,
      name: '김철수',
      dong: '101',
      ho: '101호',
      phone: '010-1234-5678',
      registeredDate: '2024-01-10',
    },
    {
      id: 2,
      name: '이영희',
      dong: '101',
      ho: '102호',
      phone: '010-2345-6789',
      registeredDate: '2024-01-11',
    },
    {
      id: 3,
      name: '박민수',
      dong: '102',
      ho: '201호',
      phone: '010-3456-7890',
      registeredDate: '2024-01-12',
    },
    {
      id: 4,
      name: '최지은',
      dong: '102',
      ho: '202호',
      phone: '010-4567-8901',
      registeredDate: '2024-01-13',
    },
    {
      id: 5,
      name: '정수현',
      dong: '103',
      ho: '301호',
      phone: '010-5678-9012',
      registeredDate: '2024-01-14',
    },
  ],
  34: [
    {
      id: 6,
      name: '강동원',
      dong: '101',
      ho: '103호',
      phone: '010-6789-0123',
      registeredDate: '2024-01-10',
    },
    {
      id: 7,
      name: '송혜교',
      dong: '102',
      ho: '203호',
      phone: '010-7890-1234',
      registeredDate: '2024-01-11',
    },
    {
      id: 8,
      name: '현빈',
      dong: '103',
      ho: '302호',
      phone: '010-8901-2345',
      registeredDate: '2024-01-12',
    },
    {
      id: 9,
      name: '손예진',
      dong: '104',
      ho: '401호',
      phone: '010-9012-3456',
      registeredDate: '2024-01-13',
    },
  ],
};

export default function DeviceDetailPage() {
  const params = useParams();
  const deviceId = params.id as string;
  const device = deviceData[deviceId as keyof typeof deviceData];

  const [selectedDong, setSelectedDong] = useState<string>('all');
  const [selectedLine, setSelectedLine] = useState<'12' | '34'>('12');

  if (!device) {
    return <div>기기를 찾을 수 없습니다.</div>;
  }

  // Filter users by selected dong
  const filteredUsers = registeredUsers[selectedLine].filter(
    (user) => selectedDong === 'all' || user.dong === selectedDong
  );

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='기기 상세보기' />

      <div className='flex-1 p-6 space-y-6'>
        {/* Back Button */}
        <Link href='/admin/devices'>
          <Button
            variant='ghost'
            className='gap-2 text-muted-foreground hover:text-foreground'
          >
            <ArrowLeft className='h-4 w-4' />
            목록으로 돌아가기
          </Button>
        </Link>

        {/* Device Information */}
        <Card className='bg-card border-border'>
          <CardHeader>
            <CardTitle className='text-foreground'>기기 정보</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>주소</p>
              <p className='text-foreground font-medium'>{device.address}</p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>아파트명</p>
              <p className='text-foreground font-medium'>
                {device.apartmentName}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>동</p>
              <p className='text-foreground font-medium'>{device.dong}동</p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>세대수</p>
              <p className='text-foreground font-medium'>
                {device.households}세대
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>등록일시</p>
              <p className='text-foreground font-medium'>
                {device.registeredDate}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>설치장소</p>
              <p className='text-foreground font-medium'>
                {device.installLocation}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>공동현관문 번호</p>
              <p className='text-foreground font-medium'>
                {device.entranceDoorNumber}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>
                출입문 장치 비밀번호
              </p>
              <p className='text-foreground font-medium font-mono'>
                {device.doorPassword}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>MAC 주소</p>
              <p className='text-foreground font-medium font-mono'>
                {device.macAddress}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Line Selection and Dong Filter */}
        <Card className='bg-card border-border'>
          <CardHeader>
            <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between'>
              <CardTitle className='text-foreground flex items-center gap-2'>
                <Users className='h-5 w-5' />
                등록된 사용자
              </CardTitle>
              <div className='flex gap-3'>
                <Select
                  value={selectedLine}
                  onValueChange={(value) =>
                    setSelectedLine(value as '12' | '34')
                  }
                >
                  <SelectTrigger className='w-[140px] bg-secondary border-border'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='12'>12 라인</SelectItem>
                    <SelectItem value='34'>34 라인</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedDong}
                  onValueChange={setSelectedDong}
                >
                  <SelectTrigger className='w-[140px] bg-secondary border-border'>
                    <SelectValue placeholder='동 선택' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>전체 동</SelectItem>
                    {device.buildings.map((building) => (
                      <SelectItem
                        key={building}
                        value={building}
                      >
                        {building}동
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground'>
                      이름
                    </TableHead>
                    <TableHead className='text-muted-foreground'>동</TableHead>
                    <TableHead className='text-muted-foreground'>
                      호수
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      전화번호
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      등록일
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
                        {user.dong}동
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {user.ho}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {user.phone}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {user.registeredDate}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsers.length === 0 && (
              <div className='text-center py-12 text-muted-foreground'>
                등록된 사용자가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <div className='text-sm text-muted-foreground'>
          {selectedLine} 라인 - 총 {filteredUsers.length}명의 사용자{' '}
          {selectedDong !== 'all' && `(${selectedDong}동)`}
        </div>
      </div>
    </div>
  );
}
