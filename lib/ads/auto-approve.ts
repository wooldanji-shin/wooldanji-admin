import { toast } from 'sonner';

/** 자동승인 플래그가 붙는 두 테이블 */
export type AutoApproveTable = 'advertisements_v2' | 'premium_advertisements_v2';

/**
 * 수정 심사 자동승인 켜기/끄기.
 *
 * 켜두면 auto-approve-ad-modifications Edge Function이 10분마다 돌며
 * 이 광고의 수정 심사를 관리자 대신 승인한다.
 *
 * 성공하면 true — 호출한 쪽에서 화면 상태를 갱신하면 된다.
 */
export async function setAutoApproveModification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: AutoApproveTable,
  id: string,
  next: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from(table)
    .update({ autoApproveModification: next })
    .eq('id', id);

  if (error) {
    console.error('자동승인 설정 변경 실패:', error);
    toast.error('자동승인 설정 변경에 실패했습니다.');
    return false;
  }

  toast.success(next ? '수정 심사 자동승인을 켰습니다.' : '수정 심사 자동승인을 껐습니다.');
  return true;
}
