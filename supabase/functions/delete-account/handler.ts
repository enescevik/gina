import { cleanupSources } from "../_shared/source-cleanup.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { type AppleDeps, appleConfig, appleIdentity, encryptToken, exchangeCode, revocable } from "../_shared/apple-signin.ts";
import { attemptRevocation, type JobStatus, type RevocationJob, userFacing } from "../_shared/apple-revocation.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
/** getUser(token) verifies the JWT. Token issue time is NOT fresh authentication; a recent amr entry is. */
function freshAmr(token: string, userId: string, method: string) {
  let claims;
  try { claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return false; }
  const now = Math.floor(Date.now() / 1000);
  return claims?.sub === userId && Array.isArray(claims.amr) && claims.amr.some((a: { method?: string; timestamp?: number }) =>
    a.method === method && typeof a.timestamp === "number" && a.timestamp <= now && now - a.timestamp <= 300);
}

/**
 * No caller-supplied user ID. Only the authenticated, non-anonymous account may be deleted.
 * H01: an account with an Apple identity gets a durable Apple token revocation job BEFORE the auth user is deleted.
 * Revocation is attempted inline; an Apple outage leaves the job pending for the worker (deletion is not blocked)
 * and the answer says so honestly (`apple_revocation`: succeeded | pending | manual_required).
 */
export async function deleteAccount(req: Request, dependencies?: { db: SupabaseClient; reauth: SupabaseClient; apple?: AppleDeps }): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let auth: SupabaseClient | undefined;
  const fail = async (body: Record<string, string>, status: number) => {
    try { await auth?.auth.signOut({ scope: "local" }); } catch { /* the re-auth session expires on its own */ }
    return json(body, status);
  };
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) return json({ error: "forbidden" }, 403);
    const db = dependencies?.db ?? serviceClient();
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user?.email || user.is_anonymous) return json({ error: "forbidden" }, 403);
    const raw = await req.text();
    if (raw.length > 16384) return json({ error: "invalid_input" }, 400);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: "invalid_input" }, 400); }
    if (input?.confirm !== true) return json({ error: "invalid_input" }, 400);
    const apple = appleIdentity(user);
    const appleDeps = dependencies?.apple;
    const reauthClient = () => dependencies?.reauth ?? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let appleReauth = false, appleUnavailable = false;
    let fresh: { clientId: string; type: "refresh_token" | "access_token"; ciphertext: string } | null = null;
    if (input.reauthentication === "apple") {
      // iOS: a fresh native Apple sign-in. Supabase Auth verifies the identity token exactly like at sign-in
      // (Apple signature, audience, nonce); the single-use authorization code yields a token to revoke now.
      if (!apple) return json({ error: "reauthentication_failed" }, 403);
      if (!str(input.apple_identity_token, 8192) || !str(input.apple_nonce, 256) ||
        (input.apple_authorization_code !== undefined && !str(input.apple_authorization_code, 2048))) return json({ error: "invalid_input" }, 400);
      auth = reauthClient();
      const verified = await auth.auth.signInWithIdToken({ provider: "apple", token: input.apple_identity_token, nonce: input.apple_nonce });
      if (verified.error || verified.data.user?.id !== user.id) return fail({ error: "reauthentication_failed" }, 403);
      appleReauth = true;
      if (input.apple_authorization_code) {
        const config = appleDeps && "config" in appleDeps ? appleDeps.config ?? null : appleConfig();
        const exchanged = await exchangeCode(input.apple_authorization_code, apple.sub, appleDeps);
        const usable = exchanged.ok ? revocable(exchanged) : null;
        if (usable && config) fresh = { clientId: config.bundleId, type: usable.type, ciphertext: await encryptToken(config.encryptionKey, usable.token, apple.sub) };
        else if (!exchanged.ok && exchanged.transient && exchanged.error !== "not_configured") appleUnavailable = true;
      }
    } else if (input.reauthentication === "apple_oauth") {
      // Web/Android: a fresh Supabase Apple OAuth sign-in (amr "oauth" within 5 min). Its provider refresh token
      // was stored through `apple-token` right after that sign-in.
      if (!apple || !freshAmr(token, user.id, "oauth")) return json({ error: "reauthentication_failed" }, 403);
      appleReauth = true;
    } else if (input.reauthentication === "email_otp") {
      if (!freshAmr(token, user.id, "otp")) return json({ error: "reauthentication_failed" }, 403);
    } else {
      if (typeof input.password !== "string" || !input.password || input.password.length > 1024) return json({ error: "invalid_input" }, 400);
      auth = reauthClient();
      const verified = await auth.auth.signInWithPassword({ email: user.email, password: input.password });
      if (verified.error || verified.data.user?.id !== user.id) return json({ error: "reauthentication_failed" }, 403);
    }
    // Optional L03 impact preview: a preview whose target changed, expired or was used never deletes.
    if (input.preview_token !== undefined) {
      if (typeof input.preview_token !== "string" || !UUID.test(input.preview_token)) return fail({ error: "invalid_input" }, 400);
      const check = await db.rpc("check_deletion_preview", { p_token: input.preview_token, p_user_id: user.id });
      const status = check.error ? "unavailable" : (check.data as { status?: string } | null)?.status;
      if (status !== "ok") {
        if (status === "unavailable") return fail({ error: "deletion_failed" }, 500);
        return fail({ error: `deletion_preview_${status ?? "not_found"}` }, 409);
      }
    }
    let appleJob: { id: string; status: JobStatus } | null = null;
    if (apple) {
      if (input.request_id !== undefined && (typeof input.request_id !== "string" || !UUID.test(input.request_id))) return fail({ error: "invalid_input" }, 400);
      // The job is written before the auth user is deleted: no job, no deletion.
      const begin = await db.rpc("apple_revocation_begin", {
        p_request_id: input.request_id ?? crypto.randomUUID(), p_user_id: user.id, p_apple_sub: apple.sub,
        p_client_id: fresh?.clientId ?? null, p_token_type: fresh?.type ?? null, p_token_ciphertext: fresh?.ciphertext ?? null,
        p_allow_without_token: appleReauth && !appleUnavailable,
      });
      const job = begin.data as (RevocationJob & { status: JobStatus | "token_required" | "request_conflict" }) | null;
      if (begin.error || !job?.status) return fail({ error: "deletion_failed" }, 500);
      if (job.status === "request_conflict") return fail({ error: "invalid_input" }, 400);
      if (job.status === "token_required") {
        // No stored token and no proof of a fresh Apple sign-in: ask for one (or Apple is down right now).
        return appleUnavailable ? fail({ error: "apple_unavailable" }, 503) : fail({ error: "apple_reauthentication_required" }, 409);
      }
      appleJob = { id: job.job_id, status: job.status === "pending" ? await attemptRevocation(db, job, appleDeps) : job.status };
    }
    // The auth.users trigger transfers shared ownership or cascades the last parent's family, atomically.
    const { error } = await db.auth.admin.deleteUser(user.id, false);
    if (error) return fail({ error: "deletion_failed" }, 500);
    if (appleJob) { try { await db.rpc("apple_revocation_mark_deleted", { p_job_id: appleJob.id }); } catch { /* evidence only */ } }
    try { await cleanupSources(db); } catch { /* Durable queue is retried by the scheduled worker. */ }
    return json(appleJob ? { ok: true, apple_revocation: userFacing(appleJob.status) } : { ok: true });
  } catch { return fail({ error: "deletion_failed" }, 500); }
}
