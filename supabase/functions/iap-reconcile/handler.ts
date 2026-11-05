// iap-reconcile işleyicisi (bağımlılıklar test için enjekte edilir; Deno.serve index.ts'te).
// Her aday bağımsız işlenir: birinin hatası diğerlerini durdurmaz; aynı turun tekrar çalışması
// sürüm kontrolü sayesinde hak değiştirmez (unchanged). Hata raporunda token/sağlayıcı gövdesi yok.
import { json } from "../_shared/supabase.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { IapError, type StoreState, applyStoreState } from "../_shared/iap.ts";

export interface Candidate {
  id: string;
  platform: "apple" | "google";
  store_key: string;
  expires_at: string;
}

export interface ReconcileDependencies {
  cronSecret: () => string | undefined;
  serviceClient: () => SupabaseClient;
  appleConfigured: () => boolean;
  googleConfigured: () => boolean;
  /** Apple: fetchAppleState; Google: refreshGoogle (acknowledge dâhil). */
  read: (db: SupabaseClient, platform: "apple" | "google", storeKey: string) => Promise<StoreState | null>;
  applyStoreState: typeof applyStoreState;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function iapReconcile(req: Request, deps: ReconcileDependencies): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = deps.cronSecret();
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || !timingSafeEqual(given, secret)) return json({ error: "unauthorized" }, 401);

  const apple = deps.appleConfigured();
  const google = deps.googleConfigured();
  if (!apple && !google) return json({ error: "store_not_configured" }, 503);

  let limit = 200;
  try {
    const body = await req.json();
    if (Number.isInteger(body?.limit) && body.limit > 0) limit = Math.min(body.limit, 1000);
  } catch {
    // gövde yok: varsayılan
  }

  const db = deps.serviceClient();
  const { data, error } = await db.rpc("iap_reconcile_candidates", { p_limit: limit });
  if (error) return json({ error: "candidates_failed" }, 500);

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;
  const failed: { store_key_hint: string; error: string }[] = [];

  for (const c of (data ?? []) as Candidate[]) {
    try {
      const configured = c.platform === "apple" ? apple : google;
      if (!configured) {
        skipped++;
        continue;
      }
      const state = await deps.read(db, c.platform, c.store_key);
      if (!state) {
        // Bekleyen ödeme / Apple'da kayıt yok: dokunma (mağazada yokluk iptal değildir).
        skipped++;
        continue;
      }
      state.source = "reconcile";
      const result = await deps.applyStoreState(db, state);
      if (result.skipped) unchanged++;
      else updated++;
    } catch (e) {
      // Token'ın tamamı ve sağlayıcı/ağ hata metni (URL içinde token olabilir) raporlanmaz.
      failed.push({ store_key_hint: c.store_key.slice(0, 8), error: e instanceof IapError ? e.code : "unexpected_error" });
    }
  }

  return json({ ok: true, checked: data?.length ?? 0, updated, unchanged, skipped, failed });
}
