// E01 content pre-review Edge handler. Called by an admin (JWT, proven by the admin-only
// request_content_prereview RPC) or by the scheduler (x-cron-secret). The record is claimed with a
// lease, the normalized content goes to the provider, the output is validated against the contract
// and the verdict is stored. Kill switch / inactive model / retry limit -> needs_admin with a reason.
import type { AiConfig, AiResult, AiUserContent } from "../_shared/prova.ts";
import {
  buildUserMessage,
  buildVerdict,
  decide,
  failureVerdict,
  PREREVIEW_KINDS,
  PREREVIEW_PROMPT_VERSION,
  type PrereviewKind,
  SCHEMA,
  SYSTEM,
  validateOutput,
} from "../_shared/prereview.ts";
import { json, preflight } from "../_shared/supabase.ts";

export type Caller = { kind: "admin"; userId: string } | { kind: "system" };
export interface Rpc {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}
export interface Dependencies {
  /** null = forbidden. Admin path must already have called request_content_prereview as the user. */
  caller(req: Request, body: Record<string, unknown>): Promise<Caller | null>;
  service: Rpc;
  key(): string | Response;
  resolve(): Promise<AiConfig | Response>;
  call(apiKey: string, config: AiConfig, system: string, user: AiUserContent, schema: Record<string, unknown>): Promise<AiResult<unknown>>;
  promptVersion?: string;
}

export interface RecordResult {
  kind: string;
  id: string;
  prereview_status: string;
  outcome: "cached" | "reviewed" | "needs_admin" | "retry_pending" | "in_progress" | "error";
  reason?: string;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function errorCode(e: unknown): string {
  const message = e instanceof Error ? e.message : "generation_failed";
  return /^(anthropic_[a-z0-9_]+|ai_input_too_large|ai_token_count_invalid|ai_result_invalid)$/.test(message)
    ? message
    : "provider_outcome_unknown";
}
async function responseReason(res: Response): Promise<string> {
  try {
    const body = await res.clone().json();
    return typeof body?.error === "string" ? body.error : `http_${res.status}`;
  } catch {
    return `http_${res.status}`;
  }
}

export async function reviewOne(deps: Dependencies, kind: PrereviewKind, id: string): Promise<RecordResult> {
  const promptVersion = deps.promptVersion ?? PREREVIEW_PROMPT_VERSION;
  const lease = crypto.randomUUID();
  const claim = await deps.service.rpc("content_prereview_claim", {
    p_kind: kind,
    p_id: id,
    p_lease: lease,
    p_prompt_version: promptVersion,
  });
  if (claim.error || !record(claim.data)) return { kind, id, prereview_status: "unknown", outcome: "error", reason: "claim_failed" };
  const c = claim.data;
  if (c.cached === true) return { kind, id, prereview_status: String(c.prereview_status), outcome: "cached" };
  if (c.error === "in_progress") return { kind, id, prereview_status: "pending", outcome: "in_progress" };
  if (c.error === "retry_limit") return { kind, id, prereview_status: "needs_admin", outcome: "needs_admin", reason: "retry_limit" };
  if (typeof c.error === "string") return { kind, id, prereview_status: "unknown", outcome: "error", reason: c.error };
  if (c.claimed !== true || !record(c.content)) return { kind, id, prereview_status: "unknown", outcome: "error", reason: "claim_invalid" };

  const finish = (status: string, verdict: unknown, error: string | null) =>
    deps.service.rpc("content_prereview_finish", {
      p_kind: kind,
      p_id: id,
      p_lease: lease,
      p_status: status,
      p_verdict: verdict,
      p_error: error,
    });

  // Kill switch, inactive model or missing key: no provider call, straight to the admin with the reason.
  const config = await deps.resolve();
  if (config instanceof Response) {
    const reason = await responseReason(config);
    const saved = await finish("needs_admin", failureVerdict(reason, null), reason);
    return saved.error
      ? { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" }
      : { kind, id, prereview_status: "needs_admin", outcome: "needs_admin", reason };
  }
  const apiKey = deps.key();
  if (apiKey instanceof Response) {
    const reason = await responseReason(apiKey);
    const saved = await finish("needs_admin", failureVerdict(reason, null), reason);
    return saved.error
      ? { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" }
      : { kind, id, prereview_status: "needs_admin", outcome: "needs_admin", reason };
  }

  let result: AiResult<unknown>;
  try {
    result = await deps.call(apiKey, { ...config, promptVersion }, SYSTEM, buildUserMessage(c.content), SCHEMA);
    const output = validateOutput(result.output);
    const decision = decide(output);
    const verdict = buildVerdict(output, decision, {
      model: config.model,
      promptVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    const saved = await finish(decision.status, verdict, null);
    if (saved.error) return { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" };
    return { kind, id, prereview_status: decision.status, outcome: "reviewed", reason: decision.reason };
  } catch (e) {
    // 429/5xx/timeout/refusal/malformed output: keep pending, the attempt is counted; the
    // database turns the third failure into needs_admin on the next claim.
    const code = errorCode(e);
    const attempts = typeof c.attempts === "number" ? c.attempts : 0;
    if (attempts >= 3) {
      const saved = await finish("needs_admin", failureVerdict("retry_limit", code), code);
      return saved.error
        ? { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" }
        : { kind, id, prereview_status: "needs_admin", outcome: "needs_admin", reason: "retry_limit" };
    }
    const saved = await finish("pending", null, code);
    return saved.error
      ? { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" }
      : { kind, id, prereview_status: "pending", outcome: "retry_pending", reason: code };
  }
}

export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight();
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_input" }, 400);
    }
    if (!record(body)) return json({ error: "invalid_input" }, 400);
    const caller = await deps.caller(req, body);
    if (!caller) return json({ error: "forbidden" }, 403);

    if (body.drain === true) {
      if (caller.kind !== "system") return json({ error: "forbidden" }, 403);
      const limit = typeof body.limit === "number" && Number.isInteger(body.limit) ? Math.min(Math.max(body.limit, 1), 25) : 5;
      const next = await deps.service.rpc("content_prereview_next", { p_limit: limit });
      if (next.error || !Array.isArray(next.data)) return json({ error: "queue_unavailable" }, 503);
      const results: RecordResult[] = [];
      for (const item of next.data) {
        if (!record(item) || !isUuid(item.id) || !(PREREVIEW_KINDS as readonly string[]).includes(String(item.kind))) continue;
        results.push(await reviewOne(deps, item.kind as PrereviewKind, item.id));
      }
      return json({ ok: true, processed: results.length, results });
    }
    if (!(PREREVIEW_KINDS as readonly string[]).includes(String(body.kind)) || !isUuid(body.id)) {
      return json({ error: "invalid_input" }, 400);
    }
    const result = await reviewOne(deps, body.kind as PrereviewKind, body.id);
    return json({ ok: result.outcome !== "error", ...result }, result.outcome === "error" ? 503 : 200);
  };
}
