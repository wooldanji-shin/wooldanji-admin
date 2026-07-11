'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { exportToCsv } from '@/lib/utils/csv';
import type {
  PartnerOption,
  SettlementPayment,
  SettlementPaymentType,
  SettlementSummary,
  StatusFilter,
  TypeFilter,
} from './types';

const PAGE_SIZE = 20;

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function threeMonthsAgo(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 3);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // month은 1~12, day 0 = 전달의 마지막 날
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recentMonthOptions(count: number): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` };
  });
}

function toUtcRange(dateFrom: string, dateTo: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: new Date(`${dateFrom}T00:00:00`).toISOString(),
    toUtc: new Date(`${dateTo}T23:59:59`).toISOString(),
  };
}

function previousPeriod(dateFrom: string, dateTo: string): { fromUtc: string; toUtc: string } {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T23:59:59`);
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { fromUtc: prevFrom.toISOString(), toUtc: prevTo.toISOString() };
}

const isSuccessStatus = (status: string): boolean => status === 'paid' || status === 'success';

function mapPaymentType(raw: string | null): SettlementPaymentType {
  if (raw === 'extension') return 'extension';
  if (raw === 'premium') return 'premium';
  return 'basic';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): SettlementPayment {
  // 기본광고 정기결제(paymentType null)는 ad_payment_history_v2.partnerId 자체가 비어있고
  // subscriptionId -> ad_subscriptions_v2 -> advertisements_v2.partnerId 로만 연결된다.
  const subscriptionAd = row.ad_subscriptions_v2?.advertisements_v2;
  const partnerUsers = row.partner_users ?? subscriptionAd?.partner_users ?? null;

  return {
    id: row.id,
    partnerId: row.partnerId ?? subscriptionAd?.partnerId ?? null,
    partnerBusinessName: partnerUsers?.businessName ?? null,
    representativeName: partnerUsers?.representativeName ?? null,
    businessRegistrationNumber: partnerUsers?.businessRegistrationNumber ?? null,
    subscriptionId: row.subscriptionId ?? null,
    premiumAdId: row.premiumAdId ?? null,
    paymentType: mapPaymentType(row.paymentType),
    adTitle: row.premiumAdId
      ? (row.premium_advertisements_v2?.title ?? null)
      : (row.ad_subscriptions_v2?.advertisements_v2?.title ?? null),
    supplyAmount: row.supplyAmount,
    vatAmount: row.vatAmount,
    amount: row.amount,
    paymentDate: row.paymentDate,
    billingPeriodStart: row.billingPeriodStart ?? null,
    billingPeriodEnd: row.billingPeriodEnd ?? null,
    status: row.status,
    receiptUrl: row.receiptUrl ?? null,
    failReason: row.failReason ?? null,
    orderId: row.orderId ?? null,
  };
}

function computeSummary(
  payments: SettlementPayment[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prev: { amount: number; status: string }[]
): SettlementSummary {
  const totalRevenue = payments
    .filter((p) => isSuccessStatus(p.status))
    .reduce((sum, p) => sum + p.amount, 0);
  const successCount = payments.filter((p) => isSuccessStatus(p.status)).length;
  const failedCount = payments.filter((p) => p.status === 'failed').length;
  const premiumRevenue = payments
    .filter((p) => isSuccessStatus(p.status) && (p.paymentType === 'premium' || p.paymentType === 'extension'))
    .reduce((sum, p) => sum + p.amount, 0);

  const prevRevenue = prev.filter((p) => isSuccessStatus(p.status)).reduce((sum, p) => sum + p.amount, 0);
  const prevSuccessCount = prev.filter((p) => isSuccessStatus(p.status)).length;

  return {
    totalRevenue,
    totalRevenueDeltaPct: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null,
    successCount,
    successCountDeltaPct: prevSuccessCount > 0 ? ((successCount - prevSuccessCount) / prevSuccessCount) * 100 : null,
    failedCount,
    premiumRevenueRatioPct: totalRevenue > 0 ? (premiumRevenue / totalRevenue) * 100 : 0,
  };
}

const PAYMENT_TYPE_LABEL: Record<SettlementPaymentType, string> = {
  basic: '기본광고',
  premium: '프리미엄 최초',
  extension: '프리미엄 연장',
};

const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  success: '결제완료',
  freeTrial: '무료체험',
  failed: '결제실패',
};

export interface UseSettlementPageReturn {
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  dateFromDraft: string;
  dateToDraft: string;
  setDateFromDraft: (v: string) => void;
  setDateToDraft: (v: string) => void;
  applyDateRange: () => void;
  monthOptions: { value: string; label: string }[];
  applyMonth: (monthValue: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (v: TypeFilter) => void;
  partnerFilter: string | null;
  setPartnerFilter: (id: string | null) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  allPartners: PartnerOption[];
  summary: SettlementSummary;
  paginatedPayments: SettlementPayment[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  filteredCount: number;
  handleExportCsv: () => void;
}

export function useSettlementPage(): UseSettlementPageReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<SettlementPayment[]>([]);
  const [prevPayments, setPrevPayments] = useState<{ amount: number; status: string }[]>([]);
  const [allPartners, setAllPartners] = useState<PartnerOption[]>([]);

  // dateFrom/dateTo: 실제 조회를 트리거하는 확정 값. dateFromDraft/dateToDraft: 달력에서 아직 선택 중인 값 —
  // 날짜를 고를 때마다 바로 조회되지 않도록, 확정 값은 applyDateRange() 호출 시에만 갱신한다.
  const [dateFrom, _setDateFrom] = useState(threeMonthsAgo);
  const [dateTo, _setDateTo] = useState(todayLocalDate);
  const [dateFromDraft, setDateFromDraft] = useState(threeMonthsAgo);
  const [dateToDraft, setDateToDraft] = useState(todayLocalDate);
  const [statusFilter, _setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, _setTypeFilter] = useState<TypeFilter>('all');
  const [partnerFilter, _setPartnerFilter] = useState<string | null>(null);
  const [searchTerm, _setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  const page = useMemo(() => {
    const p = parseInt(searchParams.get('page') ?? '1');
    return isNaN(p) || p < 1 ? 1 : p;
  }, [searchParams]);

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(p));
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams]
  );

  const setStatusFilter = useCallback((v: StatusFilter) => { _setStatusFilter(v); setPage(1); }, [setPage]);
  const setTypeFilter = useCallback((v: TypeFilter) => { _setTypeFilter(v); setPage(1); }, [setPage]);
  const setPartnerFilter = useCallback((v: string | null) => { _setPartnerFilter(v); setPage(1); }, [setPage]);
  const setSearchTerm = useCallback((v: string) => { _setSearchTerm(v); setPage(1); }, [setPage]);

  const applyDateRange = useCallback(() => {
    _setDateFrom(dateFromDraft);
    _setDateTo(dateToDraft);
    setPage(1);
  }, [dateFromDraft, dateToDraft, setPage]);

  const monthOptions = useMemo(() => recentMonthOptions(12), []);

  const applyMonth = useCallback(
    (monthValue: string) => {
      const [year, month] = monthValue.split('-').map(Number);
      const from = `${monthValue}-01`;
      const lastDay = lastDayOfMonth(year, month);
      const today = todayLocalDate();
      const to = lastDay > today ? today : lastDay;
      setDateFromDraft(from);
      setDateToDraft(to);
      _setDateFrom(from);
      _setDateTo(to);
      setPage(1);
    },
    [setPage]
  );

  const fetchPartners = useCallback(async () => {
    const { data } = await supabase
      .from('partner_users')
      .select('id, businessName')
      .order('businessName');
    setAllPartners((data ?? []) as PartnerOption[]);
  }, [supabase]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { fromUtc, toUtc } = toUtcRange(dateFrom, dateTo);

      const { data, error } = await supabase
        .from('ad_payment_history_v2')
        .select(`
          id,
          partnerId,
          subscriptionId,
          premiumAdId,
          paymentType,
          supplyAmount,
          vatAmount,
          amount,
          paymentDate,
          billingPeriodStart,
          billingPeriodEnd,
          status,
          receiptUrl,
          failReason,
          orderId,
          partner_users:partnerId(id, businessName, representativeName, businessRegistrationNumber),
          ad_subscriptions_v2:subscriptionId(
            advertisementId,
            advertisements_v2:advertisementId(
              title,
              partnerId,
              partner_users:partnerId(id, businessName, representativeName, businessRegistrationNumber)
            )
          ),
          premium_advertisements_v2:premiumAdId(title)
        `)
        .gte('paymentDate', fromUtc)
        .lte('paymentDate', toUtc)
        .order('paymentDate', { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPayments((data ?? []).map((row: any) => mapRow(row)));

      const { fromUtc: prevFromUtc, toUtc: prevToUtc } = previousPeriod(dateFrom, dateTo);
      const { data: prevData } = await supabase
        .from('ad_payment_history_v2')
        .select('amount, status')
        .gte('paymentDate', prevFromUtc)
        .lte('paymentDate', prevToUtc);
      setPrevPayments((prevData ?? []) as { amount: number; status: string }[]);
    } catch (err) {
      console.error('Failed to fetch settlement payments:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filtered = useMemo(() => {
    let result = payments;

    if (statusFilter !== 'all') {
      result = result.filter((p) =>
        statusFilter === 'success' ? isSuccessStatus(p.status) : p.status === statusFilter
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter((p) => p.paymentType === typeFilter);
    }

    if (partnerFilter) {
      result = result.filter((p) => p.partnerId === partnerFilter);
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.partnerBusinessName?.toLowerCase().includes(term) ||
          p.adTitle?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [payments, statusFilter, typeFilter, partnerFilter, debouncedSearchTerm]);

  const summary = useMemo(() => computeSummary(payments, prevPayments), [payments, prevPayments]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedPayments = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const handleExportCsv = useCallback((): void => {
    exportToCsv(
      `정산내역_${dateFrom}_${dateTo}.csv`,
      filtered,
      [
        { header: '파트너명', accessor: (r: SettlementPayment) => r.partnerBusinessName ?? '-' },
        { header: '대표자명', accessor: (r: SettlementPayment) => r.representativeName ?? '-' },
        { header: '사업자번호', accessor: (r: SettlementPayment) => r.businessRegistrationNumber ?? '-' },
        { header: '결제유형', accessor: (r: SettlementPayment) => PAYMENT_TYPE_LABEL[r.paymentType] },
        { header: '광고명', accessor: (r: SettlementPayment) => r.adTitle ?? '-' },
        { header: '공급가액', accessor: (r: SettlementPayment) => r.supplyAmount },
        { header: '부가세', accessor: (r: SettlementPayment) => r.vatAmount },
        { header: '합계금액', accessor: (r: SettlementPayment) => r.amount },
        { header: '결제일', accessor: (r: SettlementPayment) => new Date(r.paymentDate).toLocaleDateString('ko-KR') },
        {
          header: '청구시작일',
          accessor: (r: SettlementPayment) => (r.billingPeriodStart ? new Date(r.billingPeriodStart).toLocaleDateString('ko-KR') : '-'),
        },
        {
          header: '청구종료일',
          accessor: (r: SettlementPayment) => (r.billingPeriodEnd ? new Date(r.billingPeriodEnd).toLocaleDateString('ko-KR') : '-'),
        },
        { header: '상태', accessor: (r: SettlementPayment) => SETTLEMENT_STATUS_LABEL[r.status] ?? r.status },
        { header: '실패사유', accessor: (r: SettlementPayment) => r.failReason ?? '-' },
        { header: '주문번호', accessor: (r: SettlementPayment) => r.orderId ?? '-' },
      ]
    );
  }, [filtered, dateFrom, dateTo]);

  return {
    loading,
    dateFrom,
    dateTo,
    dateFromDraft,
    dateToDraft,
    setDateFromDraft,
    setDateToDraft,
    applyDateRange,
    monthOptions,
    applyMonth,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    partnerFilter,
    setPartnerFilter,
    searchTerm,
    setSearchTerm,
    allPartners,
    summary,
    paginatedPayments,
    page,
    setPage,
    totalPages,
    filteredCount: filtered.length,
    handleExportCsv,
  };
}
