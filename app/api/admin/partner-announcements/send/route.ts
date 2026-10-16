import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const CHUNK_SIZE = 200;
const MAX_TOTAL = 10000;

interface BulkResponse {
  total: number;
  success: number;
  failed: number;
  noToken: number;
  failures?: Array<{
    partnerUserId: string;
    token?: string;
    reason: string;
    message?: string;
  }>;
  durationMs: number;
}

export async function POST(req: NextRequest) {
  try {
    // 서비스 롤로 전체 회원·파트너 데이터를 다루므로 관리자 세션을 먼저 확인한다
    const authClient = await createServerClient();
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

    const { partnerUserIds, title, body } = await req.json();

    if (!Array.isArray(partnerUserIds) || partnerUserIds.length === 0) {
      return NextResponse.json(
        { error: '알림을 받을 파트너를 1명 이상 선택해 주세요.' },
        { status: 400 },
      );
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: '알림 제목을 입력해 주세요.' }, { status: 400 });
    }
    if (typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: '알림 내용을 입력해 주세요.' }, { status: 400 });
    }
    if (partnerUserIds.length > MAX_TOTAL) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_TOTAL.toLocaleString()}명까지 보낼 수 있습니다. 대상을 나눠서 보내 주세요.` },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: '서버 설정 문제로 알림을 보낼 수 없습니다. 개발 담당자에게 알려 주세요.' },
        { status: 500 },
      );
    }

    // 발송 이력 1행 선생성 — EF 청크들이 공유할 announcementId
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: announcement, error: announcementErr } = await supabase
      .from('partner_announcements')
      .insert({ title: title.trim(), body: body.trim(), recipientCount: partnerUserIds.length })
      .select('id')
      .single();
    if (announcementErr || !announcement) {
      console.error('[partner-announcements/send] announcement insert error:', announcementErr);
      return NextResponse.json(
        { error: '발송 이력을 만들지 못해 알림을 보내지 않았습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 },
      );
    }

    const efUrl = `${supabaseUrl}/functions/v1/send-partner-bulk-fcm-notification`;

    // 200명 청크 분할
    const chunks: string[][] = [];
    for (let i = 0; i < partnerUserIds.length; i += CHUNK_SIZE) {
      chunks.push(partnerUserIds.slice(i, i + CHUNK_SIZE));
    }

    const t0 = Date.now();

    // EF 병렬 호출 — Promise.allSettled로 부분 실패 흡수
    const results = await Promise.allSettled(
      chunks.map((chunk) =>
        fetch(efUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerUserIds: chunk,
            title: title.trim(),
            body: body.trim(),
            type: 'admin_announcement',
            announcementId: announcement.id,
          }),
        }).then(async (r) => {
          const json = (await r.json()) as BulkResponse | { error: string };
          if (!r.ok) throw new Error(`EF chunk error: ${JSON.stringify(json)}`);
          return json as BulkResponse;
        }),
      ),
    );

    // 결과 집계
    const summary = {
      total: 0,
      success: 0,
      failed: 0,
      noToken: 0,
      chunks: chunks.length,
      chunkErrors: 0,
      failures: [] as Array<{
        partnerUserId: string;
        token?: string;
        reason: string;
        message?: string;
      }>,
      durationMs: 0,
    };

    for (const r of results) {
      if (r.status === 'fulfilled') {
        summary.total += r.value.total ?? 0;
        summary.success += r.value.success ?? 0;
        summary.failed += r.value.failed ?? 0;
        summary.noToken += r.value.noToken ?? 0;
        if (r.value.failures) summary.failures.push(...r.value.failures);
      } else {
        summary.chunkErrors++;
        console.error('[partner-announcements/send] EF chunk failed:', r.reason);
      }
    }
    summary.durationMs = Date.now() - t0;

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[partner-announcements/send] error:', err);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}
