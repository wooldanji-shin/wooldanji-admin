'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, HardDrive, Activity, TrendingUp } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export default function DashboardPage() {
  const stats = [
    {
      title: '총 회원 수',
      value: '1,234',
      icon: Users,
      change: '+12.5%',
      changeType: 'positive' as const,
    },
    {
      title: '등록된 기기',
      value: '856',
      icon: HardDrive,
      change: '+8.2%',
      changeType: 'positive' as const,
    },
    {
      title: '활성 사용자',
      value: '432',
      icon: Activity,
      change: '+23.1%',
      changeType: 'positive' as const,
    },
    {
      title: '이번 달 증가율',
      value: '18.3%',
      icon: TrendingUp,
      change: '+4.3%',
      changeType: 'positive' as const,
    },
  ];

  const chartData = [
    { month: '1월', users: 400, devices: 240 },
    { month: '2월', users: 500, devices: 300 },
    { month: '3월', users: 650, devices: 380 },
    { month: '4월', users: 780, devices: 450 },
    { month: '5월', users: 920, devices: 550 },
    { month: '6월', users: 1050, devices: 680 },
    { month: '7월', users: 1234, devices: 856 },
  ];

  const chartConfig = {
    users: {
      label: '회원 수',
      color: 'hsl(var(--chart-1))',
    },
    devices: {
      label: '기기 수',
      color: 'hsl(var(--chart-2))',
    },
  };

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='대시보드' />

      <div className='flex-1 p-6 space-y-6'>
        {/* Stats Grid */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className='bg-card border-border'
              >
                <CardHeader className='flex flex-row items-center justify-between pb-2'>
                  <CardTitle className='text-sm font-medium text-muted-foreground'>
                    {stat.title}
                  </CardTitle>
                  <Icon className='h-4 w-4 text-muted-foreground' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold text-card-foreground'>
                    {stat.value}
                  </div>
                  <p className='text-xs text-primary mt-1'>
                    {stat.change} 지난 달 대비
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className='bg-card border-border'>
          <CardHeader>
            <CardTitle className='text-card-foreground'>
              월별 증가 추이
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className='h-[300px] w-full'
            >
              <ResponsiveContainer
                width='100%'
                height='100%'
              >
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray='3 3'
                    className='stroke-muted'
                  />
                  <XAxis
                    dataKey='month'
                    className='text-xs'
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    className='text-xs'
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type='monotone'
                    dataKey='users'
                    stroke='var(--color-chart-1)'
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-chart-1)', r: 4 }}
                  />
                  <Line
                    type='monotone'
                    dataKey='devices'
                    stroke='var(--color-chart-2)'
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-chart-2)', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className='grid gap-4 md:grid-cols-2'>
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-card-foreground'>
                최근 가입 회원
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {[
                  {
                    name: '김철수',
                    email: 'kim@example.com',
                    date: '2024-01-15',
                  },
                  {
                    name: '이영희',
                    email: 'lee@example.com',
                    date: '2024-01-14',
                  },
                  {
                    name: '박민수',
                    email: 'park@example.com',
                    date: '2024-01-14',
                  },
                  {
                    name: '정수진',
                    email: 'jung@example.com',
                    date: '2024-01-13',
                  },
                ].map((user, i) => (
                  <div
                    key={i}
                    className='flex items-center justify-between'
                  >
                    <div>
                      <p className='text-sm font-medium text-card-foreground'>
                        {user.name}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {user.email}
                      </p>
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      {user.date}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-card-foreground'>
                최근 등록 기기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {[
                  {
                    mac: '00:1B:44:11:3A:B7',
                    line: 'Line 1',
                    date: '2024-01-15',
                  },
                  {
                    mac: '00:1B:44:11:3A:B8',
                    line: 'Line 2',
                    date: '2024-01-14',
                  },
                  {
                    mac: '00:1B:44:11:3A:B9',
                    line: 'Line 1',
                    date: '2024-01-14',
                  },
                  {
                    mac: '00:1B:44:11:3A:C0',
                    line: 'Line 3',
                    date: '2024-01-13',
                  },
                ].map((device, i) => (
                  <div
                    key={i}
                    className='flex items-center justify-between'
                  >
                    <div>
                      <p className='text-sm font-medium font-mono text-card-foreground'>
                        {device.mac}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {device.line}
                      </p>
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      {device.date}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
