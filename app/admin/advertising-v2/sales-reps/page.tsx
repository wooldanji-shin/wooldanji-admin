'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { PageShell, PageHeader, PageHeaderTitle } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import type { SalesRep } from '@/lib/ads/sales-reps';

interface SalesRepRow extends SalesRep {
  /** 이 담당자로 승인된 광고 수 — 삭제 시 영향 범위를 보여준다 */
  adCount: number;
}

export default function SalesRepsPage() {
  // lib/supabase/types.ts의 Database 형태가 현재 클라이언트 버전과 맞지 않아
  // 모든 테이블이 never로 추론된다(레포 전반의 기존 타입 에러와 같은 원인).
  // 레포 전체를 고치는 건 별도 작업이라 여기서만 스키마 타입을 벗겨 쓴다.
  const supabase = createClient() as unknown as SupabaseClient;

  const [reps, setReps] = useState<SalesRepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SalesRepRow | null>(null);
  const [processing, setProcessing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchReps = useCallback(async () => {
    const [repRes, adRes, premiumRes] = await Promise.all([
      supabase
        .from('sales_reps')
        .select('id, name, isActive, createdAt')
        .order('name'),
      supabase.from('advertisements_v2').select('salesRepId').not('salesRepId', 'is', null),
      supabase
        .from('premium_advertisements_v2')
        .select('salesRepId')
        .not('salesRepId', 'is', null),
    ]);

    const counts = new Map<string, number>();
    for (const row of [...(adRes.data ?? []), ...(premiumRes.data ?? [])] as any[]) {
      counts.set(row.salesRepId, (counts.get(row.salesRepId) ?? 0) + 1);
    }

    setReps(
      ((repRes.data ?? []) as SalesRep[]).map((rep) => ({
        ...rep,
        adCount: counts.get(rep.id) ?? 0,
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchReps().catch(() => {
      toast.error('영업 담당자를 불러오지 못했습니다.');
      setLoading(false);
    });
  }, [fetchReps]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    setProcessing(true);
    const { error } = await supabase.from('sales_reps').insert({ name });
    setProcessing(false);

    if (error) {
      toast.error('추가에 실패했습니다.');
      return;
    }
    setNewName('');
    toast.success('영업 담당자를 추가했습니다.');
    await fetchReps();
  };

  const handleRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;

    setProcessing(true);
    setSavingName(true);
    let error;
    try {
      ({ error } = await supabase
        .from('sales_reps')
        .update({ name, updatedAt: new Date().toISOString() })
        .eq('id', id));
    } finally {
      setProcessing(false);
      setSavingName(false);
    }

    if (error) {
      toast.error('수정에 실패했습니다.');
      return;
    }
    setEditingId(null);
    toast.success('이름을 수정했습니다.');
    await fetchReps();
  };

  const handleToggleActive = async (rep: SalesRepRow): Promise<void> => {
    setTogglingId(rep.id);
    try {
      const { error } = await supabase
        .from('sales_reps')
        .update({ isActive: !rep.isActive, updatedAt: new Date().toISOString() })
        .eq('id', rep.id);

      if (error) {
        toast.error('상태 변경에 실패했습니다.');
        return;
      }
      await fetchReps();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setProcessing(true);
    const { error } = await supabase.from('sales_reps').delete().eq('id', deleteTarget.id);
    setProcessing(false);
    setDeleteTarget(null);

    if (error) {
      toast.error('삭제에 실패했습니다.');
      return;
    }
    toast.success('영업 담당자를 삭제했습니다.');
    await fetchReps();
  };

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="영업 담당자 관리"
          description="광고 승인 시 지정할 영업 담당자를 관리합니다."
        />
      </PageHeader>

      <Paper withBorder radius="md" p="lg">
        <Group gap="xs" wrap="nowrap">
          <TextInput
            w="100%"
            maw={320}
            placeholder="담당자 이름"
            value={newName}
            disabled={processing}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            onClick={handleAdd}
            disabled={processing || !newName.trim()}
            leftSection={<Plus size={16} />}
          >
            추가
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="lg">
        {loading ? (
          <TableSkeleton rows={8} columns={4} />
        ) : reps.length === 0 ? (
          <EmptyState
            title="등록된 영업 담당자가 없습니다"
            description="위에서 이름을 입력해 추가해주세요."
          />
        ) : (
          <Table.ScrollContainer minWidth={560} type="native">
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>이름</Table.Th>
                  <Table.Th w={128}>담당 광고</Table.Th>
                  <Table.Th w={128}>활성</Table.Th>
                  <Table.Th w={128} ta="right">
                    관리
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reps.map((rep) => (
                  <Table.Tr key={rep.id}>
                    <Table.Td>
                      {editingId === rep.id ? (
                        <Group gap="xs" wrap="nowrap">
                          <TextInput
                            maw={320}
                            style={{ flex: 1 }}
                            value={editingName}
                            autoFocus
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !savingName && handleRename(rep.id)}
                          />
                          <Button size="xs" onClick={() => handleRename(rep.id)} disabled={savingName}>
                            {savingName ? '저장 중...' : '저장'}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => setEditingId(null)}
                          >
                            취소
                          </Button>
                        </Group>
                      ) : (
                        <Text size="sm" fw={500}>
                          {rep.name}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {rep.adCount > 0 ? (
                        <Badge variant="light" color="gray">
                          {rep.adCount}건
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={rep.isActive}
                        disabled={togglingId === rep.id}
                        onChange={() => handleToggleActive(rep)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label="이름 수정"
                          onClick={() => {
                            setEditingId(rep.id);
                            setEditingName(rep.name);
                          }}
                        >
                          <Pencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="삭제"
                          onClick={() => setDeleteTarget(rep)}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <Text size="xs" c="dimmed" mt="md">
          비활성으로 두면 승인 화면의 선택 목록에서만 빠지고, 이미 담당으로 지정된 광고는
          그대로 유지됩니다. 퇴사자는 삭제 대신 비활성을 권합니다.
        </Text>
      </Paper>

      <Modal
        closeOnClickOutside={false}
        withCloseButton={false}
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="영업 담당자 삭제"
      >
        <Text size="sm" c="dimmed">
          {deleteTarget?.name}님을 삭제할까요?
          {(deleteTarget?.adCount ?? 0) > 0 && (
            <>
              {' '}
              담당 광고 {deleteTarget?.adCount}건의 담당자 정보가 비워집니다. 실적 기록을
              남기려면 삭제 대신 비활성으로 바꿔주세요.
            </>
          )}
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>
            취소
          </Button>
          {/* AlertDialogAction과 동일하게 클릭 즉시 다이얼로그를 닫는다 */}
          <Button
            color="red"
            disabled={processing}
            onClick={() => {
              handleDelete();
              setDeleteTarget(null);
            }}
          >
            삭제
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
