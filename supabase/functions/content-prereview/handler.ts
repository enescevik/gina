// E01/C09 content pre-review Edge handler. Called by an admin or content operator (JWT, proven by the
// role-gated request_content_prereview RPC) or by the scheduler (x-cron-secret). The record is claimed with a
// lease, the normalized content goes to the RESOLVED provider (C08 generateWith), the output is validated
// against the contract and the verdict is stored. Kill switch / inactive model / missing key / paused
// provider / obsolete source -> no provider call. Retryable failures are bounded (3 attempts in the DB);
// non-retryable failures (auth, rejected, too large, refusal, unconfigured) go straight to the admin queue.
// Images are never sent: the verdict carries an explicit media flag and an image-bearing record is not approved.
import type { AiConfig, AiResult, AiUserContent } from "../_shared/prova.ts";
import { type AiFailure, classifyAiError } from "../_shared/ai-provider.ts";
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
  /** C08: the secret name comes from the resolved adapter (no Anthropic fallback for other providers). */
  key(config: AiConfig): string | Response;
  resolve(): Promise<AiConfig | Response>;
  /** C08: generateWith — the resolved adapter performs exactly one paid call. */
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

/** Failure kinds that a retry cannot fix: the record goes to the admin at once (no second paid call). */
const NON_RETRYABLE = new Set<AiFailure["kind"]>([
  "auth",
  "rejected",
  "input_too_large",
  "token_count_invalid",
  "unsupported",
  "unconfigured",
  "refusal",
]);
/** Retryable outcomes that happen before any provider call (paused breaker, breaker state unreadable). */
const NO_CALL_RETRY = new Set(["ai_temporarily_unavailable", "provider_health_unavailable"]);
/** Drain stops its run on these: further items would not be called either (kill switch, quota, paused provider). */
const STOP_DRAIN = new Set(["ai_temporarily_unavailable", "provider_health_unavailable", "daily_limit", "prereview_disabled"]);
export const PILOT_MAX_ITEMS = 12;
export const MAX_BODY_CHARS = 256 * 1024;

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
async function responseReason(res: Response): Promise<string> {
  try {
    const body = await res.clone().json();
    return typeof body?.error === "string" ? body.error : `http_${res.status}`;
  } catch {
    return `http_${res.status}`;
  }
}
const providerOf = (config: AiConfig) => config.provider ?? "anthropic";

/** C08 breaker: paused? (and optionally record an outcome). null = health unknown -> fail closed. */
async function providerHealth(
  deps: Dependencies,
  provider: string,
  outcome?: { ok: boolean; error?: string | null; uncertain?: boolean },
): Promise<{ paused: boolean } | null> {
  const res = await deps.service.rpc("content_prereview_provider", {
    p_provider: provider,
    p_ok: outcome ? outcome.ok : null,
    p_error: outcome?.error ?? null,
    p_uncertain: outcome?.uncertain ?? false,
  });
  if (res.error || !record(res.data)) return null;
  return { paused: res.data.paused === true };
}

type Prepared =
  | { ok: true; config: AiConfig; apiKey: string }
  | { ok: false; reason: string; retryable: boolean };

/** Resolve model, key and breaker. No provider call happens here. */
async function prepare(deps: Dependencies): Promise<Prepared> {
  const config = await deps.resolve();
  if (config instanceof Response) return { ok: false, reason: await responseReason(config), retryable: false };
  const apiKey = deps.key(config);
  if (apiKey instanceof Response) return { ok: false, reason: await responseReason(apiKey), retryable: false };
  if (config.chain) return { ok: true, config, apiKey };
  const health = await providerHealth(deps, providerOf(config));
  if (!health) return { ok: false, reason: "provider_health_unavailable", retryable: true };
  if (health.paused) return { ok: false, reason: "ai_temporarily_unavailable", retryable: true };
  return { ok: true, config, apiKey };
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
  // H07: daily paid-call quota reached. Nothing was claimed or charged; the record stays queued.
  if (c.error === "daily_limit") return { kind, id, prereview_status: "pending", outcome: "retry_pending", reason: "daily_limit" };
  if (c.error === "source_obsolete") {
    return { kind, id, prereview_status: "needs_admin", outcome: "needs_admin", reason: String(c.reason ?? "source_obsolete") };
  }
  if (typeof c.error === "string") return { kind, id, prereview_status: "unknown", outcome: "error", reason: c.error };
  if (c.claimed !== true || !record(c.content)) return { kind, id, prereview_status: "unknown", outcome: "error", reason: "claim_invalid" };
  const attempts = typeof c.attempts === "number" ? c.attempts : 0;
  const mediaCount = typeof c.media_count === "number" && c.media_count > 0 ? c.media_count : 0;

  const finish = async (status: string, verdict: unknown, error: string | null) => {
    const saved = await deps.service.rpc("content_prereview_finish", {
      p_kind: kind,
      p_id: id,
      p_lease: lease,
      p_status: status,
      p_verdict: verdict,
      p_error: error,
    });
    return !saved.error;
  };
  const toAdmin = async (reason: string, detail: string | null, meta: Parameters<typeof failureVerdict>[2] = {}): Promise<RecordResult> =>
    await finish("needs_admin", failureVerdict(reason, detail, { promptVersion, mediaCount, ...meta }), detail ?? reason)
      ? { kind, id, prereview_status: "needs_admin", outcome: "needs_admin", reason }
      : { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" };
  const retry = async (code: string): Promise<RecordResult> => {
    // Bounded: claim already counted this attempt; the third failure goes to the admin.
    // No provider call was made for these codes (the database refunds the attempt), so they never exhaust it.
    if (attempts >= 3 && !NO_CALL_RETRY.has(code)) return toAdmin("retry_limit", code);
    return await finish("pending", null, code)
      ? { kind, id, prereview_status: "pending", outcome: "retry_pending", reason: code }
      : { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" };
  };

  const prepared = await prepare(deps);
  if (!prepared.ok) return prepared.retryable ? retry(prepared.reason) : toAdmin(prepared.reason, null);
  const { config, apiKey } = prepared;
  const meta = { model: config.model, provider: providerOf(config) };

  let result: AiResult<unknown>;
  try {
    result = await deps.call(apiKey, { ...config, promptVersion, execution: { kind: "prereview", lease } }, SYSTEM, buildUserMessage(c.content, mediaCount), SCHEMA);
  } catch (e) {
    const failure = classifyAiError(e);
    if (!config.chain) await providerHealth(deps, meta.provider, { ok: false, error: failure.code, uncertain: failure.uncertain });
    if (NON_RETRYABLE.has(failure.kind) || config.chain && failure.uncertain) return toAdmin(`provider_${failure.kind}`, failure.code, meta);
    return retry(failure.code);
  }
  // The provider answered; a contract violation is ours to retry, not a provider outage.
  if (!config.chain) await providerHealth(deps, meta.provider, { ok: true });
  meta.model = result.model ?? meta.model;
  meta.provider = result.provider ?? meta.provider;
  try {
    const output = validateOutput(result.output);
    const decision = decide(output, undefined, { mediaCount });
    const verdict = buildVerdict(output, decision, {
      ...meta,
      promptVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      providerUsage: result.providerUsage,
      mediaCount,
    });
    if (!await finish(decision.status, verdict, null)) return { kind, id, prereview_status: "pending", outcome: "error", reason: "finish_failed" };
    return { kind, id, prereview_status: decision.status, outcome: "reviewed", reason: decision.reason };
  } catch {
    return retry("ai_result_invalid");
  }
}

/**
 * Pilot (C09): known correct / incorrect / ambiguous samples through the SAME prompt, schema, validation and
 * threshold, without touching any content record. System caller only, explicit `confirm_paid`, at most
 * PILOT_MAX_ITEMS items, one provider call per item, no retry. Honors ai.enabled / model / key / breaker.
 */
export async function runPilot(deps: Dependencies, items: unknown[]) {
  const promptVersion = deps.promptVersion ?? PREREVIEW_PROMPT_VERSION;
  const prepared = await prepare(deps);
  if (!prepared.ok) return { ok: false, error: prepared.reason, results: [] };
  const { config, apiKey } = prepared;
  const results: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!record(item) || typeof item.key !== "string" || !record(item.content)) {
      results.push({ key: record(item) ? item.key ?? null : null, error: "invalid_item" });
      continue;
    }
    const mediaCount = typeof item.media_count === "number" && item.media_count > 0 ? item.media_count : 0;
    try {
      const r = await deps.call(apiKey, { ...config, chain: undefined, promptVersion }, SYSTEM, buildUserMessage(item.content, mediaCount), SCHEMA);
      await providerHealth(deps, providerOf(config), { ok: true });
      try {
        const output = validateOutput(r.output);
        const decision = decide(output, undefined, { mediaCount });
        results.push({
          key: item.key,
          status: decision.status,
          reason: decision.reason,
          confidence: output.confidence,
          recommendation: output.recommendation,
          rubric: output.rubric,
          findings: output.findings.map((f) => ({ code: f.code, severity: f.severity })),
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
        });
      } catch {
        results.push({ key: item.key, error: "ai_result_invalid" });
      }
    } catch (e) {
      const failure = classifyAiError(e);
      await providerHealth(deps, providerOf(config), { ok: false, error: failure.code, uncertain: failure.uncertain });
      results.push({ key: item.key, error: failure.code });
      if (failure.kind === "auth" || failure.kind === "unconfigured" || failure.kind === "rate_limited") break;
    }
  }
  return { ok: true, model: config.model, provider: providerOf(config), prompt_version: promptVersion, results };
}

export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight();
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    let body: unknown;
    try {
      // C13-SCAN-5: bound the body before parsing; the anon key alone passes verify_jwt.
      const raw = await req.text();
      if (raw.length > MAX_BODY_CHARS) return json({ error: "invalid_input" }, 400);
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_input" }, 400);
    }
    if (!record(body)) return json({ error: "invalid_input" }, 400);
    const caller = await deps.caller(req, body);
    if (!caller) return json({ error: "forbidden" }, 403);

    if (body.pilot === true) {
      if (caller.kind !== "system") return json({ error: "forbidden" }, 403);
      if (body.confirm_paid !== true) return json({ error: "pilot_confirmation_required" }, 400);
      if (!Array.isArray(body.items) || !body.items.length || body.items.length > PILOT_MAX_ITEMS) return json({ error: "invalid_input" }, 400);
      const pilot = await runPilot(deps, body.items);
      return json(pilot, pilot.ok ? 200 : 503);
    }
    if (body.drain === true) {
      if (caller.kind !== "system") return json({ error: "forbidden" }, 403);
      const limit = typeof body.limit === "number" && Number.isInteger(body.limit) ? Math.min(Math.max(body.limit, 1), 25) : 5;
      const next = await deps.service.rpc("content_prereview_next", { p_limit: limit });
      if (next.error || !Array.isArray(next.data)) return json({ error: "queue_unavailable" }, 503);
      const results: RecordResult[] = [];
      for (const item of next.data) {
        if (!record(item) || !isUuid(item.id) || !(PREREVIEW_KINDS as readonly string[]).includes(String(item.kind))) continue;
        const r = await reviewOne(deps, item.kind as PrereviewKind, item.id);
        results.push(r);
        // Paused provider / kill switch / quota: stop this run; the next scheduled drain retries without spending attempts.
        if (r.reason && STOP_DRAIN.has(r.reason)) break;
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
