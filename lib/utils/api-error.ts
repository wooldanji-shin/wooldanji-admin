/**
 * 실패 응답에서 서버가 보낸 error 문구를 꺼낸다.
 * 본문이 JSON이 아니거나(게이트웨이 타임아웃 HTML 등) error가 비어 있으면 null — 호출부가 상황 설명형 문구로 대신한다.
 */
export async function readApiErrorMessage(response: Response): Promise<string | null> {
  const body = await response.json().catch(() => null);
  const message = body?.error;
  return typeof message === 'string' && message.trim() ? message : null;
}

/** fetch 자체가 실패했을 때(네트워크 끊김 등) 보여줄 문구 */
export function networkFailedMessage(action: string): string {
  return `${action} 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`;
}
