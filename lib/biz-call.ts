import { formatBizCallNumber } from '@/lib/utils/format';

export const BIZ_CALL_DUPLICATE_MESSAGE = '이미 다른 파트너가 사용 중인 비즈콜 번호입니다.';

/**
 * 같은 비즈콜 번호를 이미 쓰는 다른 파트너를 찾는다.
 *
 * 저장 형식이 하이픈 유무로 갈릴 수 있어 포맷된 형태와 숫자만 남긴 형태를 함께 조회한다.
 * 빈 값은 "미부여"라 중복 대상이 아니다.
 *
 * [excludePartnerId]는 지금 수정 중인 파트너 — 자기 번호를 그대로 두는 경우까지 막으면 안 된다.
 */
export async function findBizCallDuplicate(
  client: any,
  bizCallNumber: string | null | undefined,
  excludePartnerId: string | null
): Promise<{ id: string; businessName: string } | null> {
  const digits = (bizCallNumber ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;

  const candidates = [...new Set([formatBizCallNumber(digits), digits])];

  let query = client
    .from('partner_users')
    .select('id, businessName')
    .in('bizCallNumber', candidates);

  if (excludePartnerId) query = query.neq('id', excludePartnerId);

  const { data, error } = await query.limit(1);
  if (error) throw error;

  return (data?.[0] as { id: string; businessName: string } | undefined) ?? null;
}
