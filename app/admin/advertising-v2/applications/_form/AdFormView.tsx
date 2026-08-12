'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatBizCallNumber } from '@/lib/utils/format';
import { MAX_AD_IMAGES } from '@/lib/ads/constants';
import { AdImagePicker } from '@/components/ad-image-picker';
import { CtaButtonsCard } from '@/components/ad-cta-buttons-card';
import { useAdForm } from './useAdForm';

// 배달앱 링크는 하단 버튼(CTA) 카드에서 관리한다
const LINK_FIELDS = [
  { key: 'naverMapUrl', label: '네이버 지도', placeholder: 'https://naver.me/...' },
  { key: 'blogUrl', label: '블로그', placeholder: 'https://blog.naver.com/...' },
  { key: 'youtubeUrl', label: '유튜브', placeholder: 'https://youtube.com/...' },
  { key: 'instagramUrl', label: '인스타그램', placeholder: 'https://instagram.com/...' },
  { key: 'kakaoOpenChatUrl', label: '카카오 오픈채팅', placeholder: 'https://open.kakao.com/...' },
] as const;

interface AdFormViewProps {
  /** 주면 수정 모드로 동작한다 */
  adId?: string;
}

export function AdFormView({ adId }: AdFormViewProps): React.ReactElement {
  const page = useAdForm(adId);
  const {
    isEdit,
    loadError,
    form,
    patch,
    apartments,
    categories,
    subCategories,
    selectedPartner,
    totalHouseholds,
    estimatedMonthlyAmount,
    isFirstAdExpected,
    benefitsApplied,
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
          <Link href="/admin/advertising-v2/applications">
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
          title={isEdit ? '광고 수정' : '광고 대리 등록'}
          description={isEdit
            ? '결제 전 광고의 내용과 승인 조건을 고칩니다.'
            : '파트너를 대신해 광고를 작성하고 결제만 남은 상태로 만듭니다.'}
        />
        <Button variant="outline" asChild>
          <Link
            href={isEdit
              ? `/admin/advertising-v2/applications/${adId}`
              : '/admin/advertising-v2/applications'}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isEdit ? '상세로' : '목록으로'}
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>파트너</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEdit ? (
            // 파트너를 바꾸는 건 사실상 다른 광고 — 수정에서는 잠근다
            <p className="text-base font-semibold">
              {selectedPartner?.businessName ?? '-'}
            </p>
          ) : (
            <PartnerCombobox
              partners={page.partnerOptions}
              value={form.partnerId}
              onChange={page.selectPartner}
            />
          )}
          {selectedPartner && (
            <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p>
                대표자 {selectedPartner.representativeName ?? '-'} · 전화{' '}
                {selectedPartner.displayPhoneNumber ?? '-'}
              </p>
              <p className="text-muted-foreground">
                {selectedPartner.businessAddress ?? '주소 미등록'}
              </p>
              <p className={isFirstAdExpected ? 'text-emerald-600' : 'text-muted-foreground'}>
                {isFirstAdExpected
                  ? '첫 광고 — 할인·무료기간 적용 가능'
                  : '첫 광고 아님 — 예외 적용을 켜야 할인·무료기간이 적용됩니다'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>카테고리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={form.categoryId ?? ''} onValueChange={page.selectCategory}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.categoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subCategories.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {subCategories.map((sub) => (
                <label key={sub.id} className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={form.subCategoryIds.includes(sub.id)}
                    onCheckedChange={() => page.toggleSubCategory(sub.id)}
                  />
                  <span className="text-sm">{sub.subCategoryName}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>광고 내용</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              제목 <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.title}
              maxLength={30}
              placeholder="앱 광고 목록에 표시될 제목"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">본문</label>
            <Textarea
              className="min-h-[140px]"
              value={form.content}
              placeholder="가게 소개, 메뉴, 이벤트 등"
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
            {form.partnerId ? (
              <AdImagePicker
                items={form.images}
                onAdd={page.addImages}
                onRemove={page.removeImage}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                파트너를 먼저 선택해주세요. 이미지가 파트너 폴더에 저장됩니다.
              </p>
            )}
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
          <CardTitle>
            노출 아파트 <span className="text-destructive">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {apartments.map((apt) => (
              <label
                key={apt.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2.5"
              >
                <Checkbox
                  checked={form.apartmentIds.includes(apt.id)}
                  onCheckedChange={() => page.toggleApartment(apt.id)}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{apt.name}</span>
                <span className="text-xs text-muted-foreground">
                  {apt.totalHouseholds.toLocaleString()}세대
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm">
            선택 {form.apartmentIds.length}곳 · 총{' '}
            <strong>{totalHouseholds.toLocaleString()}세대</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>승인 조건</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isFirstAdExpected && (
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={form.overrideEnabled}
                onCheckedChange={(checked) => patch({ overrideEnabled: checked === true })}
              />
              <span className="text-sm">
                첫 광고가 아니지만 협의된 할인·무료기간을 예외 적용
              </span>
            </label>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">할인율 (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={!benefitsApplied}
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium">무료 개월 수</label>
              <Input
                type="number"
                min={0}
                max={24}
                disabled={!benefitsApplied}
                value={form.freeMonths || ''}
                onChange={(e) =>
                  patch({ freeMonths: Math.max(0, parseInt(e.target.value) || 0) })
                }
              />
            </div>
          </div>
          {form.overrideEnabled && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                할인 사유{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  (파트너에게 표시)
                </span>
              </label>
              <Textarea
                className="min-h-[80px] resize-none"
                maxLength={100}
                placeholder="예: 신규 상권 지원 / 장기 계약 협의 완료 등"
                value={form.discountNote}
                onChange={(e) => patch({ discountNote: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              비즈콜 번호{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (안심번호, 선택)
              </span>
            </label>
            <Input
              placeholder="예: 0507-1234-5678"
              inputMode="numeric"
              value={form.bizCallNumber}
              onChange={(e) => patch({ bizCallNumber: formatBizCallNumber(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              입력하면 앱 광고 상세에서 이 번호가 노출됩니다. 비워두면 기존 대표번호(
              {selectedPartner?.displayPhoneNumber || '미등록'})가 그대로 노출됩니다.
            </p>
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
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={form.grantAnalytics}
              onCheckedChange={(checked) => patch({ grantAnalytics: checked === true })}
            />
            <span className="text-sm">광고 분석 권한 부여</span>
          </label>
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

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <p>
              예상 월 광고료{' '}
              <strong className="text-base">
                {estimatedMonthlyAmount.toLocaleString()}원
              </strong>
            </p>
            <p className="text-muted-foreground">
              {totalHouseholds.toLocaleString()}세대 ×{' '}
              {page.pricePerHousehold.toLocaleString()}원
              {benefitsApplied && form.discountRate > 0 && ` · ${form.discountRate}% 할인`}
              {benefitsApplied && form.freeMonths > 0 && ` · ${form.freeMonths}개월 무료`}
            </p>
            {page.ctaError && (
              <p className="mt-1 text-destructive">{page.ctaError}</p>
            )}
          </div>
          <Button size="lg" disabled={!canSubmit} onClick={page.submit}>
            {submitting
              ? (isEdit ? '수정 중...' : '등록 중...')
              : (isEdit ? '수정 저장' : '광고 등록 (결제 대기 상태)')}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
