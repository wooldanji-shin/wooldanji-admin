'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Shield,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Cpu,
  Save,
  BarChart2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { PageShell } from '@/components/page-shell';
import { HeaderTitle } from '@/components/header-title';
import { DetailSkeleton, TableSkeleton } from '@/components/skeletons';
import { confirmModal } from '@/components/confirm-modal';

interface Device {
  id: string;
  macAddress: string;
  password: string;
  placeName: string;
}

interface Line {
  id: string;
  line: number;
  devices: Device[];
}

interface Building {
  id: string;
  number: string;
  householdsCount: number;
  lines: Line[];
}

interface Apartment {
  id: string;
  name: string;
  address: string;
  detailAddress?: string;
  buildings: Building[];
  createdAt: string;
  status: 'active' | 'pending' | 'inactive';
}

interface RunningBasicAd {
  id: string;
  title: string | null;
  businessName: string;
  categoryName: string | null;
  activatedAt: string | null;
  freeMonths: number;
  totalImpressions: number;
  totalClicks: number;
}

interface RunningPremiumAd {
  id: string;
  title: string | null;
  businessName: string;
  startedAt: string | null;
  endedAt: string | null;
  weeks: number;
  totalAmount: number | null;
  totalImpressions: number;
  totalClicks: number;
}

const AVAILABLE_LINES = [
  { value: 12, label: '12라인' },
  { value: 34, label: '34라인' },
  { value: 56, label: '56라인' },
  { value: 78, label: '78라인' },
  { value: 90, label: '90라인' },
];

const PLACE_OPTIONS = [
  'B1 전기실',
  '1F 엘리베이터홀',
  '각 층 현관문',
  '옥상',
  '지하주차장',
  '정문',
  '후문',
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApartmentDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  const [expandedLines, setExpandedLines] = useState<string[]>([]);
  const [runningBasicAds, setRunningBasicAds] = useState<RunningBasicAd[]>([]);
  const [runningPremiumAds, setRunningPremiumAds] = useState<RunningPremiumAd[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);

  // Device dialog state
  const [deviceDialog, setDeviceDialog] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<string>('');
  const [deviceForm, setDeviceForm] = useState({
    placeName: '',
    macAddress: '',
    password: '',
  });

  const fetchRunningAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const supabase = createClient();

      // 기본광고: 이 아파트에 running 상태인 광고
      const { data: basicRows } = await supabase
        .from('advertisement_apartments_v2')
        .select(`
          advertisementId,
          advertisements_v2!inner(
            id, title, adStatus, activatedAt, freeMonths,
            partner_users:partnerId(businessName),
            ad_categories_v2:categoryId(categoryName)
          )
        `)
        .eq('apartmentId', id)
        .eq('advertisements_v2.adStatus', 'running');

      const basicAdIds = (basicRows ?? []).map((r: any) => r.advertisementId as string);

      const { data: basicAnalytics } = basicAdIds.length > 0
        ? await supabase
            .from('ad_analytics_v2')
            .select('baseAdId, impressionCount, homeImpressionCount, clickCount')
            .in('baseAdId', basicAdIds)
        : { data: [] };

      const basicAnalyticsMap = (basicAnalytics ?? []).reduce<Record<string, { impressions: number; clicks: number }>>(
        (acc, r: any) => {
          const key = r.baseAdId as string;
          if (!acc[key]) acc[key] = { impressions: 0, clicks: 0 };
          acc[key].impressions += (r.homeImpressionCount ?? 0) + (r.impressionCount ?? 0);
          acc[key].clicks += (r.clickCount ?? 0);
          return acc;
        },
        {}
      );

      setRunningBasicAds(
        (basicRows ?? []).map((r: any) => {
          const ad = r.advertisements_v2;
          return {
            id: ad.id,
            title: ad.title,
            businessName: ad.partner_users?.businessName ?? '-',
            categoryName: ad.ad_categories_v2?.categoryName ?? null,
            activatedAt: ad.activatedAt ?? null,
            freeMonths: ad.freeMonths ?? 0,
            totalImpressions: basicAnalyticsMap[ad.id]?.impressions ?? 0,
            totalClicks: basicAnalyticsMap[ad.id]?.clicks ?? 0,
          };
        })
      );

      // 프리미엄 광고: baseAdId가 이 아파트에 연결된 running 상태인 광고
      const { data: premiumBaseAdIds } = await supabase
        .from('advertisement_apartments_v2')
        .select('advertisementId')
        .eq('apartmentId', id);

      const baseAdIdList = (premiumBaseAdIds ?? []).map((r: any) => r.advertisementId as string);

      const { data: premiumRows } = baseAdIdList.length > 0
        ? await supabase
            .from('premium_advertisements_v2')
            .select(`
              id, title, weeks, status, totalAmount, approvedDiscountRate, discountedTotalAmount,
              startedAt, endedAt, partnerId
            `)
            .in('baseAdId', baseAdIdList)
            .eq('status', 'running')
        : { data: [] };

      const premiumAdIds = (premiumRows ?? []).map((r: any) => r.id as string);
      const partnerIds = [...new Set((premiumRows ?? []).map((r: any) => r.partnerId as string))];

      const [{ data: partnerData }, { data: premiumAnalytics }] = await Promise.all([
        partnerIds.length > 0
          ? supabase.from('partner_users').select('"userId", "businessName"').in('userId', partnerIds)
          : Promise.resolve({ data: [] }),
        premiumAdIds.length > 0
          ? supabase
              .from('premium_ad_analytics_v2')
              .select('"premiumAdId", "impressionCount", "homePremiumImpressionCount", "clickCount"')
              .in('premiumAdId', premiumAdIds)
          : Promise.resolve({ data: [] }),
      ]);

      const partnerMap = Object.fromEntries(
        (partnerData ?? []).map((p: any) => [p.userId, p.businessName])
      );

      const premiumAnalyticsMap = (premiumAnalytics ?? []).reduce<Record<string, { impressions: number; clicks: number }>>(
        (acc, r: any) => {
          const key = r.premiumAdId as string;
          if (!acc[key]) acc[key] = { impressions: 0, clicks: 0 };
          acc[key].impressions += (r.homePremiumImpressionCount ?? 0) + (r.impressionCount ?? 0);
          acc[key].clicks += (r.clickCount ?? 0);
          return acc;
        },
        {}
      );

      setRunningPremiumAds(
        (premiumRows ?? []).map((r: any) => ({
          id: r.id,
          title: r.title,
          businessName: partnerMap[r.partnerId] ?? '-',
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          weeks: r.weeks,
          totalAmount: (r.approvedDiscountRate ?? 0) > 0 ? r.discountedTotalAmount : r.totalAmount,
          totalImpressions: premiumAnalyticsMap[r.id]?.impressions ?? 0,
          totalClicks: premiumAnalyticsMap[r.id]?.clicks ?? 0,
        }))
      );
    } catch (err) {
      console.error('running 광고 로드 실패:', err);
    } finally {
      setAdsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApartmentDetail();
    fetchRunningAds();
  }, [id, fetchRunningAds]);

  const fetchApartmentDetail = async () => {
    try {
      // TODO: Supabase 연동
      // 임시 데이터
      setApartment({
        id,
        name: '동부아파트',
        address: '관악구 신원로 26',
        detailAddress: '101동 옆',
        status: 'active',
        createdAt: '2024-01-15',
        buildings: [
          {
            id: '1',
            number: '101',
            householdsCount: 120,
            lines: [
              {
                id: '1-12',
                line: 12,
                devices: [
                  {
                    id: 'd1',
                    macAddress: 'AA:BB:CC:DD:EE:01',
                    password: '****',
                    placeName: 'B1 전기실',
                  },
                  {
                    id: 'd2',
                    macAddress: 'AA:BB:CC:DD:EE:02',
                    password: '****',
                    placeName: '1F 엘리베이터홀',
                  },
                ],
              },
              {
                id: '1-34',
                line: 34,
                devices: [],
              },
              {
                id: '1-56',
                line: 56,
                devices: [],
              },
            ],
          },
          {
            id: '2',
            number: '102',
            householdsCount: 120,
            lines: [
              {
                id: '2-12',
                line: 12,
                devices: [],
              },
              {
                id: '2-34',
                line: 34,
                devices: [],
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('Failed to fetch apartment detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBuilding = (buildingId: string) => {
    setExpandedBuildings(prev =>
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  const toggleLine = (lineId: string) => {
    setExpandedLines(prev =>
      prev.includes(lineId)
        ? prev.filter(id => id !== lineId)
        : [...prev, lineId]
    );
  };

  const handleAddDevice = (lineId: string) => {
    setCurrentLineId(lineId);
    setDeviceForm({
      placeName: '',
      macAddress: '',
      password: '',
    });
    setDeviceDialog(true);
  };

  const handleSaveDevice = () => {
    if (!apartment) return;

    // TODO: Supabase 연동
    const newDevice: Device = {
      id: Date.now().toString(),
      ...deviceForm,
    };

    // Update local state
    const updatedBuildings = apartment.buildings.map(building => ({
      ...building,
      lines: building.lines.map(line =>
        line.id === currentLineId
          ? { ...line, devices: [...line.devices, newDevice] }
          : line
      ),
    }));

    setApartment({ ...apartment, buildings: updatedBuildings });
    setDeviceDialog(false);
  };

  const handleDeleteDevice = async (lineId: string, deviceId: string): Promise<void> => {
    if (!apartment) return;
    if (!(await confirmModal({ title: '기기 삭제', message: '정말로 이 기기를 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) return;

    // TODO: Supabase 연동
    const updatedBuildings = apartment.buildings.map(building => ({
      ...building,
      lines: building.lines.map(line =>
        line.id === lineId
          ? { ...line, devices: line.devices.filter(d => d.id !== deviceId) }
          : line
      ),
    }));

    setApartment({ ...apartment, buildings: updatedBuildings });
  };

  const handleSaveBasicInfo = () => {
    // TODO: Supabase 연동
    setEditMode(false);
  };

  if (loading) {
    return <DetailSkeleton sections={6} />;
  }

  if (!apartment) {
    return null;
  }

  return (
    <PageShell>
      <HeaderTitle title={apartment.name} onBack={() => router.push('/admin/apartments')} />
      <Group gap="sm" wrap="wrap">
        <Badge variant="light" color={apartment.status === 'active' ? 'green' : 'gray'}>
          {apartment.status === 'active' ? '활성' : '비활성'}
        </Badge>
        <Text size="sm" c="dimmed">{apartment.address}</Text>
      </Group>

      {/* Tabs */}
      <Tabs defaultValue="basic">
        <Tabs.List grow>
          <Tabs.Tab value="basic">기본 정보</Tabs.Tab>
          <Tabs.Tab value="buildings">동 관리</Tabs.Tab>
          <Tabs.Tab value="devices">기기 관리</Tabs.Tab>
          <Tabs.Tab value="permissions">권한 설정</Tabs.Tab>
          <Tabs.Tab value="ads">광고 현황</Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: 기본 정보 */}
        <Tabs.Panel value="basic" pt="lg">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <MapPin size={20} />
                    <Title order={4}>기본 정보</Title>
                  </Group>
                  <Text size="sm" c="dimmed">
                    아파트의 기본 정보를 확인하고 수정할 수 있습니다
                  </Text>
                </Stack>
                {!editMode ? (
                  <Button leftSection={<Edit2 size={16} />} onClick={() => setEditMode(true)}>
                    수정
                  </Button>
                ) : (
                  <Group gap="xs">
                    <Button variant="default" onClick={() => setEditMode(false)}>
                      취소
                    </Button>
                    <Button leftSection={<Save size={16} />} onClick={handleSaveBasicInfo}>
                      저장
                    </Button>
                  </Group>
                )}
              </Group>

              <SimpleGrid cols={2} spacing="lg">
                <TextInput
                  label="아파트명"
                  value={apartment.name}
                  onChange={(e) => setApartment({ ...apartment, name: e.target.value })}
                  disabled={!editMode}
                />
                <Select
                  label="상태"
                  data={[
                    { value: 'active', label: '활성' },
                    { value: 'inactive', label: '비활성' },
                  ]}
                  value={apartment.status || null}
                  onChange={(value) => {
                    if (value === null) return;
                    setApartment({ ...apartment, status: value as any });
                  }}
                  allowDeselect={false}
                  disabled={!editMode}
                />
              </SimpleGrid>

              <TextInput label="주소" value={apartment.address} disabled />

              <TextInput
                label="상세주소"
                value={apartment.detailAddress || ''}
                onChange={(e) => setApartment({ ...apartment, detailAddress: e.target.value })}
                disabled={!editMode}
              />

              <SimpleGrid cols={3} spacing="lg">
                <Stack gap={4}>
                  <Text size="sm" fw={500}>총 동수</Text>
                  <Text fz="1.5rem" fw={700}>{apartment.buildings.length}동</Text>
                </Stack>
                <Stack gap={4}>
                  <Text size="sm" fw={500}>총 세대수</Text>
                  <Text fz="1.5rem" fw={700}>
                    {apartment.buildings.reduce((acc, b) => acc + b.householdsCount, 0)}세대
                  </Text>
                </Stack>
                <Stack gap={4}>
                  <Text size="sm" fw={500}>등록일</Text>
                  <Text fz="1.5rem" fw={700}>{apartment.createdAt}</Text>
                </Stack>
              </SimpleGrid>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Tab 2: 동 관리 */}
        <Tabs.Panel value="buildings" pt="lg">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Building2 size={20} />
                    <Title order={4}>동 관리</Title>
                  </Group>
                  <Text size="sm" c="dimmed">
                    각 동의 정보와 라인을 관리합니다
                  </Text>
                </Stack>
                {/* 동 추가 버튼은 기능 구현 전까지 숨김 */}
              </Group>

              <Stack gap="md">
                {apartment.buildings.map((building) => (
                  <Paper key={building.id} withBorder radius="md" p="md">
                    <Group justify="space-between" mb="md">
                      <Group gap="md">
                        <Text size="lg" fw={600}>{building.number}동</Text>
                        <Badge variant="light" color="gray">{building.householdsCount}세대</Badge>
                      </Group>
                      {/* 동 수정/삭제 버튼은 기능 구현 전까지 숨김 */}
                    </Group>

                    <Stack gap="xs">
                      <Text size="sm" fw={500}>라인 설정</Text>
                      <Group gap="md">
                        {AVAILABLE_LINES.map((line) => (
                          <Checkbox
                            key={line.value}
                            checked={building.lines.some(l => l.line === line.value)}
                            disabled
                            label={line.label}
                          />
                        ))}
                      </Group>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Tab 3: 기기 관리 */}
        <Tabs.Panel value="devices" pt="lg">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Stack gap={4}>
                <Group gap="xs">
                  <Cpu size={20} />
                  <Title order={4}>기기 관리</Title>
                </Group>
                <Text size="sm" c="dimmed">
                  각 라인에 설치된 기기를 관리합니다
                </Text>
              </Stack>

              <Stack gap="md">
                {apartment.buildings.map((building) => (
                  <Paper key={building.id} withBorder radius="md">
                    <UnstyledButton
                      w="100%"
                      p="md"
                      onClick={() => toggleBuilding(building.id)}
                    >
                      <Group gap="xs">
                        {expandedBuildings.includes(building.id) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                        <Text fw={600}>{building.number}동</Text>
                        <Badge variant="light" color="gray">
                          {building.lines.reduce((acc, l) => acc + l.devices.length, 0)} 기기
                        </Badge>
                      </Group>
                    </UnstyledButton>

                    {expandedBuildings.includes(building.id) && (
                      <Box
                        px="md"
                        pb="md"
                        style={{ borderTop: '1px solid var(--app-divider)' }}
                      >
                        {building.lines.map((line) => (
                          <Box key={line.id} mt="md">
                            <Group
                              justify="space-between"
                              py="xs"
                              px="xs"
                              style={{ cursor: 'pointer', borderRadius: 'var(--mantine-radius-sm)' }}
                              onClick={() => toggleLine(line.id)}
                            >
                              <Group gap="xs">
                                {expandedLines.includes(line.id) ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                                <Text fw={500}>{line.line}라인</Text>
                                <Badge variant="light" color="gray">
                                  {line.devices.length} 기기
                                </Badge>
                              </Group>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                aria-label="기기 추가"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddDevice(line.id);
                                }}
                              >
                                <Plus size={16} />
                              </ActionIcon>
                            </Group>

                            {expandedLines.includes(line.id) && (
                              <Stack gap="xs" ml="xl" mt="xs">
                                {line.devices.length === 0 ? (
                                  <Text size="sm" c="dimmed" py="xs">
                                    등록된 기기가 없습니다
                                  </Text>
                                ) : (
                                  line.devices.map((device) => (
                                    <Group
                                      key={device.id}
                                      justify="space-between"
                                      p="sm"
                                      bg="var(--app-bg-muted)"
                                      style={{ borderRadius: 'var(--mantine-radius-md)' }}
                                    >
                                      <Stack gap={4}>
                                        <Text fw={500}>{device.placeName}</Text>
                                        <Box>
                                          <Text size="sm" c="dimmed">MAC: {device.macAddress}</Text>
                                          <Text size="sm" c="dimmed">Password: {device.password}</Text>
                                        </Box>
                                      </Stack>
                                      <Group gap={4}>
                                        {/* 기기 수정 버튼은 기능 구현 전까지 숨김 */}
                                        <ActionIcon
                                          variant="subtle"
                                          color="red"
                                          aria-label="삭제"
                                          onClick={() => handleDeleteDevice(line.id, device.id)}
                                        >
                                          <Trash2 size={16} />
                                        </ActionIcon>
                                      </Group>
                                    </Group>
                                  ))
                                )}
                              </Stack>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Tab 4: 권한 설정 */}
        <Tabs.Panel value="permissions" pt="lg">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Stack gap={4}>
                <Group gap="xs">
                  <Shield size={20} />
                  <Title order={4}>권한 설정</Title>
                </Group>
                <Text size="sm" c="dimmed">
                  아파트 관리자 권한을 설정합니다
                </Text>
              </Stack>
              <Text c="dimmed">권한 설정 기능은 준비 중입니다.</Text>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Tab 5: 광고 현황 */}
        <Tabs.Panel value="ads" pt="lg">
          <Stack gap="lg">
            {/* 기본광고 */}
            <Paper withBorder radius="md" p="lg">
              <Stack gap="lg">
                <Stack gap={4}>
                  <Group gap="xs">
                    <BarChart2 size={20} />
                    <Title order={4}>기본광고 진행 중</Title>
                    <Badge variant="light" color="gray">{runningBasicAds.length}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">이 아파트에서 현재 running 상태인 기본광고입니다</Text>
                </Stack>
                {adsLoading ? (
                  <TableSkeleton rows={3} columns={7} />
                ) : runningBasicAds.length === 0 ? (
                  <Text size="sm" c="dimmed" py="md" ta="center">진행 중인 기본광고가 없습니다</Text>
                ) : (
                  <Table.ScrollContainer minWidth={640}>
                    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>상호명</Table.Th>
                          <Table.Th>광고 제목</Table.Th>
                          <Table.Th>카테고리</Table.Th>
                          <Table.Th>시작일</Table.Th>
                          <Table.Th ta="center">무료</Table.Th>
                          <Table.Th ta="right">노출수</Table.Th>
                          <Table.Th ta="right">클릭수</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {runningBasicAds.map((ad) => (
                          <Table.Tr key={ad.id}>
                            <Table.Td fw={500}>{ad.businessName}</Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed" maw={200} truncate>{ad.title ?? '-'}</Text>
                            </Table.Td>
                            <Table.Td c="dimmed">{ad.categoryName ?? '-'}</Table.Td>
                            <Table.Td c="dimmed">
                              {ad.activatedAt ? new Date(ad.activatedAt).toLocaleDateString('ko-KR') : '-'}
                            </Table.Td>
                            <Table.Td ta="center">
                              {ad.freeMonths > 0 ? (
                                <Badge variant="light" color="gray" size="sm">{ad.freeMonths}개월</Badge>
                              ) : '-'}
                            </Table.Td>
                            <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ad.totalImpressions > 0 ? ad.totalImpressions.toLocaleString() : '-'}
                            </Table.Td>
                            <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ad.totalClicks > 0 ? ad.totalClicks.toLocaleString() : '-'}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Stack>
            </Paper>

            {/* 프리미엄광고 */}
            <Paper withBorder radius="md" p="lg">
              <Stack gap="lg">
                <Stack gap={4}>
                  <Group gap="xs">
                    <ThemeIcon variant="transparent" color="yellow" size="sm">
                      <BarChart2 size={20} />
                    </ThemeIcon>
                    <Title order={4}>프리미엄광고 진행 중</Title>
                    <Badge variant="light" color="gray">{runningPremiumAds.length}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">이 아파트에서 현재 running 상태인 프리미엄광고입니다</Text>
                </Stack>
                {adsLoading ? (
                  <TableSkeleton rows={3} columns={7} />
                ) : runningPremiumAds.length === 0 ? (
                  <Text size="sm" c="dimmed" py="md" ta="center">진행 중인 프리미엄광고가 없습니다</Text>
                ) : (
                  <Table.ScrollContainer minWidth={640}>
                    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>상호명</Table.Th>
                          <Table.Th>광고 제목</Table.Th>
                          <Table.Th>기간</Table.Th>
                          <Table.Th>주수</Table.Th>
                          <Table.Th ta="right">금액</Table.Th>
                          <Table.Th ta="right">노출수</Table.Th>
                          <Table.Th ta="right">클릭수</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {runningPremiumAds.map((ad) => (
                          <Table.Tr key={ad.id}>
                            <Table.Td fw={500}>{ad.businessName}</Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed" maw={200} truncate>{ad.title ?? '-'}</Text>
                            </Table.Td>
                            <Table.Td c="dimmed" fz="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ad.startedAt && ad.endedAt ? (
                                <>
                                  {new Date(ad.startedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                                  {' ~ '}
                                  {new Date(ad.endedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                                </>
                              ) : '-'}
                            </Table.Td>
                            <Table.Td c="dimmed">{ad.weeks}주</Table.Td>
                            <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ad.totalAmount != null ? `${ad.totalAmount.toLocaleString()}원` : '-'}
                            </Table.Td>
                            <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ad.totalImpressions > 0 ? ad.totalImpressions.toLocaleString() : '-'}
                            </Table.Td>
                            <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ad.totalClicks > 0 ? ad.totalClicks.toLocaleString() : '-'}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Device Dialog */}
      <Modal opened={deviceDialog} onClose={() => setDeviceDialog(false)} title="기기 추가">
        <Text size="sm" c="dimmed">
          새로운 기기 정보를 입력해주세요
        </Text>
        <Stack gap="md" py="md">
          <Select
            label="설치 장소"
            placeholder="장소를 선택하세요"
            data={PLACE_OPTIONS}
            value={deviceForm.placeName || null}
            onChange={(value) => {
              if (value === null) return;
              setDeviceForm({ ...deviceForm, placeName: value });
            }}
            allowDeselect={false}
          />
          <TextInput
            label="MAC Address"
            placeholder="예: AA:BB:CC:DD:EE:FF"
            value={deviceForm.macAddress}
            onChange={(e) => setDeviceForm({ ...deviceForm, macAddress: e.target.value })}
          />
          <TextInput
            label="비밀번호"
            type="password"
            placeholder="기기 비밀번호"
            value={deviceForm.password}
            onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
          />
        </Stack>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeviceDialog(false)}>
            취소
          </Button>
          <Button onClick={handleSaveDevice}>저장</Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
