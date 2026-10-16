import { NextRequest, NextResponse } from 'next/server';
import { SOLO_CONTENT_COLUMNS } from '@/lib/ads/solo-popup';
import { dbErrorMessage, notifyPartner, requireAdmin, soloContentDbErrorMessage } from '@/lib/ads/solo-popup-server';

/**
 * 단독 팝업 광고 수정 승인.
 * pendingChanges 는 콘텐츠 컬럼 화이트리스트만 반영한다 (status·금액·기간 등 임의 키 무시).
 * 반영 전 DB 검증 함수(solo_popup_content_error)로 한 번 더 확인한다.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, error } = await requireAdmin();
    if (error) return error;
    const db = supabase as any;

    const { data: ad } = await db
      .from('solo_popup_ads_v2')
      .select('status, modificationStatus, pendingChanges, partnerId, baseAdId, contentType')
      .eq('id', id)
      .single();
    if (!ad) return NextResponse.json({ error: '단독 팝업 광고를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' }, { status: 404 });
    if (ad.status !== 'running') {
      return NextResponse.json({ error: '게재 중인 광고만 수정 승인할 수 있습니다.' }, { status: 409 });
    }
    if (ad.modificationStatus !== 'pending') {
      return NextResponse.json(
        { error: '심사 중인 수정 요청이 없습니다. 이미 처리됐을 수 있으니 화면을 새로고침해 주세요.' },
        { status: 400 }
      );
    }

    const pending = (ad.pendingChanges ?? null) as Record<string, unknown> | null;
    if (!pending) return NextResponse.json({ error: '수정 요청에 바뀐 내용이 없습니다. 파트너에게 다시 요청해 달라고 안내해 주세요.' }, { status: 400 });

    const content = Object.fromEntries(
      SOLO_CONTENT_COLUMNS.filter((key) => key in pending).map((key) => [key, pending[key]])
    );

    const { data: contentError } = await db.rpc('solo_popup_content_error', {
      p_title: content.title,
      p_bullet_lines: content.bulletLines,
      p_button_mode: content.buttonMode,
      p_buttons: content.buttons,
      // contentType 키가 없는 이전 수정 요청은 현재 형식 기준으로 검증
      p_content_type: content.contentType ?? ad.contentType ?? 'bullets',
    });
    if (contentError) {
      return NextResponse.json({ error: soloContentDbErrorMessage(String(contentError)) }, { status: 400 });
    }

    const { data: updated, error: updateError } = await db
      .from('solo_popup_ads_v2')
      .update({
        ...content,
        modificationStatus: null,
        modificationRejectedReason: null,
        pendingChanges: null,
      })
      .eq('id', id)
      .eq('status', 'running')
      .eq('modificationStatus', 'pending')
      .select('id');
    if (updateError) {
      console.error('Failed to approve solo popup modification:', updateError);
      return NextResponse.json({ error: dbErrorMessage(updateError) }, { status: 500 });
    }
    if (!updated?.length) {
      return NextResponse.json({ error: '게재 중인 광고만 수정 승인할 수 있습니다.' }, { status: 409 });
    }

    await notifyPartner({
      partnerUserId: ad.partnerId,
      soloPopupAdId: id,
      baseAdId: ad.baseAdId,
      title: '단독 팝업 광고 수정 심사 결과',
      body: '단독 팝업 광고 수정이 승인되었습니다. 변경 내용이 반영되었습니다.',
      type: 'solo_popup_ad_modification_approved',
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
