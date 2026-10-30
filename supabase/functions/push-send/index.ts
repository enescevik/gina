// push_outbox'ı boşaltır: hedef token'ları bulur, APNs/FCM'e gönderir, sonucu satıra yazar.
// Tetikleyen: pg_cron (gina.kick_push_send, her dakika) ya da Database Webhook (push_outbox INSERT).
// Deploy: `supabase functions deploy push-send --no-verify-jwt` (yetki aşağıda ayrıca denetlenir).
// Yetki: `Authorization: Bearer <PUSH_SEND_SECRET>` ya da service_role anahtarı.
// Kurallar: bildirim metni geneldir, kişisel veri (çocuk adı, not, puan) taşımaz; data yalnız kimlik.
// Anahtar yoksa satırlar 'skipped_unconfigured' olur ve 200 döner.

import { json, serviceClient } from "../_shared/supabase.ts";
import {
  apnsConfigFromEnv,
  fcmConfigFromEnv,
  sendApns,
  sendFcm,
  type PushMessage,
  type SendResult,
} from "./providers.ts";

type Locale = "tr" | "en";

interface OutboxRow {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
}

interface Target {
  token_id: string;
  token: string;
  token_type: "apns" | "fcm";
  locale: Locale;
}

const MAX_ATTEMPTS = 5;

// Genel, kişisel veri içermeyen metinler (tür → dil).
const TEXTS: Record<string, Record<Locale, string>> = {
  task_awaiting_approval: { tr: "Onay bekleyen bir görev var", en: "A task is waiting for your approval" },
  task_approved: { tr: "Bir görevin onaylandı", en: "One of your tasks was approved" },
  task_returned: { tr: "Bir görevin geri gönderildi, tekrar bakabilirsin", en: "A task was sent back, take another look" },
  exam_assigned: { tr: "Yeni bir deneme seni bekliyor", en: "A new practice test is waiting for you" },
  exam_finished: { tr: "Bir deneme tamamlandı", en: "A practice test was finished" },
  weekly_summary: { tr: "Haftalık özet hazır", en: "Your weekly summary is ready" },
};

function messageFor(row: OutboxRow, locale: Locale): PushMessage {
  const data: Record<string, string> = { kind: row.kind };
  // Yalnız bilinen kimlik alanları geçer (savunma: payload'a başka alan yazılsa bile sızmaz).
  for (const key of ["completion_id", "exam_id", "attempt_id"]) {
    const value = row.payload?.[key];
    if (typeof value === "string") data[key] = value;
  }
  return { title: "Gina", body: TEXTS[row.kind]?.[locale] ?? TEXTS[row.kind]?.tr ?? "Gina", kind: row.kind, data };
}

function authorized(req: Request): boolean {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!bearer) return false;
  const allowed = [Deno.env.get("PUSH_SEND_SECRET"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")].filter(Boolean);
  return allowed.includes(bearer);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "forbidden" }, 403);

  const db = serviceClient();
  const apns = apnsConfigFromEnv();
  const fcm = fcmConfigFromEnv();

  const { data: rows, error: claimError } = await db.rpc("push_claim_batch", { p_limit: 50 });
  if (claimError) return json({ error: "claim_failed" }, 500);
  const batch = (rows ?? []) as OutboxRow[];

  const counts = { claimed: batch.length, sent: 0, no_targets: 0, skipped_unconfigured: 0, retry: 0, failed: 0, tokens_deleted: 0 };

  // Hiçbir sağlayıcı tanımlı değilse hedef aramadan atla.
  if (!apns && !fcm) {
    if (batch.length > 0) {
      await db
        .from("push_outbox")
        .update({ status: "skipped_unconfigured", last_error: "apns_and_fcm_not_configured" })
        .in("id", batch.map((r) => r.id));
    }
    counts.skipped_unconfigured = batch.length;
    return json({ ok: true, ...counts });
  }

  for (const row of batch) {
    const { data: targetRows, error: targetError } = await db.rpc("push_targets", { p_outbox_id: row.id });
    if (targetError) {
      await finish(row, row.attempts >= MAX_ATTEMPTS ? "failed" : "pending", "targets_failed");
      continue;
    }
    const targets = (targetRows ?? []) as Target[];
    if (targets.length === 0) {
      await finish(row, "no_targets", null);
      counts.no_targets++;
      continue;
    }

    let sent = 0;
    let skipped = 0;
    let retry = false;
    const errors: string[] = [];
    const gone: string[] = [];

    for (const t of targets) {
      const msg = messageFor(row, t.locale === "en" ? "en" : "tr");
      let result: SendResult;
      if (t.token_type === "apns") {
        if (!apns) {
          skipped++;
          continue;
        }
        result = await sendApns(apns, t.token, msg);
      } else {
        if (!fcm) {
          skipped++;
          continue;
        }
        result = await sendFcm(fcm, t.token, msg);
      }
      if (result.ok) {
        sent++;
      } else {
        errors.push(result.error);
        if (result.gone) gone.push(t.token_id);
        if (result.retry) retry = true;
      }
    }

    if (gone.length > 0) {
      await db.from("push_tokens").delete().in("id", gone);
      counts.tokens_deleted += gone.length;
    }

    const lastError = errors.length > 0 ? errors.slice(0, 5).join(",") : null;
    if (sent > 0) {
      // Kısmi başarıda yeniden denenmez (aynı veliye çift bildirim gitmesin).
      await finish(row, "sent", lastError);
      counts.sent++;
    } else if (retry && row.attempts < MAX_ATTEMPTS) {
      await finish(row, "pending", lastError);
      counts.retry++;
    } else if (errors.length === 0 && skipped > 0) {
      await finish(row, "skipped_unconfigured", "provider_not_configured");
      counts.skipped_unconfigured++;
    } else {
      await finish(row, "failed", lastError);
      counts.failed++;
    }
  }

  return json({ ok: true, ...counts });

  async function finish(row: OutboxRow, status: string, lastError: string | null) {
    await db
      .from("push_outbox")
      .update({ status, last_error: lastError, sent_at: status === "sent" ? new Date().toISOString() : null })
      .eq("id", row.id);
  }
});
