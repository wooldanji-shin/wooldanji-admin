import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  buildApartmentSnapshot,
  premiumContentColumns,
  resolvePremiumAmounts,
  trimmedOrNull,
  validatePremiumBody,
  type PremiumBody,
} from '@/lib/ads/premium-shared';

/**
 * 관리자가 프리미엄 광고를 고친다.
 *
 * 결제 전(approved + unpaid)은 전부 고칠 수 있다 — 결제가 아직 없으므로 주수·금액이 바뀌어도 된다.
 * 광고중(running)은 내용·이미지·링크·CTA만 고친다. 주수·금액은 이미 받은 결제의 근거라
 * 여기서 바꾸면 결제 내역과 어긋난다.
 *
 * 기본 광고는 바꿀 수 없다 — 노출 아파트와 금액의 근거가 통째로 달라진다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json() as PremiumBody;

    const validationError = validatePremiumBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: premium } = await admin
      .from('premium_advertisements_v2')
      .select('id, baseAdId, status, paymentStatus, modificationStatus')
      .eq('id', id)
      .maybeSingle();

    if (!premium) {
      return NextResponse.json(
        { error: '프리미엄 광고를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const existing = premium as {
      baseAdId: string;
      status: string;
      paymentStatus: string;
      modificationStatus: string | null;
    };

    const isRunning = existing.status === 'running';
    const isBeforePayment =
      existing.status === 'approved' && existing.paymentStatus === 'unpaid';

    if (!isRunning && !isBeforePayment) {
      return NextResponse.json(
        { error: '결제 전(승인·미결제) 또는 광고중인 프리미엄 광고만 수정할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 파트너 수정 심사가 걸려 있는데 여기서 덮어쓰면, 승인 시 어느 쪽 값이 남는지 알 수 없다
    if (isRunning && existing.modificationStatus === 'pending') {
      return NextResponse.json(
        { error: '파트너의 수정 심사가 진행 중입니다. 먼저 승인하거나 거절해주세요.' },
        { status: 409 }
      );
    }

    // 광고중이면 결제 근거(주수·금액·아파트 스냅샷)는 그대로 두고 내용만 바꾼다
    if (isRunning) {
      const { error: runningUpdateError } = await admin
        .from('premium_advertisements_v2')
        .update({
          ...premiumContentColumns(body),
          adminMemo: trimmedOrNull(body.adminMemo),
          salesRepId: body.salesRepId || null,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id);

      if (runningUpdateError) {
        console.error('Failed to update premium advertisement:', runningUpdateError);
        return NextResponse.json(
          { error: 'Failed to update premium advertisement' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, premiumAdId: id });
    }

    // 아파트·금액은 저장된 기본 광고를 기준으로 다시 계산한다
    const { snapshot, totalHouseholds } = await buildApartmentSnapshot(
      admin,
      existing.baseAdId
    );

    if (totalHouseholds === 0) {
      return NextResponse.json(
        { error: '기본 광고에 노출 아파트가 없어 금액을 계산할 수 없습니다.' },
        { status: 400 }
      );
    }

    const discountRate = Math.min(100, Math.max(0, body.discountRate ?? 0));
    const { totalAmount, discountedTotalAmount } = await resolvePremiumAmounts(
      admin,
      totalHouseholds,
      body.weeks!,
      discountRate
    );

    const { error: updateError } = await admin
      .from('premium_advertisements_v2')
      .update({
        ...premiumContentColumns(body),
        weeks: body.weeks,
        totalAmount,
        approvedDiscountRate: discountRate > 0 ? discountRate : null,
        discountedTotalAmount,
        snapshotApartments: snapshot,
        adminMemo: trimmedOrNull(body.adminMemo),
        salesRepId: body.salesRepId || null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update premium advertisement:', updateError);
      return NextResponse.json(
        { error: 'Failed to update premium advertisement' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      premiumAdId: id,
      totalAmount,
      discountedTotalAmount,
      totalHouseholds,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
