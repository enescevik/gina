// S06 adapter sözleşme testleri: sahte sunucu, gerçek sağlayıcı yok, ücretli çağrı yok.
import { isContractBody } from "./error-contract.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { adapterFor, adapterKey, classifyAiError, registeredAdapterIds } from "./ai-adapters.ts";
import { openAiAdapter, toOpenAiContent } from "./ai-adapter-openai.ts";
import { geminiAdapter, toGeminiSchema } from "./ai-adapter-gemini.ts";
import { runAiOperation } from "./ai-operation.ts";
import { type AiConfig, resolveAi } from "./prova.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const schema = { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false };
const base: AiConfig = { model: "synthetic-model", promptVersion: "test", maxInputTokens: 500, maxOutputTokens: 100 };
const parent = { familyId: "synthetic-family", userId: "synthetic-parent" };
function validate(value: unknown): { summary: string } {
  if (!value || typeof value !== "object" || typeof (value as { summary?: unknown }).summary !== "string") throw Error("ai_result_invalid");
  return { summary: (value as { summary: string }).summary };
}
async function withFetch(responses: (Response | Error)[], test: (requests: { url: string; init?: RequestInit }[]) => Promise<void>) {
  const original = globalThis.fetch, requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) return Promise.reject(Error("Unexpected provider call"));
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  };
  try {
    await test(requests);
  } finally {
    globalThis.fetch = original;
  }
}
async function failure(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "no_error";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
const timeoutError = () => {
  const e = new Error("signal timed out");
  e.name = "TimeoutError";
  return e;
};

Deno.test("all three adapters are registered; unknown adapter resolves to null", () => {
  assert(registeredAdapterIds().sort().join() === "anthropic-messages,gemini-generate,openai-chat", "registry");
  assert(adapterFor("mystery-adapter") === null && adapterFor(null) === null, "unknown adapter accepted");
});

Deno.test("error classification: 429 and 4xx are known, 5xx/timeout/network/bad output are uncertain", () => {
  const cases: [unknown, string, boolean, string][] = [
    [Error("anthropic_429"), "rate_limited", false, "generation_failed"],
    [Error("openai_429"), "rate_limited", false, "generation_failed"],
    [Error("gemini_401"), "auth", false, "generation_failed"],
    [Error("openai_400"), "rejected", false, "generation_failed"],
    [Error("anthropic_503"), "server", true, "ai_result_uncertain"],
    [Error("gemini_529"), "server", true, "ai_result_uncertain"],
    [Error("openai_refusal"), "refusal", true, "ai_result_uncertain"],
    [Error("anthropic_max_tokens"), "truncated", true, "ai_result_uncertain"],
    [Error("ai_result_invalid"), "invalid_output", true, "ai_result_uncertain"],
    [Error("ai_input_too_large"), "input_too_large", false, "ai_input_too_large"],
    [Error("ai_token_count_invalid"), "token_count_invalid", false, "generation_failed"],
    [Error("provider_unconfigured"), "unconfigured", false, "provider_unconfigured"],
    [Error("ai_model_unsupported"), "unsupported", false, "ai_model_unsupported"],
    [timeoutError(), "timeout", true, "ai_result_uncertain"],
    [new TypeError("fetch failed: private host"), "network", true, "ai_result_uncertain"],
    ["weird", "unknown", true, "ai_result_uncertain"],
  ];
  for (const [input, kind, uncertain, publicError] of cases) {
    const f = classifyAiError(input);
    assert(f.kind === kind && f.uncertain === uncertain && f.publicError === publicError, `wrong class for ${String(input)}: ${JSON.stringify(f)}`);
    assert(!f.code.includes("private"), "provider detail leaked into code");
  }
  assert(classifyAiError(new TypeError("fetch failed")).code === "provider_outcome_unknown", "network code");
});

Deno.test("unconfigured provider fails before any request and never reveals a key name value", async () => {
  const code = await failure(() => Promise.resolve(adapterKey(openAiAdapter, () => undefined)));
  assert(code === "provider_unconfigured", "missing secret accepted");
  assert(adapterKey(geminiAdapter, (n) => (n === "GEMINI_API_KEY" ? "synthetic" : undefined)) === "synthetic", "secret resolved by name");
  await withFetch([], async (requests) => {
    assert(await failure(() => openAiAdapter.generate("", base, "s", "u", schema)) === "provider_unconfigured", "openai empty key");
    assert(await failure(() => geminiAdapter.generate("", base, "s", "u", schema)) === "provider_unconfigured", "gemini empty key");
    assert(requests.length === 0, "unconfigured provider was called");
  });
});

Deno.test("openai adapter: 429, 5xx, timeout, truncation, refusal and malformed output map to contract codes with one request each", async () => {
  const cases: [Response | Error, string][] = [
    [json({ error: "private body" }, 429), "openai_429"],
    [json({ error: "private body" }, 503), "openai_503"],
    [timeoutError(), "signal timed out"],
    [json({ choices: [{ finish_reason: "length", message: { content: '{"summary":' } }] }), "openai_max_tokens"],
    [json({ choices: [{ finish_reason: "stop", message: { refusal: "no" } }] }), "openai_refusal"],
    [json({ choices: [{ finish_reason: "stop", message: { content: "not json" } }] }), "ai_result_invalid"],
    [json({ choices: [{ finish_reason: "stop", message: { content: "" } }] }), "ai_result_invalid"],
    [json({ choices: [] }), "ai_result_invalid"],
  ];
  for (const [reply, expected] of cases) {
    await withFetch([reply], async (requests) => {
      const code = await failure(() => openAiAdapter.generate("synthetic-key", base, "system", "input", schema));
      assert(code === expected, `expected ${expected}, got ${code}`);
      assert(requests.length === 1, "openai adapter retried");
      const auth = (requests[0].init?.headers as Record<string, string>).authorization;
      assert(auth === "Bearer synthetic-key" && !requests[0].url.includes("synthetic-key"), "key not in header only");
    });
  }
});

Deno.test("openai adapter: valid structured output parses once with usage; oversized input never reaches the provider", async () => {
  await withFetch([json({ choices: [{ finish_reason: "stop", message: { content: '```json\n{"summary":"ok"}\n```' } }], usage: { prompt_tokens: 12, completion_tokens: 3 } })], async (requests) => {
    const r = await openAiAdapter.generate<{ summary: string }>("synthetic-key", base, "system", [{ type: "text", text: "hi" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } }], schema);
    assert(r.output.summary === "ok" && r.inputTokens === 12 && r.outputTokens === 3, "parse/usage");
    const body = JSON.parse(String(requests[0].init?.body));
    assert(body.response_format?.json_schema?.strict === true && body.messages[1].content[1].type === "image_url", "request shape");
    assert(body.messages[1].content[1].image_url.url.startsWith("data:image/png;base64,"), "image data url");
  });
  await withFetch([], async (requests) => {
    const code = await failure(() => openAiAdapter.generate("synthetic-key", base, "x".repeat(2000), "input", schema));
    assert(code === "ai_input_too_large" && requests.length === 0, "estimate cap bypassed");
  });
  const pdf = toOpenAiContent([{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "QQ==" } }]) as { type: string }[];
  assert(pdf[0].type === "file", "pdf part");
});

Deno.test("gemini adapter: counts tokens first, rejects on 429 without generating, maps safety and truncation, strips unsupported schema keys", async () => {
  await withFetch([json({ error: "private" }, 429)], async (requests) => {
    assert(await failure(() => geminiAdapter.generate("synthetic-key", base, "s", "u", schema)) === "gemini_429", "429 code");
    assert(requests.length === 1 && requests[0].url.endsWith(":countTokens"), "generated after rate limit");
    assert(!requests[0].url.includes("synthetic-key") && (requests[0].init?.headers as Record<string, string>)["x-goog-api-key"] === "synthetic-key", "key must be a header, not a query parameter");
  });
  await withFetch([json({ totalTokens: 501 })], async (requests) => {
    assert(await failure(() => geminiAdapter.generate("synthetic-key", base, "s", "u", schema)) === "ai_input_too_large" && requests.length === 1, "cap");
  });
  await withFetch([json({ totalTokens: -3 })], async () => {
    assert(await failure(() => geminiAdapter.generate("synthetic-key", base, "s", "u", schema)) === "ai_token_count_invalid", "negative count");
  });
  for (
    const [reply, expected] of [
      [json({ candidates: [{ finishReason: "SAFETY" }] }), "gemini_refusal"],
      [json({ promptFeedback: { blockReason: "OTHER" } }), "gemini_refusal"],
      [json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] }), "gemini_max_tokens"],
      [json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "nope" }] } }] }), "ai_result_invalid"],
      [json({ error: "private" }, 500), "gemini_500"],
      [timeoutError(), "signal timed out"],
    ] as [Response | Error, string][]
  ) {
    await withFetch([json({ totalTokens: 10 }), reply], async (requests) => {
      const code = await failure(() => geminiAdapter.generate("synthetic-key", base, "s", "u", schema));
      assert(code === expected, `expected ${expected}, got ${code}`);
      assert(requests.length === 2, "gemini retried");
    });
  }
  await withFetch([json({ totalTokens: 10 }), json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"summary":' }, { text: '"ok"}' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 } })], async (requests) => {
    const r = await geminiAdapter.generate<{ summary: string }>("synthetic-key", base, "s", "u", schema);
    assert(r.output.summary === "ok" && r.inputTokens === 10 && r.outputTokens === 4, "gemini parse");
    const body = JSON.parse(String(requests[1].init?.body));
    assert(body.generationConfig.responseMimeType === "application/json" && !("additionalProperties" in body.generationConfig.responseSchema), "schema conversion");
  });
  const converted = toGeminiSchema({ type: "object", additionalProperties: false, properties: { a: { type: "array", items: { type: "object", additionalProperties: false } } } }) as Record<string, unknown>;
  assert(JSON.stringify(converted).indexOf("additionalProperties") === -1, "nested additionalProperties left");
});

function statefulDb() {
  const jobs = new Map<string, { status: string; result?: unknown }>();
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let finishError = false;
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "reserve_ai_operation") {
        const hash = String(args.p_hash);
        const job = jobs.get(hash);
        if (job?.status === "done") return Promise.resolve({ data: { id: hash, cached: job.result }, error: null });
        if (job?.status === "uncertain") return Promise.resolve({ data: { error: "ai_result_uncertain" }, error: null });
        jobs.set(hash, { status: "working" });
        return Promise.resolve({ data: { id: hash }, error: null });
      }
      if (finishError) return Promise.resolve({ data: null, error: { message: "unavailable" } });
      jobs.set(String(args.p_id), args.p_result ? { status: "done", result: args.p_result } : { status: args.p_uncertain ? "uncertain" : "failed" });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { db, calls, jobs, failSave: () => (finishError = true) };
}
const openAiConfig: AiConfig = { ...base, adapter: "openai-chat", provider: "openai_compatible" };
const run = (db: SupabaseClient, cfg = openAiConfig) => runAiOperation(db, parent, "plan", "scope", "synthetic-key", cfg, "system", "input", schema, validate);
const ok = () => json({ choices: [{ finish_reason: "stop", message: { content: '{"summary":"first"}' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } });

Deno.test("two identical requests through a second provider produce one paid operation", async () => {
  const f = statefulDb();
  await withFetch([ok()], async (requests) => {
    const first = await run(f.db);
    const second = await run(f.db);
    assert(!(first instanceof Response) && !(second instanceof Response), "result lost");
    assert(first.output.summary === "first" && second.output.summary === "first", "second call did not reuse");
    assert(requests.length === 1, "identical input charged twice");
    assert(f.calls.filter((c) => c.name === "finish_ai_operation").length === 1, "job finished twice");
  });
});

Deno.test("second provider: 5xx and lost save response stay uncertain and block silent re-runs", async () => {
  const f = statefulDb();
  await withFetch([json({ private: "secret" }, 502)], async (requests) => {
    const r = await run(f.db);
    assert(r instanceof Response && r.status === 502 && (await r.json()).error === "ai_result_uncertain", "5xx public error");
    const finish = f.calls.find((c) => c.name === "finish_ai_operation")!;
    assert(finish.args.p_error === "openai_502" && finish.args.p_uncertain === true, "job record");
    const again = await run(f.db);
    assert(again instanceof Response && again.status === 409 && requests.length === 1, "uncertain job re-ran silently");
  });
  const g = statefulDb();
  g.failSave();
  await withFetch([ok()], async (requests) => {
    const r = await run(g.db);
    assert(r instanceof Response && r.status === 503 && (await r.json()).error === "ai_result_uncertain", "lost save surfaced");
    assert(requests.length === 1, "lost save regenerated");
  });
});

Deno.test("second provider: 429 and oversized input are known failures; timeout is uncertain", async () => {
  for (
    const [reply, code, uncertain, status] of [
      [json({}, 429), "openai_429", false, 502],
      [timeoutError(), "provider_outcome_unknown", true, 502],
    ] as [Response | Error, string, boolean, number][]
  ) {
    const f = statefulDb();
    await withFetch([reply], async (requests) => {
      const r = await run(f.db);
      assert(r instanceof Response && r.status === status, "status");
      const finish = f.calls.find((c) => c.name === "finish_ai_operation")!;
      assert(finish.args.p_error === code && finish.args.p_uncertain === uncertain && requests.length === 1, `record for ${code}`);
    });
  }
  const f = statefulDb();
  await withFetch([], async (requests) => {
    const r = await runAiOperation(f.db, parent, "plan", "scope", "synthetic-key", openAiConfig, "x".repeat(4000), "input", schema, validate);
    assert(r instanceof Response && (await r.json()).error === "ai_input_too_large" && requests.length === 0, "estimate cap");
    assert(f.calls.find((c) => c.name === "finish_ai_operation")!.args.p_uncertain === false, "known failure marked uncertain");
  });
});

Deno.test("name-only model (no adapter) is refused before reservation and provider", async () => {
  const f = statefulDb();
  await withFetch([], async (requests) => {
    const r = await run(f.db, { ...base, adapter: "mystery-adapter" as never });
    assert(r instanceof Response && r.status === 503 && (await r.json()).error === "ai_model_unsupported", "unsupported accepted");
    assert(f.calls.length === 0 && requests.length === 0, "unsupported model reserved or called");
  });
});

Deno.test("anthropic path through the adapter interface is unchanged", async () => {
  const f = statefulDb();
  await withFetch([json({ input_tokens: 50 }), json({ stop_reason: "end_turn", content: [{ type: "text", text: '{"summary":"same"}' }], usage: { input_tokens: 50, output_tokens: 1 } })], async (requests) => {
    const r = await run(f.db, base);
    assert(!(r instanceof Response) && r.output.summary === "same", "anthropic result");
    assert(requests[0].url.endsWith("/count_tokens") && requests[1].url.endsWith("/v1/messages"), "anthropic request order");
  });
});

function configDb(rows: Record<string, Record<string, unknown> | null>) {
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows[table] ?? null, error: null }) }),
      }),
    }),
  } as unknown as SupabaseClient;
  return db;
}
const settings = { model_id: "m", max_input_tokens: 8000, max_output_tokens: 1500, prompt_version: "v1", enabled: true };
const supportedModel = { active: true, provider: "anthropic", adapter: "anthropic-messages", contract_version: "s06-v1", supports_vision: true, supports_pdf: true, supports_json_schema: true, context_tokens: 200000, tokenizer: "provider_count" };
const anthropic = { id: "anthropic", adapter: "anthropic-messages", key_secret_name: "ANTHROPIC_API_KEY", data_region: "us", cross_border: true, cost_class: "medium", status: "active" };

Deno.test("resolveAi refuses a name-only model with reasons and affected features; a declared model yields adapter config", async () => {
  const refused = await resolveAi(configDb({ app_settings: null, ai_settings: settings, ai_models: { active: true, provider: "openai_compatible", adapter: null, contract_version: null }, ai_providers: { ...anthropic, id: "openai_compatible", adapter: "openai-chat", key_secret_name: "OPENAI_API_KEY", status: "unconfigured" } }), "plus", 100);
  assert(refused instanceof Response && refused.status === 503, "name-only model accepted");
  const body = await refused.json();
  assert(body.error === "ai_model_unsupported" && body.reasons.includes("adapter_missing") && body.reasons.includes("provider_unconfigured"), "reasons");
  assert(body.unsupported_features.some((f: { feature: string }) => f.feature === "weekly_summary"), "features listed");
  // U08: eski alanlar korunur, sözleşme alanları eklenir.
  assert(isContractBody(body) && body.category === "service_unavailable" && body.retryable === false, "contract body");

  const inactive = await resolveAi(configDb({ app_settings: null, ai_settings: settings, ai_models: { ...supportedModel, active: false }, ai_providers: anthropic }), "plus", 100);
  assert(inactive instanceof Response && (await inactive.json()).error === "ai_model_unavailable", "inactive model");

  const cfg = await resolveAi(configDb({ app_settings: null, ai_settings: settings, ai_models: supportedModel, ai_providers: anthropic }), "plus", 100);
  assert(!(cfg instanceof Response) && cfg.adapter === "anthropic-messages" && cfg.capabilities?.vision === true && cfg.model === "m", "config lost");

  const killed = await resolveAi(configDb({ app_settings: { value: false }, ai_settings: settings, ai_models: supportedModel, ai_providers: anthropic }), "plus", 100);
  assert(killed instanceof Response && (await killed.json()).error === "ai_disabled", "kill switch");
});
