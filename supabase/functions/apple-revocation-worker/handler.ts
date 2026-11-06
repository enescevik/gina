import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json, serviceClient } from "../_shared/supabase.ts";
import type { AppleDeps } from "../_shared/apple-signin.ts";
import { attemptRevocation, type RevocationJob } from "../_shared/apple-revocation.ts";

function sameSecret(expected: string | undefined, supplied: string) {
  if (!expected || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

/** H01 retry worker (pg_cron, x-cron-secret: APPLE_REVOCATION_SECRET): due pending revocation jobs, leased. */
export async function runAppleRevocations(req: Request, dependencies?: { db: SupabaseClient; secret?: string; apple?: AppleDeps }): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = dependencies && "secret" in dependencies ? dependencies.secret : Deno.env.get("APPLE_REVOCATION_SECRET");
  if (!sameSecret(secret, req.headers.get("x-cron-secret") ?? "")) return json({ error: "forbidden" }, 403);
  try {
    const db = dependencies?.db ?? serviceClient();
    const claimed = await db.rpc("apple_revocation_claim", { p_limit: 20 });
    if (claimed.error) return json({ error: "apple_revocation_failed" }, 503);
    const counts = { processed: 0, succeeded: 0, pending: 0, failed: 0 };
    for (const job of (claimed.data ?? []) as RevocationJob[]) {
      const status = await attemptRevocation(db, job, dependencies?.apple);
      counts.processed++;
      if (status === "succeeded") counts.succeeded++; else if (status === "pending") counts.pending++; else counts.failed++;
    }
    return json({ ok: true, ...counts });
  } catch { return json({ error: "apple_revocation_failed" }, 503); }
}
