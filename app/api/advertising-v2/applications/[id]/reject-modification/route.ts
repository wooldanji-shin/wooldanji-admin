import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// running 광고 수정 심사 거절
// pendingChanges 폐기, modificationStatus = 'rejected', 거절 사유 저장
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

    const body = await request.json();
    const { rejectReason } = body as { rejectReason: string };

    if (!rejectReason?.trim()) {
      return NextResponse.json({ error: '거절 사유를 입력해주세요.' }, { status: 400 });
    }

    const { data: ad, error: fetchError } = await supabase
      .from('advertisements_v2')
      .select('modificationStatus, partnerId')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 });
    }

    if (ad.modificationStatus !== 'pending') {
      return NextResponse.json({ error: 'No pending modification to reject' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        modificationStatus: 'rejected',
        modificationRejectedReason: rejectReason.trim(),
        pendingChanges: null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject modification:', updateError);
      return NextResponse.json({ error: 'Failed to reject modification' }, { status: 500 });
    }

    // 수정 거절 FCM 알림 전송 (non-critical: 실패해도 거절 처리는 유지)
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
          title: '광고 수정 심사 결과',
          body: '광고 수정 요청이 반려되었습니다. 앱에서 사유를 확인해주세요.',
          type: 'ad_rejected',
          navigationData: {
            type: 'ad_detail',
            params: { advertisementId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('수정 거절 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
