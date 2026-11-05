// Durable per-device delivery. Deploy after 083000; old claim API deliberately fails closed.
import { json, serviceClient } from "../_shared/supabase.ts";
import { authorizedBearer } from "./auth.ts";
import { drainPush, type PushRow, type PushTarget } from "./handler.ts";
import {
  apnsConfigFromEnv,
  fcmConfigFromEnv,
  sendApns,
  sendFcm,
} from "./providers.ts";
// Q03-EDGE-1: sabit zamanlı karşılaştırma (./auth.ts). Sözleşme değişmedi: PUSH_SEND_SECRET veya
// SUPABASE_SERVICE_ROLE_KEY bearer olarak kabul edilir (işletim betikleri / zamanlayıcı bu ucu böyle çağırır).
function authorized(req: Request) {
  return authorizedBearer(req.headers.get("authorization"), [
    Deno.env.get("PUSH_SEND_SECRET"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ]);
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
    return json({ ok: true, ...counts });
  } catch {
    return json({ error: "push_worker_incomplete" }, 503);
  }
});
