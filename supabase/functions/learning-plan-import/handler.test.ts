import { handleLearningPlanImport } from "./handler.ts";
const id = "00000000-0000-4000-8000-000000009101",
  child = "00000000-0000-4000-8000-000000009102",
  source = "00000000-0000-4000-8000-000000009103";
const draft = {
  items: [{
    kind: "homework",
    title: "Kesirler",
    subject: "Matematik",
    topic: "",
    due_on: null,
    time: null,
    steps: [],
    page: 1,
    note: "",
  }],
  warnings: [],
};
function fixture(
  options: {
    cached?: boolean;
    deleted?: boolean;
    hash?: string;
    parent?: boolean;
  } = {},
) {
  let calls = 0, documents = 0, resolves = 0;
  const args: unknown[] = [];
  const view = {
    id,
    child_id: child,
    source_id: source,
    locale: "tr",
    grade: 5,
    status: options.cached ? "done" : "new",
    draft: options.cached ? draft : null,
    applied: {},
  };
  const context = {
    config: { model: "frozen", maxOutputTokens: 4000, promptVersion: "v1" },
    system: "saved system",
    schema: { type: "object" },
    input: { grade: 5, locale: "tr" },
    sha256: "a".repeat(64),
    pages: 1,
  };
  const deps = {
    db: {
      rpc: async (name: string, input: unknown) => {
        args.push([name, input]);
        if (options.deleted && calls) {
          return { data: null, error: { message: "source_not_ready" } };
        }
        return { data: { id, context, view }, error: null };
      },
    },
    parent: async () =>
      options.parent === false
        ? null
        : { familyId: "family", userId: "parent" },
    key: () => "synthetic-key",
    resolve: async () => {
      resolves++;
      throw Error("must use frozen context");
    },
    document: async () => {
      documents++;
      return { id: source, sha256: options.hash ?? context.sha256, media: [] };
    },
    run: async (...a: unknown[]) => {
      args.push(a);
      calls++;
      view.status = "done";
      view.draft = draft;
      return { jobId: id, output: draft, inputTokens: 1, outputTokens: 1 };
    },
  } as unknown as Parameters<typeof handleLearningPlanImport>[1];
  return {
    deps,
    args,
    count: () => ({ calls, documents, resolves }),
    request: (extra = {}) =>
      new Request("https://local.invalid", {
        method: "POST",
        body: JSON.stringify({
          child_id: child,
          source_id: source,
          locale: "tr",
          ai_consent: true,
          ...extra,
        }),
      }),
  };
}
Deno.test("learning import: no consent means no document or provider access", async () => {
  const f = fixture();
  const r = await handleLearningPlanImport(
    f.request({ ai_consent: false }),
    f.deps,
  );
  if (r.status !== 400 || f.args.length) throw Error();
});
Deno.test("learning import: child or anonymous cannot access extractor", async () => {
  const f = fixture({ parent: false });
  const r = await handleLearningPlanImport(f.request(), f.deps);
  if (r.status !== 403 || f.args.length) throw Error();
});
Deno.test("learning import: reject client grade and arbitrary URL", async () => {
  for (const extra of [{ grade: 12 }, { url: "https://secret.invalid" }]) {
    const f = fixture();
    const r = await handleLearningPlanImport(f.request(extra), f.deps);
    if (r.status !== 400 || f.args.length) throw Error();
  }
});
Deno.test("learning import: cached output avoids download and paid call", async () => {
  const f = fixture({ cached: true });
  const r = await handleLearningPlanImport(f.request(), f.deps);
  if (r.status !== 200 || Object.values(f.count()).some(Boolean)) throw Error();
});
Deno.test("learning import: original model and server grade reused", async () => {
  const f = fixture();
  const r = await handleLearningPlanImport(f.request(), f.deps);
  const a = f.args.find((a) =>
    Array.isArray(a) && a[2] === "learning_import"
  ) as unknown[];
  if (
    r.status !== 200 || f.count().calls !== 1 || !a ||
    JSON.stringify(a[7]) !==
      JSON.stringify([{
        type: "text",
        text: JSON.stringify({ grade: 5, locale: "tr" }),
      }]) ||
    JSON.stringify(a[5]) !==
      JSON.stringify({
        model: "frozen",
        maxOutputTokens: 4000,
        promptVersion: "v1",
      })
  ) throw Error();
});
Deno.test("learning import: changed bytes never reach provider", async () => {
  const f = fixture({ hash: "b".repeat(64) });
  const r = await handleLearningPlanImport(f.request(), f.deps);
  if (r.status !== 409 || f.count().calls) throw Error();
});
Deno.test("learning import: deletion during paid response cannot resurrect draft", async () => {
  const f = fixture({ deleted: true });
  const r = await handleLearningPlanImport(f.request(), f.deps);
  if (r.status !== 409) throw Error();
});
