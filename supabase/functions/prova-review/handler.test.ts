import { createReviewHandler } from "./index.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
const attempt = "10000000-0000-4000-8000-000000000001",
  question = "20000000-0000-4000-8000-000000000001",
  hash = "a".repeat(64);
const d5Table = "Cisim | Dinamometre (N)\nA | 4\nB | 7\nC | 10";
const report = {
  score: 80,
  readable: true,
  feedback: "İşlemi doğru kurmuşsun.",
  evidence: ["Doğru işlem"],
  next_step: "Birimini kontrol et.",
  limitation: "",
};
function fixture(
  changes: {
    auth?: boolean;
    gate?: boolean;
    owned?: boolean;
    status?: string;
    hash?: string;
    cached?: boolean;
    consentError?: boolean;
    providerError?: boolean;
    group?: boolean;
  } = {},
) {
  const operations: string[] = [], writes: Record<string, unknown>[] = [];
  const sent: unknown[] = [];
  let fingerprints = 0;
  const db = {
    from(table: string) {
      operations.push(table);
      const builder = {
        select() {
          return builder;
        },
        eq(key: string, value: unknown) {
          operations.push(`${table}:${key}=${value}`);
          return builder;
        },
        upsert(value: Record<string, unknown>) {
          writes.push({ table, ...value });
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(result());
        },
        single() {
          return Promise.resolve(result());
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      function result() {
        if (table === "app_settings") {
          return { data: { value: changes.gate ?? true }, error: null };
        }
        if (table === "exam_attempts") {
          return {
            data: changes.owned === false ? null : {
              id: attempt,
              status: changes.status ?? "graded",
              exam_id: "exam",
            },
            error: null,
          };
        }
        if (table === "exams") {
          return {
            data: { question_ids: [question], grade: 5, subject: "Matematik" },
            error: null,
          };
        }
        if (table === "question_bank") {
          return {
            data: {
              kind: "open_ended",
              stem: changes.group
                ? `Ortak tablo\n${d5Table}\n\nTablodaki cisimlerden hangisine en büyük kuvvet uygulanmıştır?`
                : "Çevresi kaçtır?",
              expected_answer: "28",
              solution: "2(8+6)",
            },
            error: null,
          };
        }
        if (table === "question_source_members") {
          // D1 grup sözleşmesi: üyenin gövdesi `başlık\nortak metin\n\nsoru`, prompt yalnız soru.
          return {
            data: changes.group
              ? {
                question_id: question,
                prompt: "Tablodaki cisimlerden hangisine en büyük kuvvet uygulanmıştır?",
                source_group: { id: "group-1", title: "Ortak tablo", body: d5Table },
              }
              : null,
            error: null,
          };
        }
        if (table === "exam_answers") {
          return {
            data: { answer_document: { original: true }, answer_text: "28" },
            error: null,
          };
        }
        if (table === "answer_review_consents") {
          return { error: changes.consentError ? { message: "failed" } : null };
        }
        if (table === "answer_review_suggestions") {
          return {
            data: changes.cached || writes.some((w) => w.table === table)
              ? { id: "suggestion", result: report }
              : null,
            error: null,
          };
        }
        throw new Error(`unexpected ${table}`);
      }
      return builder;
    },
    rpc(name: string) {
      if (name !== "review_answer_fingerprint") {
        throw new Error("unexpected write RPC");
      }
      fingerprints++;
      return Promise.resolve({ data: changes.hash ?? hash, error: null });
    },
  } as unknown as SupabaseClient;
  let rendered = 0, provider = 0;
  const handler = createReviewHandler({
    serviceClient: () => db,
    readParent: () =>
      Promise.resolve(
        changes.auth === false
          ? null
          : { familyId: "family", userId: "parent" },
      ),
    provaEntitlement: () =>
      Promise.resolve({ ai_grading: true, plan: "plus" } as never),
    resolveAi: () =>
      Promise.resolve(
        { model: "test", maxTokens: 2500, promptVersion: "test" } as never,
      ),
    apiKeyOrResponse: () => "test-only-key",
    questionImages: () => Promise.resolve([]),
    renderReviewNotebook: (_db, _family, _q, document) => {
      if (!(document as { original: boolean }).original) {
        throw new Error("not original");
      }
      rendered++;
      return Promise.resolve(new Uint8Array([137, 80, 78, 71]));
    },
    runAiOperation: (...args) => {
      provider++;
      sent.push(args[7]);
      if (!writes.some((w) => w.table === "answer_review_consents")) {
        throw new Error("no recorded consent");
      }
      if (JSON.stringify(args[7]).includes("injected-parent-layer")) {
        throw new Error("parent notes sent to AI");
      }
      return Promise.resolve(
        changes.providerError
          ? new Response('{"error":"ai_result_uncertain"}', { status: 502 })
          : { output: report, jobId: "job" } as never,
      );
    },
  });
  const request = (
    body: unknown = {
      attempt_id: attempt,
      question_id: question,
      answer_hash: hash,
      consent: true,
      answer_document: "injected-parent-layer",
    },
  ) =>
    handler(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  return {
    request,
    operations,
    writes,
    sent,
    stats: () => ({ rendered, provider, fingerprints }),
  };
}
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
Deno.test("review handler: unauthenticated, disabled and foreign attempts never render/send", async () => {
  for (
    const [options, status] of [
      [{ auth: false }, 403],
      [{ gate: false }, 503],
      [{ owned: false }, 404],
      [{ status: "in_progress" }, 409],
      [{ hash: "b".repeat(64) }, 409],
    ] as const
  ) {
    const f = fixture(options);
    assert((await f.request()).status === status, "wrong denial");
    assert(
      f.stats().provider === 0 && f.stats().rendered === 0,
      "sent private content",
    );
  }
});
Deno.test("review handler: explicit consent required and consent failure blocks provider", async () => {
  const f = fixture();
  assert(
    (await f.request({
      attempt_id: attempt,
      question_id: question,
      answer_hash: hash,
      consent: false,
    })).status === 400,
    "consent bypass",
  );
  const failed = fixture({ consentError: true });
  assert(
    (await failed.request()).status === 500 && failed.stats().provider === 0,
    "missing durable consent",
  );
});
Deno.test("review handler: stored original only, family scoped, suggestion only; no score write", async () => {
  const f = fixture();
  const response = await f.request();
  assert(response.status === 200, await response.text());
  assert(
    f.stats().rendered === 1 && f.stats().provider === 1 &&
      f.stats().fingerprints === 2,
    "missing render/revision checks",
  );
  assert(
    f.operations.includes("exam_attempts:family_id=family"),
    "missing ownership scope",
  );
  assert(
    f.writes.every((w) =>
      ["answer_review_consents", "answer_review_suggestions"].includes(
        String(w.table),
      )
    ),
    "wrote grade/answer",
  );
});
Deno.test("review handler: same answer cache skips renderer/provider; uncertain result never publishes", async () => {
  const cached = fixture({ cached: true });
  assert(
    (await cached.request()).status === 200 && cached.stats().provider === 0 &&
      cached.stats().rendered === 0,
    "cached answer charged again",
  );
  const failed = fixture({ providerError: true });
  assert((await failed.request()).status === 502, "provider failure hidden");
  assert(
    !failed.writes.some((w) => w.table === "answer_review_suggestions"),
    "published failed suggestion",
  );
});
Deno.test("D9: group question sends the shared table once in its own field and the member prompt as the question", async () => {
  const f = fixture({ group: true });
  const response = await f.request();
  assert(response.status === 200, await response.text());
  const user = f.sent[0] as { type: string; text?: string }[];
  const payload = JSON.parse(user[0].text!);
  assert(payload.ortak_kaynak?.baslik === "Ortak tablo", JSON.stringify(payload));
  assert(payload.ortak_kaynak.icerik === d5Table, "table rows must be sent verbatim");
  assert(payload.soru === "Tablodaki cisimlerden hangisine en büyük kuvvet uygulanmıştır?", payload.soru);
  assert(user[0].text!.split("Dinamometre").length === 2, "shared table sent more than once");
  const plain = fixture();
  await plain.request();
  const plainPayload = JSON.parse((plain.sent[0] as { text: string }[])[0].text);
  assert(!("ortak_kaynak" in plainPayload) && plainPayload.soru === "Çevresi kaçtır?", "ungrouped payload changed shape");
  assert(f.operations.includes(`question_source_members:question_id=${question}`), "member lookup not scoped to the question");
});
