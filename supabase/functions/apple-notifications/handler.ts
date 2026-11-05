import { json, serviceClient } from "../_shared/supabase.ts";
import { processStoreNotification } from "../_shared/store-notification.ts";
import {
  APPLE_BUNDLE_ID, appleApiConfigured, applyStoreState, appleState, fetchAppleState,
  verifyAppleJws, type AppleRenewalInfo, type AppleTransaction,
} from "../_shared/iap.ts";

interface NotificationV2 {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: { signedTransactionInfo?: string; signedRenewalInfo?: string; bundleId?: string; environment?: string };
}
const defaults = { serviceClient, verifyAppleJws, appleApiConfigured, applyStoreState, appleState, fetchAppleState, bundleId: APPLE_BUNDLE_ID };
export async function appleNotifications(req: Request, deps = defaults): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: { signedPayload?: string } | null;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (typeof body?.signedPayload !== "string") return json({ error: "missing_signedPayload" }, 400);
  let payload: NotificationV2;
  try { payload = await deps.verifyAppleJws<NotificationV2>(body.signedPayload); }
  catch { return json({ error: "invalid_jws" }, 400); }
  // Never peek an unverified UUID into the idempotency log.
  if (!payload || typeof payload.notificationUUID !== "string" || !payload.notificationUUID || payload.notificationUUID.length > 256) {
    return json({ error: "missing_notification_id" }, 400);
  }
  if (payload.data?.bundleId && payload.data.bundleId !== deps.bundleId()) return json({ error: "bundle_mismatch" }, 400);
  if (payload.notificationType !== "TEST" && !payload.data?.signedTransactionInfo) {
    return json({ error: "missing_transaction" }, 400);
  }
  try {
    const db = deps.serviceClient();
    return await processStoreNotification(db, "apple", payload.notificationUUID,
      [payload.notificationType, payload.subtype].filter(Boolean).join(":") || null, { payload }, async () => {
        if (payload.notificationType === "TEST") return {};
        const tx = await deps.verifyAppleJws<AppleTransaction>(payload.data!.signedTransactionInfo!);
        const renewal = payload.data?.signedRenewalInfo
          ? await deps.verifyAppleJws<AppleRenewalInfo>(payload.data.signedRenewalInfo) : null;
        let state = deps.appleState(tx, renewal);
        if (deps.appleApiConfigured()) state = (await deps.fetchAppleState(tx.originalTransactionId, tx.environment)) ?? state;
        state.source = "notification";
        await deps.applyStoreState(db, state);
        return { storeKey: state.storeKey };
      });
  } catch { return json({ error: "processing_failed" }, 503); }
}
