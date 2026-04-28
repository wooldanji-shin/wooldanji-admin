'use client';

import { useState } from 'react';
import { AddDeviceDialog } from '@/components/add-device-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, HardDrive } from 'lucide-react';
import Link from 'next/link';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataToolbar, DataToolbarSearch, DataToolbarActions } from '@/components/data-toolbar';
import { EmptyState } from '@/components/empty-state';

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
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="기기 등록"
          description="등록된 기기 정보를 검색하고 상세를 확인합니다."
        />
        <PageHeaderActions>
          <AddDeviceDialog />
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <DataToolbar>
              <DataToolbarSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="주소, 아파트명, 동으로 검색..."
              />
              <DataToolbarActions>
                <span className="text-xs text-muted-foreground tabular-nums">
                  총 {filteredDevices.length.toLocaleString()}개
                  {searchQuery && ` / ${devices.length.toLocaleString()}`}
                </span>
              </DataToolbarActions>
            </DataToolbar>
          }
        >
          {filteredDevices.length === 0 ? (
            <EmptyState
              icon={HardDrive}
              title="검색 결과가 없습니다"
              description="다른 검색어로 다시 시도해 보세요."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주소</TableHead>
                  <TableHead>아파트명</TableHead>
                  <TableHead>동</TableHead>
                  <TableHead>세대수</TableHead>
                  <TableHead>등록일시</TableHead>
                  <TableHead>MAC 주소</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {device.address}
                    </TableCell>
                    <TableCell className="font-medium">{device.apartmentName}</TableCell>
                    <TableCell className="text-muted-foreground">{device.dong}동</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {device.households}세대
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.registeredDate}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {device.macAddress}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/devices/${device.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          상세보기
                        </Button>
                      </Link>
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
