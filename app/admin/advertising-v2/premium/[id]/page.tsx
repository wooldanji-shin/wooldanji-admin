'use client';

import { AdminHeader } from '@/components/admin-header';
import { PartnerBusinessHoursCard } from '@/components/partner-business-hours-card';
import { PartnerCouponsCard } from '@/components/partner-coupons-card';
import { formatAuthProviders } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  BarChart2,
  Building2,
  Check,
  ChevronLeft,
  ExternalLink,
  GitCompare,
  MapPin,
  Tag,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  StatusBadge as DomainStatusBadge,
  type PremiumStatus,
} from '@/components/status-badge';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';
import { usePremiumDetailPage } from './usePremiumDetailPage';

const FIELD_LABELS: Record<string, string> = {
  title: '제목',
  content: '본문',
  imageUrls: '이미지',
  naverMapUrl: '네이버 지도',
  blogUrl: '블로그',
  youtubeUrl: '유튜브',
  instagramUrl: '인스타그램',
  kakaoOpenChatUrl: '카카오 오픈채팅',
  baeminUrl: '배달의민족',
  coupangEatsUrl: '쿠팡이츠',
};

function StatusBadge({ status }: { status: PremiumStatus }): React.ReactElement {
  return <DomainStatusBadge.Premium status={status} size="md" />;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className='grid grid-cols-[140px_1fr] gap-3 items-start py-2.5 border-b last:border-0 border-border/50'>
      <span className='text-sm font-medium text-muted-foreground pt-0.5'>{label}</span>
      <span className='text-base font-medium text-foreground'>{children}</span>
    </div>
  );
}

export default function PremiumAdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = usePremiumDetailPage(params);
  const adImgLb = useImageLightbox(page.detail?.imageUrls ?? []);
  const pendingImgLb = useImageLightbox(
    Array.isArray((page.detail?.pendingChanges as { imageUrls?: string[] } | null)?.imageUrls)
      ? ((page.detail!.pendingChanges as { imageUrls?: string[] }).imageUrls ?? [])
      : []
  );

  if (page.loading) {
    return (
      <div className='flex w-full flex-col gap-6 px-6 py-6 md:py-8'>
        <AdminHeader title='프리미엄 광고 상세' />
        <div className='flex w-full items-center justify-center py-20'>
          <div className='flex flex-col items-center gap-3 text-muted-foreground'>
            <div className='h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin' />
            <span className='text-base'>불러오는 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!page.detail) {
    return (
      <div className='flex w-full flex-col gap-6 px-6 py-6 md:py-8'>
        <AdminHeader title='프리미엄 광고 상세' />
        <div className='flex w-full items-center justify-center py-20'>
          <div className='flex flex-col items-center gap-2 text-muted-foreground'>
            <AlertCircle className='h-8 w-8' />
            <span className='text-base'>프리미엄 광고 정보를 찾을 수 없습니다.</span>
          </div>
        </div>
      </div>
    );
  }

  const { detail } = page;

  const socialLinks = [
    { label: '네이버 지도', url: detail.naverMapUrl },
    { label: '블로그', url: detail.blogUrl },
    { label: '유튜브', url: detail.youtubeUrl },
    { label: '인스타그램', url: detail.instagramUrl },
    { label: '카카오톡 오픈채팅', url: detail.kakaoOpenChatUrl },
    { label: '배달의민족', url: detail.baeminUrl },
    { label: '쿠팡이츠', url: detail.coupangEatsUrl },
  ].filter((s) => s.url);

  return (
    <div className='flex w-full flex-col gap-6 px-6 py-6 md:py-8'>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => router.push('/admin/advertising-v2/premium')}
          aria-label='뒤로가기'
        >
          <ChevronLeft className='size-7' />
        </Button>
        <AdminHeader title='프리미엄 광고 상세' className='flex-1' />
      </div>

      <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]'>
        {/* ───────────────────── 좌측 메인 ───────────────────── */}
        <div className='min-w-0 space-y-5'>
          {/* 1. 광고 본문 카드: 카테고리 → 이미지 → 제목 → 내용 → 링크 */}
          <Card>
            <CardContent className='space-y-4 px-6 py-5'>
              {/* 카테고리 태그 + 상태 뱃지 */}
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary'>
                  <Tag className='h-3.5 w-3.5' />
                  {detail.category?.categoryName ?? '-'}
                  {detail.subCategoryNames.length > 0 && (
                    <>
                      <span className='text-primary/60'>›</span>
                      {detail.subCategoryNames.join(', ')}
                    </>
                  )}
                </span>
                <div className='flex flex-wrap items-center gap-2'>
                  {detail.modificationStatus === 'pending' && (
                    <Badge
                      variant='outline'
                      className='border-purple-200 bg-purple-50 px-2.5 py-0.5 text-sm font-medium text-purple-700'
                    >
                      수정 심사
                    </Badge>
                  )}
                </div>
              </div>
              {/* 이미지 */}
              {detail.imageUrls.length > 0 && (
                <div className='flex flex-wrap gap-2.5'>
                  {detail.imageUrls.map((url, i) => (
                    <ImageThumbnail
                      key={i}
                      src={url}
                      alt={`광고 이미지 ${i + 1}`}
                      onClick={() => adImgLb.open(i)}
                    />
                  ))}
                </div>
              )}
              {/* 제목 + 신청일시 */}
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <h1 className='text-xl font-bold text-foreground'>
                    {detail.title ?? '(제목 없음)'}
                  </h1>
                  <StatusBadge status={detail.status} />
                </div>
                <p className='mt-1.5 text-sm text-muted-foreground'>
                  신청일시: {new Date(detail.createdAt).toLocaleString('ko-KR')}
                </p>
              </div>
              {/* 내용 */}
              {detail.content && (
                <div className='border-t border-border/60 pt-4'>
                  <p className='whitespace-pre-wrap text-base leading-relaxed text-foreground'>
                    {detail.content}
                  </p>
                </div>
              )}
              {/* 소셜 링크 */}
              {socialLinks.length > 0 && (
                <div className='border-t border-border/60 pt-4'>
                  <p className='mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground'>
                    <ExternalLink className='h-3.5 w-3.5' />
                    소셜 링크
                  </p>
                  <div className='flex flex-wrap gap-x-6 gap-y-1.5'>
                    {socialLinks.map((s) => (
                      <a
                        key={s.label}
                        href={s.url!}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1.5 text-base text-primary hover:underline'
                      >
                        <ExternalLink className='h-3.5 w-3.5' />
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 거절 사유 배너 */}
          {detail.rejectedReason && (
            <div className='flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg'>
              <AlertCircle className='h-4 w-4 text-red-600 mt-0.5 shrink-0' />
              <div>
                <p className='text-base font-medium text-red-800 mb-0.5'>거절 사유</p>
                <p className='text-base text-red-700 whitespace-pre-wrap'>
                  {detail.rejectedReason}
                </p>
              </div>
            </div>
          )}

          {/* 수정 거절 사유 배너 */}
          {detail.modificationRejectedReason && (
            <div className='flex gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg'>
              <AlertCircle className='h-4 w-4 text-orange-600 mt-0.5 shrink-0' />
              <div>
                <p className='text-base font-medium text-orange-800 mb-0.5'>수정 거절 사유</p>
                <p className='text-base text-orange-700 whitespace-pre-wrap'>
                  {detail.modificationRejectedReason}
                </p>
              </div>
            </div>
          )}

          {/* 수정 심사 비교 */}
          {detail.modificationStatus === 'pending' && detail.pendingChanges && (
            <Card className='border-purple-200 bg-purple-50/40'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold flex items-center gap-2 text-purple-800'>
                  <GitCompare className='h-4 w-4' />
                  수정 내용 비교 (현재 → 수정 요청)
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {Object.entries(detail.pendingChanges).map(([key, pendingValue]) => {
                  const label = FIELD_LABELS[key] ?? key;
                  const currentValue = (detail as unknown as Record<string, unknown>)[key];
                  const isChanged =
                    JSON.stringify(currentValue) !== JSON.stringify(pendingValue);
                  if (!isChanged) return null;

                  if (key === 'imageUrls') {
                    return (
                      <div key={key} className='space-y-2'>
                        <p className='text-sm font-medium text-muted-foreground'>{label}</p>
                        <div className='grid grid-cols-2 gap-4'>
                          <div>
                            <p className='mb-1.5 text-xs text-muted-foreground'>
                              현재 ({((currentValue as string[]) ?? []).length}장)
                            </p>
                            <div className='flex flex-wrap gap-1.5'>
                              {((currentValue as string[]) ?? []).map((url, i) => (
                                <ImageThumbnail
                                  key={i}
                                  src={url}
                                  alt=''
                                  className='h-24 w-24'
                                  onClick={() => adImgLb.open(i)}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className='mb-1.5 text-xs font-medium text-purple-600'>
                              수정 요청 ({((pendingValue as string[]) ?? []).length}장)
                            </p>
                            <div className='flex flex-wrap gap-1.5'>
                              {((pendingValue as string[]) ?? []).map((url, i) => (
                                <ImageThumbnail
                                  key={i}
                                  src={url}
                                  alt=''
                                  className='h-24 w-24 border-2 border-purple-300'
                                  onClick={() => pendingImgLb.open(i)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <CompareRow
                      key={key}
                      label={label}
                      current={(currentValue as string | null) ?? '(없음)'}
                      proposed={(pendingValue as string | null) ?? '(없음)'}
                      multiline={key === 'content'}
                    />
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 연장 이력 */}
          {page.extensions.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold'>
                  연장 이력 (총 {page.extensions.length}건)
                </CardTitle>
              </CardHeader>
              <CardContent className='px-6 pb-5'>
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='border-b border-border/60 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                        <th className='py-2 pr-3'>차수</th>
                        <th className='py-2 pr-3'>결제일</th>
                        <th className='py-2 pr-3'>주수</th>
                        <th className='py-2 pr-3 text-right'>결제 금액</th>
                        <th className='py-2 pr-3'>광고 기간</th>
                        <th className='py-2'>영수증</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.extensions.map((ext, idx) => (
                        <tr
                          key={ext.id}
                          className='border-b border-border/40 last:border-b-0'
                        >
                          <td className='py-2.5 pr-3 font-medium text-foreground'>
                            {idx + 1}차
                          </td>
                          <td className='py-2.5 pr-3 text-foreground'>
                            {ext.paidAt.toLocaleDateString('ko-KR')}
                          </td>
                          <td className='py-2.5 pr-3 text-foreground'>{ext.weeks}주</td>
                          <td className='py-2.5 pr-3 text-right font-semibold text-foreground tabular-nums'>
                            {ext.amount.toLocaleString()}원
                          </td>
                          <td className='py-2.5 pr-3 text-xs text-muted-foreground'>
                            {ext.periodStart.toLocaleDateString('ko-KR')} ~{' '}
                            {ext.periodEnd.toLocaleDateString('ko-KR')}
                          </td>
                          <td className='py-2.5'>
                            {ext.receiptUrl ? (
                              <a
                                href={ext.receiptUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center gap-1 text-xs text-primary hover:underline'
                              >
                                <ExternalLink className='h-3 w-3' /> 보기
                              </a>
                            ) : (
                              <span className='text-xs text-muted-foreground'>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 광고 통계 */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base font-semibold'>
                <BarChart2 className='h-4 w-4 text-muted-foreground' />
                광고 통계 (누적)
              </CardTitle>
            </CardHeader>
            <CardContent className='px-6 pb-4'>
              {(() => {
                const a = page.analytics;
                const fmt = (n: number) => n.toLocaleString();
                const isFoodCategory = detail.category?.categoryName === '음식';
                const rows: { label: string; value: number }[] = [
                  { label: '카테고리 노출', value: a?.impressionCount ?? 0 },
                  { label: '홈 프리미엄 노출수', value: a?.homePremiumImpressionCount ?? 0 },
                  { label: '다이얼로그 노출수', value: a?.dialogImpressionCount ?? 0 },
                  { label: '클릭수', value: a?.clickCount ?? 0 },
                  { label: '전화 클릭', value: a?.phoneClickCount ?? 0 },
                  { label: '찜 수', value: a?.wishCount ?? 0 },
                  { label: '네이버지도 클릭', value: a?.naverMapClickCount ?? 0 },
                  { label: '블로그 클릭', value: a?.blogClickCount ?? 0 },
                  { label: '유튜브 클릭', value: a?.youtubeClickCount ?? 0 },
                  { label: '인스타그램 클릭', value: a?.instagramClickCount ?? 0 },
                  { label: '카카오채팅 클릭', value: a?.kakaoChatClickCount ?? 0 },
                  ...(isFoodCategory ? [
                    { label: '배민 클릭', value: a?.baeminClickCount ?? 0 },
                    { label: '쿠팡이츠 클릭', value: a?.coupangEatsClickCount ?? 0 },
                  ] : []),
                ];
                return (
                  <div className='space-y-1.5 text-sm'>
                    {rows.flatMap(({ label, value }) => {
                      const row = (
                        <div key={label} className='flex items-center'>
                          <span className='text-muted-foreground min-w-[9rem] shrink-0'>{label}</span>
                          <span className='tabular-nums font-medium'>{fmt(value)}</span>
                        </div>
                      );
                      if (label === '네이버지도 클릭') {
                        return [<hr key={`${label}-hr`} className='border-border/50 my-1' />, row];
                      }
                      return [row];
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* 파트너 정보 */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base font-semibold'>
                <Building2 className='h-4 w-4 text-muted-foreground' />
                파트너 정보
              </CardTitle>
            </CardHeader>
            <CardContent className='px-6 py-0 pb-4'>
              <div className='grid gap-x-6 sm:grid-cols-2'>
                <InfoRow label='상호명'>{detail.partner?.businessName ?? '-'}</InfoRow>
                <InfoRow label='대표자명'>{detail.partner?.representativeName ?? '-'}</InfoRow>
                <InfoRow label='광고표시용 전화'>
                  {detail.partner?.displayPhoneNumber ?? '-'}
                </InfoRow>
                <InfoRow label='연락처'>{detail.partner?.phoneNumber ?? '-'}</InfoRow>
                <InfoRow label='사업자등록번호'>
                  {detail.partner?.businessRegistrationNumber ?? '-'}
                </InfoRow>
                <InfoRow label='파트너 가입일'>
                  {detail.partner?.createdAt
                    ? new Date(detail.partner.createdAt).toLocaleDateString('ko-KR')
                    : '-'}
                </InfoRow>
                {/* auth.users 기반 계정 정보 (관리자 API 경유 조회) */}
                <InfoRow label='로그인 이메일'>
                  {page.partnerExtra.authInfo?.email ?? '-'}
                </InfoRow>
                <InfoRow label='로그인 방식'>
                  {formatAuthProviders(page.partnerExtra.authInfo?.providers)}
                </InfoRow>
                <InfoRow label='최근 로그인'>
                  {page.partnerExtra.authInfo?.lastSignInAt
                    ? new Date(page.partnerExtra.authInfo.lastSignInAt).toLocaleString('ko-KR')
                    : '-'}
                </InfoRow>
                <div className='sm:col-span-2'>
                  <InfoRow label='사업장 주소'>
                    {detail.partner?.businessAddress ? (
                      <span>
                        {detail.partner.businessAddress}
                        {detail.partner.businessDetailAddress && (
                          <span className='text-muted-foreground'>
                            {' '}
                            {detail.partner.businessDetailAddress}
                          </span>
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </InfoRow>
                </div>
                <div className='sm:col-span-2'>
                  <InfoRow label='주차 정보'>{detail.partner?.parkingInfo ?? '-'}</InfoRow>
                </div>
                <InfoRow label='기본 광고 ID'>
                  <span className='font-mono text-sm'>{detail.baseAdId.slice(0, 8)}…</span>
                </InfoRow>
              </div>
            </CardContent>
          </Card>

          {/* 파트너 영업시간 / 발급 쿠폰 */}
          <div className='grid gap-4 lg:grid-cols-2'>
            <PartnerBusinessHoursCard
              businessHours={page.partnerExtra.businessHours}
              businessHoursNote={detail.partner?.businessHoursNote}
              loading={page.partnerExtra.loading}
            />
            <PartnerCouponsCard
              coupons={page.partnerExtra.coupons}
              loading={page.partnerExtra.loading}
            />
          </div>
        </div>

        {/* ───────────────────── 우측 Sticky 사이드바 ───────────────────── */}
        <aside>
          <div className='space-y-4'>
            {/* 결제/기간 요약 */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold'>결제 정보</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2.5 px-6 pb-4'>
                {/* 광고 아파트 */}
                <div className='space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground'>
                      <Building2 className='h-3.5 w-3.5' />
                      광고 아파트
                    </span>
                    <span className='text-sm font-medium tabular-nums text-muted-foreground'>
                      {detail.snapshotApartments.length}개 ·{' '}
                      {page.totalHouseholds.toLocaleString()}세대
                    </span>
                  </div>
                  {detail.snapshotApartments.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>아파트 정보 없음</p>
                  ) : (
                    <ul className='divide-y divide-border/50'>
                      {detail.snapshotApartments.map((apt, i) => (
                        <li
                          key={i}
                          className='flex items-start justify-between gap-3 py-2 text-sm'
                        >
                          <div className='min-w-0 flex-1'>
                            <p className='truncate font-medium'>{apt.apartmentName}</p>
                            <p className='mt-0.5 flex items-center gap-1 text-xs text-muted-foreground'>
                              <MapPin className='h-3 w-3 shrink-0' />
                              <span className='truncate'>{apt.address}</span>
                            </p>
                          </div>
                          <span className='shrink-0 text-sm font-semibold tabular-nums text-foreground'>
                            {apt.totalHouseholds.toLocaleString()}
                            <span className='ml-0.5 text-xs font-normal text-muted-foreground'>
                              세대
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div className='space-y-1.5 text-sm'>
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>광고 기간</span>
                    <span className='font-medium tabular-nums'>
                      {page.cumulativeWeeks}주
                      {page.extensionWeeks > 0 && (
                        <span className='ml-1 text-xs text-muted-foreground'>
                          (원 {detail.weeks}주 + 연장 {page.extensionWeeks}주)
                        </span>
                      )}
                    </span>
                  </div>
                  {detail.startedAt && (
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>광고 시작일</span>
                      <span className='font-medium'>
                        {new Date(detail.startedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  )}
                  {detail.endedAt && (
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>광고 종료일</span>
                      <span className='font-medium'>
                        {new Date(detail.endedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className='flex items-center justify-between text-base font-semibold'>
                  <span>결제 금액</span>
                  <div className='flex flex-col items-end gap-0.5'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-primary tabular-nums'>
                        {page.displayAmount != null
                          ? `${page.displayAmount.toLocaleString()}원`
                          : '-'}
                      </span>
                      {(detail.approvedDiscountRate ?? 0) > 0 && (
                        <span className='text-xs font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded'>
                          {detail.approvedDiscountRate}%↓
                        </span>
                      )}
                    </div>
                    {(detail.approvedDiscountRate ?? 0) > 0 && page.baseDisplayAmount != null && (
                      <span className='text-xs text-muted-foreground line-through tabular-nums'>
                        정상가 {page.baseDisplayAmount.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
                {page.extensionAmount != null &&
                  page.extensionAmount > 0 &&
                  detail.totalAmount != null && (
                    <p className='text-xs text-muted-foreground text-right'>
                      원 {detail.totalAmount.toLocaleString()}원 + 연장{' '}
                      {page.extensionAmount.toLocaleString()}원
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* 액션 버튼 (pending 상태일 때만) */}
            {detail.status === 'pending' && (
              <Card>
                <CardContent className='space-y-2 px-6 py-4'>
                  <Button
                    size='lg'
                    onClick={page.handleApprove}
                    disabled={page.processing}
                    className='w-full gap-2 bg-blue-600 text-white hover:bg-blue-700'
                  >
                    <Check className='h-4 w-4' />
                    승인하기
                  </Button>
                  <Button
                    variant='outline'
                    size='lg'
                    onClick={() => page.setRejectDialog(true)}
                    disabled={page.processing}
                    className='w-full gap-2'
                  >
                    <X className='h-4 w-4' />
                    거절하기
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 수정 심사 액션 */}
            {detail.modificationStatus === 'pending' && (
              <Card>
                <CardContent className='space-y-2 px-6 py-4'>
                  <p className='mb-1 text-sm text-muted-foreground'>수정 내용을 검토해주세요.</p>
                  <Button
                    size='lg'
                    onClick={page.handleApproveModification}
                    disabled={page.processing}
                    className='w-full gap-2 bg-blue-600 text-white hover:bg-blue-700'
                  >
                    <Check className='h-4 w-4' />
                    수정 승인
                  </Button>
                  <Button
                    variant='outline'
                    size='lg'
                    onClick={() => page.setModificationRejectDialog(true)}
                    disabled={page.processing}
                    className='w-full gap-2'
                  >
                    <X className='h-4 w-4' />
                    수정 거절
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 관리 메모 */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold'>관리 메모</CardTitle>
                <p className='text-xs text-muted-foreground'>내부용 · 파트너에게 공개되지 않습니다</p>
              </CardHeader>
              <CardContent className='space-y-2 px-6 pb-4'>
                <Textarea
                  className='min-h-[100px] resize-none text-sm'
                  placeholder='이 광고에 대한 내부 메모를 남겨주세요...'
                  maxLength={500}
                  value={page.adminMemo}
                  onChange={(e) => page.setAdminMemo(e.target.value)}
                />
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-muted-foreground'>{page.adminMemo.length}/500</span>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={page.handleUpdateMemo}
                    disabled={page.processing}
                  >
                    {page.processing ? '저장 중...' : '저장'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* 거절 다이얼로그 */}
      <Dialog open={page.rejectDialog} onOpenChange={page.setRejectDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>프리미엄 광고 거절</DialogTitle>
            <DialogDescription>
              거절 사유를 입력해주세요. 파트너가 이 사유를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className='py-2'>
            <Textarea
              className='min-h-[120px] resize-none'
              placeholder='거절 사유를 입력해주세요...'
              value={page.rejectReason}
              onChange={(e) => page.setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => page.setRejectDialog(false)}
              disabled={page.processing}
            >
              취소
            </Button>
            <Button
              variant='destructive'
              onClick={page.handleReject}
              disabled={page.processing}
            >
              {page.processing ? '처리 중...' : '거절'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 승인 다이얼로그 */}
      <Dialog open={page.approveDialog} onOpenChange={page.setApproveDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>프리미엄 광고 승인</DialogTitle>
            <DialogDescription>
              할인율을 입력하면 파트너에게 할인된 금액으로 결제 요청됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>할인율 (%)</label>
              <Input
                type='number'
                min={0}
                max={100}
                placeholder='0 (할인 없음)'
                value={page.discountRate || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  page.setDiscountRate(
                    val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0))
                  );
                }}
              />
            </div>
            {page.detail?.totalAmount != null && page.discountRate > 0 && (
              <div className='rounded-md bg-muted p-3 text-sm'>
                <span className='text-muted-foreground'>할인 후 결제금액: </span>
                <span className='font-semibold'>
                  {(
                    Math.round(
                      (page.detail.totalAmount * (100 - page.discountRate)) / 100 / 10
                    ) * 10
                  ).toLocaleString()}
                  원
                </span>
                <span className='text-muted-foreground ml-1'>
                  (정상가 {page.detail.totalAmount.toLocaleString()}원)
                </span>
              </div>
            )}
            {/* 광고 분석 열람 권한 부여 */}
            <div className='rounded-md border border-blue-200 bg-blue-50 p-3 space-y-1.5'>
              <label className='flex items-center gap-2 cursor-pointer'>
                <Checkbox
                  checked={page.grantAnalytics}
                  disabled={detail.partner?.analyticsEnabled}
                  onCheckedChange={(checked) => page.setGrantAnalytics(!!checked)}
                  className='border-blue-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600'
                />
                <span className='text-sm font-semibold text-blue-900'>광고 분석 열람 권한 부여</span>
              </label>
              {detail.partner?.analyticsEnabled ? (
                <p className='text-sm text-blue-600 pl-6'>이미 분석 열람 권한이 허용된 파트너입니다.</p>
              ) : (
                <p className='text-sm text-blue-700/70 pl-6'>승인 시 파트너가 앱에서 광고 통계를 열람할 수 있습니다.</p>
              )}
            </div>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>
                관리 메모{' '}
                <span className='font-normal text-muted-foreground'>(내부용, 파트너 비공개)</span>
              </label>
              <Textarea
                className='min-h-[80px] resize-none'
                placeholder='승인 관련 내부 메모를 남겨주세요...'
                maxLength={500}
                value={page.adminMemo}
                onChange={(e) => page.setAdminMemo(e.target.value)}
              />
              <p className='text-right text-xs text-muted-foreground'>{page.adminMemo.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => page.setApproveDialog(false)}>
              취소
            </Button>
            <Button onClick={page.handleApproveConfirm} disabled={page.processing}>
              {page.processing ? '처리 중...' : '승인 확정'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 거절 다이얼로그 */}
      <Dialog
        open={page.modificationRejectDialog}
        onOpenChange={page.setModificationRejectDialog}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>수정 내용 거절</DialogTitle>
            <DialogDescription>
              거절 사유를 입력해주세요. 파트너가 앱에서 이 사유를 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className='py-2'>
            <Textarea
              className='min-h-[120px] resize-none'
              placeholder='거절 사유를 입력해주세요...'
              value={page.modificationRejectReason}
              onChange={(e) => page.setModificationRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => page.setModificationRejectDialog(false)}
              disabled={page.processing}
            >
              취소
            </Button>
            <Button
              variant='destructive'
              onClick={page.handleRejectModification}
              disabled={page.processing}
            >
              {page.processing ? '처리 중...' : '거절'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox {...adImgLb.props} />
      <ImageLightbox {...pendingImgLb.props} />
    </div>
  );
}

// ── 비교 행 컴포넌트 ───────────────────────────────────────────
function CompareRow({
  label,
  current,
  proposed,
  multiline = false,
}: {
  label: string;
  current: string;
  proposed: string;
  multiline?: boolean;
}): React.ReactElement {
  return (
    <div className='space-y-1.5'>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <div className='grid grid-cols-2 gap-3'>
        <div className='rounded-md bg-muted/50 p-2.5'>
          <p className='text-xs text-muted-foreground mb-1'>현재</p>
          <p
            className={`text-sm text-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}
          >
            {current}
          </p>
        </div>
        <div className='rounded-md bg-purple-50 border border-purple-200 p-2.5'>
          <p className='text-xs text-purple-600 mb-1 font-medium'>수정 요청</p>
          <p
            className={`text-sm text-foreground font-medium ${
              multiline ? 'whitespace-pre-wrap' : ''
            }`}
          >
            {proposed}
          </p>
        </div>
      </div>
    </div>
  );
}

