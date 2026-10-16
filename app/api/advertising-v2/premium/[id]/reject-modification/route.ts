import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { reason } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json({ error: '거절 사유를 입력해주세요.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: '이 작업을 할 권한이 없습니다.' }, { status: 403 });
    }

    // 프리미엄 광고 조회
    const { data: ad, error: fetchError } = await supabase
      .from('premium_advertisements_v2')
      .select('modificationStatus, partnerId, baseAdId')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json({ error: '프리미엄 광고를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' }, { status: 404 });
    }

    if (ad.modificationStatus !== 'pending') {
      return NextResponse.json(
        { error: '심사 중인 수정 요청이 없습니다. 이미 처리됐을 수 있으니 화면을 새로고침해 주세요.' },
        { status: 400 }
      );
    }

    // 수정 거절 처리: pendingChanges 초기화, modificationStatus → rejected
    const { error: updateError } = await supabase
      .from('premium_advertisements_v2')
      .update({
        modificationStatus: 'rejected',
        modificationRejectedReason: reason.trim(),
        pendingChanges: null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject modification:', updateError);
      return NextResponse.json({ error: '수정 요청을 거절하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
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
          body: `프리미엄 광고 수정이 거절되었습니다. 사유: ${reason.trim()}`,
          type: 'premium_ad_modification_rejected',
          navigationData: {
            type: 'premium_ad_detail',
            params: { premiumAdId: id, baseAdId: ad.baseAdId },
          },
        }),
      });
    } catch (notificationError) {
      console.error('프리미엄 광고 수정 거절 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Premium advertisement modification rejected',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
