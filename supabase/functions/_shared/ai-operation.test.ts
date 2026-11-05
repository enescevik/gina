import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runAiOperation } from "./ai-operation.ts";
import { callClaude } from "./prova.ts";
import { expectContract } from "./contract-fixtures.ts";
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

Deno.test("validation diagnostics retain only approved field names, never document values", async () => {
  for (const field of ["title", "private document text"]) {
    const f = fixture();
    await withFetch([json({ input_tokens: 20 }), success()], async () => {
      const r = await runAiOperation(
        f.db,
        parent,
        "import",
        "source",
        "synthetic",
        config,
        "system",
        "input",
        schema,
        () => {
          throw Object.assign(Error("ai_result_invalid"), {
            validationCode: field,
          });
        },
      );
      assert(
        r instanceof Response && r.status === 502,
        "invalid output remains blocked",
      );
    });
    const saved = f.calls.find((c) => c.name === "finish_ai_operation")?.args;
    assert(saved?.p_uncertain === true, "no automatic paid retry");
    assert(
      saved?.p_error ===
        (field === "title" ? "ai_result_invalid_title" : "ai_result_invalid"),
      "safe diagnostic only",
    );
  }
});

Deno.test("Archived child uses scoped reservation and rejects before quota/provider", async () => {
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const db={rpc:(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return Promise.resolve({data:null,error:{message:"child_archived"}});}} as unknown as SupabaseClient;
  await withFetch([],async requests=>{
    const result=await runAiOperation(db,parent,"import","scope","synthetic-key",config,"system","input",schema,validate,"synthetic-child");
    assert(result instanceof Response && result.status===409,"archive status");
    assert((await result.json()).error==="child_archived","archive error");
    assert(calls.length===1&&calls[0].name==="reserve_child_ai_operation","atomic child reservation required");
    assert(calls[0].args.p_child_id==="synthetic-child","child identity passed");
    assert(requests.length===0,"no provider calls");
  });
});

Deno.test("U08 contract: reservation and provider failures use the shared error body", async () => {
  for (
    const [reservation, status, code, category] of [
      [{ error: "ai_quota_exceeded" }, 402, "ai_quota_exceeded", "rate_limited"],
      [{ error: "ai_rate_limited" }, 429, "ai_rate_limited", "rate_limited"],
      [{ error: "generation_in_progress" }, 409, "generation_in_progress", "conflict"],
      [{ error: "ai_result_uncertain" }, 409, "ai_result_uncertain", "service_unavailable"],
      // Ham/bilinmeyen rezervasyon metni istemciye sızmaz.
      [{ error: "ERROR: duplicate key 8f1c" }, 409, "server_error", "service_unavailable"],
    ] as const
  ) {
    const f = fixture(reservation);
    await withFetch([], async (requests) => {
      const result = await run(f.db);
      assert(result instanceof Response, "expected response");
      const body = await expectContract(result, status, code, category);
      if (code === "ai_rate_limited") assert(body.retry_after_s === 60 && body.retryable === true, "no retry hint");
      if (code === "generation_in_progress") assert(body.retry_after_s === 20, "no retry hint");
      assert(requests.length === 0, "gate called provider");
    });
  }
  const outage = fixture(null, true);
  await withFetch([], async () => {
    await expectContract(await run(outage.db) as Response, 503, "ai_configuration_unavailable", "service_unavailable");
  });
  const uncertain = fixture();
  await withFetch([Error("network lost")], async () => {
    await expectContract(await run(uncertain.db) as Response, 502, "ai_result_uncertain", "service_unavailable");
  });
});
Deno.test("U08 single charge: same request repeated (and raced) yields one paid provider job", async () => {
  // Durumlu rezervasyon: aynı hash ilk çağrıda iş açar, işlem sürerken `generation_in_progress`,
  // bittikten sonra aynı iş kimliğiyle `cached` döner (DB'deki reserve_ai_operation sözleşmesi).
  const jobs = new Map<string, { id: string; done: boolean; result?: unknown }>();
  let reservations = 0;
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "reserve_ai_operation") {
        reservations++;
        const hash = String(args.p_hash), job = jobs.get(hash);
        if (!job) {
          jobs.set(hash, { id: "job-1", done: false });
          return Promise.resolve({ data: { id: "job-1" }, error: null });
        }
        return Promise.resolve({
          data: job.done ? { id: job.id, cached: job.result } : { error: "generation_in_progress" },
          error: null,
        });
      }
      if (name === "finish_ai_operation") {
        for (const job of jobs.values()) {
          if (job.id === args.p_id) Object.assign(job, { done: true, result: args.p_result });
        }
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  // Sağlayıcı yanıtı kapı açılana kadar bekler: ilk iş kesin olarak "sürüyor" durumundayken ikinci istek gelir.
  const original = globalThis.fetch, requests: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => release = resolve);
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    if (String(input).includes("count_tokens")) return json({ input_tokens: 50 });
    await gate;
    return success();
  };
  try {
    const first = run(db);
    while (requests.length < 2) await new Promise((r) => setTimeout(r, 1));
    const raced = await run(db);
    assert(raced instanceof Response, "race started a second job");
    await expectContract(raced, 409, "generation_in_progress", "conflict");
    release();
    const done = await first;
    assert(!(done instanceof Response) && done.jobId === "job-1", "first call failed");
    const again = await run(db);
    assert(!(again instanceof Response) && again.jobId === "job-1", "retry did not reuse the job");
    assert(!(again instanceof Response) && again.output.summary === "Small next step", "cache lost output");
    assert(requests.length === 2, `paid provider called ${requests.length / 2} times`);
    assert(reservations === 3 && jobs.size === 1, "more than one job reserved");
  } finally {
    globalThis.fetch = original;
  }
});
