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

    // 요청 body에서 할인율 파싱 (없으면 0)
    let discountRate = 0;
    try {
      const body = await request.json();
      discountRate = body?.discountRate ?? 0;
    } catch {
      // body 없거나 파싱 실패 시 0으로 처리
    }
    const effectiveDiscountRate = Math.min(100, Math.max(0, discountRate));

    // 프리미엄 광고 조회 (할인 계산에 totalAmount 필요)
    const { data: ad, error: fetchError } = await supabase
      .from('premium_advertisements_v2')
      .select('status, partnerId, totalAmount')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json({ error: 'Premium advertisement not found' }, { status: 404 });
    }

    if (ad.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve: current status is '${ad.status}'` },
        { status: 400 }
      );
    }

    // 할인된 결제 금액 계산 (10원 단위 반올림)
    const totalAmount = ad.totalAmount as number | null;
    const discountedTotalAmount =
      effectiveDiscountRate > 0 && totalAmount != null
        ? Math.round((totalAmount * (100 - effectiveDiscountRate)) / 100 / 10) * 10
        : null;

    // 상태 → approved 전환
    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update({
        status: 'approved',
        approvedDiscountRate: effectiveDiscountRate > 0 ? effectiveDiscountRate : null,
        discountedTotalAmount,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve premium advertisement:', updateError);
      return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
    }

    // FCM 알림 전송 (non-critical)
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
          title: '프리미엄 광고 심사 결과',
          body: effectiveDiscountRate > 0
            ? `프리미엄 광고가 승인되었습니다. ${effectiveDiscountRate}% 할인이 적용되었습니다.`
            : '프리미엄 광고가 승인되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
          type: 'premium_ad_approved',
          navigationData: {
            type: 'premium_ad_detail',
            params: { premiumAdId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('프리미엄 광고 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({ success: true, message: 'Premium advertisement approved' });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
