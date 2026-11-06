import type { AiConfig } from "../_shared/prova.ts";
import { PREREVIEW_PROMPT_VERSION, RUBRIC_PASS } from "../_shared/prereview.ts";
import { json } from "../_shared/supabase.ts";
import { type Caller, createHandler, type Dependencies } from "./handler.ts";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw Error(message);
}
const ID = "6d4399b9-46b1-47ba-bc6b-5558f48c4c7b";
const config: AiConfig = { model: "synthetic-model", maxOutputTokens: 1500, promptVersion: "v1" };
const cleanOutput = {
  confidence: 0.95,
  recommendation: "approve",
  rubric: { ...RUBRIC_PASS },
  findings: [],
  summary: "Sentetik: çözüm doğru, kazanımla uyumlu.",
};

/** In-memory stand-in for content_prereview_claim/finish/next with the same lease and cache rules. */
function fixture() {
  const state = {
    caller: { kind: "admin", userId: "admin" } as Caller | null,
    rows: new Map<string, { status: string; hash: string; prompt: string; verdict: unknown; attempts: number; lease: string | null; error: string | null }>(),
    content: { kind: "curriculum_candidate", id: ID, candidate: { label: "Senaryo 1" } } as Record<string, unknown>,
    hash: "a".repeat(64),
    enabled: true,
    providerOutput: cleanOutput as unknown,
    providerError: null as string | null,
    providerCalls: 0 as number,
    providerPrompts: [] as string[],
    configResponse: null as Response | null,
    keyResponse: null as Response | null,
    rpcLog: [] as string[],
    pending: [] as { kind: string; id: string }[],
    mediaCount: 0,
    obsolete: null as string | null,
    paused: false,
    health: [] as { provider: string; ok: boolean | null; error: string | null; uncertain: boolean }[],
    keyConfigs: [] as AiConfig[],
  };
  const key = (kind: string, id: string) => `${kind}:${id}`;
  const deps: Dependencies = {
    caller: async () => state.caller,
    key: (cfg) => {
      state.keyConfigs.push(cfg);
      return state.keyResponse ?? "synthetic-key";
    },
    resolve: async () => state.configResponse ?? config,
    call: async (_k, _c, _system, user) => {
      state.providerCalls++;
      state.providerPrompts.push(String(user));
      if (state.providerError) throw Error(state.providerError);
      return { output: state.providerOutput, inputTokens: 120, outputTokens: 60 };
    },
    service: {
      rpc: async (name, args) => {
        state.rpcLog.push(name);
        if (name === "content_prereview_next") return { data: state.pending, error: null };
        if (name === "content_prereview_provider") {
          state.health.push({ provider: String(args.p_provider), ok: args.p_ok as boolean | null, error: (args.p_error as string | null) ?? null, uncertain: args.p_uncertain === true });
          return { data: { provider: args.p_provider, paused: state.paused }, error: null };
        }
        const k = key(String(args.p_kind), String(args.p_id));
        if (name === "content_prereview_claim") {
          if (!state.enabled) return { data: { error: "prereview_disabled" }, error: null };
          const row = state.rows.get(k);
          const prompt = String(args.p_prompt_version);
          if (row && row.hash === state.hash && row.prompt === prompt && row.status !== "pending") {
            return { data: { cached: true, prereview_status: row.status, prereview_verdict: row.verdict }, error: null };
          }
          if (row && row.lease) return { data: { error: "in_progress" }, error: null };
          if (row && (row.hash !== state.hash || row.prompt !== prompt)) {
            row.attempts = 0;
            row.verdict = null;
            row.status = "pending";
          }
          if (state.obsolete) {
            const r = row ?? { status: "pending", hash: state.hash, prompt, verdict: null, attempts: 0, lease: null, error: null };
            Object.assign(r, { status: "needs_admin", verdict: { decision_reason: state.obsolete }, error: state.obsolete, lease: null });
            state.rows.set(k, r);
            return { data: { error: "source_obsolete", reason: state.obsolete, prereview_status: "needs_admin" }, error: null };
          }
          if (row && row.attempts >= 3) {
            row.status = "needs_admin";
            row.verdict = { decision_reason: "retry_limit" };
            return { data: { error: "retry_limit", prereview_status: "needs_admin" }, error: null };
          }
          const next = row ?? { status: "pending", hash: state.hash, prompt, verdict: null, attempts: 0, lease: null, error: null };
          next.hash = state.hash;
          next.prompt = prompt;
          next.attempts++;
          next.lease = String(args.p_lease);
          state.rows.set(k, next);
          return { data: { claimed: true, content: state.content, content_hash: state.hash, prompt_version: prompt, attempts: next.attempts, media_count: state.mediaCount }, error: null };
        }
        if (name === "content_prereview_finish") {
          const row = state.rows.get(k);
          if (!row || row.lease !== args.p_lease || row.status !== "pending") return { data: null, error: { message: "lease_lost" } };
          row.status = String(args.p_status);
          row.lease = null;
          row.error = (args.p_error as string | null) ?? null;
          // Same refund as the database: a paused provider was never called.
          if (row.status === "pending" && row.error === "ai_temporarily_unavailable") row.attempts = Math.max(row.attempts - 1, 0);
          if (row.status !== "pending") row.verdict = args.p_verdict;
          return { data: { prereview_status: row.status, attempts: row.attempts }, error: null };
        }
        return { data: null, error: { message: "unknown_rpc" } };
      },
    },
  };
  return { state, deps, handler: createHandler(deps), row: () => state.rows.get(key("curriculum_candidate", ID)) };
}
const calls = (f: { state: { providerCalls: number } }): number => f.state.providerCalls;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://edge.local/content-prereview", { method: "POST", headers, body: JSON.stringify(body) });

Deno.test("forbidden caller and malformed input never reach the queue or the provider", async () => {
  const f = fixture();
  f.state.caller = null;
  const denied = await f.handler(post({ kind: "curriculum_candidate", id: ID }));
  assert(denied.status === 403);
  f.state.caller = { kind: "admin", userId: "admin" };
  assert((await f.handler(post({ kind: "exam", id: ID }))).status === 400, "unknown kind");
  assert((await f.handler(post({ kind: "curriculum_candidate", id: "not-a-uuid" }))).status === 400, "bad id");
  assert((await f.handler(new Request("https://edge.local/x", { method: "POST", body: "{" }))).status === 400, "bad json");
  assert((await f.handler(new Request("https://edge.local/x", { method: "GET" }))).status === 405);
  assert((await f.handler(post({ drain: true }))).status === 403, "admin cannot drain the system queue");
  assert(f.state.rpcLog.length === 0 && calls(f) === 0);
});

Deno.test("clean output above threshold -> ai_approved, replay is served from the record", async () => {
  const f = fixture();
  const res = await f.handler(post({ kind: "curriculum_candidate", id: ID }));
  const body = await res.json();
  assert(res.status === 200 && body.ok === true && body.prereview_status === "ai_approved" && body.outcome === "reviewed", JSON.stringify(body));
  assert(calls(f) === 1);
  assert(f.state.providerPrompts[0].includes("Senaryo 1"), "normalized content is in the prompt");
  const row = f.row();
  assert(row?.status === "ai_approved" && row.lease === null);
  const verdict = row.verdict as Record<string, unknown>;
  assert(verdict.model === "synthetic-model" && verdict.prompt_version === PREREVIEW_PROMPT_VERSION && verdict.confidence === 0.95 && verdict.decision_reason === "all_checks_passed");
  const replay = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(replay.outcome === "cached" && replay.prereview_status === "ai_approved");
  assert(calls(f) === 1, "idempotent: same content + prompt version does not call the provider again");
});

Deno.test("content change and prompt version change each trigger exactly one new provider call", async () => {
  const f = fixture();
  await f.handler(post({ kind: "curriculum_candidate", id: ID }));
  f.state.hash = "b".repeat(64);
  const changed = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(changed.outcome === "reviewed" && calls(f) === 2, "changed content reviewed again");
  f.deps.promptVersion = "prereview-v3";
  const bumped = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(bumped.outcome === "reviewed" && calls(f) === 3, "new prompt version reviewed again");
  assert((f.row()?.verdict as Record<string, unknown>).prompt_version === "prereview-v3");
  await f.handler(post({ kind: "curriculum_candidate", id: ID }));
  assert(calls(f) === 3, "then cached again");
});

Deno.test("low confidence or blocking finding -> needs_admin; explicit reject -> suggestion only", async () => {
  const f = fixture();
  f.state.providerOutput = { ...cleanOutput, confidence: 0.6 };
  let body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.prereview_status === "needs_admin" && body.reason === "low_confidence", JSON.stringify(body));
  f.state.hash = "c".repeat(64);
  f.state.providerOutput = { ...cleanOutput, findings: [{ code: "rubric_incomplete", severity: "blocking", detail: "Kısmi puan ölçütü yok", item: "q1" }] };
  body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.prereview_status === "needs_admin" && body.reason === "blocking_finding");
  f.state.hash = "d".repeat(64);
  f.state.providerOutput = { ...cleanOutput, recommendation: "reject", rubric: { ...RUBRIC_PASS, leaked_exam_suspicion: "yes" }, findings: [{ code: "leaked_exam", severity: "blocking", detail: "Okul yazılısı", item: null }] };
  body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.prereview_status === "ai_rejected_suggestion", "reject stays a suggestion for the admin");
});

Deno.test("kill switch, inactive model and missing key -> needs_admin with the reason, no provider call", async () => {
  for (const [label, patch] of [
    ["ai_disabled", (f: ReturnType<typeof fixture>) => f.state.configResponse = json({ error: "ai_disabled" }, 503)],
    ["ai_model_unavailable", (f: ReturnType<typeof fixture>) => f.state.configResponse = json({ error: "ai_model_unavailable" }, 503)],
    ["ai_not_configured", (f: ReturnType<typeof fixture>) => f.state.keyResponse = json({ error: "ai_not_configured" }, 503)],
  ] as const) {
    const f = fixture();
    patch(f);
    const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
    assert(body.prereview_status === "needs_admin" && body.reason === label, `${label}: ${JSON.stringify(body)}`);
    assert(calls(f) === 0, `${label}: provider not called`);
    const verdict = f.row()?.verdict as Record<string, unknown>;
    assert(verdict.decision_reason === label && f.row()?.error === label, `${label}: reason recorded`);
  }
  const f = fixture();
  f.state.enabled = false;
  const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.outcome === "error" && body.reason === "prereview_disabled" && calls(f) === 0, "feature gate closed");
});

Deno.test("429/5xx/timeout/malformed output keep the attempt counted; third failure routes to the admin", async () => {
  const f = fixture();
  f.state.providerError = "anthropic_429";
  let body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.outcome === "retry_pending" && body.reason === "anthropic_429" && f.row()?.attempts === 1 && f.row()?.status === "pending", JSON.stringify(body));
  f.state.providerError = "anthropic_529";
  body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.outcome === "retry_pending" && f.row()?.attempts === 2);
  f.state.providerError = null;
  f.state.providerOutput = { broken: true };
  body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.outcome === "needs_admin" && body.reason === "retry_limit" && f.row()?.status === "needs_admin", JSON.stringify(body));
  assert((f.row()?.verdict as Record<string, unknown>).decision_reason === "retry_limit" && f.row()?.error === "ai_result_invalid");
  assert(calls(f) === 3);
  body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.outcome === "cached" && calls(f) === 3, "exhausted record is not retried automatically");
});

Deno.test("timeout-like unknown errors are not misreported as a verdict", async () => {
  const f = fixture();
  f.state.providerError = "TimeoutError: signal timed out";
  const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.outcome === "retry_pending" && body.reason === "provider_outcome_unknown" && f.row()?.status === "pending");
});

Deno.test("system drain processes the pending queue once and skips malformed items", async () => {
  const f = fixture();
  f.state.caller = { kind: "system" };
  f.state.pending = [{ kind: "curriculum_candidate", id: ID }, { kind: "bogus", id: ID }, { kind: "library_package", id: "nope" }];
  const res = await f.handler(post({ drain: true, limit: 10 }, { "x-cron-secret": "x" }));
  const body = await res.json();
  assert(res.status === 200 && body.processed === 1 && body.results[0].prereview_status === "ai_approved", JSON.stringify(body));
  assert(calls(f) === 1);
  assert(f.state.rpcLog[0] === "content_prereview_next");
});

// ---- C09: C08 routing, breaker, media flag, obsolete source, non-retryable failures, pilot -------------------

Deno.test("C09 deterministic provider: correct / incorrect / ambiguous records", async () => {
  for (const [label, output, expected] of [
    ["correct", cleanOutput, "ai_approved"],
    ["incorrect", { ...cleanOutput, confidence: 0.9, recommendation: "reject", rubric: { ...RUBRIC_PASS, solution_correct: "no" }, findings: [{ code: "answer_key_mismatch", severity: "blocking", detail: "Anahtar A, doğru cevap 1.", item: "q1" }] }, "ai_rejected_suggestion"],
    ["ambiguous", { ...cleanOutput, confidence: 0.62, recommendation: "admin_review", rubric: { ...RUBRIC_PASS, solution_correct: "unsure" } }, "needs_admin"],
  ] as const) {
    const f = fixture();
    f.state.providerOutput = output;
    const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
    assert(body.prereview_status === expected, `${label}: ${JSON.stringify(body)}`);
    assert(calls(f) === 1, `${label}: exactly one provider call`);
    const verdict = f.row()?.verdict as Record<string, unknown>;
    assert(verdict.provider === "anthropic" && verdict.advisory === true, `${label}: provider and advisory flag recorded`);
  }
});

Deno.test("C09 key is resolved from the routed config (C08 generateWith), success resets the provider breaker", async () => {
  const f = fixture();
  const routed: AiConfig = { ...config, provider: "openai_compatible", adapter: "openai-chat" };
  f.deps.resolve = () => Promise.resolve(routed);
  const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.prereview_status === "ai_approved", JSON.stringify(body));
  assert(f.state.keyConfigs[0]?.adapter === "openai-chat", "key lookup receives the resolved adapter");
  assert(f.state.health.some((h) => h.provider === "openai_compatible" && h.ok === null), "breaker checked for the routed provider before the call");
  assert(f.state.health.some((h) => h.provider === "openai_compatible" && h.ok === true), "success recorded for the routed provider");
  assert((f.row()?.verdict as Record<string, unknown>).provider === "openai_compatible");
});

Deno.test("C09 images are never reviewed: explicit media flag, no ai_approved, prompt says images were not shown", async () => {
  const f = fixture();
  f.state.mediaCount = 2;
  const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.prereview_status === "needs_admin" && body.reason === "media_not_reviewed", JSON.stringify(body));
  const verdict = f.row()?.verdict as { media: { count: number; reviewed: boolean; image_dependent_correctness: string } };
  assert(verdict.media.count === 2 && verdict.media.reviewed === false && verdict.media.image_dependent_correctness === "not_proven");
  assert(f.state.providerPrompts[0].includes("GÖSTERİLMEDİ"), "the model is told that images were not shown");
  const plain = fixture();
  await plain.handler(post({ kind: "curriculum_candidate", id: ID }));
  assert((plain.row()?.verdict as { media: { image_dependent_correctness: string } }).media.image_dependent_correctness === "not_applicable");
});

Deno.test("C09 paused provider (breaker): no call, attempt refunded, drain stops", async () => {
  const f = fixture();
  f.state.paused = true;
  for (let i = 0; i < 5; i++) {
    const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
    assert(body.outcome === "retry_pending" && body.reason === "ai_temporarily_unavailable", JSON.stringify(body));
  }
  assert(calls(f) === 0 && f.row()?.attempts === 0 && f.row()?.status === "pending", "no paid call and no attempt spent while paused");
  f.state.caller = { kind: "system" };
  f.state.pending = [{ kind: "curriculum_candidate", id: ID }, { kind: "library_package", id: "11111111-1111-4111-8111-111111111111" }];
  const drained = await (await f.handler(post({ drain: true }, { "x-cron-secret": "x" }))).json();
  assert(drained.processed === 1, "drain stops at the first paused result");
  f.state.paused = false;
  f.state.caller = { kind: "admin", userId: "admin" };
  const after = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(after.prereview_status === "ai_approved" && calls(f) === 1, "resumes when the breaker closes");
});

Deno.test("C09 non-retryable provider failures go to the admin after one call; retryable ones record the breaker", async () => {
  for (const [code, reason] of [["anthropic_401", "provider_auth"], ["anthropic_400", "provider_rejected"], ["ai_input_too_large", "provider_input_too_large"], ["provider_unconfigured", "provider_unconfigured"]] as const) {
    const f = fixture();
    f.state.providerError = code;
    const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
    assert(body.prereview_status === "needs_admin" && body.reason === reason, `${code}: ${JSON.stringify(body)}`);
    assert(calls(f) === 1 && f.row()?.error === code, `${code}: one call, code recorded`);
    const again = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
    assert(again.outcome === "cached" && calls(f) === 1, `${code}: no automatic second paid call`);
  }
  const f = fixture();
  f.state.providerError = "anthropic_529";
  await f.handler(post({ kind: "curriculum_candidate", id: ID }));
  assert(f.state.health.some((h) => h.ok === false && h.error === "anthropic_529" && h.uncertain === true), "5xx is reported to the C08 breaker as uncertain");
});

Deno.test("C09 retry bound: at most three paid calls for one content + prompt version, then admin", async () => {
  const f = fixture();
  f.state.providerError = "anthropic_503";
  for (let i = 0; i < 6; i++) await f.handler(post({ kind: "curriculum_candidate", id: ID }));
  assert(calls(f) === 3, `three calls, got ${calls(f)}`);
  assert(f.row()?.status === "needs_admin" && (f.row()?.verdict as Record<string, unknown>).decision_reason === "retry_limit");
});

Deno.test("C09 obsolete scenario source: no provider call, needs_admin with the source reason", async () => {
  const f = fixture();
  f.state.obsolete = "source_superseded";
  const body = await (await f.handler(post({ kind: "curriculum_candidate", id: ID }))).json();
  assert(body.prereview_status === "needs_admin" && body.reason === "source_superseded" && calls(f) === 0, JSON.stringify(body));
});

Deno.test("C09 kill switch with the prereview gate closed: drain claims nothing, no call", async () => {
  const f = fixture();
  f.state.enabled = false;
  f.state.caller = { kind: "system" };
  f.state.pending = [{ kind: "curriculum_candidate", id: ID }];
  const body = await (await f.handler(post({ drain: true }, { "x-cron-secret": "x" }))).json();
  assert(body.results[0].reason === "prereview_disabled" && calls(f) === 0);
});

Deno.test("C09 pilot: system only, explicit paid confirmation, no record writes, same threshold path", async () => {
  const f = fixture();
  const items = [
    { key: "ok", content: { kind: "library_package", title: "ok" }, media_count: 0 },
    { key: "img", content: { kind: "library_package", title: "img" }, media_count: 1 },
  ];
  assert((await f.handler(post({ pilot: true, confirm_paid: true, items }))).status === 403, "admin JWT cannot run the paid pilot");
  f.state.caller = { kind: "system" };
  assert((await f.handler(post({ pilot: true, items }))).status === 400, "confirmation required");
  assert((await f.handler(post({ pilot: true, confirm_paid: true, items: Array(13).fill(items[0]) }))).status === 400, "item cap");
  const res = await f.handler(post({ pilot: true, confirm_paid: true, items }));
  const body = await res.json();
  assert(res.status === 200 && body.results.length === 2, JSON.stringify(body));
  assert(body.results[0].status === "ai_approved" && body.results[1].status === "needs_admin" && body.results[1].reason === "media_not_reviewed");
  assert(calls(f) === 2 && !f.state.rpcLog.some((n) => n === "content_prereview_claim" || n === "content_prereview_finish"), "pilot never touches content records");
  f.state.configResponse = json({ error: "ai_disabled" }, 503);
  const off = await f.handler(post({ pilot: true, confirm_paid: true, items }));
  assert(off.status === 503 && (await off.json()).error === "ai_disabled" && calls(f) === 2, "global kill switch stops the pilot too");
});
