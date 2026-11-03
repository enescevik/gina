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
