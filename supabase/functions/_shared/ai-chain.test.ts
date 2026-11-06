import { assertEquals, assertRejects } from "jsr:@std/assert";
import { type chainDefaults, runAiChain } from "./ai-chain.ts";
import { type AiAdapter, AiProviderError } from "./ai-provider.ts";
import type { AiConfig } from "./prova.ts";
const cfg: AiConfig = {
  model: "first",
  maxOutputTokens: 100,
  promptVersion: "v1",
  chain: {
    id: "chain",
    usage_key: "open_ended_grading",
    plan: "pro",
    updated_at: "v1",
    on_rate_limit: true,
    on_server_error: true,
    on_timeout: false,
    attempt_seconds: 10,
    total_seconds: 30,
    steps: [{
      position: 1,
      active: true,
      paused: false,
      config: {
        model: "first",
        provider: "openai_compatible",
        adapter: "openai-chat",
        maxOutputTokens: 100,
        promptVersion: "v1",
      },
    }, {
      position: 2,
      active: true,
      paused: false,
      config: {
        model: "second",
        provider: "anthropic",
        adapter: "anthropic-messages",
        maxOutputTokens: 100,
        promptVersion: "v1",
      },
    }],
  },
};
function fixture(
  error?: Error,
  options: {
    skip?: boolean;
    stop?: boolean;
    journalFail?: boolean;
    finishFail?: boolean;
    secondError?: Error;
    keyMissing?: boolean;
  } = {},
) {
  const calls: string[] = [],
    keys: string[] = [],
    entries: { name: string; args: Record<string, unknown> }[] = [];
  const deps: typeof chainDefaults = {
    now: () => 100,
    key: (a) => {
      if (options.keyMissing && a.id === "openai-chat") {
        throw new Error("missing");
      }
      return `secret-for-${a.id}`;
    },
    adapter: (id) =>
      ({
        id,
        generate: (key: string, config: AiConfig) => {
          calls.push(config.model);
          keys.push(key);
          if (config.model === "first" && error) return Promise.reject(error);
          if (config.model === "second" && options.secondError) {
            return Promise.reject(options.secondError);
          }
          return Promise.resolve({
            output: { ok: true },
            inputTokens: 5,
            outputTokens: 3,
          });
        },
      }) as unknown as AiAdapter,
    rpc: (name, args) => {
      entries.push({ name, args });
      if (
        options.journalFail ||
        options.finishFail && name === "ai_chain_finish_attempt"
      ) return Promise.reject(new Error("journal"));
      if (name === "ai_chain_start_attempt") {
        return Promise.resolve(
          options.stop ? { stop: "daily_limit" } : {
            id: args.p_position,
            allowed: !(args.p_skip || options.skip && args.p_position === 1),
          },
        );
      }
      return Promise.resolve(null);
    },
  };
  return { deps, calls, keys, entries };
}
Deno.test("chain: 429 advances across providers using the correct key, records actual model", async () => {
  const f = fixture(new AiProviderError("openai_429"));
  const r = await runAiChain(cfg, "s", "u", {}, f.deps);
  assertEquals(f.calls, ["first", "second"]);
  assertEquals(f.keys, [
    "secret-for-openai-chat",
    "secret-for-anthropic-messages",
  ]);
  assertEquals(r.model, "second");
  assertEquals(r.provider, "anthropic");
  assertEquals(
    f.entries.filter((x) => x.name === "ai_chain_finish_attempt").map((x) =>
      x.args.p_ok
    ),
    [false, true],
  );
});
Deno.test("chain: first success stops, no second paid call", async () => {
  const f = fixture();
  await runAiChain(cfg, "s", "u", {}, f.deps);
  assertEquals(f.calls, ["first"]);
});
for (
  const code of [
    "openai_refusal",
    "ai_result_invalid",
    "openai_length",
    "openai_401",
  ]
) {
  Deno.test(`chain: ${code} stops`, async () => {
    const f = fixture(new AiProviderError(code));
    await assertRejects(() => runAiChain(cfg, "s", "u", {}, f.deps));
    assertEquals(f.calls, ["first"]);
  });
}
Deno.test("chain: inactive/current server skip never calls provider", async () => {
  const f = fixture(undefined, { skip: true });
  await runAiChain(cfg, "s", "u", {}, f.deps);
  assertEquals(f.calls, ["second"]);
});
Deno.test("chain: missing first key can use second provider", async () => {
  const f = fixture(undefined, { keyMissing: true });
  await runAiChain(cfg, "s", "u", {}, f.deps);
  assertEquals(f.calls, ["second"]);
});
Deno.test("chain: incompatible media is skipped", async () => {
  const f = fixture();
  const c = structuredClone(cfg);
  c.chain!.steps[1].config.capabilities = {
    vision: true,
    pdf: true,
    jsonSchema: true,
    contextTokens: 8000,
    tokenizer: "provider_count",
  };
  await runAiChain(
    c,
    "s",
    [{
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AA==" },
    }],
    {},
    f.deps,
  );
  assertEquals(f.calls, ["second"]);
});
Deno.test("chain: database failure before start never charges", async () => {
  const f = fixture(undefined, { journalFail: true });
  await assertRejects(() => runAiChain(cfg, "s", "u", {}, f.deps));
  assertEquals(f.calls, []);
});
Deno.test("chain: budget/lease stop never calls another provider", async () => {
  const f = fixture(undefined, { stop: true });
  await assertRejects(() => runAiChain(cfg, "s", "u", {}, f.deps));
  assertEquals(f.calls, []);
});
Deno.test("chain: journal failure after success does not generate again", async () => {
  const f = fixture(undefined, { finishFail: true });
  await assertRejects(() => runAiChain(cfg, "s", "u", {}, f.deps));
  assertEquals(f.calls, ["first"]);
});
Deno.test("chain: 5xx then 429 remains uncertain, cannot become a safe retry", async () => {
  const f = fixture(new AiProviderError("openai_503"), {
    secondError: new AiProviderError("anthropic_429"),
  });
  await assertRejects(
    () => runAiChain(cfg, "s", "u", {}, f.deps),
    Error,
    "provider_outcome_unknown",
  );
  assertEquals(f.calls, ["first", "second"]);
});
Deno.test("chain: configured 5xx stop", async () => {
  const f = fixture(new AiProviderError("openai_503"));
  const c = structuredClone(cfg);
  c.chain!.on_server_error = false;
  await assertRejects(() => runAiChain(c, "s", "u", {}, f.deps));
  assertEquals(f.calls, ["first"]);
});
Deno.test("chain: timeout stops by default; explicit policy allows next model", async () => {
  const f = fixture(new DOMException("timeout", "TimeoutError"));
  await assertRejects(() => runAiChain(cfg, "s", "u", {}, f.deps));
  assertEquals(f.calls, ["first"]);
  const g = fixture(new DOMException("timeout", "TimeoutError"));
  const c = structuredClone(cfg);
  c.chain!.on_timeout = true;
  await runAiChain(c, "s", "u", {}, g.deps);
  assertEquals(g.calls, ["first", "second"]);
});
Deno.test("chain: expired total deadline makes no paid calls", async () => {
  const f = fixture();
  let n = 0;
  f.deps.now = () => n++ === 0 ? 0 : 31000;
  await assertRejects(() => runAiChain(cfg, "s", "u", {}, f.deps));
  assertEquals(f.calls, []);
});
