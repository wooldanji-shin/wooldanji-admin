import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * 쿠폰 만료 스케줄러
 * - pg_cron으로 매일 KST 자정(UTC 15:00) 자동 실행
 * - expiresAt 경과 + isActive=true 쿠폰을 isActive=false로 업데이트
 */
serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // 기간 종료된 활성 쿠폰 조회
    const { data: expiredCoupons, error: selectError } = await supabaseAdmin
      .from("coupons")
      .select("id, partnerUserId, title")
      .eq("isActive", true)
      .lt("expiresAt", now);

    if (selectError) {
      console.error(`[ExpireCoupons] 조회 실패: ${selectError.message}`);
      return new Response(
        JSON.stringify({ success: false, error: selectError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      );
    }

    const expiredCount = expiredCoupons?.length ?? 0;

    if (expiredCount === 0) {
      console.log("[ExpireCoupons] 만료 처리할 쿠폰 없음");
      return new Response(
        JSON.stringify({ success: true, expiredCount: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // isActive=false 업데이트
    const expiredIds = expiredCoupons!.map((c) => c.id);
    const { error: updateError } = await supabaseAdmin
      .from("coupons")
      .update({
        isActive: false,
        updatedAt: now,
      })
      .in("id", expiredIds);

    if (updateError) {
      console.error(`[ExpireCoupons] 업데이트 실패: ${updateError.message}`);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      );
    }

    for (const coupon of expiredCoupons!) {
      console.log(
        `[ExpireCoupons] 만료 처리: id=${coupon.id} | 파트너=${coupon.partnerUserId} | 제목="${coupon.title}"`,
      );
    }

    console.log(`[ExpireCoupons] 완료 — ${expiredCount}건 만료 처리`);

    return new Response(
      JSON.stringify({ success: true, expiredCount }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ExpireCoupons] 예외 발생:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});