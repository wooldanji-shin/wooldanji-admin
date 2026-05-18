import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * 프리미엄 광고 종료 D-7 알림 스케줄러
 *
 * - 매일 1회 Cron 또는 어드민 서버에서 HTTP POST 호출
 * - endedAt - 7일 = today인 running 프리미엄 광고 조회
 * - send-partner-fcm-notification으로 알림 발송
 * - notifiedExpiry7days → true 업데이트 (중복 발송 방지)
 */
serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + 7);

    const targetStart = new Date(targetDate);
    targetStart.setUTCHours(0, 0, 0, 0);

    const targetEnd = new Date(targetDate);
    targetEnd.setUTCHours(23, 59, 59, 999);

    console.log(
      `[PremiumExpiryCheck] D-7 알림 대상 조회: ${targetStart.toISOString()} ~ ${targetEnd.toISOString()}`,
    );

    // running + notifiedExpiry7days=false + endedAt 범위
    const { data: targets, error: queryError } = await supabase
      .from('premium_advertisements_v2')
      .select('id, "partnerId", "endedAt"')
      .eq('status', 'running')
      .eq('notifiedExpiry7days', false)
      .gte('endedAt', targetStart.toISOString())
      .lte('endedAt', targetEnd.toISOString());

    if (queryError) {
      console.error(`[PremiumExpiryCheck] 조회 실패: ${queryError.message}`);
      return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
    }

    if (!targets || targets.length === 0) {
      console.log('[PremiumExpiryCheck] 알림 대상 없음');
      return new Response(JSON.stringify({ success: true, notified: 0 }), { status: 200 });
    }

    console.log(`[PremiumExpiryCheck] 알림 대상: ${targets.length}건`);

    let notifiedCount = 0;
    const fcmUrl = `${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`;

    for (const target of targets) {
      try {
        const endedAt = new Date(target.endedAt);
        const endedAtKst = new Date(endedAt.getTime() + 9 * 60 * 60 * 1000);
        const endDateStr = `${endedAtKst.getFullYear()}.${String(endedAtKst.getMonth() + 1).padStart(2, '0')}.${String(endedAtKst.getDate()).padStart(2, '0')}`;

        const fcmRes = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            partnerUserId: target.partnerId,
            title: '프리미엄 광고 종료 예정',
            body: `프리미엄 광고가 7일 후 종료됩니다. (종료일: ${endDateStr})`,
            type: 'premium_ad_expiry',
            navigationData: {
              type: 'premium_ad_detail',
              params: { premiumAdId: target.id },
            },
          }),
        });

        if (fcmRes.ok) {
          // notifiedExpiry7days → true
          await supabase
            .from('premium_advertisements_v2')
            .update({
              notifiedExpiry7days: true,
              updatedAt: new Date().toISOString(),
            })
            .eq('id', target.id);

          notifiedCount++;
          console.log(`[PremiumExpiryCheck] 알림 발송 완료: ${target.id}`);
        } else {
          console.error(`[PremiumExpiryCheck] FCM 실패 (id=${target.id}): ${fcmRes.status}`);
        }
      } catch (err) {
        console.error(`[PremiumExpiryCheck] 처리 실패 (id=${target.id}):`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifiedCount, total: targets.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[PremiumExpiryCheck] 서버 오류:', error);
    return new Response(JSON.stringify({ error: '서버 오류' }), { status: 500 });
  }
});
