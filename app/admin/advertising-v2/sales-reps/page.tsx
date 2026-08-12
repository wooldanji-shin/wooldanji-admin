'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageShell, PageHeader, PageHeaderTitle } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
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
    const { error } = await supabase
      .from('sales_reps')
      .update({ name, updatedAt: new Date().toISOString() })
      .eq('id', id);
    setProcessing(false);

    if (error) {
      toast.error('수정에 실패했습니다.');
      return;
    }
    setEditingId(null);
    toast.success('이름을 수정했습니다.');
    await fetchReps();
  };

  const handleToggleActive = async (rep: SalesRepRow) => {
    const { error } = await supabase
      .from('sales_reps')
      .update({ isActive: !rep.isActive, updatedAt: new Date().toISOString() })
      .eq('id', rep.id);

    if (error) {
      toast.error('상태 변경에 실패했습니다.');
      return;
    }
    await fetchReps();
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

      <Card>
        <CardContent className="flex gap-2 pt-6">
          <Input
            className="max-w-xs"
            placeholder="담당자 이름"
            value={newName}
            disabled={processing}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={processing || !newName.trim()}>
            <Plus className="mr-1.5 h-4 w-4" />
            추가
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : reps.length === 0 ? (
            <EmptyState
              title="등록된 영업 담당자가 없습니다"
              description="위에서 이름을 입력해 추가해주세요."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-32">담당 광고</TableHead>
                  <TableHead className="w-32">활성</TableHead>
                  <TableHead className="w-32 text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((rep) => (
                  <TableRow key={rep.id}>
                    <TableCell>
                      {editingId === rep.id ? (
                        <div className="flex gap-2">
                          <Input
                            className="max-w-xs"
                            value={editingName}
                            autoFocus
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename(rep.id)}
                          />
                          <Button size="sm" onClick={() => handleRename(rep.id)}>
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            취소
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium">{rep.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rep.adCount > 0 ? (
                        <Badge variant="outline">{rep.adCount}건</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rep.isActive}
                        onCheckedChange={() => handleToggleActive(rep)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="이름 수정"
                        onClick={() => {
                          setEditingId(rep.id);
                          setEditingName(rep.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="삭제"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(rep)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            비활성으로 두면 승인 화면의 선택 목록에서만 빠지고, 이미 담당으로 지정된 광고는
            그대로 유지됩니다. 퇴사자는 삭제 대신 비활성을 권합니다.
          </p>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>영업 담당자 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name}님을 삭제할까요?
              {(deleteTarget?.adCount ?? 0) > 0 && (
                <>
                  {' '}
                  담당 광고 {deleteTarget?.adCount}건의 담당자 정보가 비워집니다. 실적 기록을
                  남기려면 삭제 대신 비활성으로 바꿔주세요.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={processing}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
