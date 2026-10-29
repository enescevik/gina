import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface SubscriptionUpsert {
  familyId: string;
  purchaserUserId: string | null;
  platform: "apple" | "google";
  productId: string;
  storeKey: string; // Apple originalTransactionId / Google purchaseToken
  status: "active" | "grace" | "on_hold" | "expired" | "revoked";
  expiresAt: string; // ISO
  autoRenewing: boolean;
  raw?: unknown;
}

/** product_id'yi plan'a çevirir; tanımsız ürün hata döndürür (mağaza konfigürasyon hatasını erken yakala). */
export async function planForProduct(db: SupabaseClient, productId: string): Promise<string> {
  const { data, error } = await db
    .from("plan_products")
    .select("plan, active")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.active) throw new Error(`unknown_product:${productId}`);
  return data.plan as string;
}

/** Aboneliği store_key üzerinden idempotent biçimde yazar; aile yetkisinin tek kaynağıdır. */
export async function upsertSubscription(db: SupabaseClient, sub: SubscriptionUpsert): Promise<void> {
  const plan = await planForProduct(db, sub.productId);
  const { error } = await db.from("store_subscriptions").upsert(
    {
      family_id: sub.familyId,
      purchaser_user_id: sub.purchaserUserId,
      platform: sub.platform,
      product_id: sub.productId,
      plan,
      store_key: sub.storeKey,
      status: sub.status,
      expires_at: sub.expiresAt,
      auto_renewing: sub.autoRenewing,
      raw: sub.raw ?? null,
    },
    { onConflict: "store_key" },
  );
  if (error) throw error;
}

/** Bildirimi günlüğe yazar; aynı event_key ikinci kez gelirse false döner (idempotency). */
export async function logNotification(
  db: SupabaseClient,
  platform: "apple" | "google",
  eventKey: string,
  eventType: string | null,
  payload: unknown,
): Promise<boolean> {
  const { error } = await db.from("store_notifications").insert({
    platform,
    event_key: eventKey,
    event_type: eventType,
    payload,
  });
  if (error) {
    if (error.code === "23505") return false; // zaten işlendi
    throw error;
  }
  return true;
}

export async function markProcessed(db: SupabaseClient, eventKey: string, err?: string): Promise<void> {
  await db
    .from("store_notifications")
    .update({ processed_at: new Date().toISOString(), error: err ?? null })
    .eq("event_key", eventKey);
}
