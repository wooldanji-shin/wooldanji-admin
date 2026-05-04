'use client';

import { AdminHeader } from '@/components/admin-header';
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
  ImageIcon,
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
          {/* 1. 광고 본문 카드 */}
          <Card>
            <CardContent className='space-y-4 px-6 py-5'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0 flex-1'>
                  <h1 className='text-xl font-bold text-foreground'>
                    {detail.title ?? '(제목 없음)'}
                  </h1>
                  <p className='mt-1.5 text-sm text-muted-foreground'>
                    신청일시: {new Date(detail.createdAt).toLocaleString('ko-KR')}
                  </p>
                  <div className='mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground'>
                    <span>카테고리:</span>
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
                  </div>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <StatusBadge status={detail.status} />
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
              {detail.content && (
                <div className='border-t border-border/60 pt-4'>
                  <p className='whitespace-pre-wrap text-base leading-relaxed text-foreground'>
                    {detail.content}
                  </p>
                </div>
              )}
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

          {/* 2. 광고 이미지 카드 */}
          {detail.imageUrls.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2 text-base font-semibold'>
                  <ImageIcon className='h-4 w-4 text-muted-foreground' />
                  광고 이미지
                  <span className='ml-auto text-sm font-normal text-muted-foreground'>
                    {detail.imageUrls.length}장
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className='px-6 pb-5'>
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
              </CardContent>
            </Card>
          )}

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
                const rows: { label: string; value: number }[] = [
                  { label: '노출수', value: a?.impressionCount ?? 0 },
                  { label: '홈 프리미엄 노출수', value: a?.homePremiumImpressionCount ?? 0 },
                  { label: '다이얼로그 노출수', value: a?.dialogImpressionCount ?? 0 },
                  { label: '클릭수', value: a?.clickCount ?? 0 },
                  { label: '전화 클릭', value: a?.phoneClickCount ?? 0 },
                  { label: '네이버지도 클릭', value: a?.naverMapClickCount ?? 0 },
                  { label: '블로그 클릭', value: a?.blogClickCount ?? 0 },
                  { label: '유튜브 클릭', value: a?.youtubeClickCount ?? 0 },
                  { label: '인스타그램 클릭', value: a?.instagramClickCount ?? 0 },
                  { label: '카카오채팅 클릭', value: a?.kakaoChatClickCount ?? 0 },
                ];
                return (
                  <div className='space-y-2 text-sm'>
                    {rows.map(({ label, value }) => (
                      <div key={label} className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>{label}</span>
                        <span className='tabular-nums font-medium'>{fmt(value)}</span>
                      </div>
                    ))}
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
                <InfoRow label='기본 광고 ID'>
                  <span className='font-mono text-sm'>{detail.baseAdId.slice(0, 8)}…</span>
                </InfoRow>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ───────────────────── 우측 Sticky 사이드바 ───────────────────── */}
        <aside className='lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto'>
          <div className='space-y-4'>
            {/* 상태 요약 */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold'>상태</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2.5 px-6 pb-4 text-sm'>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>광고 상태</span>
                  <StatusBadge status={detail.status} />
                </div>
                {detail.modificationStatus && (
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>수정 심사</span>
                    <Badge
                      variant='outline'
                      className='border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700'
                    >
                      {detail.modificationStatus === 'pending'
                        ? '심사 대기'
                        : detail.modificationStatus === 'approved'
                        ? '승인'
                        : '거절'}
                    </Badge>
                  </div>
                )}
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>결제 상태</span>
                  <span className='font-medium'>
                    {detail.paymentStatus === 'paid' ? '결제 완료' : '결제 대기'}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>신청일</span>
                  <span className='font-medium'>
                    {new Date(detail.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </CardContent>
            </Card>

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
                  <span className='text-primary tabular-nums'>
                    {page.displayAmount != null
                      ? `${page.displayAmount.toLocaleString()}원`
                      : '-'}
                  </span>
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

