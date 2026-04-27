'use client';

import { AdminHeader } from '@/components/admin-header';
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
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PremiumStatus = 'pending' | 'approved' | 'running' | 'ended' | 'rejected' | 'modification_pending';

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

const STATUS_CONFIG: Record<PremiumStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:              { label: '승인 대기', color: '#CD6D00', bg: '#FFF4E5', border: '#FDDCAA' },
  approved:             { label: '승인됨',   color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  running:              { label: '진행중',   color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  ended:                { label: '종료',     color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  rejected:             { label: '거절됨',   color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  modification_pending: { label: '수정 심사', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
};

const STATUS_FILTERS: { value: PremiumStatus | 'all'; label: string }[] = [
  { value: 'all',               label: '전체' },
  { value: 'pending',           label: '승인 대기' },
  { value: 'modification_pending', label: '수정 심사' },
  { value: 'approved',          label: '승인됨' },
  { value: 'running',           label: '진행중' },
  { value: 'ended',             label: '종료' },
  { value: 'rejected',          label: '거절됨' },
];

function StatusBadge({ status }: { status: PremiumStatus }) {
  const c = STATUS_CONFIG[status] ?? { label: status, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  return (
    <span
      className='inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border'
      style={{ color: c.color, backgroundColor: c.bg, borderColor: c.border }}
    >
      {c.label}
    </span>
  );
}

export default function PremiumAdListPage() {
  const router = useRouter();
  const [ads, setAds] = useState<PremiumAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PremiumStatus | 'all'>('all');

  useEffect(() => {
    loadAds();
  }, []);

  async function loadAds() {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // 1단계: 프리미엄 광고 목록 조회 (draft 제외)
      const { data: adsData, error: adsError } = await supabase
        .from('premium_advertisements_v2')
        .select('id, "partnerId", "baseAdId", title, weeks, status, "paymentStatus", "totalAmount", "modificationStatus", "startedAt", "endedAt", "createdAt"')
        .neq('status', 'draft')
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;
      if (!adsData || adsData.length === 0) { setAds([]); return; }

      // 2단계: partnerId (= auth.users.id) 기준으로 partner_users.businessName 조회
      const partnerUserIds = [...new Set(adsData.map((a: any) => a.partnerId))];
      const adIds = adsData.map((a: any) => a.id);

      // 누적 결제 합계 (신규 + 연장) — 진실의 원천: ad_payment_history_v2 SUM(paid)
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
        (partnerData ?? []).map((p: any) => [p.userId, p.businessName])
      );

      const cumulativeAmountMap = (paymentRows ?? []).reduce<Record<string, number>>(
        (acc, r: any) => {
          const k = r.premiumAdId as string;
          acc[k] = (acc[k] ?? 0) + ((r.amount as number | null) ?? 0);
          return acc;
        },
        {},
      );

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

  const filtered = statusFilter === 'all'
    ? ads
    : ads.filter(ad => ad.status === statusFilter);

  return (
    <div className='min-h-screen bg-gray-50'>
      <AdminHeader title='프리미엄 광고 목록' />
      <main className='max-w-7xl mx-auto px-6 py-8'>
        {/* 상태 필터 */}
        <div className='flex gap-2 mb-6 flex-wrap'>
          {STATUS_FILTERS.map(f => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'outline'}
              size='sm'
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
              {f.value !== 'all' && (
                <Badge variant='secondary' className='ml-1.5 text-xs'>
                  {ads.filter(ad => ad.status === f.value).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* 목록 테이블 */}
        <div className='bg-white rounded-lg border shadow-sm overflow-hidden'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>업체명</TableHead>
                <TableHead>광고 제목</TableHead>
                <TableHead>기간</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>신청일</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className='text-center py-12 text-gray-400'>
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='text-center py-12 text-gray-400'>
                    해당하는 프리미엄 광고가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(ad => (
                  <TableRow
                    key={ad.id}
                    className='cursor-pointer hover:bg-gray-50'
                    onClick={() => router.push(`/admin/advertising-v2/premium/${ad.id}`)}
                  >
                    <TableCell className='font-medium'>
                      {ad.partnerBusinessName ?? '-'}
                    </TableCell>
                    <TableCell>{ad.title ?? '(제목 없음)'}</TableCell>
                    <TableCell>
                      {(() => {
                        // 누적 기간 = (endedAt - startedAt) / 7일, 시작 전이면 ad.weeks
                        const cumulativeWeeks =
                          ad.startedAt && ad.endedAt
                            ? Math.floor(
                                (new Date(ad.endedAt).getTime() -
                                  new Date(ad.startedAt).getTime()) /
                                  (7 * 24 * 60 * 60 * 1000),
                              )
                            : ad.weeks;
                        const extWeeks = cumulativeWeeks - ad.weeks;
                        return (
                          <span>
                            {cumulativeWeeks}주
                            {extWeeks > 0 && (
                              <span className='text-xs text-gray-500 ml-1'>
                                (원 {ad.weeks} + 연장 {extWeeks})
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const amount = ad.cumulativeAmount ?? ad.totalAmount;
                        return amount != null ? `${amount.toLocaleString()}원` : '-';
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1.5 flex-wrap'>
                        <StatusBadge status={ad.status} />
                        {ad.status === 'running' && ad.modificationStatus === 'pending' && (
                          <span
                            className='inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border'
                            style={{ color: '#7C3AED', backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                          >
                            수정 심사
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-sm text-gray-500'>
                      {new Date(ad.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={e => {
                          e.stopPropagation();
                          router.push(`/admin/advertising-v2/premium/${ad.id}`);
                        }}
                      >
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
