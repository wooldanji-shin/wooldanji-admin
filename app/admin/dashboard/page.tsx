'use client';

import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  Building2,
  HardDrive,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import {
  Box,
  Button,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';

const trendData = [
  { day: '04/22', users: 980, ads: 32, inquiries: 14 },
  { day: '04/23', users: 1010, ads: 38, inquiries: 18 },
  { day: '04/24', users: 1052, ads: 41, inquiries: 22 },
  { day: '04/25', users: 1089, ads: 47, inquiries: 17 },
  { day: '04/26', users: 1132, ads: 52, inquiries: 20 },
  { day: '04/27', users: 1190, ads: 58, inquiries: 24 },
  { day: '04/28', users: 1234, ads: 63, inquiries: 28 },
];

const distribution = [
  { label: '활성', value: 432, color: 'var(--color-chart-2)' },
  { label: '대기', value: 124, color: 'var(--color-chart-4)' },
  { label: '비활성', value: 86, color: 'var(--color-chart-3)' },
  { label: '거절', value: 24, color: 'var(--color-chart-5)' },
];

const recentActivity = [
  {
    title: '입주민 승인 대기',
    description: '8건이 24시간 이상 대기 중',
    href: '/admin/user-reconfirm',
    badge: 'pending',
    badgeLabel: '검토 필요',
  },
  {
    title: '광고 검수 요청',
    description: '신규 3건, 재검수 2건',
    href: '/admin/advertising-v2/applications',
    badge: 'info',
    badgeLabel: '신규',
  },
  {
    title: '문의 미응답',
    description: '12건이 응답 대기 중',
    href: '/admin/inquiries',
    badge: 'error',
    badgeLabel: '지연',
  },
  {
    title: '파트너 전환 신청',
    description: '회원 관리에서 pending 상태 확인',
    href: '/admin/users',
    badge: 'primary',
    badgeLabel: '신규',
  },
] as const;

const quickActions = [
  { label: '아파트 등록', href: '/admin/apartments/new', icon: Building2 },
  { label: '광고 검수', href: '/admin/advertising-v2/applications', icon: ShieldAlert },
  { label: '회원 관리', href: '/admin/users', icon: Users },
  { label: '공지 발송', href: '/admin/partner-announcements', icon: Megaphone },
  { label: '문의 응대', href: '/admin/inquiries', icon: MessageSquare },
  { label: '프리미엄 광고', href: '/admin/advertising-v2/premium', icon: Sparkles },
];

const chartConfig = {
  users: { label: '회원', color: 'var(--color-chart-1)' },
  ads: { label: '광고', color: 'var(--color-chart-2)' },
  inquiries: { label: '문의', color: 'var(--color-chart-4)' },
};

const distributionConfig = {
  value: { label: '입주민', color: 'var(--color-chart-1)' },
};

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="대시보드"
          description="플랫폼 핵심 지표와 미처리 작업을 한눈에 확인하세요."
        />
        <PageHeaderActions>
          <Button
            variant="default"
            size="sm"
            leftSection={<Building2 size={16} />}
            onClick={() => router.push('/admin/apartments')}
          >
            아파트 목록
          </Button>
          <Button
            size="sm"
            rightSection={<ArrowUpRight size={16} />}
            onClick={() => router.push('/admin/advertising-v2/applications')}
          >
            광고 검수 시작
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
          <StatCard
            label="총 회원 수"
            value="1,234"
            icon={Users}
            delta={12.5}
            deltaLabel="지난 주 대비"
            accent="primary"
          />
          <StatCard
            label="등록된 기기"
            value="856"
            icon={HardDrive}
            delta={8.2}
            deltaLabel="지난 주 대비"
            accent="info"
          />
          <StatCard
            label="활성 사용자"
            value="432"
            icon={Activity}
            delta={23.1}
            deltaLabel="지난 주 대비"
            accent="success"
          />
          <StatCard
            label="이번 달 증가율"
            value="18.3%"
            icon={TrendingUp}
            delta={4.3}
            deltaLabel="지난 달 대비"
            accent="warning"
          />
        </SimpleGrid>

        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Paper withBorder radius="md" p="lg" h="100%">
              <Tabs defaultValue="users">
                <Group justify="space-between" align="flex-start" gap="sm" mb="md">
                  <Stack gap={4}>
                    <Title order={4}>최근 7일 추이</Title>
                    <Text size="sm" c="dimmed">
                      주요 지표의 일별 변화
                    </Text>
                  </Stack>
                  <Tabs.List>
                    <Tabs.Tab value="users">회원</Tabs.Tab>
                    <Tabs.Tab value="ads">광고</Tabs.Tab>
                    <Tabs.Tab value="inquiries">문의</Tabs.Tab>
                  </Tabs.List>
                </Group>
                <Tabs.Panel value="users">
                  <Box h={260} w="100%">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--app-divider)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          fontSize="0.75rem"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--mantine-color-dimmed)' }}
                        />
                        <YAxis
                          fontSize="0.75rem"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--mantine-color-dimmed)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--mantine-color-body)',
                            border: '1px solid var(--app-divider)',
                            borderRadius: 'var(--mantine-radius-md)',
                            fontSize: '0.75rem',
                          }}
                        />
                        <Area
                          dataKey="users"
                          name={chartConfig.users.label}
                          type="monotone"
                          stroke="var(--mantine-color-blue-6)"
                          strokeWidth={2}
                          fill="url(#fillUsers)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Tabs.Panel>
                <Tabs.Panel value="ads">
                  <Box h={260} w="100%">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="fillAds" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--mantine-color-teal-6)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--mantine-color-teal-6)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--app-divider)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          fontSize="0.75rem"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--mantine-color-dimmed)' }}
                        />
                        <YAxis
                          fontSize="0.75rem"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--mantine-color-dimmed)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--mantine-color-body)',
                            border: '1px solid var(--app-divider)',
                            borderRadius: 'var(--mantine-radius-md)',
                            fontSize: '0.75rem',
                          }}
                        />
                        <Area
                          dataKey="ads"
                          name={chartConfig.ads.label}
                          type="monotone"
                          stroke="var(--mantine-color-teal-6)"
                          strokeWidth={2}
                          fill="url(#fillAds)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Tabs.Panel>
                <Tabs.Panel value="inquiries">
                  <Box h={260} w="100%">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="fillInq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--mantine-color-orange-6)" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="var(--mantine-color-orange-6)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--app-divider)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          fontSize="0.75rem"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--mantine-color-dimmed)' }}
                        />
                        <YAxis
                          fontSize="0.75rem"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--mantine-color-dimmed)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--mantine-color-body)',
                            border: '1px solid var(--app-divider)',
                            borderRadius: 'var(--mantine-radius-md)',
                            fontSize: '0.75rem',
                          }}
                        />
                        <Area
                          dataKey="inquiries"
                          name={chartConfig.inquiries.label}
                          type="monotone"
                          stroke="var(--mantine-color-orange-6)"
                          strokeWidth={2}
                          fill="url(#fillInq)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper withBorder radius="md" h="100%" style={{ overflow: 'hidden' }}>
              <Stack
                gap={4}
                p="lg"
                style={{ borderBottom: '1px solid var(--app-divider)' }}
              >
                <Title order={4}>처리해야 할 작업</Title>
                <Text size="sm" c="dimmed">
                  지금 확인하면 좋은 항목
                </Text>
              </Stack>
              <Stack gap={0}>
                {recentActivity.map((item, index) => (
                  <UnstyledButton
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    px="lg"
                    py="md"
                    className="hover:bg-[var(--mantine-color-default-hover)]"
                    style={
                      index > 0
                        ? { borderTop: '1px solid var(--app-divider)' }
                        : undefined
                    }
                  >
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                      <Box miw={0} style={{ flex: 1 }}>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" fw={500} truncate>
                            {item.title}
                          </Text>
                          <StatusBadge variant={item.badge} size="sm">
                            {item.badgeLabel}
                          </StatusBadge>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                          {item.description}
                        </Text>
                      </Box>
                      <Text c="dimmed" mt={4} style={{ flexShrink: 0, display: 'flex' }}>
                        <ArrowUpRight size={16} />
                      </Text>
                    </Group>
                  </UnstyledButton>
                ))}
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Paper withBorder radius="md" p="lg">
            <Stack gap={4} mb="lg">
              <Title order={4}>입주민 상태 분포</Title>
              <Text size="sm" c="dimmed">
                전체 가입자의 현재 상태
              </Text>
            </Stack>
            <Box h={200} w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} barCategoryGap={24}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--app-divider)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    fontSize="0.75rem"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--mantine-color-dimmed)' }}
                  />
                  <YAxis
                    fontSize="0.75rem"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--mantine-color-dimmed)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--mantine-color-default-hover)' }}
                    contentStyle={{
                      background: 'var(--mantine-color-body)',
                      border: '1px solid var(--app-divider)',
                      borderRadius: 'var(--mantine-radius-md)',
                      fontSize: '0.75rem',
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name={distributionConfig.value.label}
                    radius={[6, 6, 0, 0]}
                    fill="var(--mantine-color-blue-6)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Stack gap={4} mb="lg">
              <Title order={4}>빠른 작업</Title>
              <Text size="sm" c="dimmed">
                자주 사용하는 메뉴로 바로 이동
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
              {quickActions.map((q) => {
                const Icon = q.icon;
                return (
                  <UnstyledButton
                    key={q.href}
                    onClick={() => router.push(q.href)}
                    p="md"
                    className="hover:bg-[var(--mantine-color-default-hover)]"
                    style={{
                      border: '1px solid var(--app-divider)',
                      borderRadius: 'var(--mantine-radius-md)',
                    }}
                  >
                    <Stack gap="xs" align="flex-start">
                      <ThemeIcon variant="light" color="blue" size="lg" radius="md">
                        <Icon size={16} />
                      </ThemeIcon>
                      <Text size="sm" fw={500}>
                        {q.label}
                      </Text>
                    </Stack>
                  </UnstyledButton>
                );
              })}
            </SimpleGrid>
          </Paper>
        </SimpleGrid>
      </PageContent>
    </PageShell>
  );
}
