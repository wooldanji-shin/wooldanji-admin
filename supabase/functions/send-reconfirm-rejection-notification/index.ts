import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.9.6/index.ts";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;

/**
 * FCM API v1용 OAuth 2.0 액세스 토큰 생성
 */
async function getAccessToken(): Promise<string> {
  try {
    const now = Math.floor(Date.now() / 1000);

    console.log("[FCM] OAuth 토큰 생성 시작");
    console.log(`[FCM] Client Email: ${FIREBASE_CLIENT_EMAIL}`);
    console.log(`[FCM] Private Key 길이: ${FIREBASE_PRIVATE_KEY.length} 문자`);
    console.log(`[FCM] Private Key 시작: ${FIREBASE_PRIVATE_KEY.substring(0, 50)}...`);

    // Private Key import
    let privateKey;
    try {
      privateKey = await importPKCS8(FIREBASE_PRIVATE_KEY, "RS256");
      console.log("[FCM] ✅ Private Key import 성공");
    } catch (keyError) {
      console.error("[FCM] ❌ Private Key import 실패:", keyError);
      throw new Error(`Private Key import 실패: ${keyError.message}`);
    }

    // JWT 생성 (scope를 payload에 직접 포함)
    const jwt = await new SignJWT({
      scope: "https://www.googleapis.com/auth/firebase.messaging"
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(FIREBASE_CLIENT_EMAIL)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setSubject(FIREBASE_CLIENT_EMAIL)
      .sign(privateKey);

    console.log("[FCM] ✅ JWT 생성 성공");

    // Access Token 요청
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[FCM] ❌ OAuth 토큰 요청 실패:", data);
      throw new Error(`OAuth 토큰 요청 실패: ${JSON.stringify(data)}`);
    }

    console.log("[FCM] ✅ OAuth 액세스 토큰 발급 성공");
    return data.access_token;
  } catch (error) {
    console.error("[FCM] getAccessToken 예외:", error);
    throw error;
  }
}

serve(async (req) => {
  try {
    const { userId, reconfirmId, rejectionReason } = await req.json();

    console.log(`[FCM] 재신청 거절 알림 요청: userId=${userId}, reconfirmId=${reconfirmId}`);

    // 1. Supabase 클라이언트 생성 (Service Role Key 사용)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. 사용자의 FCM 토큰 조회 (배열)
    const { data: user, error: userError } = await supabaseClient
      .from("user")
      .select("name, fcmToken")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error(`[FCM] 사용자 조회 실패: ${userError.message}`);
      return new Response(
        JSON.stringify({ success: false, error: "사용자 조회 실패" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!user?.fcmToken || user.fcmToken.length === 0) {
      console.log(`[FCM] FCM 토큰 없음: userId=${userId}`);
      return new Response(
        JSON.stringify({ success: false, error: "FCM 토큰 없음" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // fcmToken이 배열인지 확인
    const tokens: string[] = Array.isArray(user.fcmToken)
      ? user.fcmToken
      : [user.fcmToken];

    console.log(`[FCM] FCM 토큰 ${tokens.length}개 확인`);

    // 3. 알림 메시지 설정 (사유는 앱 내에서 확인)
    const title = "재신청 알림";
    const body = `${user.name}님, 재신청이 거절되었습니다. 확인해주세요.`;
    const notificationType = "reconfirm_rejected";

    // 4. OAuth 2.0 액세스 토큰 생성
    const accessToken = await getAccessToken();
    console.log(`[FCM] 액세스 토큰 생성 완료`);

    // 5. 모든 FCM 토큰으로 푸시 알림 전송
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
    const results = [];
    const errors = [];

    for (const token of tokens) {
      try {
        const fcmResponse = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title: title,
                body: body,
              },
              data: {
                type: notificationType,
                userId: userId,
                reconfirmId: reconfirmId,
                rejectionReason: rejectionReason || "",
              },
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            },
          }),
        });

        if (fcmResponse.ok) {
          const result = await fcmResponse.json();
          results.push({ token: token.substring(0, 20) + "...", success: true });
          console.log(`[FCM] ✅ 알림 전송 성공: ${token.substring(0, 20)}...`);
        } else {
          const errorText = await fcmResponse.text();
          errors.push({ token: token.substring(0, 20) + "...", error: errorText });
          console.error(`[FCM] ❌ 알림 전송 실패: ${token.substring(0, 20)}... - ${errorText}`);

          // UNREGISTERED 에러면 DB에서 토큰 제거
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
              await supabaseClient.rpc('remove_fcm_token', {
                user_id: userId,
                token_to_remove: token,
              });
              console.log(`[FCM] 🗑️ 무효한 토큰 제거: ${token.substring(0, 20)}...`);
            }
          } catch (cleanupError) {
            console.error(`[FCM] ⚠️ 토큰 제거 실패: ${cleanupError.message}`);
          }
        }
      } catch (error) {
        errors.push({ token: token.substring(0, 20) + "...", error: error.message });
        console.error(`[FCM] ❌ 예외 발생: ${token.substring(0, 20)}... - ${error.message}`);
      }
    }

    console.log(`[FCM] 전송 완료: 성공 ${results.length}개, 실패 ${errors.length}개`);

    return new Response(
      JSON.stringify({
        success: results.length > 0,
        totalTokens: tokens.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[FCM] 예외 발생:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
