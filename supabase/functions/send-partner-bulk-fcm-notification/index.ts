// Design Ref: §4.2 send-partner-bulk-fcm-notification — C+B + admin_announcement enforcement
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.9.6/index.ts";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;

const BATCH_SIZE = 50;
const BATCH_SLEEP_MS = 10;
const FETCH_TIMEOUT_MS = 5000;

interface PartnerRow {
  id: string;
  fcmToken: string[] | null;
  notificationPreferences: { announcement?: boolean } | null;
  marketingAgreed: boolean | null;
}

interface FailureRecord {
  partnerUserId: string;
  token?: string;
  reason: "UNREGISTERED" | "INVALID_ARGUMENT" | "TIMEOUT" | "OTHER";
  message?: string;
}

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

function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

serve(async (req) => {
  const t0 = Date.now();
  try {
    const { partnerUserIds, title, body, type, announcementId } = await req.json();
    if (!Array.isArray(partnerUserIds) || partnerUserIds.length === 0) return jsonResponse(400, { error: "partnerUserIds required (non-empty array)" });
    if (typeof title !== "string" || !title.trim()) return jsonResponse(400, { error: "title required" });
    if (typeof body !== "string" || !body.trim()) return jsonResponse(400, { error: "body required" });
    if (typeof type !== "string" || !type) return jsonResponse(400, { error: "type required" });
    if (partnerUserIds.length > 500) return jsonResponse(400, { error: "max 500 per call (use chunking from caller)" });

    console.log(`[bulk-fcm] start: ${partnerUserIds.length} partners, type=${type}`);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const accessToken = await getAccessToken();
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

    const { data: usersRaw, error: selectErr } = await supabase
      .from("partner_users")
      .select("id, fcmToken, notificationPreferences, marketingAgreed")
      .in("id", partnerUserIds);
    if (selectErr) {
      console.error(`[bulk-fcm] partner_users SELECT 실패:`, selectErr);
      return jsonResponse(500, { error: "partner_users 조회 실패", detail: selectErr.message });
    }
    const users: PartnerRow[] = (usersRaw ?? []) as PartnerRow[];

    const failures: FailureRecord[] = [];
    const unregisteredPairs: { partnerUserId: string; token: string }[] = [];
    let success = 0; let failed = 0; let noToken = 0; let skippedByPreference = 0;

    // admin_announcement: 공지 opt-out 및 마케팅 미동의자 사전 필터 (Plan SC-3, Design §4.2)
    const isAdminAnnouncement = type === "admin_announcement";
    const eligibleUsers: PartnerRow[] = [];
    for (const u of users) {
      if (isAdminAnnouncement) {
        const announcementAllowed = (u.notificationPreferences?.announcement ?? true) === true;
        const marketingAllowed = u.marketingAgreed === true;
        if (!announcementAllowed || !marketingAllowed) { skippedByPreference++; continue; }
      }
      eligibleUsers.push(u);
    }

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
      const tasks: Promise<{ user: PartnerRow; token: string; ok: boolean; errCode?: string; errMsg?: string }>[] = [];
      for (const u of batch) {
        const tokens = Array.isArray(u.fcmToken) ? u.fcmToken : [];
        if (tokens.length === 0) { noToken++; continue; }
        for (const token of tokens) {
          tasks.push(
            fetchWithTimeout(fcmUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
              body: JSON.stringify({
                message: {
                  token,
                  notification: { title, body },
                  data: { type, partnerUserId: u.id },
                  android: { priority: "HIGH", notification: { sound: "default" } },
                  apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
                },
              }),
            }, FETCH_TIMEOUT_MS)
              .then(async (res) => {
                if (res.ok) return { user: u, token, ok: true };
                const errBody = await res.json().catch(() => ({}));
                const code: string = errBody?.error?.details?.[0]?.errorCode ?? errBody?.error?.status ?? "OTHER";
                return { user: u, token, ok: false, errCode: code, errMsg: errBody?.error?.message };
              })
              .catch((err) => ({ user: u, token, ok: false, errCode: "TIMEOUT", errMsg: String(err) })),
          );
        }
      }
      const results = await Promise.allSettled(tasks);
      for (const r of results) {
        if (r.status !== "fulfilled") { failed++; continue; }
        const v = r.value;
        if (v.ok) { success++; continue; }
        failed++;
        const reason: FailureRecord["reason"] = v.errCode === "UNREGISTERED" ? "UNREGISTERED" : v.errCode === "INVALID_ARGUMENT" ? "INVALID_ARGUMENT" : v.errCode === "TIMEOUT" ? "TIMEOUT" : "OTHER";
        failures.push({ partnerUserId: v.user.id, token: v.token, reason, message: v.errMsg });
        if (reason === "UNREGISTERED") unregisteredPairs.push({ partnerUserId: v.user.id, token: v.token });
      }
      if (i + BATCH_SIZE < eligibleUsers.length) await new Promise((r) => setTimeout(r, BATCH_SLEEP_MS));
    }

    if (unregisteredPairs.length > 0) {
      supabase.rpc("remove_partner_fcm_tokens_bulk", { pairs: unregisteredPairs })
        .then(({ error }) => { if (error) console.error(`[bulk-fcm] UNREGISTERED 정리 실패:`, error); else console.log(`[bulk-fcm] UNREGISTERED 정리 완료: ${unregisteredPairs.length}개`); });
    }

    // admin_announcement는 partner_announcement_recipients에 저장, 그 외는 partner_notifications에 저장
    if (eligibleUsers.length > 0) {
      if (type === "admin_announcement" && announcementId) {
        const { error: insertErr } = await supabase.from("partner_announcement_recipients").insert(
          eligibleUsers.map((u) => ({ announcementId, partnerUserId: u.id })),
        );
        if (insertErr) console.error(`[bulk-fcm] partner_announcement_recipients INSERT 실패:`, insertErr);
      } else {
        const { error: insertErr } = await supabase.from("partner_notifications").insert(
          eligibleUsers.map((u) => ({ partnerUserId: u.id, type, title, body, navigationType: null, navigationParams: null, isRead: false })),
        );
        if (insertErr) console.error(`[bulk-fcm] partner_notifications INSERT 실패:`, insertErr);
      }
    }

    const durationMs = Date.now() - t0;
    console.log(`[bulk-fcm] done: total=${users.length}, success=${success}, failed=${failed}, noToken=${noToken}, skippedByPreference=${skippedByPreference}, ${durationMs}ms`);
    return jsonResponse(200, { total: users.length, success, failed, noToken, skippedByPreference, failures, durationMs });
  } catch (err) {
    console.error(`[bulk-fcm] 예외:`, err);
    return jsonResponse(500, { error: "internal_error", message: err instanceof Error ? err.message : String(err), durationMs: Date.now() - t0 });
  }
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
