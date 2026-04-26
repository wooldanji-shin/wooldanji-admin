import { NextRequest, NextResponse } from 'next/server';

/**
 * 파트너 문의 답변 알림 API.
 * 신규 Edge Function 대신 기존 `send-partner-fcm-notification` 제네릭 디스패처를 재사용한다.
 * - UNREGISTERED 토큰 자동 정리
 * - partner_notifications 테이블 자동 기록
 */
export async function POST(request: NextRequest) {
  try {
    const { partnerUserId, inquiryId, replyContent } = await request.json();

    if (!partnerUserId || !inquiryId) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
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
        { success: false, error: 'Edge Function 호출 실패', details: data },
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
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
