'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageShell, PageHeader, PageHeaderTitle } from '@/components/page-shell';
import { PartnerCombobox } from '@/components/partner-combobox';
import { SalesRepSelect } from '@/components/sales-rep-select';
import {
  SOLO_BULLET_MAX_LENGTH,
  SOLO_BULLET_MAX_LINES,
  SOLO_TEXT_MAX_LENGTH,
  SOLO_TEXT_MAX_LINES,
  SOLO_MAX_MONTHS,
  SOLO_MAX_WEEKS,
  SOLO_TITLE_MAX,
  CONTENT_TYPE_LABEL,
  soloTextLength,
  type SoloContentType,
} from '@/lib/ads/solo-popup';
import { useSoloPopupForm } from './useSoloPopupForm';

const LIST_PATH = '/admin/advertising-v2/solo-popup';

interface SoloPopupFormViewProps {
  /** 주면 수정 모드 */
  soloId?: string;
}

export function SoloPopupFormView({ soloId }: SoloPopupFormViewProps): React.ReactElement {
  const page = useSoloPopupForm(soloId);
  const { form, patch, isEdit, contentOnly } = page;

  if (page.loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      </PageShell>
    );
  }

  if (page.loadError) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">{page.loadError}</p>
        <Button variant="outline" asChild className="self-start">
          <Link href={LIST_PATH}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Link>
        </Button>
      </PageShell>
    );
  }

  const periodMax = form.periodUnit === 'month' ? SOLO_MAX_MONTHS : SOLO_MAX_WEEKS;
  const countOptions = Array.from({ length: periodMax }, (_, i) => i + 1);

  const setBullet = (index: number, value: string) =>
    patch({ bulletLines: form.bulletLines.map((l, i) => (i === index ? value : l)) });

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title={isEdit ? '단독 팝업 광고 수정' : '단독 팝업 광고 대리 등록'}
          description={
            contentOnly
              ? '광고중인 단독 팝업의 내용을 고칩니다. 저장하면 앱에 바로 반영됩니다.'
              : isEdit
                ? '결제 전 단독 팝업의 내용과 승인 조건을 고칩니다.'
                : '운영 중인 기본 광고에 단독 팝업을 대신 등록합니다.'
          }
        />
        <Button variant="outline" asChild>
          <Link href={isEdit ? `${LIST_PATH}/${soloId}` : LIST_PATH}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isEdit ? '상세로' : '목록으로'}
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>파트너 · 기본 광고</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEdit ? (
            <p className="text-sm text-muted-foreground">
              파트너·기본 광고는 수정할 수 없습니다 (노출 아파트와 금액이 달라지기 때문입니다).
            </p>
          ) : (
            <>
              <PartnerCombobox
                partners={page.partners.map((p) => ({ id: p.id, businessName: p.businessName, description: p.description }))}
                value={form.partnerId}
                onChange={page.selectPartner}
              />
              {form.partnerId &&
                (page.partnerBaseAds.length > 0 ? (
                  <Select value={form.baseAdId ?? ''} onValueChange={(v) => patch({ baseAdId: v })}>
                    <SelectTrigger className="w-full md:w-[420px]">
                      <SelectValue placeholder="단독 팝업을 연결할 기본 광고 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {page.partnerBaseAds.map((ad) => (
                        <SelectItem key={ad.id} value={ad.id}>
                          {ad.title ?? '(제목 없음)'} · {ad.totalHouseholds.toLocaleString()}세대
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    이 파트너에게는 단독 팝업을 등록할 수 있는 광고가 없습니다. 운영 중(결제 완료)이고
                    진행 중인 단독 팝업이 없는 광고만 고를 수 있습니다.
                  </p>
                ))}
            </>
          )}
          {page.selectedBaseAd && (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              카테고리 {page.selectedBaseAd.categoryName ?? '-'} · 총{' '}
              <strong>{page.selectedBaseAd.totalHouseholds.toLocaleString()}세대</strong> (노출 아파트는 기본 광고를 그대로 따릅니다)
            </p>
          )}
        </CardContent>
      </Card>

      {(form.baseAdId || isEdit) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>팝업 내용</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  제목 <span className="text-destructive">*</span>{' '}
                  <span className="text-xs text-muted-foreground">{form.title.length}/{SOLO_TITLE_MAX}</span>
                </label>
                <Input value={form.title} maxLength={SOLO_TITLE_MAX} onChange={(e) => patch({ title: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  이미지 <span className="text-destructive">*</span>{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    3:4 세로 · 선택한 이미지를 중앙 기준으로 자동 크롭해 1080×1440으로 저장합니다
                  </span>
                </label>
                <div className="flex items-start gap-4">
                  <div className="aspect-[3/4] w-[150px] overflow-hidden rounded-md border border-border bg-muted">
                    {form.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.image.kind === 'url' ? form.image.url : form.image.previewUrl}
                        alt="단독 팝업 이미지"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="w-[280px]"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) page.pickImage(file);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  문구 <span className="text-destructive">*</span>{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {form.contentType === 'bullets'
                      ? `글머리표 1~${SOLO_BULLET_MAX_LINES}줄, 줄당 ${SOLO_BULLET_MAX_LENGTH}자`
                      : `최대 ${SOLO_TEXT_MAX_LINES}줄, ${SOLO_TEXT_MAX_LENGTH}자 (줄바꿈 제외)`}
                  </span>
                </label>
                <div className="flex gap-2">
                  {(Object.keys(CONTENT_TYPE_LABEL) as SoloContentType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={form.contentType === type ? 'default' : 'outline'}
                      onClick={() => patch({ contentType: type })}
                    >
                      {CONTENT_TYPE_LABEL[type]}
                    </Button>
                  ))}
                </div>
                {form.contentType === 'text' ? (
                  <div className="space-y-1">
                    <Textarea
                      className="min-h-[90px] resize-none"
                      value={form.bodyText}
                      placeholder={`최대 ${SOLO_TEXT_MAX_LINES}줄, ${SOLO_TEXT_MAX_LENGTH}자까지`}
                      onChange={(e) => {
                        // 줄 수 초과 입력은 받지 않는다 (글자수는 카운터·검증으로 안내)
                        if (e.target.value.split('\n').length > SOLO_TEXT_MAX_LINES) return;
                        patch({ bodyText: e.target.value });
                      }}
                    />
                    <p className="text-right text-xs text-muted-foreground tabular-nums">
                      {soloTextLength(form.bodyText)}/{SOLO_TEXT_MAX_LENGTH}
                    </p>
                  </div>
                ) : (
                  <>
                    {form.bulletLines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={line}
                          maxLength={SOLO_BULLET_MAX_LENGTH}
                          onChange={(e) => setBullet(i, e.target.value)}
                        />
                        <span className="w-12 text-xs text-muted-foreground tabular-nums">
                          {line.length}/{SOLO_BULLET_MAX_LENGTH}
                        </span>
                        {form.bulletLines.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => patch({ bulletLines: form.bulletLines.filter((_, idx) => idx !== i) })}
                          >
                            삭제
                          </Button>
                        )}
                      </div>
                    ))}
                    {form.bulletLines.length < SOLO_BULLET_MAX_LINES && (
                      <Button variant="outline" size="sm" onClick={() => patch({ bulletLines: [...form.bulletLines, ''] })}>
                        줄 추가
                      </Button>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">버튼</label>
                <p className="text-sm text-muted-foreground">
                  &apos;자세히 보기&apos; 버튼 1개로 고정됩니다. 링크는 등록 후 상세 화면에서 넣을 수 있고, 비워 두면 연결된 기본 광고 상세로 이동합니다.
                </p>
              </div>
              {page.contentErr && <p className="text-sm text-destructive">{page.contentErr}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>노출 기간 · 승인 조건</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contentOnly ? (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  광고중에는 이미 결제된 금액의 근거라 기간·할인율을 바꿀 수 없습니다.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">기간 단위</label>
                    <Select value={form.periodUnit} onValueChange={(v) => page.changeUnit(v as 'week' | 'month')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">주</SelectItem>
                        <SelectItem value="month">개월 (1개월 = 4주)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{form.periodUnit === 'month' ? '개월 수' : '주 수'}</label>
                    <Select value={String(form.periodCount)} onValueChange={(v) => patch({ periodCount: Number(v) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countOptions.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                            {form.periodUnit === 'month' ? '개월' : '주'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">할인율 (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.discountRate || ''}
                      onChange={(e) => patch({ discountRate: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  영업 담당자 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </label>
                <SalesRepSelect className="w-[240px]" value={form.salesRepId} onChange={(salesRepId) => patch({ salesRepId })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  관리 메모 <span className="text-xs font-normal text-muted-foreground">(내부용, 파트너 비공개)</span>
                </label>
                <Textarea
                  className="min-h-[80px] resize-none"
                  value={form.adminMemo}
                  onChange={(e) => patch({ adminMemo: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            {contentOnly ? (
              <p className="text-muted-foreground">기간·금액은 변경되지 않습니다.</p>
            ) : (
              <>
                <p>
                  결제 예정 금액(미리보기){' '}
                  <strong className="text-base">
                    {(page.discountedTotalAmount ?? page.totalAmount).toLocaleString()}원
                  </strong>
                  {page.discountedTotalAmount !== null && (
                    <span className="ml-2 text-muted-foreground line-through">{page.totalAmount.toLocaleString()}원</span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {(page.selectedBaseAd?.totalHouseholds ?? 0).toLocaleString()}세대 × {page.pricePerWeek.toLocaleString()}원 ×{' '}
                  {page.weeks}주{form.discountRate > 0 && ` · ${form.discountRate}% 할인`} — 확정 금액은 저장 시 서버가 계산합니다.
                </p>
              </>
            )}
            {page.periodErr && <p className="mt-1 text-destructive">{page.periodErr}</p>}
          </div>
          <Button size="lg" disabled={!page.canSubmit} onClick={page.submit}>
            {page.submitting
              ? isEdit ? '수정 중...' : '등록 중...'
              : isEdit ? '수정 저장' : '단독 팝업 등록 (결제 대기 상태)'}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
