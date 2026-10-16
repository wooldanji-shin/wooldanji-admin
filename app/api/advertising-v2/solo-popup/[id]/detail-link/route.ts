import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/ads/solo-popup-server';

// 앱이 인앱 웹뷰로 여는 링크 — DB CHECK 와 같은 규칙 (http/https 만)
const LINK_PATTERN = /^https?:\/\//;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, error } = await requireAdmin();
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    // 빈 값이면 링크 해제 → 앱은 기본 광고 상세로 이동
    const detailLinkUrl: string | null = body?.detailLinkUrl?.trim() || null;
    if (detailLinkUrl && !LINK_PATTERN.test(detailLinkUrl)) {
      return NextResponse.json({ error: '링크는 http:// 또는 https:// 로 시작해야 합니다.' }, { status: 400 });
    }

    const { error: updateError } = await (supabase as any)
      .from('solo_popup_ads_v2')
      .update({ detailLinkUrl })
      .eq('id', id);
    if (updateError) {
      console.error('Failed to update detail link:', updateError);
      return NextResponse.json({ error: '링크를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
