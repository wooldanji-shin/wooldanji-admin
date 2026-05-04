'use client';

import { AdminHeader } from '@/components/admin-header';
import { Skeleton } from '@/components/ui/skeleton';
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
  ImageIcon,
  MapPin,
  Phone,
  Tag,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useApplicationDetailPage } from './useApplicationDetailPage';

import { StatusBadge as DomainStatusBadge, type AdStatus, type ModificationStatus } from '@/components/status-badge';
import { ImageThumbnail, ImageLightbox, useImageLightbox } from '@/components/image-lightbox';

function StatusBadge({ status }: { status: string }): React.ReactElement {
  return <DomainStatusBadge.Ad status={status as AdStatus} size="md" />;
}

function ModificationBadge({ status }: { status: string | null }): React.ReactElement | null {
  return <DomainStatusBadge.Modification status={status as ModificationStatus} size="md" />;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[140px_1fr] gap-3 items-start py-2.5 border-b last:border-0 border-border/50'>
      <span className='text-sm font-medium text-muted-foreground pt-0.5'>{label}</span>
      <span className='text-base font-medium text-foreground'>{children}</span>
    </div>
  );
}

export default function AdApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const router = useRouter();
  const page = useApplicationDetailPage(params);
  const adImgLb = useImageLightbox(page.detail?.imageUrls ?? []);
  const pendingImgLb = useImageLightbox(page.detail?.pendingChanges?.imageUrls ?? []);

  if (page.loading) {
    return (
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title='광고 신청 상세' />
        <div className="flex w-full items-center justify-center py-20">
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
      <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
        <AdminHeader title='광고 신청 상세' />
        <div className="flex w-full items-center justify-center py-20">
          <div className='flex flex-col items-center gap-2 text-muted-foreground'>
            <AlertCircle className='h-8 w-8' />
            <span className='text-base'>광고 신청 정보를 찾을 수 없습니다.</span>
          </div>
        </div>
      </div>
    );
  }

  const { detail } = page;
  const effectiveDiscountRate = detail.approvedDiscountRate ?? detail.defaultDiscountRate;
  const effectiveMonthlyAmount = detail.approvedMonthlyAmount
    ?? Math.round((page.monthlyAmount * (1 - effectiveDiscountRate / 100)) / 10) * 10;

  const socialLinks = [
    { label: '네이버 지도', url: detail.naverMapUrl },
    { label: '블로그', url: detail.blogUrl },
    { label: '유튜브', url: detail.youtubeUrl },
    { label: '인스타그램', url: detail.instagramUrl },
    { label: '카카오톡 오픈채팅', url: detail.kakaoOpenChatUrl },
  ].filter((s) => s.url);

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => router.push('/admin/advertising-v2/applications')}
          aria-label='뒤로가기'
        >
          <ChevronLeft className='size-7' />
        </Button>
        <AdminHeader title='광고 신청 상세' className='flex-1' />
      </div>

      <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]'>
        {/* ───────────────────── 좌측 메인 ───────────────────── */}
        <div className='min-w-0 space-y-5'>
          {/* 1. 광고 본문 카드: 제목 + 내용 + 소셜 링크 */}
          <Card>
            <CardContent className='space-y-4 px-6 py-5'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0 flex-1'>
                  <h1 className='text-xl font-bold text-foreground'>{detail.title}</h1>
                  {detail.submittedAt && (
                    <p className='mt-1.5 text-sm text-muted-foreground'>
                      신청일시: {new Date(detail.submittedAt).toLocaleString('ko-KR')}
                    </p>
                  )}
                  <div className='mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground'>
                    <span>카테고리</span>
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
                  <StatusBadge status={detail.adStatus} />
                  <ModificationBadge status={detail.modificationStatus} />
                  {detail.adStatus === 'pending' && detail.isFirstAd && (
                    <Badge
                      variant='outline'
                      className='border-blue-200 bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800'
                    >
                      첫광고
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

          {/* 2. 광고 이미지 카드 (별도) */}
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
          {detail.rejectReason && (
            <div className='flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg'>
              <AlertCircle className='h-4 w-4 text-red-600 mt-0.5 shrink-0' />
              <div>
                <p className='text-base font-medium text-red-800 mb-0.5'>거절 사유</p>
                <p className='text-base text-red-700 whitespace-pre-wrap'>{detail.rejectReason}</p>
              </div>
            </div>
          )}

          {/* 수정 심사 섹션 */}
          {detail.modificationStatus === 'pending' && detail.pendingChanges && (
            <Card className='border-purple-200 bg-purple-50/40'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold flex items-center gap-2 text-purple-800'>
                  <GitCompare className='h-4 w-4' />
                  수정 내용 비교 (현재 → 수정 요청)
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* 제목 비교 */}
                {detail.pendingChanges.title !== undefined && detail.pendingChanges.title !== detail.title && (
                  <CompareRow
                    label='광고 제목'
                    current={detail.title}
                    proposed={detail.pendingChanges.title ?? ''}
                  />
                )}
                {/* 내용 비교 */}
                {detail.pendingChanges.content !== undefined && detail.pendingChanges.content !== detail.content && (
                  <CompareRow
                    label='광고 내용'
                    current={detail.content ?? '(없음)'}
                    proposed={detail.pendingChanges.content ?? '(없음)'}
                    multiline
                  />
                )}
                {/* 카테고리 비교 */}
                {detail.pendingChanges.resolvedCategoryName && (
                  <CompareRow
                    label='카테고리'
                    current={detail.category?.categoryName ?? '-'}
                    proposed={detail.pendingChanges.resolvedCategoryName}
                  />
                )}
                {detail.pendingChanges.resolvedSubCategoryNames && detail.pendingChanges.resolvedSubCategoryNames.length > 0 && (
                  <CompareRow
                    label='서브카테고리'
                    current={detail.subCategoryNames.join(', ') || '-'}
                    proposed={detail.pendingChanges.resolvedSubCategoryNames.join(', ')}
                  />
                )}
                {/* SNS 링크 비교 */}
                {(['naverMapUrl', 'blogUrl', 'youtubeUrl', 'instagramUrl', 'kakaoOpenChatUrl'] as const).map((key) => {
                  const labelMap = { naverMapUrl: '네이버 지도', blogUrl: '블로그', youtubeUrl: '유튜브', instagramUrl: '인스타그램', kakaoOpenChatUrl: '카카오톡 오픈채팅' };
                  const proposed = detail.pendingChanges![key];
                  const current = detail[key];
                  if (proposed === undefined || proposed === current) return null;
                  return (
                    <CompareRow
                      key={key}
                      label={labelMap[key]}
                      current={current ?? '(없음)'}
                      proposed={proposed ?? '(없음)'}
                    />
                  );
                })}
                {/* 아파트 비교 */}
                {detail.pendingChanges.resolvedApartments && detail.pendingChanges.resolvedApartments.length > 0 && (() => {
                  const discountRate = detail.approvedDiscountRate ?? detail.defaultDiscountRate;
                  const calcFee = (apts: typeof detail.apartments) => {
                    const total = apts.reduce((s, a) => s + a.totalHouseholds, 0);
                    const original = Math.round(total * detail.pricePerHousehold / 10) * 10;
                    return Math.round(original * (100 - discountRate) / 100 / 10) * 10;
                  };
                  const currentFee = detail.approvedMonthlyAmount ?? calcFee(detail.apartments);
                  const newFee = calcFee(detail.pendingChanges!.resolvedApartments!);
                  const diff = newFee - currentFee;
                  return (
                    <div className='space-y-2'>
                      <p className='text-sm font-medium text-muted-foreground'>신청 아파트</p>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <p className='text-xs text-muted-foreground mb-1.5'>현재 ({detail.apartments.length}개)</p>
                          <div className='space-y-1.5'>
                            {detail.apartments.map((apt) => (
                              <div key={apt.apartmentId} className='flex items-start gap-1.5 p-2 rounded border border-border/50 bg-white text-sm'>
                                <Building2 className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                                <div>
                                  <p className='font-medium text-foreground'>{apt.apartmentName}</p>
                                  <p className='text-xs text-muted-foreground'>{apt.totalHouseholds.toLocaleString()}세대</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className='text-xs text-purple-600 mb-1.5 font-medium'>수정 요청 ({detail.pendingChanges!.resolvedApartments!.length}개)</p>
                          <div className='space-y-1.5'>
                            {detail.pendingChanges!.resolvedApartments!.map((apt) => (
                              <div key={apt.apartmentId} className='flex items-start gap-1.5 p-2 rounded border-2 border-purple-300 bg-purple-50/50 text-sm'>
                                <Building2 className='h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0' />
                                <div>
                                  <p className='font-medium text-foreground'>{apt.apartmentName}</p>
                                  <p className='text-xs text-muted-foreground'>{apt.totalHouseholds.toLocaleString()}세대</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* 월 금액 변경 */}
                      <div className='flex items-center justify-between p-3 rounded-lg bg-white border border-border/50 text-sm mt-1'>
                        <span className='text-muted-foreground font-medium'>월 금액 변경</span>
                        <div className='flex items-center gap-2 font-semibold'>
                          <span className='text-foreground'>{currentFee.toLocaleString()}원</span>
                          <span className='text-muted-foreground'>→</span>
                          <span className='text-purple-700'>{newFee.toLocaleString()}원</span>
                          {diff !== 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${diff > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      </div>
                      {diff > 0 && (
                        <p className='text-xs text-muted-foreground mt-1'>
                          * 승인 시 남은 구독 기간 일할 계산하여 차액이 확정됩니다.
                        </p>
                      )}
                    </div>
                  );
                })()}
                {/* 이미지 비교 */}
                {detail.pendingChanges.imageUrls && (
                  <div className='space-y-2'>
                    <p className='text-sm font-medium text-muted-foreground'>이미지</p>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <p className='mb-1.5 text-xs text-muted-foreground'>현재 ({detail.imageUrls.length}장)</p>
                        <div className='flex flex-wrap gap-1.5'>
                          {detail.imageUrls.map((url, i) => (
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
                        <p className='mb-1.5 text-xs font-medium text-purple-600'>수정 요청 ({detail.pendingChanges.imageUrls.length}장)</p>
                        <div className='flex flex-wrap gap-1.5'>
                          {detail.pendingChanges.imageUrls.map((url, i) => (
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
                )}
              </CardContent>
            </Card>
          )}

          {/* 아파트 변경 차액 결제 대기 카드 */}
          {detail.apartmentChangeStatus === 'pending_payment' && (
            <Card className='border-orange-200 bg-orange-50/40'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-base text-orange-800'>차액 결제 대기 중</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-orange-700 mb-3'>
                  아파트 변경 승인이 완료되었습니다. 파트너가 아래 금액을 결제해야 변경이 적용됩니다.
                </p>
                <div className='flex items-center justify-between p-3 rounded-lg bg-white border border-orange-200 text-sm'>
                  <span className='text-muted-foreground font-medium'>파트너 청구 차액 (일할 계산)</span>
                  <span className='font-bold text-orange-700 text-base'>
                    결제 시점에 자동 산출
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 수정 거절 사유 배너 */}
          {detail.modificationRejectedReason && (
            <div className='flex gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg'>
              <AlertCircle className='h-4 w-4 text-orange-600 mt-0.5 shrink-0' />
              <div>
                <p className='text-base font-medium text-orange-800 mb-0.5'>수정 거절 사유</p>
                <p className='text-base text-orange-700 whitespace-pre-wrap'>{detail.modificationRejectedReason}</p>
              </div>
            </div>
          )}

          {/* 3. 파트너 정보 (전체 폭, 모든 필드) */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base font-semibold'>
                <User className='h-4 w-4 text-muted-foreground' />
                파트너 정보
              </CardTitle>
            </CardHeader>
            <CardContent className='px-6 py-0 pb-4'>
              <div className='grid gap-x-6 sm:grid-cols-2'>
                <InfoRow label='상호명'>{detail.partner?.businessName ?? '-'}</InfoRow>
                <InfoRow label='대표자명'>{detail.partner?.representativeName ?? '-'}</InfoRow>
                <InfoRow label='광고표시용 전화'>
                  {detail.partner?.displayPhoneNumber ? (
                    <span className='inline-flex items-center gap-1.5'>
                      <Phone className='h-3.5 w-3.5 text-muted-foreground' />
                      {detail.partner.displayPhoneNumber}
                    </span>
                  ) : (
                    '-'
                  )}
                </InfoRow>
                <InfoRow label='연락처'>
                  {detail.partner?.phoneNumber ? (
                    <span className='inline-flex items-center gap-1.5'>
                      <Phone className='h-3.5 w-3.5 text-muted-foreground' />
                      {detail.partner.phoneNumber}
                    </span>
                  ) : (
                    '-'
                  )}
                </InfoRow>
                <InfoRow label='사업자등록번호'>{detail.partner?.businessRegistrationNumber ?? '-'}</InfoRow>
                <InfoRow label='파트너 가입일'>
                  {detail.partner?.createdAt
                    ? new Date(detail.partner.createdAt).toLocaleDateString('ko-KR')
                    : '-'}
                </InfoRow>
                <div className='sm:col-span-2'>
                  <InfoRow label='사업장 주소'>
                    {detail.partner?.businessAddress ? (
                      <span>
                        {detail.partner.businessAddress}
                        {detail.partner.businessDetailAddress && (
                          <span className='text-muted-foreground'> {detail.partner.businessDetailAddress}</span>
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
              </div>
            </CardContent>
          </Card>

          {/* 4. 광고 통계 */}
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
                  { label: '홈 노출수', value: a?.homeImpressionCount ?? 0 },
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
                  <StatusBadge status={detail.adStatus} />
                </div>
                {detail.modificationStatus && (
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>수정 심사</span>
                    <ModificationBadge status={detail.modificationStatus} />
                  </div>
                )}
                {detail.isFirstAd && (
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>광고 이력</span>
                    <Badge
                      variant='outline'
                      className='border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700'
                    >
                      첫광고
                    </Badge>
                  </div>
                )}
                {detail.submittedAt && (
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>신청일</span>
                    <span className='font-medium'>
                      {new Date(detail.submittedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 결제 요약 */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold'>결제 정보</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2.5 px-6 pb-4'>
                {/* 신청 아파트 리스트 (선택 세대수 위) */}
                <div className='space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground'>
                      <Building2 className='h-3.5 w-3.5' />
                      신청 아파트
                    </span>
                    <span className='text-sm font-medium tabular-nums text-muted-foreground'>
                      {detail.apartments.length}개 · {page.totalHouseholds.toLocaleString()}세대
                    </span>
                  </div>
                  {detail.apartments.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>아파트 정보 없음</p>
                  ) : (
                    <ul className='divide-y divide-border/50'>
                      {detail.apartments.map((apt) => (
                        <li
                          key={apt.apartmentId}
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
                            <span className='ml-0.5 text-xs font-normal text-muted-foreground'>세대</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Separator />

                <div className='space-y-1.5 text-sm'>
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>선택 세대수</span>
                    <span className='font-medium tabular-nums'>{page.totalHouseholds.toLocaleString()}세대</span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>월 정상가</span>
                    <span className='font-medium tabular-nums'>{page.monthlyAmount.toLocaleString()}원</span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>기본 할인율</span>
                    <span className='font-medium text-green-700'>{effectiveDiscountRate}%</span>
                  </div>
                </div>
                <Separator />
                <div className='flex items-center justify-between text-base font-semibold'>
                  <span>월 결제 예정금액</span>
                  <span className='text-primary tabular-nums'>{effectiveMonthlyAmount.toLocaleString()}원</span>
                </div>
                {(detail.freeEndDate || detail.nextBillingDate) && (
                  <>
                    <Separator />
                    <div className='space-y-1.5 text-sm'>
                      {detail.freeEndDate && (() => {
                        const d = new Date(detail.freeEndDate);
                        d.setDate(d.getDate() - 1);
                        return (
                          <div className='flex items-center justify-between'>
                            <span className='text-muted-foreground'>무료기간 종료일</span>
                            <span className='font-medium'>{d.toLocaleDateString('ko-KR')}</span>
                          </div>
                        );
                      })()}
                      {detail.nextBillingDate && (
                        <div className='flex items-center justify-between'>
                          <span className='text-muted-foreground'>다음 결제일</span>
                          <span className='font-medium'>{new Date(detail.nextBillingDate).toLocaleDateString('ko-KR')}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 액션 버튼 */}
            {(detail.adStatus === 'pending' || detail.adStatus === 'approved') && (
              <Card>
                <CardContent className='space-y-2 px-6 py-4'>
                  {detail.adStatus === 'pending' && (
                    <Button
                      size='lg'
                      onClick={() => page.setApproveDialog(true)}
                      disabled={page.processing}
                      className='w-full gap-2 bg-blue-600 text-white hover:bg-blue-700'
                    >
                      <Check className='h-4 w-4' />
                      승인하기
                    </Button>
                  )}
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

      {/* 승인 다이얼로그 */}
      <Dialog open={page.approveDialog} onOpenChange={page.setApproveDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>광고 신청 승인</DialogTitle>
            <DialogDescription>
              <strong className='text-foreground'>{detail.partner?.businessName}</strong>의 광고 신청을 승인합니다.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-5 py-2'>
            {/* 비첫광고 안내 배너 + 예외 적용 체크박스 */}
            {!detail.isFirstAd && (
              <div className='flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md'>
                <AlertCircle className='h-4 w-4 text-amber-600 mt-0.5 shrink-0' />
                <div className='flex-1'>
                  <p className='text-sm text-amber-800'>
                    이 파트너는 이미 광고를 운영한 이력이 있습니다.
                  </p>
                  <label className='flex items-center gap-2 mt-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={page.overrideEnabled}
                      onChange={(e) => page.setOverrideEnabled(e.target.checked)}
                    />
                    <span className='text-sm text-amber-900 font-medium'>예외 적용 (파트너 협의 완료)</span>
                  </label>
                </div>
              </div>
            )}
            <div className='space-y-1.5'>
              <label className='text-base font-medium'>무료 개월 수</label>
              <Input
                type='number'
                min={0}
                max={24}
                placeholder='0'
                disabled={!detail.isFirstAd && !page.overrideEnabled}
                value={page.freeMonths || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  page.setFreeMonths(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
                }}
              />
              {(detail.isFirstAd || page.overrideEnabled) && (
                <p className='text-sm text-muted-foreground'>
                  무료 기간: <strong>{page.freeMonths}개월</strong>
                </p>
              )}
            </div>
            <div className='space-y-1.5'>
              <label className='text-base font-medium'>첫 결제 할인율 (%)</label>
              <Input
                type='number'
                min={0}
                max={100}
                placeholder='0'
                disabled={!detail.isFirstAd && !page.overrideEnabled}
                value={page.discountRate || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  page.setDiscountRate(val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0)));
                }}
              />
              {(detail.isFirstAd || page.overrideEnabled) && (
                <p className='text-sm text-muted-foreground'>
                  적용 후 월 결제금액:{' '}
                  <strong>
                    {(Math.round((page.monthlyAmount * (1 - page.discountRate / 100)) / 10) * 10).toLocaleString()}원
                  </strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => page.setApproveDialog(false)}
              disabled={page.processing}
            >
              취소
            </Button>
            <Button
              onClick={page.handleApprove}
              disabled={page.processing}
              className='bg-blue-600 text-white hover:bg-blue-700'
            >
              {page.processing ? '처리 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거절 다이얼로그 */}
      <Dialog open={page.rejectDialog} onOpenChange={page.setRejectDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>광고 신청 거절</DialogTitle>
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

      <ImageLightbox {...adImgLb.props} />
      <ImageLightbox {...pendingImgLb.props} />

      {/* 수정 거절 다이얼로그 */}
      <Dialog open={page.modificationRejectDialog} onOpenChange={page.setModificationRejectDialog}>
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
}) {
  return (
    <div className='space-y-1.5'>
      <p className='text-sm font-medium text-muted-foreground'>{label}</p>
      <div className='grid grid-cols-2 gap-3'>
        <div className='rounded-md bg-muted/50 p-2.5'>
          <p className='text-xs text-muted-foreground mb-1'>현재</p>
          <p className={`text-sm text-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}>{current}</p>
        </div>
        <div className='rounded-md bg-purple-50 border border-purple-200 p-2.5'>
          <p className='text-xs text-purple-600 mb-1 font-medium'>수정 요청</p>
          <p className={`text-sm text-foreground font-medium ${multiline ? 'whitespace-pre-wrap' : ''}`}>{proposed}</p>
        </div>
      </div>
    </div>
  );
}
