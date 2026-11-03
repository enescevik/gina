import { json, serviceClient } from "../_shared/supabase.ts";
import { processStoreNotification } from "../_shared/store-notification.ts";
import { applyStoreState, GOOGLE_PACKAGE_NAME, googleApiConfigured, refreshGoogle, verifyGoogleOidc } from "../_shared/iap.ts";
interface PubSubEnvelope { message?: { data?: string; messageId?: string } }
interface DeveloperNotification {
  packageName?: string;
  subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
  voidedPurchaseNotification?: { purchaseToken?: string; productType?: number };
  testNotification?: object;
}
const defaults = { serviceClient, applyStoreState, googleApiConfigured, refreshGoogle, verifyGoogleOidc,
  env: (key: string) => Deno.env.get(key), packageName: GOOGLE_PACKAGE_NAME };
export async function googleRtdn(req: Request, deps = defaults): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const audience = deps.env("GOOGLE_RTDN_AUDIENCE")?.trim();
  const sender = deps.env("GOOGLE_RTDN_SA_EMAIL")?.trim();
  if (!audience || !sender) return json({ error: "push_auth_not_configured" }, 503);
  let verified = false;
  try { verified = await deps.verifyGoogleOidc(req.headers.get("authorization"), audience, sender); } catch { /* deny */ }
  if (!verified) return json({ error: "unauthorized" }, 401);
  let envelope: PubSubEnvelope | null;
  let notification: DeveloperNotification;
  try {
    envelope = await req.json();
    if (typeof envelope?.message?.data !== "string") throw new Error();
    notification = JSON.parse(atob(envelope.message.data));
    if (!notification || typeof notification !== "object" || Array.isArray(notification)) throw new Error();
  } catch { return json({ error: "bad_notification" }, 400); }
  const eventKey = envelope?.message?.messageId;
  if (typeof eventKey !== "string" || !eventKey || eventKey.length > 256) return json({ error: "missing_notification_id" }, 400);
  if (notification.packageName !== deps.packageName()) return json({ error: "package_mismatch" }, 400);
  const types = [notification.subscriptionNotification, notification.voidedPurchaseNotification, notification.testNotification].filter(Boolean);
  if (types.length !== 1) return json({ error: "bad_notification_type" }, 400);
  const purchaseToken = notification.subscriptionNotification?.purchaseToken ?? notification.voidedPurchaseNotification?.purchaseToken;
  if (!notification.testNotification && (typeof purchaseToken !== "string" || !purchaseToken)) return json({ error: "missing_purchase_token" }, 400);
  const type = notification.testNotification ? "test" : notification.voidedPurchaseNotification ? "voided"
    : `subscription:${notification.subscriptionNotification?.notificationType ?? "unknown"}`;
  try {
    const db = deps.serviceClient();
    return await processStoreNotification(db, "google", eventKey, type, { notification }, async () => {
      if (notification.testNotification) return {};
      // One-time purchases are outside GINA's subscription model.
      if (notification.voidedPurchaseNotification?.productType === 2) return { ignored: true };
      if (!deps.googleApiConfigured()) throw new Error("store_not_configured");
      const revoked = notification.subscriptionNotification?.notificationType === 12 || !!notification.voidedPurchaseNotification;
      const state = await deps.refreshGoogle(db, purchaseToken!, { revoked });
      if (state) await deps.applyStoreState(db, state);
      return { storeKey: purchaseToken! };
    });
  } catch { return json({ error: "processing_failed" }, 503); }
}
