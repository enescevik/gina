// Durable per-device delivery. Deploy after 083000; old claim API deliberately fails closed.
// S02: the same tick drains the email/SMS channel outbox after push; push behaviour is unchanged.
import { json, serviceClient } from "../_shared/supabase.ts";
import { drainPush, type PushRow, type PushTarget } from "./handler.ts";
import {
  apnsConfigFromEnv,
  fcmConfigFromEnv,
  sendApns,
  sendFcm,
} from "./providers.ts";
import { emailAdapterFromEnv } from "../_shared/channels/email.ts";
import { smsAdapterFromEnv } from "../_shared/channels/sms.ts";
import type { ChannelRow } from "../_shared/channels/render.ts";
import { drainChannels, workerMissing } from "./channels.ts";
function authorized(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return !!bearer &&
    [
      Deno.env.get("PUSH_SEND_SECRET"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ].filter(Boolean).includes(bearer);
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "forbidden" }, 403);
  try {
    const db = serviceClient(),
      apns = apnsConfigFromEnv(),
      fcm = fcmConfigFromEnv();
    async function rpc(name: string, args: Record<string, unknown>) {
      const r = await db.rpc(name, args);
      if (r.error) throw Error("push_storage_failed");
      return r.data;
    }
    const counts = await drainPush({
      claim: async () =>
        await rpc("push_claim_v2", { p_limit: 1 }) as PushRow[],
      targets: async (row) =>
        await rpc("push_delivery_targets", {
          p_outbox_id: row.id,
          p_lease: row.lease_id,
        }) as PushTarget[],
      configured: (target) => target.token_type === "apns" ? !!apns : !!fcm,
      send: (target, msg) =>
        target.token_type === "apns"
          ? sendApns(apns!, target.token, msg)
          : sendFcm(fcm!, target.token, msg),
      record: async (row, target, status, error, retryAfter) => {
        const acknowledged = await rpc("push_record_delivery", {
          p_outbox_id: row.id,
          p_lease: row.lease_id,
          p_token_id: target.token_id,
          p_token_hash: target.token_hash,
          p_status: status,
          p_error: error,
          p_retry_after: retryAfter ?? null,
        });
        if (acknowledged !== true) throw Error("push_receipt_invalid");
      },
      finish: async (row) =>
        await rpc("push_finish_delivery", {
          p_outbox_id: row.id,
          p_lease: row.lease_id,
        }) as string,
    });
    // Channel readiness heartbeat: which secrets the worker can see, by name only.
    const render = {
      unsubscribeUrl: Deno.env.get("CHANNEL_UNSUBSCRIBE_URL") || null,
      confirmUrl: Deno.env.get("CHANNEL_CONFIRM_URL") || null,
    };
    const settings = await db.from("app_settings").select("key,value").in("key", [
      "channels.email.provider",
      "channels.sms.provider",
    ]);
    const setting = (key: string) => {
      const v = settings.data?.find((s) => s.key === key)?.value;
      return typeof v === "string" ? v : null;
    };
    const emailSetup = emailAdapterFromEnv(setting("channels.email.provider"), Deno.env),
      smsSetup = smsAdapterFromEnv(setting("channels.sms.provider"), Deno.env);
    await rpc("channel_report_provider_status", { p_channel: "push", p_provider: "apns+fcm", p_configured: !!apns && !!fcm, p_missing: [...(apns ? [] : ["APNS_KEY_P8/APNS_KEY_ID/APNS_TEAM_ID"]), ...(fcm ? [] : ["FCM_SERVICE_ACCOUNT_JSON"])] });
    await rpc("channel_report_provider_status", { p_channel: "email", p_provider: setting("channels.email.provider"), p_configured: !!emailSetup.adapter && !!render.unsubscribeUrl, p_missing: workerMissing("email", emailSetup, render) });
    await rpc("channel_report_provider_status", { p_channel: "sms", p_provider: setting("channels.sms.provider"), p_configured: !!smsSetup.adapter && !!render.unsubscribeUrl, p_missing: workerMissing("sms", smsSetup, render) });
    const channels = await drainChannels({
      claim: async (limit) => await rpc("channel_claim", { p_limit: limit }) as ChannelRow[],
      emailFor: (provider) => provider === setting("channels.email.provider") ? emailSetup : emailAdapterFromEnv(provider, Deno.env),
      smsFor: (provider) => provider === setting("channels.sms.provider") ? smsSetup : smsAdapterFromEnv(provider, Deno.env),
      record: async (row, status, provider, messageId, error, retryAfter) => {
        const acknowledged = await rpc("channel_record_result", {
          p_id: row.id,
          p_lease: row.lease_id,
          p_status: status,
          p_provider: provider,
          p_provider_message_id: messageId,
          p_error: error,
          p_retry_after: retryAfter ?? null,
        });
        if (acknowledged !== true) throw Error("channel_receipt_invalid");
      },
      render,
    });
    return json({ ok: true, ...counts, channels });
  } catch {
    return json({ error: "push_worker_incomplete" }, 503);
  }
});
