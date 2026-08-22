'use client';

import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Pencil,
  Phone,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BIZ_CALL_DUPLICATE_MESSAGE } from '@/lib/biz-call';
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

/** 편집 모드면 입력창, 아니면 저장된 값을 그대로 보여준다 */
function EditableRow({
  label,
  editing,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <InfoRow label={label}>
      {editing ? (
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        />
      ) : (
        children
      )}
    </InfoRow>
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

  const { partner, adHistory, analyticsToggling, handleToggleAnalytics } = page;
  const { editing, draft, patchDraft, saving, canSave } = page;

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={page.handleBack} aria-label="뒤로가기">
          <ChevronLeft className="size-7" />
        </Button>
        <AdminHeader title="파트너 상세" className="flex-1" />
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={page.cancelEdit} disabled={saving}>
              취소
            </Button>
            <Button onClick={page.handleSave} disabled={!canSave}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={page.startEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            정보 수정
          </Button>
        )}
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
              <EditableRow
                label="상호명"
                editing={editing}
                value={draft.businessName}
                onChange={(v) => patchDraft({ businessName: v })}
              >
                {partner.businessName}
              </EditableRow>
              <EditableRow
                label="대표자명"
                editing={editing}
                value={draft.representativeName}
                onChange={(v) => patchDraft({ representativeName: v })}
              >
                {partner.representativeName}
              </EditableRow>
              <InfoRow label="카테고리">
                {editing ? (
                  <Select
                    value={draft.categoryId ?? ''}
                    onValueChange={(v) => patchDraft({ categoryId: v })}
                  >
                    <SelectTrigger className="h-9 w-[220px]">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {page.categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  partner.categoryName ?? '-'
                )}
              </InfoRow>
              <EditableRow
                label="광고표시용 전화"
                editing={editing}
                value={draft.displayPhoneNumber}
                onChange={(v) => patchDraft({ displayPhoneNumber: v })}
              >
                {partner.displayPhoneNumber ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {partner.displayPhoneNumber}
                  </span>
                ) : (
                  '-'
                )}
              </EditableRow>
              <EditableRow
                label="연락처"
                editing={editing}
                value={draft.phoneNumber}
                onChange={(v) => patchDraft({ phoneNumber: v })}
              >
                {partner.phoneNumber ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {partner.phoneNumber}
                  </span>
                ) : (
                  '-'
                )}
              </EditableRow>
              <InfoRow label="비즈콜 번호">
                {editing ? (
                  <div className="space-y-1">
                    <Input
                      value={draft.bizCallNumber}
                      placeholder="050-0000-0000 (비우면 대표번호 노출)"
                      onChange={(e) => patchDraft({ bizCallNumber: e.target.value })}
                      className="h-9"
                    />
                    {page.bizCallDuplicateName && (
                      <p className="text-xs text-destructive">
                        {BIZ_CALL_DUPLICATE_MESSAGE} ({page.bizCallDuplicateName})
                      </p>
                    )}
                  </div>
                ) : (
                  partner.bizCallNumber ?? '-'
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
              <InfoRow label="광고 분석 열람">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="analyticsEnabled"
                    checked={partner.analyticsEnabled}
                    disabled={analyticsToggling}
                    onCheckedChange={handleToggleAnalytics}
                  />
                  <Label htmlFor="analyticsEnabled" className="cursor-pointer text-sm">
                    {partner.analyticsEnabled ? '허용됨' : '비허용'}
                  </Label>
                </div>
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
              <EditableRow
                label="사업자등록번호"
                editing={editing}
                value={draft.businessRegistrationNumber}
                onChange={(v) => patchDraft({ businessRegistrationNumber: v })}
              >
                {partner.businessRegistrationNumber ?? '-'}
              </EditableRow>
              <InfoRow label="사업장 주소">
                {editing ? (
                  <div className="space-y-1.5">
                    <Input
                      value={draft.businessAddress}
                      placeholder="도로명 주소"
                      onChange={(e) => patchDraft({ businessAddress: e.target.value })}
                      className="h-9"
                    />
                    <Input
                      value={draft.businessDetailAddress}
                      placeholder="상세 주소"
                      onChange={(e) => patchDraft({ businessDetailAddress: e.target.value })}
                      className="h-9"
                    />
                  </div>
                ) : partner.businessAddress ? (
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
              {/* 영업시간은 별도 테이블(business_hours)이라 파트너 앱에서만 고친다 */}
              <InfoRow label="영업시간">{partner.businessHoursNote ?? '-'}</InfoRow>
              <EditableRow
                label="주차 정보"
                editing={editing}
                value={draft.parkingInfo}
                onChange={(v) => patchDraft({ parkingInfo: v })}
              >
                {partner.parkingInfo ?? '-'}
              </EditableRow>
              <EditableRow
                label="오시는길"
                editing={editing}
                value={draft.directionsInfo}
                onChange={(v) => patchDraft({ directionsInfo: v })}
              >
                {partner.directionsInfo ?? '-'}
              </EditableRow>
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
                <div className="overflow-x-auto">
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
                </div>
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
