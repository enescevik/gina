import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { type AppleDeps, appleConfig, decryptToken, revokeToken } from "./apple-signin.ts";

export type RevocationJob = { job_id: string; client_id: string | null; token_type: "refresh_token" | "access_token" | null; token_ciphertext: string | null; apple_sub: string | null };
export type JobStatus = "pending" | "succeeded" | "failed" | "token_unavailable";

/**
 * One revocation attempt for a pending job, recorded durably. Returns the job's status AFTER the attempt.
 * A failed record write is reported as "pending": the job stays pending in the database and the worker retries.
 */
export async function attemptRevocation(db: SupabaseClient, job: RevocationJob, deps?: AppleDeps): Promise<JobStatus> {
  const config = deps && "config" in deps ? deps.config ?? null : appleConfig();
  let outcome: "succeeded" | "retry" | "failed";
  let error: string | null = null;
  if (!job.client_id || !job.token_type || !job.token_ciphertext || !job.apple_sub) return "pending";
  if (!config) { outcome = "retry"; error = "not_configured"; }
  else {
    let token: string | null = null;
    try { token = await decryptToken(config.encryptionKey, job.token_ciphertext, job.apple_sub); } catch { /* wrong/rotated key */ }
    if (token === null) { outcome = "retry"; error = "decrypt_failed"; }
    else {
      const r = await revokeToken(job.client_id, token, job.token_type, { ...deps, config });
      if (r.ok) outcome = "succeeded";
      else { outcome = r.transient ? "retry" : "failed"; error = r.error; }
    }
  }
  const recorded = await db.rpc("apple_revocation_record", { p_job_id: job.job_id, p_outcome: outcome, p_error: error });
  if (recorded.error) return "pending";
  return (recorded.data as JobStatus) ?? "pending";
}

/** What the user is told: revoked, still being retried, or they must remove the app at appleid.apple.com. */
export function userFacing(status: JobStatus): "succeeded" | "pending" | "manual_required" {
  return status === "succeeded" ? "succeeded" : status === "pending" ? "pending" : "manual_required";
}
