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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/apartments')}
          >
            <Building2 className="mr-1.5 h-4 w-4" />
            아파트 목록
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/admin/advertising-v2/applications')}
          >
            광고 검수 시작
            <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden border-border/70 shadow-card lg:col-span-2">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">최근 7일 추이</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  주요 지표의 일별 변화
                </p>
              </div>
              <Tabs defaultValue="users">
                <TabsList>
                  <TabsTrigger value="users">
                    회원
                  </TabsTrigger>
                  <TabsTrigger value="ads">
                    광고
                  </TabsTrigger>
                  <TabsTrigger value="inquiries">
                    문의
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="users" className="mt-4">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/70"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        className="text-xs"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'oklch(0.5 0.015 260)' }}
                      />
                      <YAxis
                        className="text-xs"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'oklch(0.5 0.015 260)' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        dataKey="users"
                        type="monotone"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        fill="url(#fillUsers)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </TabsContent>
                <TabsContent value="ads" className="mt-4">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="fillAds" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/70"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'oklch(0.5 0.015 260)' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'oklch(0.5 0.015 260)' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        dataKey="ads"
                        type="monotone"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        fill="url(#fillAds)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </TabsContent>
                <TabsContent value="inquiries" className="mt-4">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="fillInq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/70"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'oklch(0.5 0.015 260)' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'oklch(0.5 0.015 260)' }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        dataKey="inquiries"
                        type="monotone"
                        stroke="var(--color-chart-4)"
                        strokeWidth={2}
                        fill="url(#fillInq)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">처리해야 할 작업</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                지금 확인하면 좋은 항목
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {recentActivity.map((item) => (
                  <li
                    key={item.href}
                    className="group flex cursor-pointer items-start justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-muted/50"
                    onClick={() => router.push(item.href)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <StatusBadge variant={item.badge} size="sm">
                          {item.badgeLabel}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 shadow-card">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">입주민 상태 분포</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                전체 가입자의 현재 상태
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <ChartContainer config={distributionConfig} className="h-[200px] w-full">
                <BarChart data={distribution} barCategoryGap={24}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/70"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'oklch(0.5 0.015 260)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'oklch(0.5 0.015 260)' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-1)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">빠른 작업</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                자주 사용하는 메뉴로 바로 이동
              </p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {quickActions.map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.href}
                      onClick={() => router.push(q.href)}
                      className={cn(
                        'group flex flex-col items-start gap-2 rounded-lg border border-border/70 bg-card p-4 text-left transition-all duration-200 ease-spring',
                        'hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-card-hover'
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {q.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </PageShell>
  );
}
