import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./supabase.ts";
import { isPermanentIapError } from "./iap.ts";

export type StorePlatform = "apple" | "google";
export type NotificationResult = { storeKey?: string; ignored?: boolean };

/** Verification happens in the handler, before entering this durable inbox. */
export async function processStoreNotification(
  db: SupabaseClient, platform: StorePlatform, eventKey: string, eventType: string | null,
  payload: object, process: () => Promise<NotificationResult>,
): Promise<Response> {
  let token: string | undefined;
  const finish = async (error: string | null, storeKey?: string) => {
    const result = await db.rpc("finish_store_notification", {
      p_platform: platform, p_event_key: eventKey, p_token: token!,
      p_error: error, p_store_key: storeKey ?? null,
    });
    if (result.error || result.data !== true) throw new Error("notification_completion_not_saved");
  };
  try {
    const claim = await db.rpc("claim_store_notification", {
      p_platform: platform, p_event_key: eventKey, p_event_type: eventType,
      p_payload: { ...payload, verified: true },
    });
    if (claim.error) throw new Error("notification_claim_failed");
    if (claim.data?.status === "done") return json({ ok: true, duplicate: true });
    if (claim.data?.status === "busy") return json({ error: "processing_in_progress" }, 503);
    if (claim.data?.status !== "claimed" || typeof claim.data.token !== "string") {
      throw new Error("notification_claim_invalid");
    }
    token = claim.data.token;
    let result: NotificationResult;
    try {
      result = await process();
    } catch (e) {
      // A permanent rejection (wrong bundle, foreign family, unknown product...) is recorded with its
      // code and acknowledged to the provider: resending the same event cannot change the outcome.
      // The inbox row stays visible as failed for operators; a later delivery may still reclaim it.
      if (isPermanentIapError(e)) {
        await finish(e.code);
        return json({ ok: false, rejected: e.code });
      }
      throw e;
    }
    await finish(null, result.storeKey);
    return json({ ok: true, ...(result.ignored ? { ignored: true } : {}) });
  } catch {
    // Do not leak provider bodies/tokens. An uncertain finish is NOT an acknowledgement.
    // If releasing fails, the next delivery can reclaim the expired lease.
    if (token) {
      try { await finish("processing_failed"); } catch { /* lease expires */ }
    }
    return json({ error: "processing_failed" }, 503);
  }
}
