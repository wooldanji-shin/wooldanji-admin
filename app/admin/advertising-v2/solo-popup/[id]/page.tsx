'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { AdminHeader } from '@/components/admin-header';
import { AutoApproveSwitch } from '@/components/auto-approve-switch';
import { StatusBadge } from '@/components/status-badge';
import { SalesRepSelect } from '@/components/sales-rep-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CONTENT_TYPE_LABEL, periodLabel } from '@/lib/ads/solo-popup';
import { useSoloPopupDetailPage, type SoloPopupDetail } from './useSoloPopupDetailPage';

const LIST_PATH = '/admin/advertising-v2/solo-popup';
const formatDateTime = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('ko-KR') : '-');

function InfoRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="pt-0.5 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-base font-medium text-foreground">{children}</span>
    </div>
  );
}

function ContentCard({ title, c, buttonLabel }: { title: string; buttonLabel?: string | null; c: Pick<SoloPopupDetail, 'title' | 'imageUrls' | 'bulletLines' | 'contentType' | 'buttonMode' | 'buttons'> }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-5">
        <div className="flex w-[160px] shrink-0 flex-wrap content-start gap-1.5">
          {c.imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={`팝업 이미지 ${i + 1}`} className={`aspect-square rounded-md border border-border object-cover ${c.imageUrls.length === 1 ? 'w-[160px]' : 'w-[77px]'}`} />
          ))}
        </div>
        <div className="flex-1">
          <InfoRow label="제목">{c.title}</InfoRow>
          <InfoRow label={`문구 (${CONTENT_TYPE_LABEL[c.contentType ?? 'bullets']})`}>
            {c.contentType === 'text' ? (
              <p className="whitespace-pre-line text-sm">{c.bulletLines.join('\n')}</p>
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {c.bulletLines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            )}
          </InfoRow>
          <InfoRow label="버튼">&apos;{buttonLabel || '자세히 보기'}&apos; 1개 (아래 링크가 있으면 외부 브라우저, 없으면 기본 광고 상세)</InfoRow>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SoloPopupDetailPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const page = useSoloPopupDetailPage(params);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'rejectMod' | 'delete' | null>(null);
  const [discountRate, setDiscountRate] = useState(0);
  const [memo, setMemo] = useState<string | null>(null);
  const [detailLink, setDetailLink] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState<string | null>(null);
  const [salesRepId, setSalesRepId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (page.loading) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title="단독 팝업 광고 상세" />
        <p className="py-20 text-center text-muted-foreground">불러오는 중...</p>
      </div>
    );
  }
  if (!page.detail) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title="단독 팝업 광고 상세" />
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <span>단독 팝업 광고 정보를 찾을 수 없습니다.</span>
        </div>
      </div>
    );
  }

  const { detail, payments, stats, processing } = page;
  const memoValue = memo ?? detail.adminMemo ?? '';
  const detailLinkValue = detailLink ?? detail.detailLinkUrl ?? '';
  const buttonLabelValue = buttonLabel ?? detail.detailButtonLabel ?? '';
  const isPending = detail.status === 'pending';
  const hasModification = detail.status === 'running' && detail.modificationStatus === 'pending';
  const canEdit =
    (detail.status === 'approved' && detail.paymentStatus === 'unpaid') ||
    (detail.status === 'running' && !hasModification);
  // null 과 '' 는 같은 "링크 없음"으로 보고, 실제로 바뀔 때만 변경 카드를 보여준다
  const linkChanged =
    hasModification &&
    !!detail.pendingChanges &&
    'detailLinkUrl' in detail.pendingChanges &&
    (detail.pendingChanges.detailLinkUrl?.trim() || null) !== (detail.detailLinkUrl?.trim() || null);
  const hasDiscount = (detail.approvedDiscountRate ?? 0) > 0;
  const closeDialog = () => { setDialog(null); setReason(''); };

  const submitDialog = async () => {
    const ok =
      dialog === 'approve'
        ? await page.runAction('approve', { discountRate, adminMemo: memoValue, salesRepId }, '승인했습니다.')
        : dialog === 'reject'
          ? await page.runAction('reject', { reason }, '거절했습니다.')
          : dialog === 'rejectMod'
            ? await page.runAction('reject-modification', { reason }, '수정을 거절했습니다.')
            : await page.runAction('delete', {}, '삭제했습니다.');
    if (ok) closeDialog();
  };

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <Link href={LIST_PATH}><ArrowLeft className="mr-2 h-4 w-4" />목록으로</Link>
        </Button>
      </div>
      <AdminHeader title="단독 팝업 광고 상세" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>신청 정보</CardTitle>
          <div className="flex flex-wrap gap-2">
            {isPending && (
              <>
                <Button onClick={() => setDialog('approve')} disabled={processing}>승인</Button>
                <Button variant="outline" onClick={() => setDialog('reject')} disabled={processing}>거절</Button>
              </>
            )}
            {hasModification && (
              <>
                <Button onClick={() => page.runAction('approve-modification', {}, '수정을 승인했습니다.')} disabled={processing}>수정 승인</Button>
                <Button variant="outline" onClick={() => setDialog('rejectMod')} disabled={processing}>수정 거절</Button>
              </>
            )}
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`${LIST_PATH}/${detail.id}/edit`}>수정</Link>
              </Button>
            )}
            <Button variant="destructive" onClick={() => setDialog('delete')} disabled={processing}>삭제</Button>
          </div>
        </CardHeader>
        <CardContent>
          <InfoRow label="업체명">{detail.partnerBusinessName}</InfoRow>
          <InfoRow label="기본 광고">{detail.baseAdTitle ?? '(기본 광고 삭제됨)'}</InfoRow>
          <InfoRow label="상태">
            <div className="flex items-center gap-2">
              <StatusBadge.Premium status={detail.status} size="md" />
              <StatusBadge variant={detail.paymentStatus === 'paid' ? 'success' : 'pending'}>
                {detail.paymentStatus === 'paid' ? '결제완료' : '미결제'}
              </StatusBadge>
              {hasModification && <StatusBadge variant="primary">수정 심사</StatusBadge>}
            </div>
          </InfoRow>
          {detail.rejectedReason && <InfoRow label="거절 사유">{detail.rejectedReason}</InfoRow>}
          {detail.modificationRejectedReason && <InfoRow label="수정 거절 사유">{detail.modificationRejectedReason}</InfoRow>}
          <InfoRow label="신청 기간">{periodLabel(detail.periodUnit, detail.periodCount)}</InfoRow>
          <InfoRow label="금액">
            {hasDiscount && <span className="mr-2 text-muted-foreground line-through">{detail.totalAmount.toLocaleString()}원</span>}
            {(hasDiscount ? (detail.discountedTotalAmount ?? detail.totalAmount) : detail.totalAmount).toLocaleString()}원
            {hasDiscount && ` (${detail.approvedDiscountRate}% 할인)`}
          </InfoRow>
          <InfoRow label="게재 기간">{formatDateTime(detail.startedAt)} ~ {formatDateTime(detail.endedAt)}</InfoRow>
          <InfoRow label="노출 아파트">
            <ul className="text-sm">
              {detail.snapshotApartments.map((a, i) => (
                <li key={i}>{a.apartmentName} ({a.totalHouseholds.toLocaleString()}세대)</li>
              ))}
            </ul>
          </InfoRow>
          <InfoRow label="통계">
            노출 {stats.impressions.toLocaleString()} · 클릭 {(stats.primaryClicks + stats.secondaryClicks).toLocaleString()}
            {detail.buttonMode === 'split' && ` (버튼1 ${stats.primaryClicks} / 버튼2 ${stats.secondaryClicks})`}
          </InfoRow>
          <InfoRow label="신청일">{formatDateTime(detail.createdAt)}</InfoRow>
        </CardContent>
      </Card>

      <ContentCard title="팝업 내용" c={detail} buttonLabel={detail.detailButtonLabel} />
      {hasModification && detail.pendingChanges && (
        <ContentCard title="수정 요청 내용 (승인 시 반영)" c={{ ...detail, ...detail.pendingChanges, imageUrls: detail.pendingChanges.imageUrls ?? (detail.pendingChanges.imageUrl ? [detail.pendingChanges.imageUrl] : detail.imageUrls) }} buttonLabel={detail.detailButtonLabel} />
      )}
      {linkChanged && detail.pendingChanges && (
        <Card>
          <CardHeader><CardTitle>자세히 보기 링크 변경 (승인 시 반영)</CardTitle></CardHeader>
          <CardContent>
            <InfoRow label="변경 전">{detail.detailLinkUrl || '링크 없음 (기본 광고 상세로 이동)'}</InfoRow>
            <InfoRow label="변경 후">{detail.pendingChanges.detailLinkUrl || '링크 없음 (기본 광고 상세로 이동)'}</InfoRow>
          </CardContent>
        </Card>
      )}

      {/* 수정 심사 자동승인 — 광고중일 때만 의미가 있다 */}
      {detail.status === 'running' && (
        <Card>
          <CardContent className="px-6 py-4">
            <AutoApproveSwitch
              id={detail.id}
              checked={detail.autoApproveModification}
              disabled={page.autoApproveToggling}
              onChange={page.handleToggleAutoApprove}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>자세히 보기 링크</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            버튼 방식이 &apos;자세히 보기&apos;일 때 사용됩니다. 링크가 있으면 외부 브라우저로 열리고, 비워 두면 연결된 기본 광고 상세로 이동합니다.
          </p>
          <Input
            placeholder="https://"
            value={detailLinkValue}
            onChange={(e) => setDetailLink(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              버튼 이름{' '}
              <span className="text-xs font-normal text-muted-foreground">
                {buttonLabelValue.length}/10 · 비워 두면 &apos;자세히 보기&apos;
              </span>
            </label>
            <Input
              placeholder="자세히 보기"
              maxLength={10}
              value={buttonLabelValue}
              onChange={(e) => setButtonLabel(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => page.saveDetailLink(detailLinkValue, buttonLabelValue)}>저장</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>관리 메모</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea className="min-h-[80px] resize-none" value={memoValue} onChange={(e) => setMemo(e.target.value)} />
          <Button variant="outline" onClick={() => page.saveMemo(memoValue)}>메모 저장</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>결제 내역</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">결제 내역이 없습니다.</p>
          ) : (
            payments.map((p) => (
              <InfoRow key={p.id} label={formatDateTime(p.paymentDate)}>
                {p.amount.toLocaleString()}원 · {p.paymentType === 'solo_popup_extension' ? '연장' : '최초'}
                {p.periodWeeks ? ` · ${p.periodWeeks}주` : ''} · {p.status}
              </InfoRow>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {{ approve: '신청 승인', reject: '신청 거절', rejectMod: '수정 거절', delete: '광고 삭제', '': '' }[dialog ?? '']}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'delete'
                ? '삭제하면 노출이 즉시 멈추고 통계가 함께 삭제됩니다. 결제 이력은 보존되며 환불은 되지 않습니다.'
                : dialog === 'approve'
                  ? '할인율을 입력하면 결제 금액에 반영됩니다.'
                  : '사유는 파트너에게 알림으로 전달됩니다.'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'approve' && (
            <div className="space-y-3">
              <label className="text-sm font-medium">할인율 (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountRate || ''}
                onChange={(e) => setDiscountRate(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              />
              <label className="block text-sm font-medium">영업 담당자 (선택)</label>
              <SalesRepSelect value={salesRepId} onChange={setSalesRepId} />
            </div>
          )}
          {(dialog === 'reject' || dialog === 'rejectMod') && (
            <Textarea placeholder="거절 사유" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>취소</Button>
            <Button
              variant={dialog === 'delete' ? 'destructive' : 'default'}
              disabled={processing || ((dialog === 'reject' || dialog === 'rejectMod') && !reason.trim())}
              onClick={submitDialog}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
