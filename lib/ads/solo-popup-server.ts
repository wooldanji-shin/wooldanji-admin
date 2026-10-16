// 단독 팝업 광고 API 라우트 공용 서버 헬퍼
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeButtons,
  periodError,
  soloContentError,
  type SoloButton,
  type SoloButtonMode,
  type SoloContentType,
  type SoloContent,
  type SoloPeriodUnit,
} from '@/lib/ads/solo-popup';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** 관리자(SUPER_ADMIN/MANAGER) 세션 확인. 실패 시 응답을 돌려준다. */
export async function requireAdmin(): Promise<
  { supabase: ServerClient; error: null } | { supabase: null; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, error: NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 }) };
  }

  const { data: roles } = await supabase.from('user_roles').select('role').eq('userId', user.id);
  const isAdmin = roles?.some((r) => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
  if (!isAdmin) {
    return {
      supabase: null,
      error: NextResponse.json({ error: '이 작업을 할 권한이 없습니다.' }, { status: 403 }),
    };
  }
  return { supabase, error: null };
}

interface SoloNotification {
  partnerUserId: string;
  soloPopupAdId: string;
  baseAdId: string | null;
  title: string;
  body: string;
  type: string;
}

/** 파트너 FCM (non-critical: 실패해도 본 작업은 유지) */
export async function notifyPartner(n: SoloNotification): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        partnerUserId: n.partnerUserId,
        title: n.title,
        body: n.body,
        type: n.type,
        navigationData: {
          type: 'solo_popup_ad_detail',
          params: { soloPopupAdId: n.soloPopupAdId, baseAdId: n.baseAdId },
        },
      }),
    });
  } catch (err) {
    console.error('단독 팝업 알림 전송 실패 (non-critical):', err);
  }
}

/**
 * PostgREST 에러를 관리자 메시지로.
 * DB 원문(err.message)은 영어·기술 문구라 화면에 내보내지 않는다 — 원문은 호출하는 라우트가 로그로 남긴다.
 */
export function dbErrorMessage(err: { code?: string; message?: string }): string {
  if (err.code === '23505') return '이 기본 광고에는 이미 진행 중인 단독 팝업 광고가 있습니다.';
  if (err.code === '23514') return '입력값이 규칙에 맞지 않습니다. (글자수·링크·기간을 확인해주세요)';
  return '단독 팝업 광고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/** solo_popup_content_error가 돌려주는 '필드명: 사유' 원문을 화면에서 쓰는 말로 바꾼다 */
const SOLO_CONTENT_FIELD_MESSAGES: Record<string, string> = {
  title: '제목 글자 수를 확인해 주세요.',
  bulletLines: '글머리표 줄 수와 줄당 글자 수를 확인해 주세요.',
  buttonMode: '버튼 종류를 다시 선택해 주세요.',
  buttons: '버튼 개수, 링크(http:// 또는 https://로 시작), 버튼 라벨 글자 수를 확인해 주세요.',
};

export function soloContentDbErrorMessage(raw: string): string {
  console.error('Solo popup content rejected by DB:', raw);
  const field = raw.split(':')[0].trim();
  const hint = SOLO_CONTENT_FIELD_MESSAGES[field] ?? '제목·글머리표·버튼을 확인해 주세요.';
  return `입력 내용이 규칙에 맞지 않습니다. ${hint}`;
}

export interface SoloWriteBody {
  partnerId?: string;
  baseAdId?: string;
  title?: string;
  imageUrl?: string;
  bulletLines?: string[];
  contentType?: SoloContentType;
  buttonMode?: SoloButtonMode;
  buttons?: SoloButton[];
  periodUnit?: SoloPeriodUnit;
  periodCount?: number;
  discountRate?: number;
  adminMemo?: string;
  salesRepId?: string | null;
}

/** 사용자 입력 오류 — 400 으로 응답한다 */
export class SoloInputError extends Error {}

/** 콘텐츠 컬럼 조립 + 클라이언트 규칙·DB 검증 함수로 이중 검증 */
export async function buildSoloContent(admin: any, body: SoloWriteBody) {
  const content: SoloContent = {
    title: (body.title ?? '').trim(),
    imageUrl: body.imageUrl ?? '',
    bulletLines: (body.bulletLines ?? []).map((l) => l.trim()),
    contentType: body.contentType === 'text' ? 'text' : 'bullets',
    buttonMode: body.buttonMode ?? 'detail',
    buttons: body.buttons ?? [],
  };
  const clientError = soloContentError(content);
  if (clientError) throw new SoloInputError(clientError);

  const buttons = normalizeButtons(content.buttonMode, content.buttons);
  const { data: dbError } = await admin.rpc('solo_popup_content_error', {
    p_title: content.title,
    p_bullet_lines: content.bulletLines,
    p_button_mode: content.buttonMode,
    p_buttons: buttons,
    p_content_type: content.contentType,
  });
  if (dbError) throw new SoloInputError(soloContentDbErrorMessage(String(dbError)));

  return { ...content, buttons };
}

/** 기간 환산·스냅샷·총액 — 전부 DB 함수가 계산한다 (TS 에 환산식을 두지 않는다) */
export async function computeSoloAmounts(
  admin: any,
  baseAdId: string,
  unit: SoloPeriodUnit,
  count: number
) {
  const periodErr = periodError(unit, count);
  if (periodErr) throw new SoloInputError(periodErr);

  const { data: weeks, error: weeksError } = await admin.rpc('solo_popup_period_to_weeks', {
    p_unit: unit,
    p_count: count,
  });
  if (weeksError) throw new SoloInputError('기간이 올바르지 않습니다.');

  const { data: snapshot } = await admin.rpc('solo_popup_build_snapshot', { p_base_ad_id: baseAdId });
  const { data: totalAmount, error: amountError } = await admin.rpc('calc_solo_popup_amount', {
    p_snapshot: snapshot,
    p_weeks: weeks,
  });
  if (amountError) throw new SoloInputError('기본 광고에 노출 아파트가 없어 금액을 계산할 수 없습니다.');

  return { weeks: weeks as number, snapshot, totalAmount: totalAmount as number };
}
