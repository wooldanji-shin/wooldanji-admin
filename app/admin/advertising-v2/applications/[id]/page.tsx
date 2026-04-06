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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GitCompare,
  ImageIcon,
  MapPin,
  Phone,
  Tag,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApplicationDetailPage } from './useApplicationDetailPage';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending:  { label: '검토 중', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    approved: { label: '승인됨',  className: 'bg-green-100 text-green-800 border-green-200' },
    rejected: { label: '거절됨',  className: 'bg-red-100 text-red-800 border-red-200' },
    running:  { label: '진행중',  className: 'bg-blue-100 text-blue-800 border-blue-200' },
    ended:    { label: '종료',    className: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const c = config[status] ?? { label: status, className: '' };
  return (
    <Badge variant='outline' className={`text-sm font-medium px-2.5 py-0.5 ${c.className}`}>
      {c.label}
    </Badge>
  );
}

function ModificationBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const config: Record<string, { label: string; className: string }> = {
    pending:  { label: '수정신청', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    approved: { label: '수정승인', className: 'bg-green-100 text-green-800 border-green-200' },
    rejected: { label: '수정거절', className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const c = config[status] ?? { label: status, className: '' };
  return (
    <Badge variant='outline' className={`text-sm font-medium px-2.5 py-0.5 ${c.className}`}>
      {c.label}
    </Badge>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[130px_1fr] gap-3 items-start py-2.5 border-b last:border-0 border-border/50'>
      <span className='text-sm font-medium text-muted-foreground pt-0.5'>{label}</span>
      <span className='text-base font-medium'>{children}</span>
    </div>
  );
}

export default function AdApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const page = useApplicationDetailPage(params);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const openLightbox = useCallback((urls: string[], index: number) => setLightbox({ urls, index }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const toPrev = useCallback(() =>
    setLightbox((lb) => lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb), []);
  const toNext = useCallback(() =>
    setLightbox((lb) => lb && lb.index < lb.urls.length - 1 ? { ...lb, index: lb.index + 1 } : lb), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') toPrev();
      if (e.key === 'ArrowRight') toNext();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, toPrev, toNext, closeLightbox]);

  if (page.loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='광고 신청 상세' />
        <div className='flex-1 flex items-center justify-center'>
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
      <div className='flex flex-col h-full'>
        <AdminHeader title='광고 신청 상세' />
        <div className='flex-1 flex items-center justify-center'>
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
  ].filter((s) => s.url);

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='광고 신청 상세' />

      <div className='flex-1 overflow-auto'>
        <div className='max-w-5xl mx-auto px-6 py-6 space-y-5'>
          {/* 상단 네비 + 상태 */}
          <div className='flex items-center justify-between'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => router.push('/admin/advertising-v2/applications')}
              className='gap-1.5 -ml-2 text-muted-foreground hover:text-foreground'
            >
              <ArrowLeft className='h-4 w-4' />
              목록으로
            </Button>
            <div className='flex items-center gap-2'>
              <StatusBadge status={detail.adStatus} />
              <ModificationBadge status={detail.modificationStatus} />
            </div>
          </div>

          {/* 제목 */}
          <div>
            <h1 className='text-xl font-bold text-foreground'>{detail.title}</h1>
            {detail.submittedAt && (
              <p className='text-sm text-muted-foreground mt-1'>
                신청일시: {new Date(detail.submittedAt).toLocaleString('ko-KR')}
              </p>
            )}
          </div>

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
                {detail.pendingChanges.resolvedSubCategoryName && (
                  <CompareRow
                    label='서브카테고리'
                    current={detail.subCategory?.subCategoryName ?? '-'}
                    proposed={detail.pendingChanges.resolvedSubCategoryName}
                  />
                )}
                {/* SNS 링크 비교 */}
                {(['naverMapUrl', 'blogUrl', 'youtubeUrl', 'instagramUrl'] as const).map((key) => {
                  const labelMap = { naverMapUrl: '네이버 지도', blogUrl: '블로그', youtubeUrl: '유튜브', instagramUrl: '인스타그램' };
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
                {/* 이미지 비교 */}
                {detail.pendingChanges.imageUrls && (
                  <div className='space-y-2'>
                    <p className='text-sm font-medium text-muted-foreground'>이미지</p>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <p className='text-xs text-muted-foreground mb-1.5'>현재 ({detail.imageUrls.length}장)</p>
                        <div className='grid grid-cols-3 gap-1'>
                          {detail.imageUrls.map((url, i) => (
                            <button
                              key={i}
                              type='button'
                              onClick={() => openLightbox(detail.imageUrls, i)}
                              className='group relative aspect-square block w-full'
                            >
                              <img src={url} alt='' className='w-full h-full aspect-square object-cover rounded border border-border/50 group-hover:opacity-80 transition-opacity' />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className='text-xs text-purple-600 mb-1.5 font-medium'>수정 요청 ({detail.pendingChanges.imageUrls.length}장)</p>
                        <div className='grid grid-cols-3 gap-1'>
                          {detail.pendingChanges.imageUrls.map((url, i) => (
                            <button
                              key={i}
                              type='button'
                              onClick={() => openLightbox(detail.pendingChanges!.imageUrls!, i)}
                              className='group relative aspect-square block w-full'
                            >
                              <img src={url} alt='' className='w-full h-full aspect-square object-cover rounded border-2 border-purple-300 group-hover:opacity-80 transition-opacity' />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

          {/* 2컬럼 레이아웃 */}
          <div className='grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5'>
            {/* 좌측: 주요 정보 */}
            <div className='space-y-5'>
              {/* 광고 내용 */}
              {detail.content && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base font-semibold flex items-center gap-2'>
                      <Tag className='h-4 w-4 text-muted-foreground' />
                      광고 내용
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-base text-foreground/80 leading-relaxed whitespace-pre-wrap'>
                      {detail.content}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 이미지 갤러리 */}
              {detail.imageUrls.length > 0 && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base font-semibold flex items-center gap-2'>
                      <ImageIcon className='h-4 w-4 text-muted-foreground' />
                      광고 이미지
                      <span className='text-sm font-normal text-muted-foreground'>
                        ({detail.imageUrls.length}장)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='grid grid-cols-3 gap-2'>
                      {detail.imageUrls.map((url, i) => (
                        <button
                          key={i}
                          type='button'
                          onClick={() => openLightbox(detail.imageUrls, i)}
                          className='group relative aspect-square block w-full'
                        >
                          <img
                            src={url}
                            alt={`광고 이미지 ${i + 1}`}
                            className='w-full h-full object-cover rounded-lg border border-border/50 group-hover:opacity-80 transition-opacity'
                          />
                          <div className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                            <ExternalLink className='h-5 w-5 text-white drop-shadow' />
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 신청 아파트 */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <Building2 className='h-4 w-4 text-muted-foreground' />
                    신청 아파트
                    <span className='ml-auto text-sm font-normal text-muted-foreground'>
                      총 {page.totalHouseholds.toLocaleString()}세대
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className='p-0'>
                  {detail.apartments.length === 0 ? (
                    <p className='px-6 py-4 text-base text-muted-foreground'>아파트 정보 없음</p>
                  ) : (
                    <div>
                      {detail.apartments.map((apt, idx) => (
                        <div
                          key={apt.apartmentId}
                          className={`flex items-center justify-between px-6 py-3.5 ${
                            idx !== detail.apartments.length - 1 ? 'border-b border-border/50' : ''
                          }`}
                        >
                          <div className='min-w-0 flex-1'>
                            <p className='text-base font-medium truncate'>{apt.apartmentName}</p>
                            <p className='text-sm text-muted-foreground flex items-center gap-1 mt-0.5'>
                              <MapPin className='h-3.5 w-3.5 shrink-0' />
                              {apt.address}
                            </p>
                          </div>
                          <div className='ml-4 text-base font-semibold text-foreground shrink-0'>
                            {apt.totalHouseholds.toLocaleString()}
                            <span className='text-sm font-normal text-muted-foreground ml-0.5'>세대</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 우측: 파트너 / 광고분류 / 결제 요약 */}
            <div className='space-y-5'>
              {/* 파트너 정보 */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <User className='h-4 w-4 text-muted-foreground' />
                    파트너 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-4 py-0 pb-4'>
                  <InfoRow label='상호명'>{detail.partner?.businessName ?? '-'}</InfoRow>
                  <InfoRow label='대표자명'>{detail.partner?.representativeName ?? '-'}</InfoRow>
                  <InfoRow label='연락처'>
                    {detail.partner?.displayPhoneNumber ? (
                      <span className='flex items-center gap-1'>
                        <Phone className='h-3 w-3 text-muted-foreground' />
                        {detail.partner.displayPhoneNumber}
                      </span>
                    ) : (
                      '-'
                    )}
                  </InfoRow>
                </CardContent>
              </Card>

              {/* 광고 분류 */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base font-semibold flex items-center gap-2'>
                    <Tag className='h-4 w-4 text-muted-foreground' />
                    광고 분류
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-4 py-0 pb-4'>
                  <InfoRow label='카테고리'>
                    <span className='flex items-center gap-1 flex-wrap'>
                      <span>{detail.category?.categoryName ?? '-'}</span>
                      {detail.subCategory && (
                        <>
                          <span className='text-muted-foreground'>{'>'}</span>
                          <span className='text-muted-foreground'>{detail.subCategory.subCategoryName}</span>
                        </>
                      )}
                    </span>
                  </InfoRow>
                  <InfoRow label='광고 상태'>
                    <StatusBadge status={detail.adStatus} />
                  </InfoRow>
                </CardContent>
              </Card>

              {/* 소셜 링크 */}
              {socialLinks.length > 0 && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base font-semibold flex items-center gap-2'>
                      <ExternalLink className='h-4 w-4 text-muted-foreground' />
                      소셜 링크
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-1.5'>
                    {socialLinks.map((s) => (
                      <a
                        key={s.label}
                        href={s.url!}
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-2 text-base text-primary hover:underline'
                      >
                        <ExternalLink className='h-3.5 w-3.5' />
                        {s.label}
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 결제 정보 */}
              <Card className='bg-muted/30'>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base font-semibold'>결제 정보</CardTitle>
                </CardHeader>
                <CardContent className='space-y-2.5'>
                  <div className='space-y-1.5 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>선택 세대수</span>
                      <span>{page.totalHouseholds.toLocaleString()}세대</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>월 정상가</span>
                      <span>{page.monthlyAmount.toLocaleString()}원</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>기본 할인율</span>
                      <span className='text-green-700 font-medium'>{effectiveDiscountRate}%</span>
                    </div>
                  </div>
                  <Separator />
                  <div className='flex justify-between text-sm font-semibold'>
                    <span>월 결제 예정금액</span>
                    <span className='text-primary'>{effectiveMonthlyAmount.toLocaleString()}원</span>
                  </div>
                  {(detail.freeEndDate || detail.nextBillingDate) && (
                    <>
                      <Separator />
                      <div className='space-y-1.5 text-sm'>
                        {detail.freeEndDate && (() => {
                          const d = new Date(detail.freeEndDate);
                          d.setDate(d.getDate() - 1);
                          return (
                            <div className='flex justify-between'>
                              <span className='text-muted-foreground'>무료기간 종료일</span>
                              <span>{d.toLocaleDateString('ko-KR')}</span>
                            </div>
                          );
                        })()}
                        {detail.nextBillingDate && (
                          <div className='flex justify-between'>
                            <span className='text-muted-foreground'>다음 결제일</span>
                            <span className='font-medium'>{new Date(detail.nextBillingDate).toLocaleDateString('ko-KR')}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 광고 신청 액션 버튼 */}
          {(detail.adStatus === 'pending' || detail.adStatus === 'approved') && (
            <div className='sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/60 -mx-6 px-6 py-4'>
              <div className='flex gap-3 justify-end max-w-5xl mx-auto'>
                <Button
                  variant='outline'
                  size='lg'
                  onClick={() => page.setRejectDialog(true)}
                  disabled={page.processing}
                  className='gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300'
                >
                  <X className='h-4 w-4' />
                  거절하기
                </Button>
                {detail.adStatus === 'pending' && (
                  <Button
                    size='lg'
                    onClick={() => page.setApproveDialog(true)}
                    disabled={page.processing}
                    className='gap-2 bg-green-600 hover:bg-green-700 text-white'
                  >
                    <Check className='h-4 w-4' />
                    승인하기
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 수정 심사 액션 버튼 */}
          {detail.modificationStatus === 'pending' && (
            <div className='sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/60 -mx-6 px-6 py-4'>
              <div className='flex gap-3 justify-end max-w-5xl mx-auto'>
                <p className='text-sm text-muted-foreground self-center mr-auto'>수정 내용을 검토하고 승인 또는 거절해주세요.</p>
                <Button
                  variant='outline'
                  size='lg'
                  onClick={() => page.setModificationRejectDialog(true)}
                  disabled={page.processing}
                  className='gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300'
                >
                  <X className='h-4 w-4' />
                  수정 거절
                </Button>
                <Button
                  size='lg'
                  onClick={page.handleApproveModification}
                  disabled={page.processing}
                  className='gap-2 bg-purple-600 hover:bg-purple-700 text-white'
                >
                  <Check className='h-4 w-4' />
                  수정 승인
                </Button>
              </div>
            </div>
          )}
        </div>
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
            <div className='space-y-1.5'>
              <label className='text-base font-medium'>추가 무료 개월 수</label>
              <Input
                type='number'
                min={0}
                max={24}
                placeholder='0'
                value={page.adminExtraMonths || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  page.setAdminExtraMonths(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
                }}
              />
              <p className='text-sm text-muted-foreground'>
                총 무료 기간: <strong>{detail.freeMonths + page.adminExtraMonths}개월</strong>
              </p>
            </div>
            <div className='space-y-1.5'>
              <label className='text-base font-medium'>첫 결제 할인율 (%)</label>
              <Input
                type='number'
                min={0}
                max={100}
                placeholder='0'
                value={page.discountRate || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  page.setDiscountRate(val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val) || 0)));
                }}
              />
              <p className='text-sm text-muted-foreground'>
                기본값: {detail.defaultDiscountRate}% &middot; 적용 후 월 결제금액:{' '}
                <strong>
                  {(Math.round((page.monthlyAmount * (1 - page.discountRate / 100)) / 10) * 10).toLocaleString()}원
                </strong>
              </p>
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
              className='bg-green-600 hover:bg-green-700 text-white'
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

      {/* 이미지 라이트박스 */}
      {lightbox && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/85'
          onClick={closeLightbox}
        >
          {/* 닫기 */}
          <button
            type='button'
            className='absolute top-4 right-4 text-white/80 hover:text-white'
            onClick={closeLightbox}
          >
            <X className='h-7 w-7' />
          </button>

          {/* 카운터 */}
          <span className='absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm'>
            {lightbox.index + 1} / {lightbox.urls.length}
          </span>

          {/* 이전 */}
          {lightbox.index > 0 && (
            <button
              type='button'
              className='absolute left-4 text-white/80 hover:text-white'
              onClick={(e) => { e.stopPropagation(); toPrev(); }}
            >
              <ChevronLeft className='h-10 w-10' />
            </button>
          )}

          {/* 이미지 */}
          <img
            src={lightbox.urls[lightbox.index]}
            alt={`이미지 ${lightbox.index + 1}`}
            className='max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          />

          {/* 다음 */}
          {lightbox.index < lightbox.urls.length - 1 && (
            <button
              type='button'
              className='absolute right-4 text-white/80 hover:text-white'
              onClick={(e) => { e.stopPropagation(); toNext(); }}
            >
              <ChevronRight className='h-10 w-10' />
            </button>
          )}
        </div>
      )}

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
          <p className={`text-sm text-foreground/70 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{current}</p>
        </div>
        <div className='rounded-md bg-purple-50 border border-purple-200 p-2.5'>
          <p className='text-xs text-purple-600 mb-1 font-medium'>수정 요청</p>
          <p className={`text-sm text-foreground font-medium ${multiline ? 'whitespace-pre-wrap' : ''}`}>{proposed}</p>
        </div>
      </div>
    </div>
  );
}
