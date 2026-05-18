import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.9.6/index.ts";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(FIREBASE_PRIVATE_KEY, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(FIREBASE_CLIENT_EMAIL)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setSubject(FIREBASE_CLIENT_EMAIL)
    .sign(privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`OAuth 토큰 요청 실패: ${JSON.stringify(data)}`);
  return data.access_token;
}

serve(async (req) => {
  try {
    const { partnerUserId, title, body, type, navigationData } = await req.json();
    if (!partnerUserId || !title || !body || !type) {
      return new Response(JSON.stringify({ success: false, error: "필수 파라미터 누락" }), { headers: { "Content-Type": "application/json" }, status: 400 });
    }
    console.log(`[FCM] 파트너 알림 요청: partnerUserId=${partnerUserId}, type=${type}`);
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Design Ref: §4.1 — admin_announcement enforcement용 컴럼 추가 (N+1 회피)
    const { data: partner, error: partnerError } = await supabaseClient
      .from("partner_users")
      .select("fcmToken, notificationPreferences")
      .eq("id", partnerUserId)
      .single();

    if (partnerError) {
      console.error(`[FCM] 파트너 조회 실패: ${partnerError.message}`);
      return new Response(JSON.stringify({ success: false, error: "파트너 조회 실패" }), { headers: { "Content-Type": "application/json" }, status: 400 });
    }

    // admin_announcement enforcement (Plan SC-3, Design §4.1)
    if (type === "admin_announcement") {
      const allowed = (partner?.notificationPreferences?.announcement ?? true) === true;
      if (!allowed) {
        console.log(`[FCM] admin_announcement skipped by preference: ${partnerUserId}`);
        return new Response(JSON.stringify({ success: false, error: "skipped_by_preference", skippedByPreference: 1 }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (!partner?.fcmToken || partner.fcmToken.length === 0) {
      console.log(`[FCM] FCM 토큰 없음: partnerUserId=${partnerUserId}`);
      return new Response(JSON.stringify({ success: false, error: "FCM 토큰 없음" }), { headers: { "Content-Type": "application/json" } });
    }

    const tokens: string[] = Array.isArray(partner.fcmToken) ? partner.fcmToken : [partner.fcmToken];
    console.log(`[FCM] FCM 토큰 ${tokens.length}개 확인`);
    const accessToken = await getAccessToken();
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
    const results = []; const errors = [];

    for (const token of tokens) {
      try {
        const fcmResponse = await fetch(fcmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { type, partnerUserId, ...(navigationData?.params ?? {}) },
              android: { priority: "high", notification: { sound: "default" } },
              apns: { payload: { aps: { sound: "default" } } },
            },
          }),
        });
        if (fcmResponse.ok) {
          results.push({ token: token.substring(0, 20) + "...", success: true });
        } else {
          const errorText = await fcmResponse.text();
          errors.push({ token: token.substring(0, 20) + "...", error: errorText });
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.details?.[0]?.errorCode === "UNREGISTERED") {
              const updatedTokens = (partner.fcmToken as string[]).filter((t) => t !== token);
              await supabaseClient.from("partner_users").update({ fcmToken: updatedTokens }).eq("id", partnerUserId);
            }
          } catch (_) {}
        }
      } catch (error) {
        errors.push({ token: token.substring(0, 20) + "...", error: error.message });
      }
    }

    try {
      await supabaseClient.from("partner_notifications").insert({
        partnerUserId,
        type,
        title,
        body,
        navigationType: navigationData?.type ?? null,
        navigationParams: navigationData?.params ?? null,
      });
    } catch (_) {}

    return new Response(JSON.stringify({
      success: results.length > 0,
      totalTokens: tokens.length,
      successCount: results.length,
      errorCount: errors.length,
      results, errors,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[FCM] 예외 발생:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { "Content-Type": "application/json" }, status: 500 });
  }
});
