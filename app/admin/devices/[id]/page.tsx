'use client';

import { useState } from 'react';
import { HeaderTitle } from '@/components/header-title';
import { PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import {
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ChevronLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

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

  const router = useRouter();
  const [selectedDong, setSelectedDong] = useState<string>('all');
  const [selectedLine, setSelectedLine] = useState<'12' | '34'>('12');

  if (!device) {
    return (
      <PageShell>
        <EmptyState
          title="기기를 찾을 수 없습니다."
          action={
            <Button
              component={Link}
              href="/admin/devices"
              variant="default"
              leftSection={<ChevronLeft size={16} />}
            >
              기기 목록으로
            </Button>
          }
        />
      </PageShell>
    );
  }

  // Filter users by selected dong
  const filteredUsers = registeredUsers[selectedLine].filter(
    (user) => selectedDong === 'all' || user.dong === selectedDong
  );

  return (
    <PageShell>
      <HeaderTitle title="기기 상세보기" onBack={() => router.push('/admin/devices')} />

      {/* Device Information */}
      <Paper withBorder radius="md" p="lg">
        <Title order={4} mb="md">
          기기 정보
        </Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              주소
            </Text>
            <Text fw={500}>{device.address}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              아파트명
            </Text>
            <Text fw={500}>{device.apartmentName}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              동
            </Text>
            <Text fw={500}>{device.dong}동</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              세대수
            </Text>
            <Text fw={500}>{device.households}세대</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              등록일시
            </Text>
            <Text fw={500}>{device.registeredDate}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              설치장소
            </Text>
            <Text fw={500}>{device.installLocation}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              공동현관문 번호
            </Text>
            <Text fw={500}>{device.entranceDoorNumber}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              출입문 장치 비밀번호
            </Text>
            <Text fw={500} ff="monospace">{device.doorPassword}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              MAC 주소
            </Text>
            <Text fw={500} ff="monospace">{device.macAddress}</Text>
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Line Selection and Dong Filter */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <Group justify="space-between" align="center" gap="md" p="lg">
          <Group gap="xs">
            <Users size={20} />
            <Title order={4}>등록된 사용자</Title>
          </Group>
          <Group gap="sm">
            <Select
              data={[
                { value: '12', label: '12 라인' },
                { value: '34', label: '34 라인' },
              ]}
              value={selectedLine}
              onChange={(value) => {
                if (value === null) return;
                setSelectedLine(value as '12' | '34');
              }}
              allowDeselect={false}
              w={140}
            />
            <Select
              placeholder="동 선택"
              data={[
                { value: 'all', label: '전체 동' },
                ...device.buildings.map((building) => ({
                  value: building,
                  label: `${building}동`,
                })),
              ]}
              value={selectedDong || null}
              onChange={(value) => {
                if (value === null) return;
                setSelectedDong(value);
              }}
              allowDeselect={false}
              w={140}
            />
          </Group>
        </Group>
        <Table.ScrollContainer minWidth={0} type="native">
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>이름</Table.Th>
                <Table.Th>동</Table.Th>
                <Table.Th>호수</Table.Th>
                <Table.Th>전화번호</Table.Th>
                <Table.Th>등록일</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredUsers.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td fw={500}>{user.name}</Table.Td>
                  <Table.Td c="dimmed">{user.dong}동</Table.Td>
                  <Table.Td c="dimmed">{user.ho}</Table.Td>
                  <Table.Td c="dimmed">{user.phone}</Table.Td>
                  <Table.Td c="dimmed">{user.registeredDate}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {filteredUsers.length === 0 && (
          <Text ta="center" py={48} c="dimmed">
            등록된 사용자가 없습니다.
          </Text>
        )}
      </Paper>

      {/* Summary */}
      <Text size="sm" c="dimmed">
        {selectedLine} 라인 - 총 {filteredUsers.length}명의 사용자{' '}
        {selectedDong !== 'all' && `(${selectedDong}동)`}
      </Text>
    </PageShell>
  );
}
