import { defaults, setupSuggestions } from "./handler.ts";
import { assert, assertEquals } from "jsr:@std/assert";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = {
  request_id: id(1),
  kind: "task",
  grade: 5,
  interests: ["reading"],
  source_id: id(2),
  source_ai_consent: true,
};
const request = (body: unknown = input) =>
  new Request("https://local.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
function fixture() {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let paid = 0;
  const output = {
    suggestions: [{
      title: "Oku",
      reason: "Belgedeki okuma etkinliği",
      stars: 1,
      icon: "read-book",
    }],
    document_notes: "Günleri birlikte seçin.",
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return {
      data: name === "get_setup_ai_entitlement"
        ? { limit: 10, remaining: 10, plan: "plus" }
        : name === "reserve_setup_generation"
        ? { ok: true }
        : true,
      error: null,
    };
  };
  const db = { rpc } as unknown as ReturnType<typeof defaults.serviceClient>;
  const deps = {
    ...defaults,
    serviceClient: () => db,
    readParent: async () => ({ familyId: id(3), userId: id(4) }),
    resolveAi: async () => ({}),
    apiKeyOrResponse: () => "synthetic",
    provaDocument: async (...args: unknown[]) => {
      calls.push({
        name: "document",
        args: { consent: args[5], purpose: args[6] },
      });
      return {
        media: [{ type: "text", text: "SYNTHETIC DOCUMENT" }],
        id: id(2),
        sha256: "a".repeat(64),
      };
    },
    callClaude: async (...args: unknown[]) => {
      paid++;
      calls.push({
        name: "model",
        args: { system: args[2], content: args[3] },
      });
      return { output };
    },
  } as unknown as typeof defaults;
  return { deps, db, calls, output, paid: () => paid, rpc };
}
Deno.test("setup document forwards verified media, purpose and server provenance", async () => {
  const f = fixture();
  const r = await setupSuggestions(
    request({ ...input, name: "PRIVATE" }),
    f.deps,
  );
  assertEquals(r.status, 200);
  const data = await r.json();
  assertEquals(data.suggestions[0].source_id, id(2));
  assertEquals(f.paid(), 1);
  assertEquals(f.calls.find((c) => c.name === "document")?.args, {
    consent: true,
    purpose: "setup",
  });
  assert(
    !JSON.stringify(f.calls.find((c) => c.name === "model")).includes(
      "PRIVATE",
    ),
  );
  const reserve = f.calls.find((c) => c.name === "reserve_setup_generation")!,
    finish = f.calls.find((c) => c.name === "finish_setup_generation")!;
  assertEquals(reserve.args.p_lease, finish.args.p_lease);
  assertEquals(finish.args.p_unknown, false);
});
Deno.test("setup auth rejection stops document and paid provider", async () => {
  const f = fixture();
  f.deps.readParent = async () => null;
  assertEquals((await setupSuggestions(request(), f.deps)).status, 403);
  assertEquals(f.calls, []);
});
Deno.test("document validation rejection stops reservation and provider", async () => {
  const f = fixture();
  f.deps.provaDocument = async () => new Response("{}", { status: 400 });
  assertEquals(
    (await setupSuggestions(
      request({ ...input, source_ai_consent: false }),
      f.deps,
    )).status,
    400,
  );
  assertEquals(f.paid(), 0);
  assertEquals(f.calls.map((c) => c.name), ["get_setup_ai_entitlement"]);
});
Deno.test("cached reply reuses output without paid provider", async () => {
  const f = fixture();
  f.db.rpc =
    ((name: string, args: Record<string, unknown>) =>
      name === "reserve_setup_generation"
        ? Promise.resolve({ data: { cached: f.output }, error: null })
        : f.rpc(name, args)) as unknown as typeof f.db.rpc;
  assertEquals((await setupSuggestions(request(), f.deps)).status, 200);
  assertEquals(f.paid(), 0);
});
for (
  const code of [
    "generation_in_progress",
    "ai_result_uncertain",
    "request_conflict",
    "ai_quota_exceeded",
  ]
) {
  Deno.test("reservation stops paid call: " + code, async () => {
    const f = fixture();
    f.db.rpc = ((name: string, args: Record<string, unknown>) =>
      name === "reserve_setup_generation"
        ? Promise.resolve({ data: { error: code }, error: null })
        : f.rpc(name, args)) as unknown as typeof f.db.rpc;
    const r = await setupSuggestions(request(), f.deps);
    assertEquals(r.status, code === "ai_quota_exceeded" ? 402 : 409);
    assertEquals(f.paid(), 0);
  });
}
Deno.test("provider timeout is marked unknown, never retried within request", async () => {
  const f = fixture();
  f.deps.callClaude = async () => {
    throw Error("PRIVATE PROVIDER ERROR");
  };
  const r = await setupSuggestions(request(), f.deps);
  assertEquals(r.status, 502);
  assertEquals(await r.json(), { error: "ai_result_uncertain" });
  assertEquals(f.calls.at(-1)?.args.p_unknown, true);
});
Deno.test("late or lost completion is uncertain without overwriting prior state", async () => {
  for (const mode of ["false", "throw"]) {
    const f = fixture();
    let finishes = 0;
    f.db.rpc = ((name: string, args: Record<string, unknown>) => {
      if (name === "finish_setup_generation") {
        finishes++;
        if (mode === "throw") throw Error("lost");
        return Promise.resolve({ data: false, error: null });
      }
      return f.rpc(name, args);
    }) as unknown as typeof f.db.rpc;
    assertEquals((await setupSuggestions(request(), f.deps)).status, 503);
    assertEquals(finishes, 1);
  }
});
Deno.test("source identity participates in stable request hash", async () => {
  const a = fixture(), b = fixture();
  b.deps.provaDocument = async () => ({
    id: id(8),
    sha256: "b".repeat(64),
    media: [],
  });
  await setupSuggestions(request(), a.deps);
  await setupSuggestions(request(), b.deps);
  assert(
    a.calls.find((c) => c.name === "reserve_setup_generation")?.args.p_hash !==
      b.calls.find((c) => c.name === "reserve_setup_generation")?.args.p_hash,
  );
});
Deno.test("generic draft remains supported without document permission", async () => {
  const f = fixture();
  const r = await setupSuggestions(
    request({ request_id: id(1), kind: "task" }),
    f.deps,
  );
  assertEquals(r.status, 200);
  assert(!f.calls.some((c) => c.name === "document"));
  assertEquals((await r.json()).suggestions[0].source_id, undefined);
});
