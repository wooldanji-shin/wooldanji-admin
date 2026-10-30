'use client';

import { useState } from 'react';
import { AddDeviceDialog } from '@/components/add-device-dialog';
import { Button, Table, Text } from '@mantine/core';
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
                <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  총 {filteredDevices.length.toLocaleString()}개
                  {searchQuery && ` / ${devices.length.toLocaleString()}`}
                </Text>
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
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>주소</Table.Th>
                  <Table.Th>아파트명</Table.Th>
                  <Table.Th>동</Table.Th>
                  <Table.Th>세대수</Table.Th>
                  <Table.Th>등록일시</Table.Th>
                  <Table.Th>MAC 주소</Table.Th>
                  <Table.Th ta="right">작업</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredDevices.map((device) => (
                  <Table.Tr key={device.id}>
                    <Table.Td>
                      <Text size="sm" c="dimmed" maw={200} truncate title={device.address}>
                        {device.address}
                      </Text>
                    </Table.Td>
                    <Table.Td fw={500}>{device.apartmentName}</Table.Td>
                    <Table.Td c="dimmed">{device.dong}동</Table.Td>
                    <Table.Td c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {device.households}세대
                    </Table.Td>
                    <Table.Td c="dimmed">{device.registeredDate}</Table.Td>
                    <Table.Td c="dimmed" fz="xs" ff="monospace">
                      {device.macAddress}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Button
                        component={Link}
                        href={`/admin/devices/${device.id}`}
                        variant="subtle"
                        color="gray"
                        size="xs"
                        leftSection={<Eye size={16} />}
                      >
                        상세보기
                      </Button>
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
