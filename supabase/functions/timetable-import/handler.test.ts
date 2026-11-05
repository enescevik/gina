// U08: timetable-import uç sözleşmesi — kimlik ayrımı, hata gövdesi, paylaşılan kaynak sınırı ve
// aynı istekte tek ücretli iş. Gerçek `runAiOperation` + sahte sağlayıcı (fetch) ile koşar; ağ/AI yok.
import { assert, assertEquals } from "jsr:@std/assert";
import { defaults, handleTimetableImport } from "./handler.ts";
import { parentOrResponse } from "../_shared/auth.ts";
import { fail } from "../_shared/error-contract.ts";
import { authCases, expectContract, PARENT_FAMILY, PARENT_USER } from "../_shared/contract-fixtures.ts";

const child = "00000000-0000-4000-8000-000000007101",
  source = "00000000-0000-4000-8000-000000007102";
const lesson = { day: 1, title: "Matematik", start: "09:00", end: "09:40", page: 1, note: "" };

function fixture(options: { sourcesEnabled?: boolean; archived?: boolean; policy?: boolean } = {}) {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const jobs = new Map<string, { id: string; done: boolean; result?: unknown }>();
  let documents = 0, usage = 0;
  const db = {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: table === "app_settings"
              ? { value: options.sourcesEnabled !== false }
              : table === "children"
              ? { id: child, archived_at: options.archived ? "2026-11-01" : null }
              : table === "ai_operation_policies"
              ? { enabled: options.policy !== false }
              : null,
            error: null,
          }),
      };
      return chain;
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      if (name === "reserve_child_ai_operation") {
        const job = jobs.get(String(args.p_hash));
        if (!job) {
          jobs.set(String(args.p_hash), { id: `job-${jobs.size + 1}`, done: false });
          return Promise.resolve({ data: { id: `job-${jobs.size}` }, error: null });
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
      if (name === "register_timetable_import") {
        return Promise.resolve({ data: { id: "import-1", draft: { lessons: [lesson] }, applied_revision: 0 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as ReturnType<typeof defaults.serviceClient>;
  const deps: typeof defaults = {
    ...defaults,
    serviceClient: () => db,
    parentOrResponse: async () => ({ familyId: PARENT_FAMILY, userId: PARENT_USER }),
    provaEntitlement: (async () => ({ plan: "plus" })) as unknown as typeof defaults.provaEntitlement,
    resolveAi: (async () => ({
      model: "synthetic-model",
      promptVersion: "test",
      maxInputTokens: 5000,
      maxOutputTokens: 100,
    })) as unknown as typeof defaults.resolveAi,
    apiKeyOrResponse: () => "synthetic-key",
    provaDocument: (async () => {
      documents++;
      return { media: [{ type: "text", text: "SYNTHETIC" }], id: source, sha256: "a".repeat(64), pages: 1 };
    }) as unknown as typeof defaults.provaDocument,
    logUsage: (async () => {
      usage++;
    }) as unknown as typeof defaults.logUsage,
  };
  return { deps, rpcs, jobs, documents: () => documents, usage: () => usage };
}

const body = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ source_id: source, child_id: child, ai_consent: true, locale: "tr", ...extra });
const request = (extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Request("https://local.test", { method: "POST", headers, body: body(extra) });

async function withProvider(test: (requests: string[]) => Promise<void>) {
  const original = globalThis.fetch, requests: string[] = [];
  globalThis.fetch = (input) => {
    requests.push(String(input));
    const url = String(input);
    const payload = url.includes("count_tokens")
      ? { input_tokens: 50 }
      : {
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify({ lessons: [lesson], warnings: [] }) }],
        usage: { input_tokens: 50, output_tokens: 10 },
      };
    return Promise.resolve(new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } }));
  };
  try {
    await test(requests);
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("U08 timetable: session_expired, unauthorized and forbidden stay distinct and touch nothing", async () => {
  for (const c of authCases()) {
    const f = fixture();
    f.deps.parentOrResponse = (r: Request) => parentOrResponse(r, c.db);
    const res = await handleTimetableImport(request({}, c.authorization ? { authorization: c.authorization } : {}), f.deps);
    await expectContract(res, c.status, c.code, c.category);
    assertEquals(f.rpcs.length, 0, c.name);
    assertEquals(f.documents(), 0);
  }
});

Deno.test("U08 timetable: validation, availability and archive errors use the shared body", async () => {
  await expectContract(await handleTimetableImport(request({ ai_consent: false }), fixture().deps), 400, "source_ai_consent_required", "validation");
  await expectContract(await handleTimetableImport(request({ child_id: "x" }), fixture().deps), 400, "invalid_input", "validation");
  await expectContract(
    await handleTimetableImport(new Request("https://local.test", { method: "GET" }), fixture().deps),
    405,
    "method_not_allowed",
  );
  await expectContract(await handleTimetableImport(request(), fixture({ sourcesEnabled: false }).deps), 503, "source_unavailable", "service_unavailable");
  await expectContract(await handleTimetableImport(request(), fixture({ archived: true }).deps), 409, "child_archived", "conflict");
  const noPolicy = fixture({ policy: false });
  await expectContract(await handleTimetableImport(request(), noPolicy.deps), 402, "ai_disabled", "service_unavailable");
  assertEquals(noPolicy.documents(), 0);
});

Deno.test("U08 timetable: shared source limit rejection stops before reservation and provider", async () => {
  const f = fixture();
  f.deps.provaDocument = (async () =>
    fail("source_file_limit", 400, { details: { max_files: 3, selected: 4, remaining: 0 } })) as unknown as typeof defaults.provaDocument;
  await withProvider(async (requests) => {
    const res = await handleTimetableImport(request(), f.deps);
    const out = await expectContract(res, 400, "source_file_limit", "validation");
    assertEquals(out.details, { max_files: 3, selected: 4, remaining: 0 });
    assertEquals(requests.length, 0);
    assert(!f.rpcs.some((r) => r.name === "reserve_child_ai_operation"));
  });
});

Deno.test("U08 timetable: same request repeated runs one paid provider job", async () => {
  const f = fixture();
  await withProvider(async (requests) => {
    const first = await handleTimetableImport(request(), f.deps);
    const second = await handleTimetableImport(request(), f.deps);
    assertEquals(first.status, 200);
    assertEquals(second.status, 200);
    assertEquals(await second.json(), await first.json());
    // count_tokens + messages = tek ücretli çağrı.
    assertEquals(requests.filter((u) => !u.includes("count_tokens")).length, 1);
    assertEquals(f.jobs.size, 1);
    assertEquals(f.rpcs.filter((r) => r.name === "reserve_child_ai_operation").length, 2);
    assertEquals(f.rpcs.filter((r) => r.name === "finish_ai_operation").length, 1);
  });
});
