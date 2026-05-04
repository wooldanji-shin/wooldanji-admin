'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { StatusBadge, type PremiumStatus } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface PremiumAd {
  id: string;
  partnerId: string;
  baseAdId: string;
  title: string | null;
  weeks: number;
  status: PremiumStatus;
  paymentStatus: 'unpaid' | 'paid';
  totalAmount: number | null;
  cumulativeAmount: number | null;
  modificationStatus: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  partnerBusinessName?: string;
}

const STATUS_FILTERS: { value: PremiumStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '승인 대기' },
  { value: 'modification_pending', label: '수정 심사' },
  { value: 'approved', label: '승인됨' },
  { value: 'running', label: '진행중' },
  { value: 'ended', label: '종료' },
  { value: 'rejected', label: '거절됨' },
];

export default function PremiumAdListPage(): React.ReactElement {
  const router = useRouter();
  const [ads, setAds] = useState<PremiumAd[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<PremiumStatus | 'all'>('all');

  useEffect(() => {
    loadAds();
  }, []);

  async function loadAds(): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const { data: adsData, error: adsError } = await supabase
        .from('premium_advertisements_v2')
        .select(
          'id, "partnerId", "baseAdId", title, weeks, status, "paymentStatus", "totalAmount", "modificationStatus", "startedAt", "endedAt", "createdAt"'
        )
        .neq('status', 'draft')
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;
      if (!adsData || adsData.length === 0) {
        setAds([]);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const partnerUserIds = [...new Set(adsData.map((a: any) => a.partnerId))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adIds = adsData.map((a: any) => a.id);

      const [{ data: partnerData }, { data: paymentRows }] = await Promise.all([
        supabase
          .from('partner_users')
          .select('"userId", "businessName"')
          .in('userId', partnerUserIds),
        supabase
          .from('ad_payment_history_v2')
          .select('"premiumAdId", amount')
          .in('premiumAdId', adIds)
          .eq('status', 'paid'),
      ]);

      const partnerMap = Object.fromEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (partnerData ?? []).map((p: any) => [p.userId, p.businessName])
      );

      const cumulativeAmountMap = (paymentRows ?? []).reduce<Record<string, number>>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc, r: any) => {
          const k = r.premiumAdId as string;
          acc[k] = (acc[k] ?? 0) + ((r.amount as number | null) ?? 0);
          return acc;
        },
        {}
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: PremiumAd[] = adsData.map((row: any) => ({
        ...row,
        partnerBusinessName: partnerMap[row.partnerId] ?? '-',
        cumulativeAmount: cumulativeAmountMap[row.id] ?? null,
      }));
      setAds(mapped);
    } catch (err) {
      console.error('프리미엄 광고 목록 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered =
    statusFilter === 'all' ? ads : ads.filter((ad) => ad.status === statusFilter);

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="프리미엄 광고 목록"
          description="프리미엄 광고 신청과 진행 상태를 관리합니다."
        />
      </PageHeader>

      <PageContent>
        {/* 상태 필터 — 카운트 배지가 있는 segmented filter */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.value;
            const count = f.value === 'all' ? ads.length : ads.filter((ad) => ad.status === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                )}
              >
                {f.label}
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-6 min-w-6 justify-center px-2 text-xs tabular-nums',
                    isActive && 'bg-primary-foreground/15 text-primary-foreground'
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        <DataTableShell>
          {isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="해당하는 프리미엄 광고가 없습니다"
              description="필터를 변경해서 다른 상태의 광고를 확인해 보세요."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead>광고 제목</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="w-16 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ad) => {
                  const cumulativeWeeks =
                    ad.startedAt && ad.endedAt
                      ? Math.floor(
                          (new Date(ad.endedAt).getTime() -
                            new Date(ad.startedAt).getTime()) /
                            (7 * 24 * 60 * 60 * 1000)
                        )
                      : ad.weeks;
                  const extWeeks = cumulativeWeeks - ad.weeks;
                  const amount = ad.cumulativeAmount ?? ad.totalAmount;

                  return (
                    <TableRow
                      key={ad.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/advertising-v2/premium/${ad.id}`)}
                    >
                      <TableCell className="font-medium">
                        {ad.partnerBusinessName ?? '-'}
                      </TableCell>
                      <TableCell>{ad.title ?? '(제목 없음)'}</TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          {ad.startedAt && ad.endedAt ? (
                            <span className="text-sm">
                              {new Date(ad.startedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                              {' ~ '}
                              {new Date(ad.endedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">날짜 미정</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {cumulativeWeeks}주
                            {extWeeks > 0 && ` (원 ${ad.weeks} + 연장 ${extWeeks})`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {amount != null ? `${amount.toLocaleString()}원` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge.Premium status={ad.status} />
                          {ad.status === 'running' && ad.modificationStatus === 'pending' && (
                            <StatusBadge variant="primary">수정 심사</StatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(ad.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/advertising-v2/premium/${ad.id}`);
                          }}
                        >
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableShell>
      </PageContent>
    </PageShell>
  );
}
