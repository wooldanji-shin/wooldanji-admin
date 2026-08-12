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
 * 관리자가 파트너를 대신해 프리미엄 광고를 등록한다.
 *
 * 결제만 남은 상태(approved + unpaid)로 만든다.
 * 프리미엄은 기본 광고 위에 얹히므로, 기본 광고가 운영 중(running + paid)이어야 하고
 * 그 광고에 아직 살아있는 프리미엄이 없어야 한다 — 사용자 앱의 전환 버튼 노출 조건과 같다.
 *
 * premium_advertisements_v2의 INSERT 정책은 본인 광고만 허용하므로 쓰기는 service_role로 처리한다.
 */
export async function POST(request: NextRequest) {
  try {
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
    const { partnerId, baseAdId } = body;

    if (!partnerId || !baseAdId) {
      return NextResponse.json(
        { error: '파트너와 기본 광고를 선택해주세요.' },
        { status: 400 }
      );
    }

    const validationError = validatePremiumBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: baseAd } = await admin
      .from('advertisements_v2')
      .select('id, partnerId, adStatus, paymentStatus')
      .eq('id', baseAdId)
      .maybeSingle();

    if (!baseAd) {
      return NextResponse.json({ error: '기본 광고를 찾을 수 없습니다.' }, { status: 404 });
    }

    const base = baseAd as {
      partnerId: string;
      adStatus: string;
      paymentStatus: string;
    };

    if (base.partnerId !== partnerId) {
      return NextResponse.json(
        { error: '선택한 파트너의 광고가 아닙니다.' },
        { status: 400 }
      );
    }

    if (base.adStatus !== 'running' || base.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: '운영 중(결제 완료)인 기본 광고에만 프리미엄을 등록할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 같은 기본 광고에 프리미엄이 둘 이상 살아있으면 앱 표시가 어긋난다
    const { data: activePremiums } = await admin
      .from('premium_advertisements_v2')
      .select('id')
      .eq('baseAdId', baseAdId)
      .not('status', 'in', '("ended","draft")');

    if ((activePremiums ?? []).length > 0) {
      return NextResponse.json(
        { error: '이 광고에는 이미 진행 중인 프리미엄 광고가 있습니다.' },
        { status: 400 }
      );
    }

    const { snapshot, totalHouseholds } = await buildApartmentSnapshot(admin, baseAdId);
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

    const now = new Date().toISOString();

    const { data: inserted, error: insertError } = await admin
      .from('premium_advertisements_v2')
      .insert({
        partnerId,
        baseAdId,
        ...premiumContentColumns(body),
        weeks: body.weeks,
        status: 'approved',
        paymentStatus: 'unpaid',
        totalAmount,
        approvedDiscountRate: discountRate > 0 ? discountRate : null,
        discountedTotalAmount,
        snapshotApartments: snapshot,
        adminMemo: trimmedOrNull(body.adminMemo),
        salesRepId: body.salesRepId || null,
        createdAt: now,
        updatedAt: now,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('Failed to create premium advertisement:', insertError);
      return NextResponse.json(
        { error: 'Failed to create premium advertisement' },
        { status: 500 }
      );
    }

    const premiumAdId = inserted.id as string;

    // 등록 알림 (non-critical: 실패해도 등록은 유지)
    try {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-partner-fcm-notification`;

      await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '프리미엄 광고 등록 안내',
          body: '프리미엄 광고가 등록되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
          type: 'premium_ad_approved',
          navigationData: {
            type: 'premium_ad_detail',
            params: { premiumAdId, baseAdId },
          },
        }),
      });
    } catch (notificationError) {
      console.error('프리미엄 광고 등록 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      premiumAdId,
      totalAmount,
      discountedTotalAmount,
      totalHouseholds,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
