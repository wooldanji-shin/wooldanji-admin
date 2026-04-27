'use client';

import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode, use, useEffect, useState } from 'react';

type PremiumStatus = 'pending' | 'approved' | 'running' | 'ended' | 'rejected' | 'modification_pending';

interface SnapshotApartment {
  apartmentName: string;
  address: string;
  totalHouseholds: number;
}

// Design Ref: §2.7 — 연장 이력 행 (paymentType='extension')
interface ExtensionRow {
  id: string;
  paidAt: Date;
  weeks: number;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  paymentKey: string | null;
  receiptUrl: string | null;
}

interface PremiumAdDetail {
  id: string;
  partnerId: string;
  baseAdId: string;
  title: string | null;
  content: string | null;
  imageUrls: string[];
  naverMapUrl: string | null;
  blogUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  kakaoOpenChatUrl: string | null;
  weeks: number;
  status: PremiumStatus;
  paymentStatus: 'unpaid' | 'paid';
  totalAmount: number | null;
  rejectedReason: string | null;
  modificationStatus: string | null;
  modificationRejectedReason: string | null;
  pendingChanges: Record<string, unknown> | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  snapshotApartments: SnapshotApartment[];
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

const FIELD_LABELS: Record<string, string> = {
  title: '제목',
  content: '본문',
  imageUrls: '이미지',
  naverMapUrl: '네이버 지도',
  blogUrl: '블로그',
  youtubeUrl: '유튜브',
  instagramUrl: '인스타그램',
  kakaoOpenChatUrl: '카카오 오픈채팅',
};

function StatusBadge({ status }: { status: PremiumStatus }) {
  const c = STATUS_CONFIG[status] ?? { label: status, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  return (
    <span
      className='inline-flex items-center px-2.5 py-0.5 rounded text-sm font-medium border'
      style={{ color: c.color, backgroundColor: c.bg, borderColor: c.border }}
    >
      {c.label}
    </span>
  );
}

export default function PremiumAdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ad, setAd] = useState<PremiumAdDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Design Ref: §2.7 — 누적 결제 합계 + 연장 이력
  const [cumulativeAmount, setCumulativeAmount] = useState<number | null>(null);
  const [extensions, setExtensions] = useState<ExtensionRow[]>([]);

  // 거절 다이얼로그
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 수정 거절 다이얼로그
  const [rejectModOpen, setRejectModOpen] = useState(false);
  const [rejectModReason, setRejectModReason] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadAd();
  }, [id]);

  async function loadAd() {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('premium_advertisements_v2')
        .select(
          'id, "partnerId", "baseAdId", title, content, "imageUrls", ' +
          '"naverMapUrl", "blogUrl", "youtubeUrl", "instagramUrl", "kakaoOpenChatUrl", ' +
          'weeks, status, "paymentStatus", "totalAmount", "rejectedReason", ' +
          '"modificationStatus", "modificationRejectedReason", "pendingChanges", ' +
          '"startedAt", "endedAt", "createdAt", "snapshotApartments"'
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      const { data: partnerData } = await supabase
        .from('partner_users')
        .select('"businessName"')
        .eq('userId', data.partnerId)
        .maybeSingle();

      setAd({
        ...data,
        snapshotApartments: (data.snapshotApartments as SnapshotApartment[]) ?? [],
        partnerBusinessName: partnerData?.businessName,
      } as PremiumAdDetail);

      // Design Ref: §2.7 — 누적 결제 합계 + 연장 이력 동시 조회
      // Plan SC: 누적 totalAmount = 모든 결제 amount 의 합 (신규 + 모든 연장)
      const [{ data: paidRows }, { data: extRows }] = await Promise.all([
        supabase
          .from('ad_payment_history_v2')
          .select('amount')
          .eq('premiumAdId', id)
          .eq('status', 'paid'),
        supabase
          .from('ad_payment_history_v2')
          .select('id, amount, "paymentDate", "billingPeriodStart", "billingPeriodEnd", "paymentKey", "receiptUrl"')
          .eq('premiumAdId', id)
          .eq('paymentType', 'extension')
          .eq('status', 'paid')
          .order('paymentDate', { ascending: true }),
      ]);

      const sum = (paidRows ?? []).reduce(
        (s: number, r: { amount: number | null }) => s + (r.amount ?? 0),
        0,
      );
      setCumulativeAmount(sum > 0 ? sum : null);

      const parsedExtensions: ExtensionRow[] = (extRows ?? []).map((row) => {
        const periodStart = new Date(row.billingPeriodStart as string);
        const periodEnd = new Date(row.billingPeriodEnd as string);
        const weeks = Math.floor(
          (periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        return {
          id: row.id as string,
          paidAt: new Date(row.paymentDate as string),
          weeks,
          amount: row.amount as number,
          periodStart,
          periodEnd,
          paymentKey: (row.paymentKey as string | null) ?? null,
          receiptUrl: (row.receiptUrl as string | null) ?? null,
        };
      });
      setExtensions(parsedExtensions);
    } catch (err) {
      console.error('프리미엄 광고 상세 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove() {
    if (!confirm('승인하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${id}/approve`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) { alert(`승인 실패: ${result.error}`); return; }
      alert('승인되었습니다.');
      loadAd();
    } catch { alert('승인 중 오류가 발생했습니다.'); }
    finally { setIsProcessing(false); }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { alert('거절 사유를 입력해주세요.'); return; }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const result = await res.json();
      if (!res.ok) { alert(`거절 실패: ${result.error}`); return; }
      alert('거절 처리되었습니다.');
      setRejectOpen(false);
      setRejectReason('');
      loadAd();
    } catch { alert('거절 처리 중 오류가 발생했습니다.'); }
    finally { setIsProcessing(false); }
  }

  async function handleApproveModification() {
    if (!confirm('수정 내용을 승인하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${id}/approve-modification`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) { alert(`수정 승인 실패: ${result.error}`); return; }
      alert('수정이 승인되었습니다.');
      loadAd();
    } catch { alert('수정 승인 중 오류가 발생했습니다.'); }
    finally { setIsProcessing(false); }
  }

  async function handleRejectModification() {
    if (!rejectModReason.trim()) { alert('거절 사유를 입력해주세요.'); return; }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/advertising-v2/premium/${id}/reject-modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectModReason }),
      });
      const result = await res.json();
      if (!res.ok) { alert(`수정 거절 실패: ${result.error}`); return; }
      alert('수정이 거절되었습니다.');
      setRejectModOpen(false);
      setRejectModReason('');
      loadAd();
    } catch { alert('수정 거절 중 오류가 발생했습니다.'); }
    finally { setIsProcessing(false); }
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50'>
        <AdminHeader title='프리미엄 광고 상세' />
        <main className='max-w-4xl mx-auto px-6 py-8'>
          <p className='text-gray-400 text-center py-20'>로딩 중...</p>
        </main>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className='min-h-screen bg-gray-50'>
        <AdminHeader title='프리미엄 광고 상세' />
        <main className='max-w-4xl mx-auto px-6 py-8'>
          <p className='text-gray-400 text-center py-20'>광고를 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  const totalHouseholds = ad.snapshotApartments.reduce((s, a) => s + a.totalHouseholds, 0);

  // Design Ref: §2.7 — 누적 주차 = (endedAt - startedAt) / 7일
  const cumulativeWeeks =
    ad.startedAt && ad.endedAt
      ? Math.floor(
          (new Date(ad.endedAt).getTime() - new Date(ad.startedAt).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        )
      : ad.weeks;
  const extensionWeeks = cumulativeWeeks - ad.weeks;
  const displayAmount = cumulativeAmount ?? ad.totalAmount;
  const extensionAmount =
    displayAmount != null && ad.totalAmount != null
      ? displayAmount - ad.totalAmount
      : null;

  return (
    <div className='min-h-screen bg-gray-50'>
      <AdminHeader title='프리미엄 광고 상세' />
      <main className='max-w-4xl mx-auto px-6 py-8 space-y-6'>
        {/* 뒤로가기 */}
        <Button variant='ghost' size='sm' onClick={() => router.back()} className='gap-1'>
          <ArrowLeft size={16} /> 목록으로
        </Button>

        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>기본 정보</CardTitle>
              <div className='flex items-center gap-2'>
                <StatusBadge status={ad.status} />
                {ad.status === 'running' && ad.modificationStatus === 'pending' && (
                  <span
                    className='inline-flex items-center px-2.5 py-0.5 rounded text-sm font-medium border'
                    style={{ color: '#7C3AED', backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                  >
                    수정 심사
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <InfoRow label='업체명' value={ad.partnerBusinessName ?? '-'} />
            <InfoRow label='광고 제목' value={ad.title ?? '(제목 없음)'} />
            {/* Design Ref: §2.7 — 광고 기간 분해 표기 (원 + 연장) */}
            <InfoRow
              label='광고 기간'
              value={
                <span>
                  {cumulativeWeeks}주
                  {extensionWeeks > 0 && (
                    <span className='text-xs text-gray-500 ml-1'>
                      (원 {ad.weeks}주 + 연장 {extensionWeeks}주)
                    </span>
                  )}
                </span>
              }
            />
            {/* Design Ref: §2.7 — 결제 금액 분해 표기 */}
            <InfoRow
              label='결제 금액'
              value={
                displayAmount != null ? (
                  <span>
                    {displayAmount.toLocaleString()}원
                    {extensionAmount != null && extensionAmount > 0 && ad.totalAmount != null && (
                      <span className='text-xs text-gray-500 ml-1'>
                        (원 {ad.totalAmount.toLocaleString()}원 + 연장 {extensionAmount.toLocaleString()}원)
                      </span>
                    )}
                  </span>
                ) : (
                  '-'
                )
              }
            />
            <InfoRow
              label='결제 상태'
              value={ad.paymentStatus === 'paid' ? '결제 완료' : '결제 대기'}
            />
            {ad.startedAt && (
              <InfoRow label='광고 시작일' value={new Date(ad.startedAt).toLocaleDateString('ko-KR')} />
            )}
            {ad.endedAt && (
              <InfoRow label='광고 종료일' value={new Date(ad.endedAt).toLocaleDateString('ko-KR')} />
            )}
            <InfoRow label='신청일' value={new Date(ad.createdAt).toLocaleDateString('ko-KR')} />
            {ad.rejectedReason && (
              <InfoRow label='거절 사유' value={ad.rejectedReason} isRed />
            )}
            {ad.modificationRejectedReason && (
              <InfoRow label='수정 거절 사유' value={ad.modificationRejectedReason} isRed />
            )}
          </CardContent>
        </Card>

        {/* 광고 아파트 (snapshotApartments) */}
        {ad.snapshotApartments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>광고 아파트</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {ad.snapshotApartments.map((apt, i) => (
                <div key={i} className='flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200'>
                  <div>
                    <p className='text-sm font-semibold text-gray-800'>{apt.apartmentName}</p>
                    <p className='text-xs text-gray-500 mt-0.5'>{apt.address}</p>
                  </div>
                  <span className='text-sm font-medium text-gray-700 whitespace-nowrap ml-4'>
                    {apt.totalHouseholds.toLocaleString()}세대
                  </span>
                </div>
              ))}
              {ad.snapshotApartments.length > 1 && (
                <div className='text-right text-sm font-semibold text-gray-700 pr-1'>
                  합계 {totalHouseholds.toLocaleString()}세대
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Design Ref: §2.7 — 연장 이력 테이블 (paymentType='extension') */}
        {extensions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>연장 이력 (총 {extensions.length}건)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                      <th className='py-2 pr-3'>차수</th>
                      <th className='py-2 pr-3'>결제일</th>
                      <th className='py-2 pr-3'>주수</th>
                      <th className='py-2 pr-3 text-right'>결제 금액</th>
                      <th className='py-2 pr-3'>광고 기간</th>
                      <th className='py-2'>영수증</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extensions.map((ext, idx) => (
                      <tr key={ext.id} className='border-b border-gray-100 last:border-b-0'>
                        <td className='py-2.5 pr-3 text-gray-700 font-medium'>{idx + 1}차</td>
                        <td className='py-2.5 pr-3 text-gray-700'>
                          {ext.paidAt.toLocaleDateString('ko-KR')}
                        </td>
                        <td className='py-2.5 pr-3 text-gray-700'>{ext.weeks}주</td>
                        <td className='py-2.5 pr-3 text-right text-gray-800 font-semibold'>
                          {ext.amount.toLocaleString()}원
                        </td>
                        <td className='py-2.5 pr-3 text-gray-600 text-xs'>
                          {ext.periodStart.toLocaleDateString('ko-KR')} ~{' '}
                          {ext.periodEnd.toLocaleDateString('ko-KR')}
                        </td>
                        <td className='py-2.5'>
                          {ext.receiptUrl ? (
                            <a
                              href={ext.receiptUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs'
                            >
                              <ExternalLink size={12} /> 보기
                            </a>
                          ) : (
                            <span className='text-gray-400 text-xs'>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 광고 내용 */}
        {ad.content && (
          <Card>
            <CardHeader><CardTitle>광고 내용</CardTitle></CardHeader>
            <CardContent>
              <p className='text-sm text-gray-700 whitespace-pre-wrap'>{ad.content}</p>
            </CardContent>
          </Card>
        )}

        {/* 이미지 */}
        {ad.imageUrls.length > 0 && (
          <Card>
            <CardHeader><CardTitle>이미지</CardTitle></CardHeader>
            <CardContent>
              <div className='grid grid-cols-3 gap-3'>
                {ad.imageUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`이미지 ${i + 1}`}
                    className='w-full aspect-video object-cover rounded-lg border'
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 수정 심사 중: 현재 vs 변경 예정 비교 */}
        {ad.modificationStatus === 'pending' && ad.pendingChanges && (
          <Card className='border-purple-200'>
            <CardHeader>
              <CardTitle className='text-purple-700'>수정 신청 내용 (현재 → 변경 예정)</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {Object.entries(ad.pendingChanges).map(([key, pendingValue]) => {
                const label = FIELD_LABELS[key] ?? key;
                const currentValue = (ad as Record<string, unknown>)[key];
                const isChanged = JSON.stringify(currentValue) !== JSON.stringify(pendingValue);

                return (
                  <div key={key} className='space-y-1.5'>
                    <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>{label}</p>
                    {key === 'imageUrls' ? (
                      <div className='grid grid-cols-2 gap-3'>
                        <ImageDiffBox
                          label='현재'
                          urls={(currentValue as string[]) ?? []}
                          isChanged={isChanged}
                          variant='current'
                        />
                        <ImageDiffBox
                          label='변경'
                          urls={(pendingValue as string[]) ?? []}
                          isChanged={isChanged}
                          variant='pending'
                        />
                      </div>
                    ) : (
                      <div className='grid grid-cols-2 gap-3'>
                        <DiffBox
                          label='현재'
                          value={currentValue as string | null}
                          isChanged={isChanged}
                          variant='current'
                        />
                        <DiffBox
                          label='변경'
                          value={pendingValue as string | null}
                          isChanged={isChanged}
                          variant='pending'
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 수정 승인 / 거절 버튼 */}
              <div className='flex gap-2 pt-2 border-t border-purple-100'>
                <Button
                  size='sm'
                  onClick={handleApproveModification}
                  disabled={isProcessing}
                  className='bg-purple-600 hover:bg-purple-700'
                >
                  <Check size={14} className='mr-1' /> 수정 승인
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setRejectModOpen(true)}
                  disabled={isProcessing}
                  className='border-red-300 text-red-600 hover:bg-red-50'
                >
                  <X size={14} className='mr-1' /> 수정 거절
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 액션 버튼 (pending 상태일 때만) */}
        {ad.status === 'pending' && (
          <div className='flex gap-3'>
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className='bg-green-600 hover:bg-green-700 gap-1'
            >
              <Check size={16} /> 승인
            </Button>
            <Button
              variant='destructive'
              onClick={() => setRejectOpen(true)}
              disabled={isProcessing}
              className='gap-1'
            >
              <X size={16} /> 거절
            </Button>
          </div>
        )}
      </main>

      {/* 거절 다이얼로그 */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프리미엄 광고 거절</DialogTitle>
            <DialogDescription>파트너에게 전달될 거절 사유를 입력해주세요.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder='거절 사유를 입력하세요'
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectOpen(false)}>취소</Button>
            <Button
              variant='destructive'
              onClick={handleReject}
              disabled={isProcessing || !rejectReason.trim()}
            >
              거절 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 거절 다이얼로그 */}
      <Dialog open={rejectModOpen} onOpenChange={setRejectModOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수정 심사 거절</DialogTitle>
            <DialogDescription>수정 요청을 거절하는 사유를 입력해주세요.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder='거절 사유를 입력하세요'
            value={rejectModReason}
            onChange={e => setRejectModReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectModOpen(false)}>취소</Button>
            <Button
              variant='destructive'
              onClick={handleRejectModification}
              disabled={isProcessing || !rejectModReason.trim()}
            >
              거절 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, isRed = false }: { label: string; value: ReactNode; isRed?: boolean }) {
  return (
    <div className='flex gap-3'>
      <span className='text-gray-500 w-28 shrink-0'>{label}</span>
      <span className={isRed ? 'text-red-600' : 'text-gray-800'}>{value}</span>
    </div>
  );
}

function DiffBox({
  label,
  value,
  isChanged,
  variant,
}: {
  label: string;
  value: string | null;
  isChanged: boolean;
  variant: 'current' | 'pending';
}) {
  const colors = isChanged
    ? variant === 'current'
      ? 'bg-red-50 border-red-200'
      : 'bg-green-50 border-green-200'
    : 'bg-gray-50 border-gray-200';

  const labelColors = isChanged
    ? variant === 'current'
      ? 'bg-red-100 text-red-700'
      : 'bg-green-100 text-green-700'
    : 'bg-gray-200 text-gray-600';

  return (
    <div className={`rounded-lg border p-3 ${colors}`}>
      <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded mb-2 ${labelColors}`}>
        {label}
      </span>
      <p className='text-sm text-gray-800 whitespace-pre-wrap break-all'>
        {value ?? <span className='text-gray-400 italic'>(없음)</span>}
      </p>
    </div>
  );
}

function ImageDiffBox({
  label,
  urls,
  isChanged,
  variant,
}: {
  label: string;
  urls: string[];
  isChanged: boolean;
  variant: 'current' | 'pending';
}) {
  const colors = isChanged
    ? variant === 'current'
      ? 'bg-red-50 border-red-200'
      : 'bg-green-50 border-green-200'
    : 'bg-gray-50 border-gray-200';

  const labelColors = isChanged
    ? variant === 'current'
      ? 'bg-red-100 text-red-700'
      : 'bg-green-100 text-green-700'
    : 'bg-gray-200 text-gray-600';

  return (
    <div className={`rounded-lg border p-3 ${colors}`}>
      <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded mb-2 ${labelColors}`}>
        {label}
      </span>
      {urls.length === 0 ? (
        <p className='text-sm text-gray-400 italic'>(없음)</p>
      ) : (
        <div className='grid grid-cols-2 gap-1.5'>
          {urls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`이미지 ${i + 1}`}
              className='w-full aspect-square object-cover rounded'
            />
          ))}
        </div>
      )}
    </div>
  );
}
