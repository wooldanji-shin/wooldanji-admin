import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/ads/solo-popup-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, error } = await requireAdmin();
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const adminMemo: string | null = body?.adminMemo?.trim() || null;

    const { error: updateError } = await (supabase as any)
      .from('solo_popup_ads_v2')
      .update({ adminMemo })
      .eq('id', id);
    if (updateError) {
      console.error('Failed to update admin memo:', updateError);
      return NextResponse.json({ error: '메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
