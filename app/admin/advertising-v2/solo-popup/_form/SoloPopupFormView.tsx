'use client';

import { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageShell, PageHeader, PageHeaderTitle } from '@/components/page-shell';
import { PartnerCombobox } from '@/components/partner-combobox';
import { SalesRepSelect } from '@/components/sales-rep-select';
import {
  SOLO_BULLET_MAX_LENGTH,
  SOLO_IMAGE_MAX_COUNT,
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
import { SoloImageSortableList } from './SoloImageSortableList';
import { SoloImageCropDialog } from './SoloImageCropDialog';
import { useSoloPopupForm, type SoloBaseAdOption } from './useSoloPopupForm';

const LIST_PATH = '/admin/advertising-v2/solo-popup';

// 선택칸·짧은 입력칸 폭 / 긴 입력칸 최대 폭 / 글자 수 표시 — 폼 전체에서 통일
const FIELD_WIDTH = 'w-full md:w-[420px]';
const LONG_FIELD_WIDTH = 'w-full max-w-2xl';
const COUNTER_CLASS = 'text-right text-xs tabular-nums text-muted-foreground';
// label 은 inline 이라 좁은 입력칸이 옆에 붙지 않게 block 으로 한 줄을 차지시킨다
const LABEL_CLASS = 'block text-sm font-medium';

interface SoloPopupFormViewProps {
  /** 주면 수정 모드 */
  soloId?: string;
}

/** 연결된 기본 광고의 현재 노출 아파트 — 확인용 읽기 전용 목록 */
function BaseAdApartments({
  baseAd,
  changedSinceApply,
}: {
  baseAd: SoloBaseAdOption;
  changedSinceApply: boolean;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <p className={LABEL_CLASS}>
        노출 아파트 <span className="text-xs font-normal text-muted-foreground">(기본 광고를 그대로 따라요)</span>
      </p>
      <p className="text-xs text-muted-foreground">카테고리 {baseAd.categoryName ?? '-'}</p>
      {baseAd.apartments.length === 0 ? (
        <p className="text-sm text-muted-foreground">아파트 정보 없음</p>
      ) : (
        <ul className={`${LONG_FIELD_WIDTH} max-h-60 divide-y divide-border/50 overflow-auto rounded-md border border-border px-3`}>
          {baseAd.apartments.map((apt) => (
            <li key={apt.apartmentId} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{apt.name}</p>
                {apt.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{apt.address}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {apt.totalHouseholds.toLocaleString()}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">세대</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm font-medium tabular-nums">
        총 {baseAd.apartments.length.toLocaleString()}곳 · {baseAd.totalHouseholds.toLocaleString()}세대
      </p>
      {changedSinceApply && (
        <p className="text-xs text-destructive">신청 당시와 아파트가 달라졌어요 (금액은 신청 당시 기준입니다).</p>
      )}
    </div>
  );
}

export function SoloPopupFormView({ soloId }: SoloPopupFormViewProps): React.ReactElement {
  const page = useSoloPopupForm(soloId);
  const { form, patch, isEdit, contentOnly } = page;
  // 브라우저 기본 파일 칸("Choose Files") 대신 버튼으로 파일 선택창을 연다
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <CardContent className="space-y-5">
          {isEdit ? (
            <p className="text-sm text-muted-foreground">
              파트너·기본 광고는 수정할 수 없습니다 (노출 아파트와 금액이 달라지기 때문입니다).
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>
                  파트너 <span className="text-destructive">*</span>
                </label>
                <div>
                  <PartnerCombobox
                    className={FIELD_WIDTH}
                    partners={page.partners.map((p) => ({ id: p.id, businessName: p.businessName, description: p.description }))}
                    value={form.partnerId}
                    onChange={page.selectPartner}
                  />
                </div>
              </div>
              {form.partnerId &&
                (page.partnerBaseAds.length > 0 ? (
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      연결할 기본 광고 <span className="text-destructive">*</span>
                    </label>
                    <Select value={form.baseAdId ?? ''} onValueChange={(v) => patch({ baseAdId: v })}>
                      <SelectTrigger className={FIELD_WIDTH}>
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
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    이 파트너에게는 단독 팝업을 등록할 수 있는 광고가 없습니다. 운영 중(결제 완료)이고
                    진행 중인 단독 팝업이 없는 광고만 고를 수 있습니다.
                  </p>
                ))}
            </>
          )}
          {page.selectedBaseAd && <BaseAdApartments baseAd={page.selectedBaseAd} changedSinceApply={page.apartmentsChangedSinceApply} />}
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
                <label className={LABEL_CLASS}>
                  제목 <span className="text-destructive">*</span>
                </label>
                <div className={`${FIELD_WIDTH} space-y-1`}>
                  <Input value={form.title} maxLength={SOLO_TITLE_MAX} onChange={(e) => patch({ title: e.target.value })} />
                  <p className={COUNTER_CLASS}>{form.title.length}/{SOLO_TITLE_MAX}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  이미지 <span className="text-destructive">*</span>{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    최대 {SOLO_IMAGE_MAX_COUNT}장 · 문을 열 때마다 1장이 무작위로 노출됩니다 · 사진을 고르면 한 장씩 원하는 위치를 잘라 1080×1080으로 저장합니다
                  </span>
                </label>
                <SoloImageSortableList images={form.images} onRemove={page.removeImage} onReorder={page.reorderImages} />
                {form.images.length > 1 && (
                  <p className="text-xs text-muted-foreground">사진을 끌어서 순서를 바꿀 수 있어요.</p>
                )}
                <SoloImageCropDialog
                  file={page.cropState.file}
                  title={page.cropState.title}
                  onApply={page.applyCrop}
                  onCancel={page.cancelCrop}
                />
                {form.images.length < SOLO_IMAGE_MAX_COUNT && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        if (files.length) page.pickImages(files);
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      이미지를 선택해주세요
                    </Button>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <label className={`${LABEL_CLASS} block`}>
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
                  <div className={`${LONG_FIELD_WIDTH} space-y-1`}>
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
                    <p className={COUNTER_CLASS}>
                      {soloTextLength(form.bodyText)}/{SOLO_TEXT_MAX_LENGTH}
                    </p>
                  </div>
                ) : (
                  <div className={`${LONG_FIELD_WIDTH} space-y-3`}>
                    {form.bulletLines.map((line, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1 space-y-1">
                          <Input
                            value={line}
                            maxLength={SOLO_BULLET_MAX_LENGTH}
                            onChange={(e) => setBullet(i, e.target.value)}
                          />
                          <p className={COUNTER_CLASS}>
                            {line.length}/{SOLO_BULLET_MAX_LENGTH}
                          </p>
                        </div>
                        {/* 1줄일 때도 자리를 비워 둬 줄이 늘어도 입력칸 폭이 변하지 않게 한다 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-11 ${form.bulletLines.length > 1 ? '' : 'invisible'}`}
                          tabIndex={form.bulletLines.length > 1 ? 0 : -1}
                          onClick={() => patch({ bulletLines: form.bulletLines.filter((_, idx) => idx !== i) })}
                        >
                          삭제
                        </Button>
                      </div>
                    ))}
                    {form.bulletLines.length < SOLO_BULLET_MAX_LINES && (
                      <Button variant="outline" size="sm" onClick={() => patch({ bulletLines: [...form.bulletLines, ''] })}>
                        줄 추가
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>버튼</label>
                <p className="text-sm text-muted-foreground">
                  &apos;자세히 보기&apos; 버튼 1개로 고정됩니다. 링크는 등록 후 상세 화면에서 넣을 수 있고, 비워 두면 연결된 기본 광고 상세로 이동합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>노출 기간 · 승인 조건</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {contentOnly ? (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  광고중에는 이미 결제된 금액의 근거라 기간·할인율을 바꿀 수 없습니다. 기간·금액은 변경되지 않습니다.
                </p>
              ) : (
                <>
                  <div className={`grid gap-4 md:grid-cols-3 ${LONG_FIELD_WIDTH}`}>
                    <div className="space-y-1.5">
                      <label className={LABEL_CLASS}>기간 단위</label>
                      <Select value={form.periodUnit} onValueChange={(v) => page.changeUnit(v as 'week' | 'month')}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">주</SelectItem>
                          <SelectItem value="month">개월 (1개월 = 4주)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={LABEL_CLASS}>{form.periodUnit === 'month' ? '개월 수' : '주 수'}</label>
                      <Select value={String(form.periodCount)} onValueChange={(v) => patch({ periodCount: Number(v) })}>
                        <SelectTrigger className="w-full">
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
                      <label className={LABEL_CLASS}>할인율 (%)</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.discountRate || ''}
                        onChange={(e) => patch({ discountRate: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                      />
                    </div>
                  </div>
                  {page.canStartImmediately && (
                    <label className={`${LONG_FIELD_WIDTH} flex cursor-pointer items-start gap-2 rounded-md border border-border bg-muted/40 p-3`}>
                      <Checkbox
                        className="mt-0.5"
                        checked={form.startImmediately}
                        onCheckedChange={(checked) => patch({ startImmediately: checked === true })}
                      />
                      <span className="space-y-1 text-sm">
                        <span className="block font-medium">결제 없이 바로 광고 시작</span>
                        <span className="block text-xs text-muted-foreground">
                          할인율 100%일 때만 선택할 수 있습니다. 파트너 결제를 건너뛰고 지금 바로 노출이 시작되며, 종료일은 기간에 맞춰 자동으로 정해집니다.
                        </span>
                      </span>
                    </label>
                  )}
                  <div className={`${LONG_FIELD_WIDTH} space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm`}>
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
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>관리 정보</CardTitle>
              <CardDescription>내부용 정보입니다. 파트너에게는 보이지 않습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>
                  영업 담당자 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </label>
                <SalesRepSelect className={FIELD_WIDTH} value={form.salesRepId} onChange={(salesRepId) => patch({ salesRepId })} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>
                  관리 메모 <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </label>
                <Textarea
                  className={`${FIELD_WIDTH} min-h-[80px] resize-none`}
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
            {page.periodErr && <p className="text-destructive">{page.periodErr}</p>}
          </div>
          <Button size="lg" disabled={!page.canSubmit} onClick={page.submit}>
            {page.submitting
              ? isEdit ? '수정 중...' : '등록 중...'
              : isEdit ? '수정 저장' : form.startImmediately && page.canStartImmediately ? '단독 팝업 등록 후 바로 시작' : '단독 팝업 등록 (결제 대기 상태)'}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
