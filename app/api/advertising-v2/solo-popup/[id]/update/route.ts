import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { calcDiscountedTotalAmount } from '@/lib/ads/pricing';
import {
  buildSoloContent,
  computeSoloAmounts,
  dbErrorMessage,
  requireAdmin,
  SoloInputError,
  type SoloWriteBody,
} from '@/lib/ads/solo-popup-server';

/**
 * 관리자 대리 수정.
 * - 결제 전(approved + unpaid): 콘텐츠·기간·할인율 수정, 금액/weeks/스냅샷 서버 재계산
 * - 광고중(running): 콘텐츠만 즉시 반영 (결제된 금액의 근거인 기간·할인율은 잠금)
 * 쓰기는 service_role (관리자 확인 후).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await requireAdmin();
    if (error) return error;

    const body = (await request.json()) as SoloWriteBody;
    const admin = createAdminClient() as any;

    const { data: existing } = await admin
      .from('solo_popup_ads_v2')
      .select('id, baseAdId, status, paymentStatus, modificationStatus')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다.' }, { status: 404 });

    const isRunning = existing.status === 'running';
    const isBeforePayment = existing.status === 'approved' && existing.paymentStatus === 'unpaid';
    if (!isRunning && !isBeforePayment) {
      return NextResponse.json(
        { error: '결제 전(승인·미결제) 또는 광고중인 단독 팝업 광고만 수정할 수 있습니다.' },
        { status: 400 }
      );
    }
    if (isRunning && existing.modificationStatus === 'pending') {
      return NextResponse.json(
        { error: '파트너의 수정 심사가 진행 중입니다. 먼저 승인하거나 거절해주세요.' },
        { status: 400 }
      );
    }

    const content = await buildSoloContent(admin, body);
    const columns: Record<string, unknown> = {
      ...content,
      adminMemo: body.adminMemo?.trim() || null,
      salesRepId: body.salesRepId || null,
    };

    if (isBeforePayment) {
      if (!existing.baseAdId) {
        return NextResponse.json({ error: '연결된 기본 광고가 없어 금액을 계산할 수 없습니다.' }, { status: 400 });
      }
      const amounts = await computeSoloAmounts(admin, existing.baseAdId, body.periodUnit!, body.periodCount!);
      const rate = Math.min(100, Math.max(0, Number(body.discountRate) || 0));
      Object.assign(columns, {
        periodUnit: body.periodUnit,
        periodCount: body.periodCount,
        weeks: amounts.weeks,
        snapshotApartments: amounts.snapshot,
        totalAmount: amounts.totalAmount,
        approvedDiscountRate: rate > 0 ? rate : null,
        discountedTotalAmount: calcDiscountedTotalAmount(amounts.totalAmount, rate),
      });
    }

    const { error: updateError } = await admin.from('solo_popup_ads_v2').update(columns).eq('id', id);
    if (updateError) {
      console.error('Failed to update solo popup ad:', updateError);
      return NextResponse.json({ error: dbErrorMessage(updateError) }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SoloInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
