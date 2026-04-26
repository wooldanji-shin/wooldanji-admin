import { NextRequest, NextResponse } from 'next/server';

// Design Ref: §4.2 send route — 200명 청크로 신규 EF 병렬 호출
// Plan SC: SC-1(SLA) / SC-2-1(시스템 푸시 격리)
// Decision: D3 2단 청킹 — EF wall time 150초 한도 보호
//
// 입력: { partnerUserIds: string[], title: string, body: string }
// 응답: { total, success, failed, noToken, chunks, durationMs, failures: [...] }

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
    const { partnerUserIds, title, body } = await req.json();

    if (!Array.isArray(partnerUserIds) || partnerUserIds.length === 0) {
      return NextResponse.json(
        { error: 'partnerUserIds required (non-empty array)' },
        { status: 400 },
      );
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }
    if (typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'body required' }, { status: 400 });
    }
    if (partnerUserIds.length > MAX_TOTAL) {
      return NextResponse.json(
        { error: `max ${MAX_TOTAL} per request` },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'server misconfigured (env)' },
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
      { error: 'internal_error', message: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
