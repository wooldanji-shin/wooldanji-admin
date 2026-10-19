import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/ads/solo-popup-server';

// 앱이 외부 브라우저로 여는 링크 — DB CHECK 와 같은 규칙 (http/https 만)
const LINK_PATTERN = /^https?:\/\//;
// DB CHECK 와 같은 규칙 — 버튼 문구 최대 글자 수
const BUTTON_LABEL_MAX = 10;

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

    // 필드가 body 에 있을 때만 갱신 — 링크만 보내는 기존 호출이 문구를 지우지 않도록. 빈 값이면 null(앱 기본 문구)
    const update: Record<string, string | null> = { detailLinkUrl };
    if (body && 'detailButtonLabel' in body) {
      const label: string | null = String(body.detailButtonLabel ?? '').trim() || null;
      if (label && label.length > BUTTON_LABEL_MAX) {
        return NextResponse.json({ error: `버튼 이름은 ${BUTTON_LABEL_MAX}자 이하로 입력해 주세요.` }, { status: 400 });
      }
      update.detailButtonLabel = label;
    }

    const { error: updateError } = await (supabase as any)
      .from('solo_popup_ads_v2')
      .update(update)
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
