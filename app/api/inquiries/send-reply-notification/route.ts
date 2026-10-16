import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { userId, inquiryId, replyContent } = await request.json();

    if (!userId || !inquiryId) {
      return NextResponse.json(
        { success: false, error: '알림을 보낼 문의 정보가 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' },
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
        { success: false, error: '답변 알림을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' },
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
      { success: false, error: '일시적인 오류로 답변 알림을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
