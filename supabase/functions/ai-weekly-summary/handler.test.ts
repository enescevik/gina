import {
  type Dependencies,
  handleWeeklySummary,
  validateOutput,
} from "./handler.ts";
const parent = { familyId: "family", userId: "parent" };
const config = {
  model: "synthetic-model",
  maxOutputTokens: 1500,
  promptVersion: "v2",
};
const output = {
  haftanin_ozeti: "Kayıtlara birlikte bakalım.",
  cocuk_basina: [{
    etiket: "Çocuk A",
    basarilar: [],
    zorlananlar: [],
    oneri: "Birlikte küçük bir adım seçebilirsiniz.",
  }],
  veliye_oneriler: [],
};
function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw Error(message);
}
function fixture() {
  const state = {
    calls: [] as string[],
    run: 0,
    key: 0,
    parent: true,
    entitlementError: false,
    prepareError: "",
    storeError: false,
    configResponse: null as Response | null,
    runResponse: null as Response | null,
    prepared: {
      id: "context",
      context: {
        config: { ...config, model: "frozen-model" },
        system: "frozen-system",
        schema: { type: "object" },
        input: { children: [{ alias: "Çocuk A" }] },
      },
    },
    input: [] as unknown[],
  };
  const deps: Dependencies = {
    parent: async () => state.parent ? parent : null,
    key: () => {
      state.key++;
      return "synthetic-key";
    },
    resolve: async () => state.configResponse ?? config,
    db: {
      rpc: async (name: string) => {
        state.calls.push(name);
        return name === "get_family_entitlement"
          ? {
            data: [{ plan: "pro" }],
            error: state.entitlementError ? {} : null,
          }
          : name === "prepare_weekly_summary"
          ? {
            data: state.prepared,
            error: state.prepareError ? { message: state.prepareError } : null,
          }
          : {
            data: output,
            error: state.storeError
              ? { message: "private database error" }
              : null,
          };
      },
    } as unknown as Dependencies["db"],
    run: (async (...args: unknown[]) => {
      state.run++;
      state.input = args;
      if (state.runResponse) return state.runResponse;
      const validate = args[9] as (v: unknown) => unknown;
      return {
        output: validate(output),
        jobId: "job",
        inputTokens: 10,
        outputTokens: 5,
      };
    }) as Dependencies["run"],
  };
  return { state, deps };
}
const request = (
  body: unknown = { week_start: "2026-10-26" },
  method = "POST",
) =>
  new Request("https://local.test/weekly", {
    method,
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
Deno.test("weekly requires parent and a bounded actual Monday body", async () => {
  for (
    const body of [
      { week_start: "2026-02-30" },
      { week_start: "2026-10-27" },
      { week_start: "2026-10-26", family_id: "other" },
      null,
      { week_start: "x".repeat(300) },
    ]
  ) {
    const f = fixture();
    assert((await handleWeeklySummary(request(body), f.deps)).status === 400);
    assert(!f.state.run && !f.state.calls.length);
  }
  const f = fixture();
  f.state.parent = false;
  assert((await handleWeeklySummary(request(), f.deps)).status === 403);
  assert(!f.state.calls.length);
  assert(
    (await handleWeeklySummary(request({}, "GET"), fixture().deps)).status ===
      405,
  );
});
Deno.test("weekly configuration, eligibility and source errors cannot call provider", async () => {
  for (
    const code of [
      "weekly_forbidden",
      "weekly_date",
      "weekly_no_children",
      "plan_has_no_ai",
      "private database error",
    ]
  ) {
    const f = fixture();
    f.state.prepareError = code;
    const r = await handleWeeklySummary(request(), f.deps);
    assert(r.status >= 400 && !f.state.run);
    assert(!(await r.text()).includes("private database error"));
  }
  const f = fixture();
  f.state.entitlementError = true;
  assert(
    (await handleWeeklySummary(request(), f.deps)).status === 503 &&
      !f.state.run,
  );
  const off = fixture();
  off.state.configResponse = new Response("{}", { status: 503 });
  assert(
    (await handleWeeklySummary(request(), off.deps)).status === 503 &&
      !off.state.key && !off.state.run,
  );
});
Deno.test("weekly uses immutable server context and stores only a paid job reference", async () => {
  const f = fixture();
  const r = await handleWeeklySummary(request(), f.deps);
  assert(r.status === 200);
  assert(f.state.input[2] === "weekly" && f.state.input[3] === "context");
  assert(
    (f.state.input[5] as { model: string }).model === "frozen-model" &&
      f.state.input[6] === "frozen-system",
  );
  assert(
    f.state.calls.join() ===
      "get_family_entitlement,prepare_weekly_summary,store_weekly_summary",
  );
});
Deno.test("uncertain provider result never writes a summary; lost save can recover cached paid result", async () => {
  const f = fixture();
  f.state.runResponse = new Response('{"error":"ai_result_uncertain"}', {
    status: 502,
  });
  assert(
    (await handleWeeklySummary(request(), f.deps)).status === 502 &&
      !f.state.calls.includes("store_weekly_summary"),
  );
  const lost = fixture();
  lost.state.storeError = true;
  const r = await handleWeeklySummary(request(), lost.deps);
  assert(r.status === 503 && (await r.json()).error === "weekly_save_pending");
});
Deno.test("weekly output rejects invented/duplicate aliases and oversized or extra fields", () => {
  const invalid = [
    { ...output, secret: "extra" },
    {
      ...output,
      cocuk_basina: [{ ...output.cocuk_basina[0], etiket: "Çocuk B" }],
    },
    {
      ...output,
      cocuk_basina: [...output.cocuk_basina, ...output.cocuk_basina],
    },
    { ...output, haftanin_ozeti: "x".repeat(1801) },
    { ...output, veliye_oneriler: ["a", "b", "c", "d"] },
    { ...output, cocuk_basina: [{ ...output.cocuk_basina[0], oneri: null }] },
  ];
  for (const v of invalid) {
    let threw = false;
    try {
      validateOutput(v, ["Çocuk A"]);
    } catch {
      threw = true;
    }
    assert(threw);
  }
  assert(validateOutput(output, ["Çocuk A"]) === output);
});
