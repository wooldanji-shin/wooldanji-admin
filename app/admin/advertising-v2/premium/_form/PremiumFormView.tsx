'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageShell, PageHeader, PageHeaderTitle } from '@/components/page-shell';
import { PartnerCombobox } from '@/components/partner-combobox';
import { SalesRepSelect } from '@/components/sales-rep-select';
import { AdImagePicker } from '@/components/ad-image-picker';
import { CtaButtonsCard } from '@/components/ad-cta-buttons-card';
import {
  MAX_AD_IMAGES,
  PREMIUM_MAX_WEEKS,
  PREMIUM_MIN_WEEKS,
} from '@/lib/ads/constants';
import { usePremiumForm } from './usePremiumForm';

const LINK_FIELDS = [
  { key: 'naverMapUrl', label: '네이버 지도', placeholder: 'https://naver.me/...' },
  { key: 'blogUrl', label: '블로그', placeholder: 'https://blog.naver.com/...' },
  { key: 'youtubeUrl', label: '유튜브', placeholder: 'https://youtube.com/...' },
  { key: 'instagramUrl', label: '인스타그램', placeholder: 'https://instagram.com/...' },
  { key: 'kakaoOpenChatUrl', label: '카카오 오픈채팅', placeholder: 'https://open.kakao.com/...' },
] as const;

const WEEK_OPTIONS = Array.from(
  { length: PREMIUM_MAX_WEEKS - PREMIUM_MIN_WEEKS + 1 },
  (_, i) => PREMIUM_MIN_WEEKS + i
);

interface PremiumFormViewProps {
  /** 주면 수정 모드로 동작한다 */
  premiumId?: string;
}

export function PremiumFormView({ premiumId }: PremiumFormViewProps): React.ReactElement {
  const page = usePremiumForm(premiumId);
  const {
    isEdit,
    loadError,
    form,
    patch,
    partnerBaseAds,
    selectedPartner,
    selectedBaseAd,
    totalHouseholds,
    totalAmount,
    discountedTotalAmount,
    loading,
    submitting,
    canSubmit,
  } = page;

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" asChild className="self-start">
          <Link href="/admin/advertising-v2/premium">
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title={isEdit ? '프리미엄 광고 수정' : '프리미엄 광고 대리 등록'}
          description={isEdit
            ? '결제 전 프리미엄 광고의 내용과 승인 조건을 고칩니다.'
            : '운영 중인 기본 광고 위에 프리미엄 광고를 대신 등록합니다.'}
        />
        <Button variant="outline" asChild>
          <Link
            href={isEdit
              ? `/admin/advertising-v2/premium/${premiumId}`
              : '/admin/advertising-v2/premium'}
          >
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
            // 기본 광고를 바꾸면 노출 아파트와 금액이 통째로 달라진다 — 수정에서는 잠근다
            <div className="space-y-1 text-sm">
              <p className="text-base font-semibold">
                {selectedPartner?.businessName ?? '-'}
              </p>
              <p className="text-muted-foreground">
                기본 광고: {selectedBaseAd?.title ?? '-'}
              </p>
            </div>
          ) : (
            <>
              <PartnerCombobox
                partners={page.partnerOptions}
                value={form.partnerId}
                onChange={page.selectPartner}
              />

              {form.partnerId && (
                partnerBaseAds.length > 0 ? (
                  <Select value={form.baseAdId ?? ''} onValueChange={page.selectBaseAd}>
                    <SelectTrigger className="w-full md:w-[420px]">
                      <SelectValue placeholder="프리미엄을 얹을 기본 광고 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerBaseAds.map((ad) => (
                        <SelectItem key={ad.id} value={ad.id}>
                          {ad.title ?? '(제목 없음)'} · {ad.totalHouseholds.toLocaleString()}세대
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    이 파트너에게는 프리미엄을 등록할 수 있는 광고가 없습니다.
                    운영 중(결제 완료)이고 진행 중인 프리미엄이 없는 광고만 고를 수 있습니다.
                  </p>
                )
              )}
            </>
          )}

          {selectedBaseAd && (
            <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p>
                카테고리 {selectedBaseAd.categoryName ?? '-'} · 노출 아파트{' '}
                {selectedBaseAd.apartments.length}곳 · 총{' '}
                <strong>{totalHouseholds.toLocaleString()}세대</strong>
              </p>
              <p className="text-muted-foreground">
                {selectedBaseAd.apartments.map((a) => a.name).join(', ')}
              </p>
              <p className="text-muted-foreground">
                노출 아파트는 기본 광고를 그대로 따릅니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {form.baseAdId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>광고 내용</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                기본 광고 내용을 그대로 가져왔습니다. 프리미엄에만 다르게 넣고 싶으면 고치세요.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  제목 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.title}
                  maxLength={30}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">본문</label>
                <Textarea
                  className="min-h-[140px]"
                  value={form.content}
                  onChange={(e) => patch({ content: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    이미지 <span className="text-destructive">*</span>
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {form.images.length}/{MAX_AD_IMAGES}
                  </span>
                </div>
                <AdImagePicker
                  items={form.images}
                  onAdd={page.addImages}
                  onRemove={page.removeImage}
                />
                <p className="text-xs text-muted-foreground">
                  기본 광고에서 가져온 이미지는 목록에서 빼도 파일이 지워지지 않습니다
                  (기본 광고와 같은 파일을 씁니다).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>링크</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {LINK_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label}</label>
                  <Input
                    value={form[field.key]}
                    placeholder={field.placeholder}
                    onChange={(e) => patch({ [field.key]: e.target.value })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <CtaButtonsCard
            buttons={form.ctaButtons}
            deliveryAvailable={page.deliveryAvailable}
            onToggleType={page.toggleCtaType}
            onAddCustom={page.addCustomCta}
            onUpdate={page.updateCtaButton}
            onRemove={page.removeCtaButton}
          />

          <Card>
            <CardHeader>
              <CardTitle>노출 기간 · 승인 조건</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">노출 주수</label>
                  <Select
                    value={String(form.weeks)}
                    onValueChange={(v) => patch({ weeks: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEK_OPTIONS.map((week) => (
                        <SelectItem key={week} value={String(week)}>
                          {week}주
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
                    onChange={(e) =>
                      patch({
                        discountRate: Math.min(
                          100,
                          Math.max(0, parseInt(e.target.value) || 0)
                        ),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  영업 담당자{' '}
                  <span className="text-xs font-normal text-muted-foreground">(선택)</span>
                </label>
                <SalesRepSelect
                  className="w-[240px]"
                  value={form.salesRepId}
                  onChange={(salesRepId) => patch({ salesRepId })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  관리 메모{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    (내부용, 파트너 비공개)
                  </span>
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
            <p>
              결제 예정 금액{' '}
              <strong className="text-base">
                {(discountedTotalAmount ?? totalAmount).toLocaleString()}원
              </strong>
              {discountedTotalAmount !== null && (
                <span className="ml-2 text-muted-foreground line-through">
                  {totalAmount.toLocaleString()}원
                </span>
              )}
            </p>
            <p className="text-muted-foreground">
              {totalHouseholds.toLocaleString()}세대 × {page.pricePerWeek.toLocaleString()}원 ×{' '}
              {form.weeks}주
              {form.discountRate > 0 && ` · ${form.discountRate}% 할인`}
            </p>
            {page.ctaError && (
              <p className="mt-1 text-destructive">{page.ctaError}</p>
            )}
          </div>
          <Button size="lg" disabled={!canSubmit} onClick={page.submit}>
            {submitting
              ? (isEdit ? '수정 중...' : '등록 중...')
              : (isEdit ? '수정 저장' : '프리미엄 등록 (결제 대기 상태)')}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
