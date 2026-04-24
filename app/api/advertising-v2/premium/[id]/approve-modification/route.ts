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

    // 프리미엄 광고 조회 (pendingChanges 포함)
    const { data: ad, error: fetchError } = await supabase
      .from('premium_advertisements_v2')
      .select('status, modificationStatus, pendingChanges, partnerId')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json({ error: 'Premium advertisement not found' }, { status: 404 });
    }

    if (ad.modificationStatus !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve modification: modificationStatus is '${ad.modificationStatus}'` },
        { status: 400 }
      );
    }

    const pendingChanges = ad.pendingChanges as Record<string, unknown> | null;
    if (!pendingChanges) {
      return NextResponse.json({ error: 'No pending changes to apply' }, { status: 400 });
    }

    // pendingChanges를 본 레코드에 반영 + 수정 심사 상태 초기화
    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update({
        ...pendingChanges,
        modificationStatus: 'approved',
        modificationRejectedReason: null,
        pendingChanges: null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve modification:', updateError);
      return NextResponse.json({ error: 'Failed to approve modification' }, { status: 500 });
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
          title: '프리미엄 광고 수정 심사 결과',
          body: '프리미엄 광고 수정이 승인되었습니다. 변경 내용이 반영되었습니다.',
          type: 'premium_ad_modification_approved',
          navigationData: {
            type: 'premium_ad_detail',
            params: { premiumAdId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('프리미엄 광고 수정 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Premium advertisement modification approved',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
