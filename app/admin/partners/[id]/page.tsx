'use client';

import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Phone,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/admin-header';
import { StatusBadge, type AdStatus } from '@/components/status-badge';
import { usePartnerDetailPage } from './usePartnerDetailPage';

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="pt-0.5 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const page = usePartnerDetailPage(params);

  if (page.loading) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title="파트너 상세" />
        <div className="flex w-full items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-base">불러오는 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!page.partner) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title="파트너 상세" />
        <div className="flex w-full items-center justify-center py-20">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <span className="text-base">파트너 정보를 찾을 수 없습니다.</span>
          </div>
        </div>
      </div>
    );
  }

  const { partner, adHistory } = page;

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={page.handleBack} aria-label="뒤로가기">
          <ChevronLeft className="size-7" />
        </Button>
        <AdminHeader title="파트너 상세" className="flex-1" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── 좌측 ── */}
        <div className="space-y-5">
          {/* 기본 정보 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <User className="h-4 w-4 text-muted-foreground" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-0 pb-4">
              <InfoRow label="상호명">{partner.businessName}</InfoRow>
              <InfoRow label="대표자명">{partner.representativeName}</InfoRow>
              <InfoRow label="카테고리">{partner.categoryName ?? '-'}</InfoRow>
              <InfoRow label="광고표시용 전화">
                {partner.displayPhoneNumber ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {partner.displayPhoneNumber}
                  </span>
                ) : (
                  '-'
                )}
              </InfoRow>
              <InfoRow label="연락처">
                {partner.phoneNumber ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {partner.phoneNumber}
                  </span>
                ) : (
                  '-'
                )}
              </InfoRow>
              <InfoRow label="가입일">
                {new Date(partner.createdAt).toLocaleDateString('ko-KR')}
              </InfoRow>
              <InfoRow label="마케팅 동의">
                {partner.marketingAgreed ? (
                  <Badge variant="secondary">동의</Badge>
                ) : (
                  <span className="text-muted-foreground">미동의</span>
                )}
              </InfoRow>
            </CardContent>
          </Card>

          {/* 사업자 정보 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                사업자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-0 pb-4">
              <InfoRow label="사업자등록번호">
                {partner.businessRegistrationNumber ?? '-'}
              </InfoRow>
              <InfoRow label="사업장 주소">
                {partner.businessAddress ? (
                  <span>
                    {partner.businessAddress}
                    {partner.businessDetailAddress && (
                      <span className="text-muted-foreground">
                        {' '}
                        {partner.businessDetailAddress}
                      </span>
                    )}
                  </span>
                ) : (
                  '-'
                )}
              </InfoRow>
              <InfoRow label="영업시간">{partner.businessHoursNote ?? '-'}</InfoRow>
              <InfoRow label="주차 정보">{partner.parkingInfo ?? '-'}</InfoRow>
              {partner.businessRegistrationImageUrl && (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    사업자등록증
                  </p>
                  <a
                    href={partner.businessRegistrationImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    이미지 보기
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 광고 이력 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                광고 신청 이력
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {adHistory.length}건
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {adHistory.length === 0 ? (
                <p className="px-6 pb-5 text-sm text-muted-foreground">
                  광고 신청 이력이 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>광고 제목</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead>광고 상태</TableHead>
                      <TableHead>신청일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adHistory.map((ad) => (
                      <TableRow
                        key={ad.id}
                        className="cursor-pointer"
                        onClick={() => page.handleAdClick(ad.id)}
                      >
                        <TableCell className="font-medium">
                          {ad.title ?? '(제목 없음)'}
                        </TableCell>
                        <TableCell>
                          {ad.isFirstAdApplication ? (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-blue-700"
                            >
                              첫광고
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">일반</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge.Ad status={ad.adStatus as AdStatus} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ad.submittedAt
                            ? new Date(ad.submittedAt).toLocaleDateString('ko-KR')
                            : new Date(ad.createdAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 우측 요약 ── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 px-6 pb-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">광고 이력</span>
                {partner.hasHadRunningAd ? (
                  <Badge variant="secondary">진행 이력 있음</Badge>
                ) : (
                  <span className="text-muted-foreground">없음</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">총 신청 건수</span>
                <span className="font-medium tabular-nums">{adHistory.length}건</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">진행중</span>
                <span className="font-medium tabular-nums">
                  {adHistory.filter((a) => a.adStatus === 'running').length}건
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">승인 대기</span>
                <span className="font-medium tabular-nums">
                  {adHistory.filter((a) => a.adStatus === 'pending').length}건
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">종료</span>
                <span className="font-medium tabular-nums">
                  {adHistory.filter((a) => a.adStatus === 'ended').length}건
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
