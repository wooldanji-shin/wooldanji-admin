'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface BusinessNameRow {
  id: string;
  businessName: string;
  partnerUserId: string | null;
  createdAt: string;
}

export interface UseBusinessNamesPageReturn {
  rows: BusinessNameRow[];
  loading: boolean;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  searchInput: string;
  handleSearch: (value: string) => void;
  handlePageChange: (page: number) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (value: string) => void;
  saving: boolean;
  startEdit: (row: BusinessNameRow) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  deleteTarget: BusinessNameRow | null;
  setDeleteTarget: (row: BusinessNameRow | null) => void;
  deleting: boolean;
  confirmDelete: () => Promise<void>;
}

const ITEMS_PER_PAGE = 20;
// 상호명 UNIQUE 위반 시 트리거가 던지는 커스텀 SQLSTATE. 문자열 매칭 금지 — 코드로만 분기.
const DUPLICATE_BUSINESS_NAME_ERROR_CODE = 'YB001';

export function useBusinessNamesPage(): UseBusinessNamesPageReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const debounceTimer = useRef<NodeJS.Timeout>(null);

  const searchQuery = searchParams.get('search') ?? '';
  const currentPage = parseInt(searchParams.get('page') ?? '1');

  const [rows, setRows] = useState<BusinessNameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BusinessNameRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('business_names')
        .select('id, businessName, partnerUserId, createdAt', { count: 'exact' });

      if (searchQuery) {
        query = query.ilike('businessName', `%${searchQuery}%`);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const { data, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, from + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      setRows((data as BusinessNameRow[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('상호명 목록 로드 실패:', err);
      toast.error('상호명 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage, supabase]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const updateSearchParams = (params: Record<string, string>): void => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(params).forEach(([key, value]) => {
      if (value) current.set(key, value);
      else current.delete(key);
    });
    const qs = current.toString();
    router.push(`/admin/business-names${qs ? `?${qs}` : ''}`);
  };

  const handleSearch = (value: string): void => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateSearchParams({ search: value, page: '1' });
    }, 500);
  };

  const handlePageChange = (page: number): void => {
    updateSearchParams({ page: page.toString() });
  };

  const startEdit = (row: BusinessNameRow): void => {
    setEditingId(row.id);
    setEditingName(row.businessName);
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setEditingName('');
  };

  // 상호명 수정: 상태(사용중/탈퇴) 무관하게 admin_update_business_name RPC 하나로 처리한다.
  // 사용중 행은 RPC 내부에서 partner_users를 UPDATE(트리거가 business_names를 동기화),
  // 탈퇴 행은 RPC 내부에서 business_names를 직접 UPDATE — 어느 경로든 여기서는 신경 쓸 필요 없다.
  const saveEdit = async (): Promise<void> => {
    const row = rows.find((r) => r.id === editingId);
    const name = editingName.trim();
    if (!row || !name) return;

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('admin_update_business_name', {
        p_business_name_id: row.id,
        p_new_name: name,
      });

      if (error) {
        if (error.code === DUPLICATE_BUSINESS_NAME_ERROR_CODE) {
          toast.error('이미 사용 중인 상호명입니다.');
        } else {
          console.error('상호명 수정 실패:', error);
          toast.error('상호명 수정에 실패했습니다.');
        }
        return;
      }

      toast.success('상호명을 수정했습니다.');
      cancelEdit();
      await fetchRows();
    } finally {
      setSaving(false);
    }
  };

  // 상호명 삭제: 상태 무관하게 business_names에서 DELETE한다. 사용중 행을 삭제해도
  // partner_users.businessName은 그대로 남는다 — 레지스트리 기록만 사라져 재사용이 풀린다는 점을
  // 확인 다이얼로그에서 안내한다(정책상 허용된 동작).
  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from('business_names')
        .delete()
        .eq('id', deleteTarget.id)
        .select('id');

      if (error) {
        console.error('상호명 삭제 실패:', error);
        toast.error('상호명 삭제에 실패했습니다.');
        return;
      }

      if (!data || data.length === 0) {
        toast.error('이미 다른 관리자가 삭제했습니다.');
        await fetchRows();
        return;
      }

      toast.success('상호명을 삭제했습니다.');
      setDeleteTarget(null);
      await fetchRows();
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return {
    rows,
    loading,
    totalCount,
    totalPages,
    currentPage,
    searchInput,
    handleSearch,
    handlePageChange,
    editingId,
    editingName,
    setEditingName,
    saving,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteTarget,
    setDeleteTarget,
    deleting,
    confirmDelete,
  };
}
