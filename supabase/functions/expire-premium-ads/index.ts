import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * 프리미엄 광고 만료 처리기
 * - endedAt < now인 running 광고를 ended로 변경
 * - 파트너에게 종료 FCM 알림 발송
 */
serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    const { data: targets, error: queryError } = await supabase
      .from("premium_advertisements_v2")
      .select('id, "partnerId", "endedAt"')
      .eq("status", "running")
      .lt("endedAt", now);

    if (queryError) {
      console.error(`[ExpirePremiumAds] 조회 실패: ${queryError.message}`);
      return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
    }

    if (!targets || targets.length === 0) {
      console.log("[ExpirePremiumAds] 만료 대상 없음");
      return new Response(JSON.stringify({ success: true, expiredCount: 0 }), { status: 200 });
    }

    console.log(`[ExpirePremiumAds] 만료 대상: ${targets.length}건`);

    let expiredCount = 0;
    const fcmUrl = `${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`;

    for (const target of targets) {
      try {
        const { error: updateError } = await supabase
          .from("premium_advertisements_v2")
          .update({ status: "ended", updatedAt: now })
          .eq("id", target.id);

        if (updateError) {
          console.error(`[ExpirePremiumAds] 상태 변경 실패 (id=${target.id}): ${updateError.message}`);
          continue;
        }

        expiredCount++;
        console.log(`[ExpirePremiumAds] 종료 처리 완료: ${target.id}`);

        // FCM 알림 (실패해도 만료 처리는 유지)
        await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            partnerUserId: target.partnerId,
            title: "프리미엄 광고 종료",
            body: "프리미엄 광고 게재가 종료되었습니다.",
            type: "premium_ad_ended",
            navigationData: {
              type: "premium_ad_detail",
              params: { premiumAdId: target.id },
            },
          }),
        }).catch((err) => {
          console.error(`[ExpirePremiumAds] FCM 실패 (id=${target.id}):`, err);
        });
      } catch (err) {
        console.error(`[ExpirePremiumAds] 처리 실패 (id=${target.id}):`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, expiredCount, total: targets.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ExpirePremiumAds] 서버 오류:", error);
    return new Response(JSON.stringify({ error: "서버 오류" }), { status: 500 });
  }
});
