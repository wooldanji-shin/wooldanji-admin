import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * 무료광고 종료 D-3 알림 스케줄러
 * - 외부 Cron 또는 어드민 서버에서 매일 1회 HTTP POST 호출
 * - ad_subscriptions_v2.freeEndDate 기준으로 D-3인 running 광고 조회
 * - send-partner-fcm-notification Edge Function으로 알림 발송
 */
serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // D-3 날짜 범위 계산 (UTC 기준)
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + 3);

    const targetStart = new Date(targetDate);
    targetStart.setUTCHours(0, 0, 0, 0);

    const targetEnd = new Date(targetDate);
    targetEnd.setUTCHours(23, 59, 59, 999);

    console.log(`[ExpiryCheck] D-3 알림 대상 조회: ${targetStart.toISOString()} ~ ${targetEnd.toISOString()}`);

    // active 구독 중 freeEndDate가 오늘+3일인 running 광고 조회
    const { data: targets, error: queryError } = await supabaseAdmin
      .from("ad_subscriptions_v2")
      .select(`
        id,
        "advertisementId",
        "freeEndDate",
        advertisements_v2!inner (
          id,
          "partnerId",
          "adStatus"
        )
      `)
      .eq("subscriptionStatus", "active")
      .eq("advertisements_v2.adStatus", "running")
      .gte("freeEndDate", targetStart.toISOString())
      .lte("freeEndDate", targetEnd.toISOString());

    if (queryError) {
      console.error(`[ExpiryCheck] 조회 실패: ${queryError.message}`);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!targets || targets.length === 0) {
      console.log(`[ExpiryCheck] D-3 알림 대상 없음`);
      return new Response(
        JSON.stringify({ success: true, sentCount: 0, message: "알림 대상 없음" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[ExpiryCheck] D-3 알림 대상 ${targets.length}건 발견`);

    // 중복 발송 방지: 오늘 이미 동일 타입으로 발송된 알림 확인
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const partnerIds = targets.map((t: any) => t.advertisements_v2.partnerId);
    const { data: alreadySent } = await supabaseAdmin
      .from("partner_notifications")
      .select("partner_user_id, navigation_params")
      .in("partner_user_id", partnerIds)
      .eq("type", "free_ad_expiry_warning")
      .gte("created_at", todayStart.toISOString());

    const alreadySentKeys = new Set(
      (alreadySent ?? []).map((n: any) =>
        `${n.partner_user_id}_${n.navigation_params?.advertisementId}`
      )
    );

    let sentCount = 0;
    let skippedCount = 0;

    for (const target of targets) {
      const partnerId = (target as any).advertisements_v2.partnerId;
      const advertisementId = (target as any).advertisementId;
      const dedupeKey = `${partnerId}_${advertisementId}`;

      // 오늘 이미 발송된 경우 skip
      if (alreadySentKeys.has(dedupeKey)) {
        console.log(`[ExpiryCheck] 중복 발송 skip: partnerId=${partnerId}, adId=${advertisementId}`);
        skippedCount++;
        continue;
      }

      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              partnerUserId: partnerId,
              title: "무료광고 종료 안내",
              body: "무료광고 종료가 3일 남았습니다. 이후 결제될 예정입니다.",
              type: "free_ad_expiry_warning",
              navigationData: {
                type: "ad_detail",
                params: { advertisementId },
              },
            }),
          }
        );

        if (response.ok) {
          console.log(`[ExpiryCheck] ✅ 알림 발송 성공: partnerId=${partnerId}`);
          sentCount++;
        } else {
          const errText = await response.text();
          console.error(`[ExpiryCheck] ❌ 알림 발송 실패: partnerId=${partnerId} - ${errText}`);
        }
      } catch (err) {
        console.error(`[ExpiryCheck] ❌ 알림 발송 예외: partnerId=${partnerId} - ${err}`);
      }
    }

    console.log(`[ExpiryCheck] 완료: 발송 ${sentCount}건, skip ${skippedCount}건`);

    return new Response(
      JSON.stringify({ success: true, sentCount, skippedCount }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ExpiryCheck] 예외 발생:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
