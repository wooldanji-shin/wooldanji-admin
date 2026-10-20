import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyPartner, requireAdmin, soloContentDbErrorMessage } from '@/lib/ads/solo-popup-server';

/** DB 함수(approve_solo_popup_modification)가 승인하지 못한 이유 → 관리자 안내 */
const REJECT_RESPONSES: Record<string, { status: number; error: string }> = {
  not_found: { status: 404, error: '단독 팝업 광고를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' },
  not_running: { status: 409, error: '게재 중인 광고만 수정 승인할 수 있습니다.' },
  not_pending: {
    status: 400,
    error: '심사 중인 수정 요청이 없습니다. 이미 처리됐을 수 있으니 화면을 새로고침해 주세요.',
  },
  no_changes: { status: 400, error: '수정 요청에 바뀐 내용이 없습니다. 파트너에게 다시 요청해 달라고 안내해 주세요.' },
  invalid_link: {
    status: 400,
    error: '수정 요청의 링크가 올바르지 않습니다. 파트너에게 다시 요청해 달라고 안내해 주세요.',
  },
  invalid_button_label: {
    status: 400,
    error: '수정 요청의 버튼 문구가 올바르지 않습니다(1~10자). 파트너에게 다시 요청해 달라고 안내해 주세요.',
  },
  invalid_images: { status: 400, error: '수정 요청의 이미지가 올바르지 않습니다. 파트너에게 다시 요청해 달라고 안내해 주세요.' },
};

/**
 * 단독 팝업 광고 수정 승인.
 * 화이트리스트 반영·링크/내용 검증·조건부 update 는 DB 함수가 한다 (auto-approve EF와 같은 함수).
 * 함수는 service_role 전용이라 관리자 확인 후 admin 클라이언트로 호출한다.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await requireAdmin();
    if (error) return error;

    const { data: result, error: rpcError } = await (createAdminClient() as any).rpc(
      'approve_solo_popup_modification',
      { p_id: id }
    );
    if (rpcError || !result) {
      console.error('Failed to approve solo popup modification:', rpcError);
      return NextResponse.json(
        { error: '단독 팝업 광고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      );
    }

    if (!result.approved) {
      if (result.reason === 'invalid_content') {
        return NextResponse.json({ error: soloContentDbErrorMessage(String(result.detail)) }, { status: 400 });
      }
      const response = REJECT_RESPONSES[result.reason as string];
      return NextResponse.json(
        { error: response?.error ?? '수정을 승인하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' },
        { status: response?.status ?? 400 }
      );
    }

    await notifyPartner({
      partnerUserId: result.partnerId,
      soloPopupAdId: id,
      baseAdId: result.baseAdId,
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
