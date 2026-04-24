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

    // 프리미엄 광고 조회
    const { data: ad, error: fetchError } = await supabase
      .from('premium_advertisements_v2')
      .select('status, partnerId')
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

    // 상태 → approved 전환
    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update({
        status: 'approved',
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
          body: '프리미엄 광고가 승인되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
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
