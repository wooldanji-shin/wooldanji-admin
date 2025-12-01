import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, inquiryId, replyContent } = await request.json();

    if (!userId || !inquiryId) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    console.log(`[문의 답변 알림] userId=${userId}, inquiryId=${inquiryId}`);

    // Supabase Edge Function 호출
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-inquiry-reply-notification`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        userId,
        inquiryId,
        replyContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[문의 답변 알림] Edge Function 호출 실패:', data);
      return NextResponse.json(
        { success: false, error: 'Edge Function 호출 실패', details: data },
        { status: response.status }
      );
    }

    console.log('[문의 답변 알림] 알림 전송 성공:', data);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[문의 답변 알림] 예외 발생:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
