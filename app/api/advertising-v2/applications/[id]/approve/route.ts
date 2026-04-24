import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r =>
      ['SUPER_ADMIN', 'MANAGER'].includes(r.role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { freeMonths, discountRate, overrideEnabled } = body as {
      freeMonths: number;
      discountRate: number;
      overrideEnabled?: boolean;
    };

    const [adResult, pricingResult] = await Promise.all([
      supabase
        .from('advertisements_v2')
        .select('adStatus, partnerId, isFirstAdApplication')
        .eq('id', id)
        .single(),
      supabase
        .from('ad_pricing_v2')
        .select('pricePerHousehold')
        .order('effectiveFrom', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: ad, error: fetchError } = adResult;

    if (fetchError || !ad) {
      return NextResponse.json(
        { error: 'Advertisement not found' },
        { status: 404 }
      );
    }

    if (ad.adStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Advertisement is not pending' },
        { status: 400 }
      );
    }

    // Design Ref: §4.3 — 이중 방어: isFirstAdApplication(광고 레벨) + hasHadRunningAd(파트너 레벨)
    // isFirstAdApplication: 제출 시 Flutter가 설정, 파트너당 1개만 true → 관리자 UX 기준
    // hasHadRunningAd: running 전환 시 설정, 어뷰징 방어 최종 방어선
    const { data: partnerData } = await supabase
      .from('partner_users')
      .select('hasHadRunningAd')
      .eq('id', ad.partnerId)
      .single();

    // isFirstAdApplication이 null이면(DB 컬럼 추가 전) hasHadRunningAd로 fallback
    const isFirstAdApplication = (ad as any).isFirstAdApplication;
    const isFirstAd = (isFirstAdApplication !== null && isFirstAdApplication !== undefined)
      ? (isFirstAdApplication === true && !partnerData?.hasHadRunningAd)
      : !partnerData?.hasHadRunningAd;

    // overrideEnabled: 관리자가 파트너와 협의 후 비첫광고에 예외 적용하는 경우
    const canApplyBenefits = isFirstAd || overrideEnabled === true;

    // canApplyBenefits가 아니면 할인율·무료기간 모두 강제 0
    const effectiveDiscountRate = canApplyBenefits ? (discountRate ?? 0) : 0;
    const effectiveFreeMonths   = canApplyBenefits ? (freeMonths ?? 0) : 0;

    const { data: householdsData } = await supabase
      .from('advertisement_apartments_v2')
      .select('totalHouseholds')
      .eq('advertisementId', id);

    const totalHouseholds = (householdsData ?? []).reduce(
      (sum: number, row: { totalHouseholds: number }) => sum + row.totalHouseholds,
      0
    );

    const pricePerHousehold = (pricingResult.data as any)?.pricePerHousehold ?? 70;
    const approvedMonthlyAmount =
      Math.round((totalHouseholds * pricePerHousehold * (1 - effectiveDiscountRate / 100)) / 10) * 10;

    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        adStatus: 'approved',
        freeMonths: effectiveFreeMonths,
        approvedDiscountRate: effectiveDiscountRate,
        approvedMonthlyAmount,
        approvedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve advertisement:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve advertisement' },
        { status: 500 }
      );
    }

    // 광고 승인 FCM 알림 전송 (non-critical: 실패해도 승인 처리는 유지)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-partner-fcm-notification`;

      await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: ad.partnerId,
          title: '광고 심사 결과',
          body: '신청하신 광고가 승인되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
          type: 'ad_approved',
          navigationData: {
            type: 'ad_detail',
            params: { advertisementId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('광고 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement approved successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
