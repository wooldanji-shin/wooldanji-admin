'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export type EventParticipationType = 'draw' | 'first_come';
export type EventStatus = 'pending' | 'approved' | 'rejected' | 'ended';
export type EventStatusFilter = 'all' | EventStatus;

export interface PartnerEventListItem {
  id: string;
  title: string;
  participationType: EventParticipationType;
  winnerCount: number;
  status: EventStatus;
  businessName: string;
  apartmentNames: string[];
  entryCount: number;
  entryStartAt: string;
  entryEndAt: string;
  announceAt: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

export const PARTICIPATION_TYPE_LABEL: Record<EventParticipationType, string> = {
  draw: '추첨',
  first_come: '선착순',
};

export interface UsePartnerEventsPageReturn {
  loading: boolean;
  statusFilter: EventStatusFilter;
  setStatusFilter: (v: EventStatusFilter) => void;
  statusCounts: Record<EventStatusFilter, number>;
  paginatedEvents: PartnerEventListItem[];
  page: number;
  setPage: (page: number) => void;
  totalCount: number;
  handleRowClick: (id: string) => void;
}

export function usePartnerEventsPage(): UsePartnerEventsPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [events, setEvents] = useState<PartnerEventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  // 관리자가 이 페이지에 들어와서 가장 먼저 할 일은 승인이므로 기본 필터를 승인대기로 둔다
  const [statusFilter, setStatusFilterRaw] = useState<EventStatusFilter>('pending');
  const [page, setPageRaw] = useState(1);

  const setPage = useCallback((p: number) => setPageRaw(p), []);
  const setStatusFilter = useCallback((v: EventStatusFilter) => {
    setStatusFilterRaw(v);
    setPageRaw(1);
  }, []);

  const fetchEvents = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('partner_events')
        .select(`
          id,
          title,
          participationType,
          winnerCount,
          status,
          entryStartAt,
          entryEndAt,
          announceAt,
          createdAt,
          partner_users:partnerUserId(businessName),
          partner_event_apartments(apartments:apartmentId(name)),
          partner_event_entries(count)
        `)
        .order('createdAt', { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: PartnerEventListItem[] = (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        participationType: row.participationType,
        winnerCount: row.winnerCount,
        status: row.status,
        businessName: row.partner_users?.businessName ?? '-',
        apartmentNames: (row.partner_event_apartments ?? [])
          .map((a: any) => a.apartments?.name)
          .filter(Boolean),
        entryCount: row.partner_event_entries?.[0]?.count ?? 0,
        entryStartAt: row.entryStartAt,
        entryEndAt: row.entryEndAt,
        announceAt: row.announceAt,
        createdAt: row.createdAt,
      }));

      setEvents(mapped);
    } catch (err) {
      console.error('Failed to fetch partner events:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const statusCounts = useMemo<Record<EventStatusFilter, number>>(() => ({
    all: events.length,
    pending: events.filter((e) => e.status === 'pending').length,
    approved: events.filter((e) => e.status === 'approved').length,
    rejected: events.filter((e) => e.status === 'rejected').length,
    ended: events.filter((e) => e.status === 'ended').length,
  }), [events]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return events;
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  const paginatedEvents = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const handleRowClick = useCallback((id: string) => {
    router.push(`/admin/partner-events/${id}`);
  }, [router]);

  return {
    loading,
    statusFilter,
    setStatusFilter,
    statusCounts,
    paginatedEvents,
    page,
    setPage,
    totalCount: filtered.length,
    handleRowClick,
  };
}
