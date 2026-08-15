'use client';

import { Suspense } from 'react';
import { Search, ChevronLeft, ChevronRight, BookText, Pencil, Trash2 } from 'lucide-react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useBusinessNamesPage } from './useBusinessNamesPage';

function BusinessNamesContent(): React.ReactElement {
  const page = useBusinessNamesPage();
  const isDeleteTargetWithdrawn = page.deleteTarget?.partnerUserId === null;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="상호명 관리"
          description="가입/탈퇴한 파트너의 상호명 기록을 검색합니다. 사용중·탈퇴 상태와 무관하게 수정·삭제가 가능합니다."
        />
      </PageHeader>

      <PageContent>
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="상호명 검색..."
              value={page.searchInput}
              onChange={(e) => page.handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            전체 {page.totalCount.toLocaleString()}건
          </span>
        </div>

        <DataTableShell>
          {page.loading ? (
            <TableSkeleton rows={8} columns={4} />
          ) : page.rows.length === 0 ? (
            <EmptyState
              icon={BookText}
              title="상호명 기록이 없습니다"
              description="검색 조건을 변경해 보세요."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상호명</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.rows.map((row) => {
                  const isWithdrawn = row.partnerUserId === null;
                  const isEditing = page.editingId === row.id;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Input
                              className="max-w-xs"
                              value={page.editingName}
                              autoFocus
                              disabled={page.saving}
                              onChange={(e) => page.setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && page.saveEdit()}
                            />
                            <Button size="sm" onClick={page.saveEdit} disabled={page.saving}>
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={page.cancelEdit}
                              disabled={page.saving}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          row.businessName
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isWithdrawn ? 'secondary' : 'default'}>
                          {isWithdrawn ? '탈퇴' : '사용중'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? null : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="수정"
                              onClick={() => page.startEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="삭제"
                              className="text-destructive hover:text-destructive"
                              onClick={() => page.setDeleteTarget(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableShell>

        {page.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => page.handlePageChange(page.currentPage - 1)}
              disabled={page.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(10, page.totalPages) }, (_, i) => {
                let pageNum: number;
                if (page.totalPages <= 10) pageNum = i + 1;
                else if (page.currentPage <= 5) pageNum = i + 1;
                else if (page.currentPage >= page.totalPages - 4) pageNum = page.totalPages - 9 + i;
                else pageNum = page.currentPage - 4 + i;
                return (
                  <Button
                    key={pageNum}
                    variant={page.currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => page.handlePageChange(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => page.handlePageChange(page.currentPage + 1)}
              disabled={page.currentPage === page.totalPages}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </PageContent>

      <AlertDialog
        open={page.deleteTarget !== null}
        onOpenChange={(open) => !open && page.setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDeleteTargetWithdrawn ? '상호명 삭제' : '사용중인 상호명 삭제'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDeleteTargetWithdrawn ? (
                <>
                  &apos;{page.deleteTarget?.businessName}&apos; 상호명 기록을 삭제할까요? 삭제하면
                  이 상호명을 다른 파트너가 다시 등록할 수 있게 됩니다. 되돌릴 수 없습니다.
                </>
              ) : (
                <>
                  &apos;{page.deleteTarget?.businessName}&apos;은(는) 현재 영업 중인 파트너의
                  상호명입니다. 삭제해도 해당 파트너의 상호명은 그대로 유지되지만, 레지스트리
                  기록만 사라져 제3자가 같은 이름으로 가입할 수 있게 됩니다. 정말 삭제하시겠습니까?
                  되돌릴 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={page.deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={page.confirmDelete} disabled={page.deleting}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

export default function BusinessNamesPage(): React.ReactElement {
  return (
    <Suspense>
      <BusinessNamesContent />
    </Suspense>
  );
}
