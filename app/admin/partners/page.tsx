'use client';

import { Suspense } from 'react';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePartnersPage } from './usePartnersPage';

function PartnersContent(): React.ReactElement {
  const page = usePartnersPage();
  const { handleToggleAnalytics } = page;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="파트너 회원 관리"
          description="등록된 파트너 회원 정보를 검색하고 관리합니다."
        />
      </PageHeader>

      <PageContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full max-w-2xl">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="상호명, 대표자명, 전화번호, 사업자번호 검색..."
                value={page.searchInput}
                onChange={(e) => page.handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={page.categoryFilter ?? 'all'}
              onValueChange={(value) =>
                page.handleCategoryFilterChange(value === 'all' ? null : value)
              }
            >
              <SelectTrigger className="w-[140px] shrink-0">
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 카테고리</SelectItem>
                {page.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {page.categoryFilter && page.subCategories.length > 0 && (
              <Select
                value={page.subCategoryFilter ?? 'all'}
                onValueChange={(value) =>
                  page.handleSubCategoryFilterChange(value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue placeholder="서브카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 서브카테고리</SelectItem>
                  {page.subCategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.subCategoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            전체 {page.totalCount.toLocaleString()}명
          </span>
        </div>

        <DataTableShell>
          {page.loading ? (
            <TableSkeleton rows={8} columns={9} />
          ) : page.partners.length === 0 ? (
            <EmptyState
              icon={Users}
              title="파트너 회원이 없습니다"
              description="검색 조건을 변경하거나 새 파트너가 가입할 때까지 기다려 주세요."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상호명</TableHead>
                  <TableHead>대표자명</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>노출수/클릭수</TableHead>
                  <TableHead>광고 이력</TableHead>
                  <TableHead>분석 권한</TableHead>
                  <TableHead>가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.partners.map((partner) => (
                  <TableRow
                    key={partner.id}
                    className="cursor-pointer"
                    onClick={() => page.handleRowClick(partner.id)}
                  >
                    <TableCell className="font-medium">{partner.businessName}</TableCell>
                    <TableCell>{partner.representativeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {partner.categoryNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {partner.categoryNames.map((name) => (
                            <Badge key={name} variant="outline">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[160px] truncate">
                      {partner.businessAddress ?? '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {partner.phoneNumber ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {partner.totalImpressionCount.toLocaleString()} / {partner.totalClickCount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {partner.hasHadRunningAd ? (
                        <Badge variant="secondary">광고 이력 있음</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">없음</span>
                      )}
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={partner.analyticsEnabled}
                        onCheckedChange={() =>
                          handleToggleAnalytics(partner.id, partner.analyticsEnabled)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(partner.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                  </TableRow>
                ))}
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
    </PageShell>
  );
}

export default function PartnersPage(): React.ReactElement {
  return (
    <Suspense>
      <PartnersContent />
    </Suspense>
  );
}
