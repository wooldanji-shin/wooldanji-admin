'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Ban, Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { cn } from '@/lib/utils';
import { PARTICIPATION_TYPE_LABEL } from '../usePartnerEventsPage';
import { EventBannerPreview } from './EventBannerPreview';
import { eventBannerThemeOf } from './eventBannerThemes';
import {
  useEventDetailPage,
  bannerPreviewOf,
  couponBenefitText,
  drawStatusLabelOf,
  type EventDetail,
  type EventEditForm,
  type EventEntryRow,
} from './useEventDetailPage';

type Page = ReturnType<typeof useEventDetailPage>;
type SetForm = Page['setEditForm'];

/** 관리자가 수정할 수 있는 일정 */
const SCHEDULE_FIELDS = [
  ['entryStartAt', '응모 시작'],
  ['entryEndAt', '응모 종료'],
] as const;

/** DB generated column — 응모 종료로부터 자동 계산되어 수정 불가 */
const AUTO_SCHEDULE_FIELDS = [
  ['announceAt', '당첨자 발표', '응모 종료 + 2시간'],
  ['endAt', '이벤트 종료', '발표 다음날 자정'],
] as const;

// ── DESIGN.md 토큰 (그림자 없음 — 깊이는 배경 전환과 hairline으로만) ──
/** 모든 버튼은 pill, 기본 48px */
const BTN_BASE = 'h-12 rounded-full px-7 text-base font-semibold tracking-[0.24px] shadow-none';
/** button-primary — 검정 캔버스 위 흰 pill */
const BTN_PRIMARY = cn(BTN_BASE, 'bg-white text-black hover:bg-[#c9c9cd]');
/** button-outline-dark — 검정 캔버스 위 테두리 pill */
const BTN_OUTLINE_DARK = cn(BTN_BASE, 'border border-white bg-black text-white hover:bg-[#16181a] hover:text-white');
/** button-dark — 흰 캔버스 위 검정 pill */
const BTN_DARK = cn(BTN_BASE, 'bg-black text-white hover:bg-[#191c1f]');
/** button-outline-light — 흰 캔버스 위 테두리 pill */
const BTN_OUTLINE_LIGHT = cn(BTN_BASE, 'border border-[#191c1f] bg-white text-[#191c1f] hover:bg-[#f4f4f4]');
/** text-input — 12px 라운드, hairline */
const INPUT = 'h-11 rounded-[12px] border-[#e2e2e7] bg-white px-4 text-base text-[#191c1f] shadow-none';

function toDateTimeText(value: string | null): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '-';
}

/** '2026.09.26 18:00' */
function toCompactDateTime(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 상태 배지 — 공용 StatusBadge는 흰 배경용(연한 틴트)이라 검정·cobalt 면에서 묻힌다. 어두운 면 전용으로 색을 채운다 */
const EVENT_STATUS_PILL: Record<EventDetail['status'], { label: string; className: string }> = {
  pending: { label: '승인대기', className: 'bg-[#ec7e00] text-white' },
  approved: { label: '승인됨', className: 'bg-[#00a87e] text-white' },
  rejected: { label: '거절됨', className: 'bg-[#e23b4a] text-white' },
  ended: { label: '종료', className: 'bg-white/20 text-white' },
};

function EventStatusPill({ status }: { status: EventDetail['status'] }): React.ReactElement {
  const { label, className } = EVENT_STATUS_PILL[status];
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold', className)}>
      <span className="size-1.5 rounded-full bg-white" aria-hidden />
      {label}
    </span>
  );
}

/** badge-tag — 중립 태그 */
function Tag({ children, dark }: { children: React.ReactNode; dark?: boolean }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-[13px]',
        dark ? 'bg-[#16181a] text-white' : 'bg-[#f4f4f4] text-[#191c1f]',
      )}
    >
      {children}
    </span>
  );
}

/** feature-card-light — 흰 카드, hairline, 20px, 32px 패딩 */
function Card({
  title,
  meta,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}): React.ReactElement {
  return (
    <section className={cn('rounded-[20px] border border-[#e2e2e7] bg-white', className)}>
      <header className="flex items-center justify-between gap-3 px-6 pt-6 md:px-8 md:pt-8">
        <h2 className="text-xl font-medium leading-[1.4] text-[#191c1f]">{title}</h2>
        {meta}
      </header>
      <div className={cn('px-6 pt-5 pb-6 md:px-8 md:pb-8', bodyClassName)}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 border-t border-[#e2e2e7] py-4">
      <dt className="text-sm text-[#8d969e]">{label}</dt>
      <dd className="text-base tracking-[0.24px] text-[#191c1f]">{children}</dd>
    </div>
  );
}

export default function PartnerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = useEventDetailPage(params);
  const bannerLb = useImageLightbox(page.detail?.bannerImageUrl ? [page.detail.bannerImageUrl] : []);
  const detailLb = useImageLightbox(page.detail?.detailImageUrls ?? []);
  const goBack = (): void => router.push('/admin/partner-events');

  if (page.loading) {
    return (
      <div className="min-h-full w-full bg-[#f4f4f4]">
        <div className="bg-black px-4 py-12 md:px-10 md:py-16">
          <Skeleton className="h-4 w-32 bg-[#16181a]" />
          <Skeleton className="mt-4 h-12 w-2/3 bg-[#16181a]" />
        </div>
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 md:px-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 w-full rounded-[20px]" />
          <Skeleton className="h-64 w-full rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (!page.detail) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 bg-black px-6 py-24 text-center">
        <AlertCircle className="h-8 w-8 text-white/70" />
        <p className="text-2xl font-medium text-white">이벤트 정보를 찾을 수 없습니다.</p>
        <Button onClick={goBack} className={BTN_PRIMARY}>
          목록으로
        </Button>
      </div>
    );
  }

  const { detail } = page;
  const form = page.editing ? page.editForm : null;

  return (
    <div className="min-h-full w-full bg-[#f4f4f4] text-[#191c1f]">
      <HeroBand
        page={page}
        detail={detail}
        form={form}
        onBack={goBack}
        onOpenBanner={() => bannerLb.open(0)}
        onOpenDetailImage={(index) => detailLb.open(index)}
      />

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 md:px-10 md:py-14">
        {detail.status === 'rejected' && detail.rejectionReason && (
          <div className="flex gap-3 rounded-[20px] border border-[#e23b4a]/30 bg-white px-6 py-5 md:px-8">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#e23b4a]" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-[#8b0000]">거절 사유</p>
              <p className="whitespace-pre-wrap text-base text-[#3a3d40]">{detail.rejectionReason}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── 좌측 ── */}
          <div className="min-w-0 space-y-6">
            <EventCard detail={detail} form={form} setForm={page.setEditForm} error={page.scheduleError} />
            <CouponCard detail={detail} form={form} setForm={page.setEditForm} />
            <ApartmentsCard detail={detail} form={form} setForm={page.setEditForm} allApartments={page.allApartments} />
            <EntriesCard entries={page.entries} winners={page.winners} />
          </div>

          {/* ── 우측 ── */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <SummaryCard detail={detail} entryCount={page.entries.length} winnerCount={page.winners.length} />
            {!page.editing && <ReviewActions page={page} />}
          </aside>
        </div>
      </div>

      <RejectDialog page={page} />
      <ForceEndDialog page={page} />
      <ImageLightbox {...bannerLb.props} />
      <ImageLightbox {...detailLb.props} />
    </div>
  );
}

/** hero-band-dark — 상호명 · 제목 · 상태 + 앱 배너를 product mockup으로 */
function HeroBand({
  page,
  detail,
  form,
  onBack,
  onOpenBanner,
  onOpenDetailImage,
}: {
  page: Page;
  detail: EventDetail;
  form: EventEditForm | null;
  onBack: () => void;
  onOpenBanner: () => void;
  onOpenDetailImage: (index: number) => void;
}): React.ReactElement {
  const drawLabel = drawStatusLabelOf(detail);

  return (
    <section className="bg-black text-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-12 md:px-10 md:pb-16">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로가기"
            className="flex h-10 items-center gap-2 rounded-full bg-[#16181a] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#3a3d40]"
          >
            <ArrowLeft className="size-4" />
            이벤트 목록
          </button>
          <div className="ml-auto">
            <HeaderActions page={page} />
          </div>
        </div>

        <div className="mt-10 grid items-end gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusPill status={detail.status} />
              {drawLabel && <Tag dark>{drawLabel}</Tag>}
            </div>
            <p className="text-lg text-white/72">{detail.businessName}</p>
            {form ? (
              <Input
                value={form.title}
                onChange={(e) => page.setEditForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="이벤트명"
                className="h-16 max-w-2xl rounded-[12px] border-white/12 bg-[#16181a] px-5 text-[28px] font-medium text-white shadow-none placeholder:text-white/40 md:text-[32px]"
              />
            ) : (
              <h1 className="text-[36px] font-medium leading-[1.1] tracking-[-0.36px] md:text-[48px] md:leading-[1.08] md:tracking-[-0.48px]">
                {detail.title}
              </h1>
            )}
            <p className="text-sm text-white/72">신청일시 {toDateTimeText(detail.createdAt)}</p>
          </div>

          <BannerMockup detail={detail} form={form} onOpenBanner={onOpenBanner} onOpenDetailImage={onOpenDetailImage} />
        </div>
      </div>
    </section>
  );
}

/** product-mockup — 앱 홈 배너 그대로 + 상세 이미지 */
function BannerMockup({
  detail,
  form,
  onOpenBanner,
  onOpenDetailImage,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  onOpenBanner: () => void;
  onOpenDetailImage: (index: number) => void;
}): React.ReactElement {
  return (
    <div className="w-full space-y-5 rounded-[28px] bg-[#16181a] p-6 sm:w-auto md:p-8">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">홈 배너</span>
        <span className="text-[13px] text-white/72">{detail.bannerType === 'image' ? '이미지로만' : `기본 배너 · ${eventBannerThemeOf(detail.bannerTheme).label} 테마`}</span>
      </div>
      <div className="overflow-x-auto">
        <EventBannerPreview data={bannerPreviewOf(detail, form)} onImageClick={onOpenBanner} />
      </div>
      <div className="space-y-3 border-t border-white/12 pt-5">
        <p className="text-[13px] text-white/72">상세 이미지 {detail.detailImageUrls.length}장</p>
        {detail.detailImageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {detail.detailImageUrls.map((url, index) => (
              <ImageThumbnail
                key={url}
                src={url}
                alt={`상세 이미지 ${index + 1}`}
                onClick={() => onOpenDetailImage(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderActions({ page }: { page: Page }): React.ReactElement | null {
  if (page.editing) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" onClick={page.cancelEdit} disabled={page.saving} className={cn(BTN_OUTLINE_DARK, 'h-10 px-5 text-sm')}>
          취소
        </Button>
        <Button onClick={page.handleSaveEdit} disabled={page.saving} className={cn(BTN_PRIMARY, 'h-10 px-5 text-sm')}>
          {page.saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    );
  }
  if (page.detail?.status === 'ended') return null;
  return (
    <Button onClick={page.startEdit} className={cn(BTN_PRIMARY, 'h-10 px-5 text-sm')}>
      <Pencil className="h-4 w-4" />
      정보 수정
    </Button>
  );
}

/** 참여방식 · 당첨 인원 · 일정 */
function EventCard({
  detail,
  form,
  setForm,
  error,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  setForm: SetForm;
  error: string | null;
}): React.ReactElement {
  return (
    <Card title="이벤트">
      <dl className="grid gap-x-8 sm:grid-cols-2">
        <Field label="참여방식">
          {form ? (
            <Select
              value={form.participationType}
              onValueChange={(v) => setForm((p) => ({ ...p, participationType: v as typeof p.participationType }))}
            >
              <SelectTrigger className={cn(INPUT, 'w-full')}>
                <SelectValue />
              </SelectTrigger>
              {/* 선착순은 당분간 운영하지 않아 선택지에서 뺐다 (기존 선착순 이벤트 표시는 유지) */}
              <SelectContent>
                <SelectItem value="draw">추첨</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            PARTICIPATION_TYPE_LABEL[detail.participationType]
          )}
        </Field>
        <Field label="당첨 인원">
          {form ? (
            <Input
              type="number"
              min={1}
              value={form.winnerCount}
              onChange={(e) => setForm((p) => ({ ...p, winnerCount: Math.max(1, parseInt(e.target.value) || 1) }))}
              className={INPUT}
            />
          ) : (
            <span className="tabular-nums">{detail.winnerCount.toLocaleString()}명</span>
          )}
        </Field>
        {form &&
          SCHEDULE_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                type="datetime-local"
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className={INPUT}
              />
            </Field>
          ))}
        {form &&
          AUTO_SCHEDULE_FIELDS.map(([key, label, rule]) => (
            <Field key={key} label={`${label} (자동)`}>
              <span className="tabular-nums">{toDateTimeText(detail[key])}</span>
              <span className="mt-1 block text-sm text-[#8d969e]">{rule}</span>
            </Field>
          ))}
      </dl>
      {form && error && <p className="pt-2 text-sm text-[#e23b4a]">{error}</p>}
      {!form && <ScheduleTimeline detail={detail} />}
    </Card>
  );
}

/** 응모 시작 → 응모 종료 → 발표 → 종료 — 지난 단계는 ink로 채운다 */
function ScheduleTimeline({ detail }: { detail: EventDetail }): React.ReactElement {
  const now = Date.now();
  const steps = [
    ...SCHEDULE_FIELDS.map(([key, label]) => ({ key, label, rule: null as string | null })),
    ...AUTO_SCHEDULE_FIELDS.map(([key, label, rule]) => ({ key, label, rule: rule as string | null })),
  ];

  return (
    <div className="border-t border-[#e2e2e7] pt-6">
      <p className="mb-5 text-sm text-[#8d969e]">일정</p>
      <ol className="grid gap-5 sm:grid-cols-4 sm:gap-0">
        {steps.map((step, index) => {
          const passed = new Date(detail[step.key]).getTime() <= now;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.key} className="flex gap-3 sm:flex-col sm:pr-4">
              <div className="flex items-center pt-1 sm:pt-0">
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-full',
                    passed ? 'bg-[#191c1f]' : 'border-2 border-[#c9c9cd] bg-white',
                  )}
                />
                {!isLast && (
                  <span className={cn('hidden h-0.5 flex-1 sm:block', passed ? 'bg-[#191c1f]' : 'bg-[#e2e2e7]')} />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-[#505a63]">{step.label}</p>
                <p className="text-base font-semibold tabular-nums text-[#191c1f]">
                  {toCompactDateTime(detail[step.key])}
                </p>
                {step.rule && <p className="text-[13px] text-[#8d969e]">{step.rule}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 당첨 쿠폰 — 앱에는 '아메리카노 10% 할인'처럼 할인 대상과 혜택을 이어 붙여 보여준다 */
function CouponCard({
  detail,
  form,
  setForm,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  setForm: SetForm;
}): React.ReactElement {
  const source = form ?? detail;
  const benefit = couponBenefitText(source.couponTitle, source.couponDiscountType, source.couponDiscountValue);

  return (
    <Card title="당첨 쿠폰">
      <div className="mb-6 rounded-[20px] bg-black px-6 py-7 text-white md:px-8">
        <p className="text-[13px] text-white/72">{detail.businessName}</p>
        <p className="mt-2 text-[28px] font-medium leading-[1.19] tracking-[-0.28px] md:text-[32px] md:tracking-[-0.32px]">
          {benefit || '-'}
        </p>
        <p className="mt-4 text-sm text-white/72">
          {form ? '만료일은 아래에서 수정' : `${toCompactDateTime(detail.couponExpiresAt)}까지`}
        </p>
      </div>
      <dl className="grid gap-x-8 sm:grid-cols-2">
        <Field label="혜택">
          {form ? (
            <BenefitEditor form={form} setForm={setForm} />
          ) : (
            couponBenefitText('', detail.couponDiscountType, detail.couponDiscountValue)
          )}
        </Field>
        <Field label={source.couponDiscountType === 'gift' ? '증정품' : '할인 대상'}>
          {form ? (
            <Input
              value={form.couponTitle}
              onChange={(e) => setForm((p) => ({ ...p, couponTitle: e.target.value }))}
              placeholder={form.couponDiscountType === 'gift' ? '예) 아메리카노 1잔' : '예) 아메리카노 / 전 메뉴'}
              className={INPUT}
            />
          ) : (
            detail.couponTitle
          )}
        </Field>
        <Field label="쿠폰 만료일">
          {form ? (
            <Input
              type="datetime-local"
              value={form.couponExpiresAt}
              onChange={(e) => setForm((p) => ({ ...p, couponExpiresAt: e.target.value }))}
              className={INPUT}
            />
          ) : (
            <span className="tabular-nums">{toDateTimeText(detail.couponExpiresAt)}</span>
          )}
        </Field>
      </dl>
    </Card>
  );
}

function BenefitEditor({ form, setForm }: { form: EventEditForm; setForm: SetForm }): React.ReactElement {
  return (
    <div className="flex gap-2">
      <Select
        value={form.couponDiscountType}
        onValueChange={(v) =>
          setForm((p) => ({
            ...p,
            couponDiscountType: v as typeof p.couponDiscountType,
            couponDiscountValue: v === 'gift' ? null : p.couponDiscountValue,
          }))
        }
      >
        <SelectTrigger className={cn(INPUT, 'w-[120px] shrink-0')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="percent">% 할인</SelectItem>
          <SelectItem value="fixed">원 할인</SelectItem>
          <SelectItem value="gift">증정</SelectItem>
        </SelectContent>
      </Select>
      {form.couponDiscountType !== 'gift' && (
        <Input
          type="number"
          min={0}
          value={form.couponDiscountValue ?? ''}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              couponDiscountValue: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
          placeholder={form.couponDiscountType === 'percent' ? '%' : '원'}
          className={INPUT}
        />
      )}
    </div>
  );
}

function ApartmentsCard({
  detail,
  form,
  setForm,
  allApartments,
}: {
  detail: EventDetail;
  form: EventEditForm | null;
  setForm: SetForm;
  allApartments: Page['allApartments'];
}): React.ReactElement {
  const count = form ? form.apartmentIds.length : detail.apartmentNames.length;
  const toggle = (id: string): void =>
    setForm((p) => ({
      ...p,
      apartmentIds: p.apartmentIds.includes(id)
        ? p.apartmentIds.filter((x) => x !== id)
        : [...p.apartmentIds, id],
    }));

  return (
    <Card title="대상 아파트" meta={<Tag>{count}곳</Tag>}>
      {form ? (
        <div className="grid max-h-80 gap-2 overflow-y-auto md:grid-cols-2">
          {allApartments.map((apt) => {
            const checked = form.apartmentIds.includes(apt.id);
            return (
              <label
                key={apt.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-3 transition-colors',
                  checked ? 'border-[#191c1f] bg-white' : 'border-[#e2e2e7] bg-white hover:bg-[#f4f4f4]',
                )}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(apt.id)} />
                <span className="min-w-0 flex-1 truncate text-base text-[#191c1f]">{apt.name}</span>
              </label>
            );
          })}
        </div>
      ) : detail.apartmentNames.length === 0 ? (
        <p className="text-base text-[#8d969e]">지정된 아파트가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {detail.apartmentNames.map((name) => (
            <span
              key={name}
              className="inline-flex h-9 items-center rounded-full bg-[#f4f4f4] px-4 text-sm font-semibold text-[#191c1f]"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function EntriesCard({
  entries,
  winners,
}: {
  entries: EventEntryRow[];
  winners: EventEntryRow[];
}): React.ReactElement {
  const triggerClass =
    'h-9 flex-none rounded-full px-4 text-sm font-semibold text-[#191c1f] data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none';

  return (
    <Card title="응모 현황" bodyClassName="px-0 md:px-0 pb-2 md:pb-2">
      <Tabs defaultValue="entries" className="gap-0">
        <div className="px-6 pb-4 md:px-8">
          <TabsList className="h-auto gap-2 bg-transparent p-0">
            <TabsTrigger value="entries" className={cn(triggerClass, 'bg-[#f4f4f4]')}>
              응모자 {entries.length}
            </TabsTrigger>
            <TabsTrigger value="winners" className={cn(triggerClass, 'bg-[#f4f4f4]')}>
              당첨자 {winners.length}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="entries">
          <EntriesTable rows={entries} emptyText="응모자가 없습니다." />
        </TabsContent>
        <TabsContent value="winners">
          <EntriesTable rows={winners} emptyText="당첨자가 없습니다." />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function EntriesTable({ rows, emptyText }: { rows: EventEntryRow[]; emptyText: string }): React.ReactElement {
  if (rows.length === 0) {
    return <p className="border-t border-[#e2e2e7] px-8 py-12 text-center text-base text-[#8d969e]">{emptyText}</p>;
  }
  const th = 'px-6 py-3 text-left text-sm font-normal text-[#8d969e] first:pl-6 md:first:pl-8 last:pr-6 md:last:pr-8';
  const td = 'px-6 py-4 first:pl-6 md:first:pl-8 last:pr-6 md:last:pr-8';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-t border-[#e2e2e7]">
            <th className={th}>이름</th>
            <th className={th}>응모 코드</th>
            <th className={th}>아파트</th>
            <th className={th}>동 · 호수</th>
            <th className={th}>당첨</th>
            <th className={th}>응모일시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.entryId} className="border-t border-[#e2e2e7] hover:bg-[#f4f4f4]">
              <td className={cn(td, 'text-base font-semibold text-[#191c1f]')}>{row.userName}</td>
              <td className={cn(td, 'font-mono text-base tracking-wider text-[#191c1f]')}>{row.entryCode}</td>
              <td className={cn(td, 'text-base text-[#3a3d40]')}>{row.apartmentName?.trim() || '-'}</td>
              <td className={cn(td, 'text-base tabular-nums text-[#3a3d40]')}>
                {row.buildingNumber != null ? `${row.buildingNumber}동` : '-'}
                {row.unit != null && ` ${row.unit}호`}
              </td>
              <td className={td}>
                {row.isWinner ? (
                  <span className="inline-flex h-7 items-center rounded-full bg-black px-3 text-[13px] text-white">
                    당첨
                  </span>
                ) : (
                  <span className="text-[#c9c9cd]">-</span>
                )}
              </td>
              <td className={cn(td, 'text-sm tabular-nums text-[#8d969e]')}>{toDateTimeText(row.enteredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** plan-card-featured — 화면의 유일한 cobalt 면 */
function SummaryCard({
  detail,
  entryCount,
  winnerCount,
}: {
  detail: EventDetail;
  entryCount: number;
  winnerCount: number;
}): React.ReactElement {
  const fillRate = detail.winnerCount > 0 ? Math.min(100, (winnerCount / detail.winnerCount) * 100) : 0;
  const history = [
    ['승인일시', detail.approvedAt],
    ['거절일시', detail.rejectedAt],
    ['종료일시', detail.endedAt],
  ] as const;

  return (
    <section className="rounded-[20px] bg-[#494fdf] p-8 text-white">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">요약</p>
        <EventStatusPill status={detail.status} />
      </div>

      <div className="mt-8">
        <p className="text-sm text-white/72">응모자</p>
        <p className="mt-1 text-[48px] font-medium leading-none tracking-[-0.48px] tabular-nums">
          {entryCount.toLocaleString()}
          <span className="ml-1 text-xl tracking-normal">명</span>
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-white/72">당첨자</p>
          <p className="text-base font-semibold tabular-nums">
            {winnerCount.toLocaleString()} / {detail.winnerCount.toLocaleString()}명
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${fillRate}%` }} />
        </div>
      </div>

      <dl className="mt-8 space-y-3 border-t border-white/20 pt-6">
        <div className="flex items-center justify-between">
          <dt className="text-sm text-white/72">대상 아파트</dt>
          <dd className="text-base font-semibold tabular-nums">{detail.apartmentNames.length}곳</dd>
        </div>
        {history
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-white/72">{label}</dt>
              <dd className="text-sm tabular-nums">{toDateTimeText(value)}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

function ReviewActions({ page }: { page: Page }): React.ReactElement | null {
  const status = page.detail?.status;

  if (status === 'pending') {
    // 응모 시작이 지난 이벤트는 승인하면 응모 기간이 줄거나 0명이 된다 — 일정 수정 후 승인
    const entryStartAt = page.detail?.entryStartAt;
    const entryStarted = !!entryStartAt && new Date(entryStartAt).getTime() <= Date.now();
    return (
      <section className="space-y-3 rounded-[20px] border border-[#e2e2e7] bg-white p-6">
        {entryStarted && (
          <div className="flex gap-2 rounded-[12px] bg-[#f4f4f4] px-4 py-3 text-sm text-[#3a3d40]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ec7e00]" />
            <span>응모 시작 시각이 지나 승인할 수 없습니다. 일정을 수정한 뒤 승인해주세요.</span>
          </div>
        )}
        <Button onClick={page.handleApprove} disabled={page.approving || entryStarted} className={cn(BTN_DARK, 'w-full')}>
          <Check className="h-4 w-4" />
          {page.approving ? '처리 중...' : '승인하기'}
        </Button>
        <Button variant="outline" onClick={() => page.setRejectDialog(true)} className={cn(BTN_OUTLINE_LIGHT, 'w-full')}>
          <X className="h-4 w-4" />
          거절하기
        </Button>
      </section>
    );
  }

  if (status === 'approved') {
    return (
      <section className="space-y-4 rounded-[20px] border border-[#e2e2e7] bg-white p-6">
        <p className="text-sm text-[#505a63]">종료하면 주민 앱에서 바로 사라지고 되돌릴 수 없습니다.</p>
        <Button
          variant="outline"
          onClick={() => page.setEndDialog(true)}
          className={cn(BTN_OUTLINE_LIGHT, 'w-full border-[#e23b4a] text-[#e23b4a] hover:text-[#8b0000]')}
        >
          <Ban className="h-4 w-4" />
          강제 종료
        </Button>
      </section>
    );
  }

  return null;
}

function RejectDialog({ page }: { page: Page }): React.ReactElement {
  return (
    <Dialog open={page.rejectDialog} onOpenChange={page.setRejectDialog}>
      <DialogContent className="rounded-[20px] p-8 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium">이벤트 거절</DialogTitle>
          <DialogDescription className="text-base text-[#505a63]">거절 사유는 파트너에게 그대로 보여집니다.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Textarea
            className="min-h-[120px] resize-none rounded-[12px] border-[#e2e2e7] px-4 py-3 text-base shadow-none"
            placeholder="거절 사유를 입력해주세요"
            value={page.rejectReason}
            onChange={(e) => page.setRejectReason(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => page.setRejectDialog(false)} disabled={page.rejecting} className={BTN_OUTLINE_LIGHT}>
            취소
          </Button>
          <Button onClick={page.handleReject} disabled={page.rejecting} className={BTN_DARK}>
            {page.rejecting ? '처리 중...' : '거절'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ForceEndDialog({ page }: { page: Page }): React.ReactElement {
  return (
    <AlertDialog open={page.endDialog} onOpenChange={page.setEndDialog}>
      <AlertDialogContent className="rounded-[20px] p-8">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-medium">이벤트를 종료할까요?</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-[#505a63]">
            종료하면 주민 앱에서 바로 사라지고 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={page.ending} className={BTN_OUTLINE_LIGHT}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              page.handleForceEnd();
            }}
            disabled={page.ending}
            className={cn(BTN_DARK, 'bg-[#e23b4a] hover:bg-[#8b0000]')}
          >
            {page.ending ? '처리 중...' : '종료'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
