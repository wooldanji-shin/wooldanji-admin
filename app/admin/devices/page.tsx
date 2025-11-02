'use client';

import { useState } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { AddDeviceDialog } from '@/components/add-device-dialog';
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
import { Search, Eye } from 'lucide-react';
import Link from 'next/link';

const initialDevices = [
  {
    id: 1,
    address: '서울시 강남구 테헤란로 123',
    apartmentName: '강남타워',
    dong: '101',
    households: 150,
    registeredDate: '2024-01-15 14:30',
    installLocation: '1층 로비',
    entranceDoorNumber: 'A-001',
    doorPassword: '1234',
    macAddress: '00:1B:44:11:3A:B7',
  },
  {
    id: 2,
    address: '서울시 서초구 서초대로 456',
    apartmentName: '서초파크',
    dong: '102',
    households: 200,
    registeredDate: '2024-01-14 10:20',
    installLocation: '지하 1층',
    entranceDoorNumber: 'B-002',
    doorPassword: '5678',
    macAddress: '00:1B:44:11:3A:B8',
  },
  {
    id: 3,
    address: '서울시 송파구 올림픽로 789',
    apartmentName: '송파레이크',
    dong: '103',
    households: 180,
    registeredDate: '2024-01-13 16:45',
    installLocation: '1층 현관',
    entranceDoorNumber: 'C-003',
    doorPassword: '9012',
    macAddress: '00:1B:44:11:3A:B9',
  },
  {
    id: 4,
    address: '서울시 강남구 역삼로 321',
    apartmentName: '역삼힐스테이트',
    dong: '104',
    households: 220,
    registeredDate: '2024-01-12 09:15',
    installLocation: '2층 엘리베이터홀',
    entranceDoorNumber: 'D-004',
    doorPassword: '3456',
    macAddress: '00:1B:44:11:3A:C0',
  },
];

export default function DevicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [devices] = useState(initialDevices);

  const filteredDevices = devices.filter(
    (device) =>
      device.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.apartmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.dong.includes(searchQuery)
  );

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='기기등록' />

      <div className='flex-1 p-6 space-y-6'>
        {/* Search and Actions */}
        <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6'>
          <div className='relative flex-1 w-full'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='주소, 아파트명, 동으로 검색...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>
          <AddDeviceDialog />
        </div>

        {/* Devices Table */}
        <Card className='bg-card border-border'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-border hover:bg-transparent'>
                    <TableHead className='text-muted-foreground'>
                      주소
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      아파트명
                    </TableHead>
                    <TableHead className='text-muted-foreground'>동</TableHead>
                    <TableHead className='text-muted-foreground'>
                      세대수
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      등록일시
                    </TableHead>
                    <TableHead className='text-muted-foreground'>
                      MAC 주소
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right'>
                      작업
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow
                      key={device.id}
                      className='border-border hover:bg-secondary/50'
                    >
                      <TableCell className='text-card-foreground max-w-[200px] truncate'>
                        {device.address}
                      </TableCell>
                      <TableCell className='font-medium text-card-foreground'>
                        {device.apartmentName}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {device.dong}동
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {device.households}세대
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {device.registeredDate}
                      </TableCell>
                      <TableCell className='font-mono text-sm text-muted-foreground'>
                        {device.macAddress}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Link href={`/admin/devices/${device.id}`}>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary gap-2'
                          >
                            <Eye className='h-4 w-4' />
                            상세보기
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredDevices.length === 0 && (
              <div className='text-center py-12 text-muted-foreground'>
                검색 결과가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <div className='text-sm text-muted-foreground'>
          총 {filteredDevices.length}개의 기기{' '}
          {searchQuery && `(전체 ${devices.length}개 중)`}
        </div>
      </div>
    </div>
  );
}
