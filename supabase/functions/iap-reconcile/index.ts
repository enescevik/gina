// Abonelik uzlaştırması: bitişi yaklaşan / askıdaki abonelikleri mağazadan yeniden sorgular.
// Bildirim (ASSN V2 / RTDN) kaçsa bile yetki doğru kalır. pg_cron 6 saatte bir çağırır
// (20261030100000_iap.sql; Vault: project_url + iap_cron_secret).
// Deploy: `supabase functions deploy iap-reconcile --no-verify-jwt` (x-cron-secret başlığıyla korunur).
//
// İstek: POST, başlık `x-cron-secret: <IAP_CRON_SECRET>`; gövde isteğe bağlı { "limit": 200 }.
// Yanıt 200: { ok: true, checked, updated, skipped, failed: [{ store_key_hint, error }] }
//        401 unauthorized · 503 store_not_configured (ne Apple API anahtarı ne Google service account var)

import { json, serviceClient } from "../_shared/supabase.ts";
import {
  appleApiConfigured,
  applyStoreState,
  fetchAppleState,
  googleApiConfigured,
  IapError,
  refreshGoogle,
} from "../_shared/iap.ts";

interface Candidate {
  id: string;
  platform: "apple" | "google";
  store_key: string;
  expires_at: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("IAP_CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || !timingSafeEqual(given, secret)) return json({ error: "unauthorized" }, 401);

  const apple = appleApiConfigured();
  const google = googleApiConfigured();
  if (!apple && !google) return json({ error: "store_not_configured" }, 503);

  let limit = 200;
  try {
    const body = await req.json();
    if (Number.isInteger(body?.limit) && body.limit > 0) limit = Math.min(body.limit, 1000);
  } catch {
    // gövde yok: varsayılan
  }

  const db = serviceClient();
  const { data, error } = await db.rpc("iap_reconcile_candidates", { p_limit: limit });
  if (error) return json({ error: "candidates_failed" }, 500);

  let updated = 0;
  let skipped = 0;
  const failed: { store_key_hint: string; error: string }[] = [];

  for (const c of (data ?? []) as Candidate[]) {
    try {
      const state =
        c.platform === "apple"
          ? apple
            ? await fetchAppleState(c.store_key)
            : undefined
          : google
            ? await refreshGoogle(db, c.store_key)
            : undefined;
      if (state === undefined || state === null) {
        // Mağaza yapılandırılmamış ya da bekleyen ödeme / Apple'da kayıt yok: dokunma.
        skipped++;
        continue;
      }
      await applyStoreState(db, state);
      updated++;
    } catch (e) {
      // Token'ın tamamı günlüğe yazılmaz.
      failed.push({ store_key_hint: c.store_key.slice(0, 8), error: e instanceof IapError ? e.code : String(e) });
    }
  }

  return json({ ok: true, checked: data?.length ?? 0, updated, skipped, failed });
});
