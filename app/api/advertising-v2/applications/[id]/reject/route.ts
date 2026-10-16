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
        { error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' },
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
        { error: '이 작업을 할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rejectReason } = body as { rejectReason: string };

    if (!rejectReason || !rejectReason.trim()) {
      return NextResponse.json(
        { error: '거절 사유를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const { data: ad, error: fetchError } = await supabase
      .from('advertisements_v2')
      .select('adStatus, partnerId')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json(
        { error: '광고를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' },
        { status: 404 }
      );
    }

    if (!['pending', 'approved'].includes(ad.adStatus)) {
      return NextResponse.json(
        { error: '심사 중이거나 결제 전인 광고만 거절할 수 있습니다. 목록을 새로고침해 광고 상태를 확인해 주세요.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        adStatus: 'rejected',
        rejectReason: rejectReason.trim(),
        rejectedAt: new Date().toISOString(),
        // 거절 시 isFirstAdApplication 초기화: 파트너가 재신청 시 다시 조건 평가 가능
        isFirstAdApplication: false,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject advertisement:', updateError);
      return NextResponse.json(
        { error: '광고를 거절하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    // 광고 거절 FCM 알림 전송 (non-critical: 실패해도 거절 처리는 유지)
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
          body: '신청하신 광고가 반려되었습니다. 앱에서 사유를 확인해주세요.',
          type: 'ad_rejected',
          navigationData: {
            type: 'ad_detail',
            params: { advertisementId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('광고 거절 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement rejected successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
