import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { type AppleDeps, appleConfig, appleIdentity, encryptToken, exchangeCode, revocable, validateRefreshToken } from "../_shared/apple-signin.ts";

/**
 * H01: keep a revocable Apple token for the signed-in account, server side only.
 *  - iOS native: { authorization_code } from expo-apple-authentication → exchanged for APPLE_BUNDLE_ID.
 *  - web/Android OAuth: { refresh_token } = Supabase session.provider_refresh_token (issued to APPLE_SERVICES_ID),
 *    validated with Apple before it is stored.
 * Apple's id_token subject must equal the account's Apple identity. The token is stored encrypted and never
 * returned. Failures never affect the sign-in itself (the client calls this best-effort).
 */
export async function storeAppleToken(req: Request, dependencies?: { db: SupabaseClient; apple?: AppleDeps }): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!jwt) return json({ error: "forbidden" }, 403);
    const db = dependencies?.db ?? serviceClient();
    const { data: { user }, error: authError } = await db.auth.getUser(jwt);
    if (authError || !user || user.is_anonymous) return json({ error: "forbidden" }, 403);
    const apple = appleIdentity(user);
    if (!apple) return json({ error: "not_apple_account" }, 409);
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: "invalid_input" }, 400);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: "invalid_input" }, 400); }
    const code = input?.authorization_code, refresh = input?.refresh_token;
    const valid = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 2048;
    if (valid(code) === valid(refresh)) return json({ error: "invalid_input" }, 400);
    const deps = dependencies?.apple;
    const config = deps && "config" in deps ? deps.config ?? null : appleConfig();
    if (!config) return json({ error: "apple_not_configured" }, 503);
    const result = valid(code) ? await exchangeCode(code, apple.sub, deps) : await validateRefreshToken(refresh, apple.sub, deps);
    if (!result.ok) {
      if (result.error === "identity_mismatch") return json({ error: "identity_mismatch" }, 403);
      return result.transient ? json({ error: "apple_unavailable" }, 503) : json({ error: "token_invalid" }, 400);
    }
    const usable = revocable(result);
    if (!usable) return json({ error: "token_invalid" }, 400);
    const stored = await db.rpc("apple_token_store", {
      p_user_id: user.id, p_apple_sub: apple.sub, p_client_id: valid(code) ? config.bundleId : config.servicesId,
      p_token_type: usable.type, p_token_ciphertext: await encryptToken(config.encryptionKey, usable.token, apple.sub),
    });
    if (stored.error) return json({ error: "store_failed" }, 500);
    return json({ ok: true });
  } catch { return json({ error: "store_failed" }, 500); }
}
