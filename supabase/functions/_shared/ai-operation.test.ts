import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runAiOperation } from "./ai-operation.ts";
import { callClaude } from "./prova.ts";
const config = {
  model: "synthetic-model",
  promptVersion: "test",
  maxInputTokens: 500,
  maxOutputTokens: 100,
};
const parent = { familyId: "synthetic-family", userId: "synthetic-parent" };
const schema = {
  type: "object",
  properties: { summary: { type: "string" } },
  required: ["summary"],
  additionalProperties: false,
};
function validate(value: unknown): { summary: string } {
  if (
    !value || typeof value !== "object" || !("summary" in value) ||
    typeof value.summary !== "string"
  ) throw Error("ai_result_invalid");
  return { summary: value.summary };
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
function fixture(
  reservation: unknown = { id: "job" },
  reserveError = false,
  finishError = false,
) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve(
        name === "reserve_ai_operation"
          ? {
            data: reservation,
            error: reserveError ? { message: "unavailable" } : null,
          }
          : {
            data: null,
            error: finishError ? { message: "unavailable" } : null,
          },
      );
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
async function run(db: SupabaseClient) {
  return await runAiOperation(
    db,
    parent,
    "plan",
    "synthetic-scope",
    "synthetic-key",
    config,
    "No personal data",
    "synthetic input",
    schema,
    validate,
  );
}
async function withFetch(
  responses: (Response | Error)[],
  test: (requests: string[]) => Promise<void>,
) {
  const original = globalThis.fetch, requests: string[] = [];
  globalThis.fetch = (input) => {
    requests.push(String(input));
    const response = responses.shift();
    if (!response) return Promise.reject(Error("Unexpected provider call"));
    return response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response);
  };
  try {
    await test(requests);
  } finally {
    globalThis.fetch = original;
  }
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
const success = () =>
  json({
    stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "not output" }, {
      type: "text",
      text: '{"summary":"Small next step"}',
    }],
    usage: { input_tokens: 50, output_tokens: 10 },
  });
Deno.test("AI reservation outage and quota rejection never call a provider", async () => {
  for (
    const f of [
      fixture(null, true),
      fixture({ error: "ai_quota_exceeded" }),
      fixture({ error: "ai_rate_limited" }),
    ]
  ) {
    await withFetch([], async (requests) => {
      const result = await run(f.db);
      assert(result instanceof Response, "expected response");
      assert([503, 402, 429].includes(result.status), "wrong gate status");
      assert(requests.length === 0, "gate called provider");
      assert(f.calls.length === 1, "gate mutated job");
    });
  }
});
Deno.test("cached paid output is reused without a new provider request", async () => {
  const f = fixture({
    id: "job",
    cached: {
      output: { summary: "Cached" },
      inputTokens: 50,
      outputTokens: 10,
    },
  });
  await withFetch([], async (requests) => {
    const result = await run(f.db);
    assert(
      !(result instanceof Response) && result.output.summary === "Cached",
      "cache lost",
    );
    assert(
      requests.length === 0 && f.calls.length === 1,
      "cache generated again",
    );
  });
});
Deno.test("invalid cached output does not regenerate or overwrite the paid job", async () => {
  const f = fixture({ id: "job", cached: { output: { bad: true } } });
  await withFetch([], async (requests) => {
    const result = await run(f.db);
    assert(
      result instanceof Response && result.status === 502,
      "invalid cache accepted",
    );
    assert(
      requests.length === 0 && f.calls.length === 1,
      "invalid cache retried",
    );
  });
});
Deno.test("valid output commits once and records validated content, not thinking", async () => {
  const f = fixture();
  await withFetch([json({ input_tokens: 50 }), success()], async (requests) => {
    const result = await run(f.db);
    assert(
      !(result instanceof Response) &&
        result.output.summary === "Small next step",
      "output lost",
    );
    assert(
      requests.length === 2 && f.calls.length === 2,
      "unexpected call count",
    );
    const saved = f.calls[1].args.p_result as { output: { summary: string } };
    assert(saved.output.summary === "Small next step", "wrong saved result");
  });
});
Deno.test("input cap blocks generation before the paid message request", async () => {
  const f = fixture();
  await withFetch([json({ input_tokens: 501 })], async (requests) => {
    const result = await run(f.db);
    assert(
      result instanceof Response && result.status === 502,
      "oversized input accepted",
    );
    assert(requests.length === 1, "oversized input generated");
    assert(
      f.calls[1].args.p_error === "ai_input_too_large" &&
        f.calls[1].args.p_uncertain === false,
      "known failure marked uncertain",
    );
  });
});
Deno.test("429 is a known rejection and is never retried automatically", async () => {
  const f = fixture();
  await withFetch([
    json({ input_tokens: 50 }),
    json({ error: "private provider body" }, 429),
  ], async (requests) => {
    const result = await run(f.db);
    assert(result instanceof Response, "error expected");
    assert(requests.length === 2, "rate limited request retried");
    assert(
      f.calls[1].args.p_error === "anthropic_429" &&
        f.calls[1].args.p_uncertain === false,
      "wrong certainty",
    );
    assert(
      !(await result.text()).includes("private provider body"),
      "provider body leaked",
    );
  });
});
Deno.test("5xx, network loss, refusal and truncation remain uncertain without another paid request", async () => {
  for (
    const reply of [
      json({ private: "secret" }, 503),
      new Error("socket with sensitive details"),
      json({ stop_reason: "refusal" }),
      json({ stop_reason: "max_tokens" }),
    ]
  ) {
    const f = fixture();
    await withFetch([json({ input_tokens: 50 }), reply], async (requests) => {
      const result = await run(f.db);
      assert(
        result instanceof Response && result.status === 502,
        "error expected",
      );
      assert(
        requests.length === 2 && f.calls.length === 2,
        "uncertain result retried",
      );
      assert(
        f.calls[1].args.p_uncertain === true,
        "charged outcome treated safe to retry",
      );
      assert(
        (await result.json()).error === "ai_result_uncertain",
        "unsafe public error",
      );
    });
  }
});
Deno.test("malformed or schema-invalid output is never accepted or regenerated", async () => {
  for (const text of ["not json", '{"wrong":true}']) {
    const f = fixture();
    await withFetch([
      json({ input_tokens: 50 }),
      json({ stop_reason: "end_turn", content: [{ type: "text", text }] }),
    ], async (requests) => {
      const result = await run(f.db);
      assert(
        result instanceof Response && result.status === 502,
        "bad output accepted",
      );
      assert(
        requests.length === 2 && f.calls[1].args.p_uncertain === true,
        "invalid paid output retried",
      );
    });
  }
});
Deno.test("lost commit response does not trigger a second provider call", async () => {
  const f = fixture({ id: "job" }, false, true);
  await withFetch([json({ input_tokens: 50 }), success()], async (requests) => {
    const result = await run(f.db);
    assert(
      result instanceof Response && result.status === 503,
      "ambiguous save accepted",
    );
    assert(
      requests.length === 2 && f.calls.length === 2,
      "lost save regenerated",
    );
    assert(
      (await result.json()).error === "ai_result_uncertain",
      "lost commit not surfaced",
    );
  });
});
Deno.test("provider output with no text block cannot silently become an empty object", async () => {
  await withFetch([
    json({ input_tokens: 50 }),
    json({
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "private" }],
    }),
  ], async () => {
    let rejected = false;
    try {
      await callClaude("synthetic-key", config, "system", "input", schema);
    } catch (e) {
      rejected = e instanceof Error && e.message === "ai_result_invalid";
    }
    assert(rejected, "missing text silently accepted");
  });
});
Deno.test("negative tokenizer count is malformed and never starts generation", async () => {
  await withFetch([json({ input_tokens: -1 })], async (requests) => {
    let rejected = false;
    try {
      await callClaude("synthetic-key", config, "system", "input", schema);
    } catch (e) {
      rejected = e instanceof Error && e.message === "ai_token_count_invalid";
    }
    assert(rejected && requests.length === 1, "invalid token count accepted");
  });
});

Deno.test("weekly reservation binds the frozen context and reuses its paid result", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data: {
          id: "job",
          cached: {
            output: { summary: "Cached" },
            inputTokens: 1,
            outputTokens: 1,
          },
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  await withFetch([], async () => {
    const result = await runAiOperation(
      db,
      parent,
      "weekly",
      "context-id",
      "synthetic-key",
      config,
      "system",
      "input",
      schema,
      validate,
    );
    assert(!(result instanceof Response), "cached result returns");
    assert(
      calls.length === 1 && calls[0].name === "reserve_weekly_summary",
      "dedicated reservation",
    );
    assert(
      calls[0].args.p_context === "context-id" &&
        calls[0].args.p_family === parent.familyId,
      "family and context are bound",
    );
  });
});

Deno.test("learning import reservation binds immutable document context without provider replay", async () => {
  const calls: string[] = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      assert(args.p_context === "doc-context", "context reference");
      return {
        data: {
          id: "job",
          cached: {
            output: { summary: "Cached" },
            inputTokens: 1,
            outputTokens: 1,
          },
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  await withFetch([], async (requests) => {
    const r = await runAiOperation(
      db,
      parent,
      "learning_import",
      "doc-context",
      "synthetic-key",
      config,
      "system",
      "input",
      schema,
      validate,
    );
    assert(
      !(r instanceof Response) && r.output.summary === "Cached",
      "cached extraction",
    );
    assert(requests.length === 0, "no paid request");
  });
  assert(
    calls.join() === "reserve_learning_plan_import",
    "specialized scope gate",
  );
});
