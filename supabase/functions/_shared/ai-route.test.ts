// C08 — çözülmüş sağlayıcı/model yönlendirmesi: anahtar adı adapter'dan, üretim adapter'dan, rezervasyon
// sağlayıcıyı taşır. Gerçek ağ yok: sahte fetch ve sahte RPC. Anahtar değerleri sentetik.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { type AiConfig, apiKeyOrResponse } from "./prova.ts";
import { generateWith } from "./ai-route.ts";
import { runAiOperation } from "./ai-operation.ts";
import { isContractBody } from "./error-contract.ts";

const base: AiConfig = { model: "synthetic-model", promptVersion: "c08", maxOutputTokens: 64, maxInputTokens: 500 };
const openai: AiConfig = { ...base, adapter: "openai-chat", provider: "openai_compatible" };
const anthropic: AiConfig = { ...base, adapter: "anthropic-messages", provider: "anthropic" };
const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };

async function withFetch(responses: (Response | Error)[], test: (urls: string[], headers: Headers[]) => Promise<void>) {
  const original = globalThis.fetch, urls: string[] = [], headers: Headers[] = [];
  globalThis.fetch = (input, init) => {
    urls.push(String(input));
    headers.push(new Headers(init?.headers));
    const next = responses.shift();
    if (!next) return Promise.reject(Error("unexpected provider call"));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  try {
    await test(urls, headers);
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("C08 apiKeyOrResponse: secret name comes from the resolved adapter, not an Anthropic constant", async () => {
  const seen: string[] = [];
  const env = (values: Record<string, string>) => (name: string) => {
    seen.push(name);
    return values[name];
  };
  assertEquals(apiKeyOrResponse(anthropic, env({ ANTHROPIC_API_KEY: "a-synthetic" })), "a-synthetic");
  assertEquals(apiKeyOrResponse(openai, env({ OPENAI_API_KEY: "o-synthetic", ANTHROPIC_API_KEY: "a-synthetic" })), "o-synthetic");
  assertEquals(apiKeyOrResponse({ adapter: "gemini-generate" }, env({ GEMINI_API_KEY: "g-synthetic" })), "g-synthetic");
  // OpenAI anahtarı yoksa Anthropic anahtarına düşmez (ikinci sağlayıcıya sessiz geçiş yok).
  seen.length = 0;
  const missing = apiKeyOrResponse(openai, env({ ANTHROPIC_API_KEY: "a-synthetic" }));
  assert(missing instanceof Response);
  assertEquals(seen, ["OPENAI_API_KEY"]);
  assertEquals(missing.status, 503);
  const body = await missing.json();
  assert(isContractBody(body));
  assertEquals([body.code, body.category, body.retryable], ["provider_unconfigured", "service_unavailable", false]);
  assert(!JSON.stringify(body).includes("a-synthetic"));
  // Eski çağrı (config yok) Anthropic davranışını korur.
  const legacy = apiKeyOrResponse(undefined, env({}));
  assert(legacy instanceof Response);
  assertEquals((await legacy.json()).code, "ai_not_configured");
});

Deno.test("C08 generateWith routes to the resolved adapter and refuses an unregistered one without a request", async () => {
  await withFetch([
    new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } })),
  ], async (urls, headers) => {
    const result = await generateWith<{ ok: boolean }>("o-synthetic", openai, "sys", "user", schema);
    assertEquals(result.output, { ok: true });
    assertEquals(urls.length, 1);
    assert(!urls[0].includes("anthropic.com"), "OpenAI config must not call Anthropic");
    assertEquals(headers[0].get("x-api-key"), null);
  });
  await withFetch([], async (urls) => {
    await assertRejects(() => generateWith("k", { ...base, adapter: "nope" as never }, "s", "u", schema), Error, "ai_model_unsupported");
    assertEquals(urls.length, 0);
  });
});

function reservingDb(reservation: unknown) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve(name.startsWith("reserve_") ? { data: reservation, error: null } : { data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
const parent = { familyId: "synthetic-family", userId: "synthetic-parent" };
const validate = (v: unknown) => v as { ok: boolean };

Deno.test("C08 runAiOperation sends the resolved provider to reservation (circuit breaker per provider)", async () => {
  for (const [action, rpc] of [["import", "reserve_ai_operation"], ["weekly", "reserve_weekly_summary"], ["learning_import", "reserve_learning_plan_import"]] as const) {
    const { db, calls } = reservingDb({ error: "ai_quota_exceeded" });
    const response = await runAiOperation(db, parent, action, "00000000-0000-4000-8000-000000000001", "k", openai, "s", "u", schema, validate);
    assert(response instanceof Response);
    assertEquals(response.status, 402);
    assertEquals(calls[0].name, rpc);
    assertEquals(calls[0].args.p_provider, "openai_compatible");
  }
  // Çocuk yolu imzası değişmedi: sağlayıcı ailenin etkin modelinden (SQL tarafında) çözülür.
  const child = reservingDb({ error: "ai_quota_exceeded" });
  await runAiOperation(child.db, parent, "grade", "scope", "k", openai, "s", "u", schema, validate, "child-1");
  assertEquals(child.calls[0].name, "reserve_child_ai_operation");
  assertEquals("p_provider" in child.calls[0].args, false);
});

Deno.test("C08 paused or unconfigured provider is a contract error before any provider request", async () => {
  for (const code of ["ai_temporarily_unavailable", "provider_unconfigured"]) {
    await withFetch([], async (urls) => {
      const { db } = reservingDb({ error: code });
      const response = await runAiOperation(db, parent, "import", "scope", "k", openai, "s", "u", schema, validate);
      assert(response instanceof Response);
      assertEquals(response.status, 503);
      const body = await response.json();
      assert(isContractBody(body));
      assertEquals([body.code, body.category], [code, "service_unavailable"]);
      assertEquals(urls.length, 0);
    });
  }
});

Deno.test("C08 failure matrix through the resolved adapter: one paid call, uncertain never re-runs or falls back", async () => {
  const cases: { name: string; reply: Response | Error; code: string; uncertain: boolean; status: number }[] = [
    { name: "429", reply: new Response("{}", { status: 429 }), code: "generation_failed", uncertain: false, status: 502 },
    { name: "503", reply: new Response("{}", { status: 503 }), code: "ai_result_uncertain", uncertain: true, status: 502 },
    { name: "timeout", reply: new DOMException("timeout", "TimeoutError"), code: "ai_result_uncertain", uncertain: true, status: 502 },
    { name: "lost response", reply: new TypeError("connection reset"), code: "ai_result_uncertain", uncertain: true, status: 502 },
    { name: "malformed JSON", reply: new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{not json" } }] })), code: "ai_result_uncertain", uncertain: true, status: 502 },
  ];
  for (const c of cases) {
    await withFetch([c.reply], async (urls) => {
      const { db, calls } = reservingDb({ id: "job-1" });
      const response = await runAiOperation(db, parent, "import", "scope", "k", openai, "s", "u", schema, validate);
      assert(response instanceof Response, c.name);
      assertEquals(response.status, c.status, c.name);
      const body = await response.json();
      assert(isContractBody(body), c.name);
      assertEquals(body.code, c.code, c.name);
      assertEquals(urls.length, 1, `${c.name}: exactly one provider request, no fallback`);
      const finish = calls.find((x) => x.name === "finish_ai_operation");
      assertEquals(finish?.args.p_uncertain, c.uncertain, c.name);
    });
  }
});
