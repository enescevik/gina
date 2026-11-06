import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/supabase.ts";
import { fetchWithPolicy, PolicyError, type Resolver, sha256Hex, type Transport } from "../_shared/curriculum-source.ts";
import { type ExtractionResult, extractionResult, type QueueItem } from "../_shared/meb-extract.ts";

const BUCKET = "gina-curriculum-sources";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ExtractDeps {
  db: SupabaseClient;
  admin: { userId: string } | null;
  transport?: Transport;
  resolve?: Resolver;
  /** Stored original (private bucket); null when absent. */
  download?: (path: string) => Promise<Uint8Array | null>;
  extract?: (item: QueueItem, body: Uint8Array) => Promise<ExtractionResult>;
}

interface Claim {
  state: "claimed" | "in_progress" | "already_done" | "closed";
  revision_id: string;
  status: string;
  extraction_status: string;
  extraction: Record<string, unknown> | null;
  extraction_started_at: string | null;
  extraction_attempts: number;
  sha256?: string;
  storage_path?: string | null;
  resolved_url?: string;
  label?: string;
  school_year?: string;
  term?: number;
}

const dbError = (e: { code?: string; message?: string }) =>
  e.code === "42501" || e.message === "forbidden"
    ? json({ error: "forbidden" }, 403)
    : e.message === "curriculum_not_found"
    ? json({ error: "not_found" }, 404)
    : e.message === "curriculum_revision_conflict"
    ? json({ error: "revision_closed" }, 409)
    : e.message === "curriculum_extraction_conflict" || e.message === "curriculum_source_changed"
    ? json({ error: "extraction_conflict", reason: e.message }, 409)
    : e.message === "request_conflict"
    ? json({ error: "request_conflict" }, 409)
    : json({ error: "save_failed" }, 500);

/**
 * Admin-only, per revision: claim (lease) → bytes from the private bucket or, failing that, the official URL under the
 * same host/DNS/size policy → hash check → Deno extractor → idempotent review-only import. Nothing is approved,
 * published or school-selected; a transient failure releases the lease with a reason and is never a verdict.
 */
export async function handleCurriculumSourceExtract(req: Request, deps: ExtractDeps): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!deps.admin) return json({ error: "forbidden" }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 1024) return json({ error: "invalid_input" }, 400);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  if (!body || typeof body !== "object" || !UUID.test(String(body.request_id)) || !UUID.test(String(body.revision_id))) {
    return json({ error: "invalid_input" }, 400);
  }
  const actor = deps.admin.userId, revisionId = String(body.revision_id), requestId = String(body.request_id);
  const begun = await deps.db.rpc("begin_curriculum_extraction", { p_actor_id: actor, p_revision_id: revisionId });
  if (begun.error) return begun.error.message === "curriculum_not_found" || begun.error.code === "42501" || begun.error.message === "forbidden"
    ? dbError(begun.error)
    : json({ error: "data_failed" }, 503);
  const claim = begun.data as Claim;
  if (claim.state === "closed") return json({ error: "revision_closed", status: claim.status, extraction_status: claim.extraction_status }, 409);
  if (claim.state === "already_done") {
    return json({ outcome: "already_done", revision_id: claim.revision_id, extraction_status: "done", extraction: claim.extraction });
  }
  if (claim.state === "in_progress") {
    return json({ error: "extraction_in_progress", extraction_started_at: claim.extraction_started_at, extraction_attempts: claim.extraction_attempts }, 409);
  }
  const release = async (reason: string) => {
    const r = await deps.db.rpc("release_curriculum_extraction", { p_actor_id: actor, p_revision_id: revisionId, p_error: reason.slice(0, 300) });
    return r.error ? null : r.data;
  };

  // 1. Bytes. The stored original is preferred; it must still hash to the revision, otherwise the official URL is
  //    re-read with the full acquisition policy (HTTPS, allow-listed hosts, public IPs on every hop, 15 s, 5 MB).
  let bytes: Uint8Array | null = null, origin = "storage";
  if (claim.storage_path) {
    try {
      const stored = deps.download ? await deps.download(claim.storage_path) : await defaultDownload(deps.db, claim.storage_path);
      if (stored && (await sha256Hex(stored)) === claim.sha256) bytes = stored;
    } catch {
      bytes = null;
    }
  }
  if (!bytes) {
    origin = "official_url";
    try {
      bytes = (await fetchWithPolicy(claim.resolved_url!, { transport: deps.transport, resolve: deps.resolve })).body;
    } catch (e) {
      const reason = "source_unreachable:" + (e instanceof PolicyError ? e.message : "unavailable");
      const state = await release(reason);
      return json({ error: "source_unreachable", reason, revision: state }, 502);
    }
  }

  // 2. Extraction. A hash mismatch (the official file changed since the fetch) is a recorded `failed` verdict.
  let result: ExtractionResult;
  try {
    result = await (deps.extract ?? extractionResult)({
      sha256: claim.sha256!,
      label: claim.label!,
      resolved_url: claim.resolved_url!,
      school_year: claim.school_year!,
      term: Number(claim.term),
    }, bytes);
  } catch {
    const state = await release("extractor_error");
    return json({ error: "extractor_error", revision: state }, 500);
  }

  // 3. Idempotent review-only import (same bundle → unchanged; different output for the same bytes → conflict).
  const recorded = await deps.db.rpc("record_curriculum_extraction_service", {
    p_request_id: requestId,
    p_actor_id: actor,
    p_revision_id: revisionId,
    p_result: result,
  });
  if (recorded.error) {
    await release("record_failed:" + (recorded.error.message ?? "unknown"));
    return dbError(recorded.error);
  }
  return json({ ...(recorded.data as Record<string, unknown>), origin, scenarios: result.scenarios, issues: result.issues, error: result.error, extractor: result.extractor });
}

async function defaultDownload(db: SupabaseClient, path: string) {
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
