import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 파트너 문의 답변 알림 API.
 * 신규 Edge Function 대신 기존 `send-partner-fcm-notification` 제네릭 디스패처를 재사용한다.
 * - UNREGISTERED 토큰 자동 정리
 * - partner_notifications 테이블 자동 기록
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자만 호출할 수 있다 — 아래에서 서비스 롤 키로 푸시를 보내므로 세션부터 확인한다
    const authClient = await createClient();
    const { data: { user: currentUser } } = await authClient.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    const { data: roles } = await authClient
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: '이 작업을 할 권한이 없습니다.' }, { status: 403 });
    }

    const { partnerUserId, inquiryId, replyContent } = await request.json();

    if (!partnerUserId || !inquiryId) {
      return NextResponse.json(
        { success: false, error: '알림을 보낼 문의 정보가 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' },
        { status: 400 }
      );
    }

    console.log(
      `[파트너 문의 답변 알림] partnerUserId=${partnerUserId}, inquiryId=${inquiryId}`
    );

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-partner-fcm-notification`;

    // 미리보기용 본문 (50자 컷)
    const previewBody =
      replyContent && replyContent.length > 50
        ? `${replyContent.substring(0, 50)}...`
        : (replyContent ?? '문의하신 내용에 답변이 도착했습니다');

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        partnerUserId,
        title: '문의 답변 도착',
        body: previewBody,
        // FCM data.type → NotificationRouter.route()의 분기 키.
        // user inquiry의 'inquiry_reply'와 충돌하지 않도록 'partner_inquiry_reply' 사용.
        type: 'partner_inquiry_reply',
        navigationData: {
          // partner_notification_screen의 _handleTap switch case 키
          type: 'partner_inquiry_detail',
          params: { inquiryId },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[파트너 문의 답변 알림] Edge Function 호출 실패:', data);
      return NextResponse.json(
        { success: false, error: '답변 알림을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: response.status }
      );
    }

    console.log('[파트너 문의 답변 알림] 알림 전송 성공:', data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[파트너 문의 답변 알림] 예외 발생:', error);
    return NextResponse.json(
      {
        success: false,
        error: '일시적인 오류로 답변 알림을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    );
  }
}
