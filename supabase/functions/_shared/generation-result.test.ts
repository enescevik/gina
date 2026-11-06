import { assert, assertEquals } from "jsr:@std/assert";
import {
  type GenerationContext,
  recoverGeneration,
} from "./generation-result.ts";
import { serviceClient } from "./supabase.ts";
import { isContractBody } from "./error-contract.ts";
const parent = { familyId: "family", userId: "actor" };
const context: GenerationContext = {
  schema: "gina.generation-context.v1",
  subject: "Fen",
  grade: 5,
  total: 1,
  topics: [{ topic: "Isı", count: 1 }],
  kind: "open_ended",
  difficulty: "orta",
  locale: "tr",
  scenarioCode: null,
  blueprintSource: null,
  blueprintSnapshot: null,
  draftScope: { id: "draft", version: 3, purpose: "written" },
  document: null,
  ai: {
    model: "original-model",
    maxOutputTokens: 2000,
    promptVersion: "original-settings",
  },
  promptVersion: "original-deploy",
  promptHash: "a".repeat(64),
  systemPrompt: "Original system",
  userPrompt: '{"scope":"original"}',
  catalogueBound: false,
};
const result = {
  output: {
    questions: [{
      topic: "Isı",
      kind: "open_ended",
      difficulty: "orta",
      stem: "Isı nedir?",
      choices: [],
      correct_key: "",
      distractor_notes: [],
      expected_answer: "Enerji aktarımı",
      solution: "Açıklama",
      explanation: "Detay",
      source_urls: [],
    }],
  },
  inputTokens: 10,
  outputTokens: 20,
};
function fixture(recovery: unknown, error: { code?: string } | null = null) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return name === "resume_prova_generation"
        ? { data: recovery, error }
        : { data: { ok: true, questions: ["saved"] }, error: null };
    },
    from: () => {
      throw Error("Mutable settings or draft must not be read");
    },
  } as unknown as ReturnType<typeof serviceClient>;
  return { db, calls };
}
Deno.test("completed request recovered without mutable model, quota, document or draft reads", async () => {
  const f = fixture({ cached: { ok: true, questions: ["old"] } });
  const response = await recoverGeneration(f.db, parent, "id", {
    subject: "Fen",
  });
  assert(response);
  assertEquals(await response.json(), { ok: true, questions: ["old"] });
  assertEquals(f.calls.length, 1);
  assertEquals(f.calls[0].args.p_user_id, "actor");
});
Deno.test("saved provider output finishes with original source/model/prompt even after deployment changes", async () => {
  const f = fixture({ context, provider_result: result, lease: "lease" });
  const response = await recoverGeneration(f.db, parent, "id", {
    subject: "Fen",
  });
  assert(response);
  assertEquals(response.status, 200);
  const c = f.calls[1];
  assertEquals(c.name, "complete_prova_generation_v2");
  assertEquals(c.args.p_model, "original-model");
  assertEquals(c.args.p_prompt_version, "original-deploy");
  const rows = c.args.p_rows as {
    provenance: Record<string, unknown>;
    grade: number;
    subject: string;
  }[];
  assertEquals(rows[0].grade, 5);
  assertEquals(rows[0].subject, "Fen");
  assertEquals(rows[0].provenance.prompt, {
    system: "Original system",
    user: { scope: "original" },
  });
  assertEquals(rows[0].provenance.draft_version, 3);
});
for (
  const error of [
    "generation_in_progress",
    "ai_result_uncertain",
    "generation_failed_safe",
    "generation_cancelled",
    "generation_legacy_request",
    "request_conflict",
  ]
) {
  Deno.test("recovery never starts provider on " + error, async () => {
    const f = fixture({ error });
    const response = await recoverGeneration(f.db, parent, "id", {});
    assert(response);
    assertEquals(response.status, 409);
    // C08: ortak sözleşme gövdesi; eski `error` alanı aynı kod.
    const body = await response.json();
    assertEquals(body.error, error);
    assert(isContractBody(body));
    assertEquals(f.calls.length, 1);
  });
}
Deno.test("unknown request has no side effect", async () => {
  const f = fixture(null);
  assertEquals(await recoverGeneration(f.db, parent, "id", {}), null);
  assertEquals(f.calls.length, 1);
});
Deno.test("changed output cannot be applied to frozen distribution", async () => {
  const f = fixture({
    context,
    lease: "lease",
    provider_result: { ...result, output: { questions: [] } },
  });
  const response = await recoverGeneration(f.db, parent, "id", {});
  assert(response);
  assertEquals(response.status, 502);
  assertEquals(f.calls.length, 1);
});
Deno.test("recovery data failure does not fall through to another paid request", async () => {
  const f = fixture(null, { code: "network" });
  const response = await recoverGeneration(f.db, parent, "id", {});
  assert(response);
  assertEquals(response.status, 503);
  assertEquals(f.calls.length, 1);
});
Deno.test("foreign request denied without applying result", async () => {
  const f = fixture(null, { code: "42501" });
  const response = await recoverGeneration(f.db, parent, "id", {});
  assert(response);
  assertEquals(response.status, 403);
  assertEquals(f.calls.length, 1);
});

Deno.test("check-only unknown request cannot fall through to paid generation", async () => {
  const f = fixture(null);
  const response = await recoverGeneration(f.db, parent, "id", {}, true);
  assert(response);
  assertEquals(response.status, 409);
  assertEquals((await response.json()).error, "generation_not_started");
  assertEquals(f.calls.length, 1);
});

import { validateGenerationResult } from "./generation-result.ts";
const scenarioContext: GenerationContext = {
  ...context,
  subject: "Matematik",
  total: 3,
  topics: [{ topic: "Blok 1", count: 2 }, { topic: "Blok 2", count: 1 }],
  kind: "mixed",
  catalogueBound: true,
  scenario: {
    scenario_version: "cat@2:abcdef012345",
    catalogue_id: "cat",
    revision: 2,
    content_hash: "abcdef012345".repeat(5) + "abcd",
    source: { url: "https://cdn.eba.gov.tr/x.xlsx", sha256: "d".repeat(64), sheet: "5. Sınıf", header_cell: "D6" },
    blocks: [
      { block_id: "B1", topic: "Blok 1", count: 2, outcome_ids: ["MAT.5.3.1", "MAT.5.3.2"], source_cells: { sheet: "5. Sınıf", count_cell: "D7", outcome_cells: ["C7", "C8"] } },
      { block_id: "B2", topic: "Blok 2", count: 1, outcome_ids: ["MAT.5.3.3"], source_cells: { sheet: "5. Sınıf", count_cell: "D9", outcome_cells: ["C9"] } },
    ],
  },
};
const rubric = { criteria: [{ text: "Doğru işlem sırası", points: 2 }, { text: "Sonuç", points: 1 }], alternative_answers: ["12 cm"] };
const q = (over: Record<string, unknown>) => ({
  topic: "Blok 1", kind: "open_ended", difficulty: "orta", stem: "Soru", choices: [], correct_key: "", distractor_notes: [],
  expected_answer: "Cevap", solution: "Çözüm", explanation: "", source_urls: [],
  block_id: "B1", outcome_ids: ["MAT.5.3.1"], question_type: "acik_uclu", cognitive_demand: "uygulama", intended_difficulty: "orta", rubric, shared_source_id: "",
  ...over,
});
const mc = (over: Record<string, unknown>) =>
  q({ kind: "multiple_choice", question_type: "coktan_secmeli", choices: ["A", "B", "C", "D"].map((k) => ({ key: k, text: k + " metni" })), correct_key: "B", rubric: { criteria: [], alternative_answers: [] }, ...over });
const good = () => ({ output: { shared_sources: [] as { id: string; kind: string; content: string }[], questions: [q({}), q({ outcome_ids: ["MAT.5.3.1", "MAT.5.3.2"] }), mc({ topic: "Blok 2", block_id: "B2", outcome_ids: ["MAT.5.3.3"] })] }, inputTokens: 1, outputTokens: 1 });
// deno-lint-ignore no-explicit-any
const check = (r: any, c = scenarioContext) => validateGenerationResult(r, c);
const rejects = (r: unknown, c = scenarioContext, why = "") => {
  let threw = false;
  try {
    check(r, c);
  } catch (e) {
    threw = e instanceof Error && e.message === "ai_result_invalid";
  }
  assert(threw, "should reject " + why);
};
Deno.test("catalogue-bound questions carry block, outcome subset, type/demand vocabulary and rubric", () => {
  const r = good();
  check(r);
  assertEquals(r.output.questions.filter((x) => x.topic === "Blok 1").length, 2, "a question measuring two outcomes still counts once");
});
Deno.test("scenario trace rejections: wrong block, foreign outcome, empty outcomes, type mismatch, missing rubric, bad vocab", () => {
  for (
    const over of [
      { block_id: "B2" },
      { block_id: "" },
      { outcome_ids: ["MAT.5.3.3"] },
      { outcome_ids: [] },
      { outcome_ids: ["MAT.5.3.1", "MAT.5.3.1"] },
      { question_type: "coktan_secmeli" },
      { question_type: "essay" },
      { cognitive_demand: "guessing" },
      { intended_difficulty: "impossible" },
      { rubric: { criteria: [], alternative_answers: [] } },
      { rubric: { criteria: [{ text: "", points: 1 }] } },
      { rubric: { criteria: [{ text: "x", points: 0 }] } },
      { shared_source_id: "ghost" },
    ]
  ) {
    const r = good();
    r.output.questions[0] = q(over);
    rejects(r, scenarioContext, JSON.stringify(over));
  }
  const extra = good();
  extra.output.questions.push(q({}));
  rejects(extra, scenarioContext, "block count multiplied");
});
Deno.test("shared passage is one identity: must be used, linked questions counted separately, dangling refs refused", () => {
  const r = good();
  r.output.shared_sources = [{ id: "P1", kind: "text", content: "Ortak metin" }];
  r.output.questions[0] = q({ shared_source_id: "P1" });
  r.output.questions[1] = q({ shared_source_id: "P1", outcome_ids: ["MAT.5.3.2"] });
  check(r);
  const unused = good();
  unused.output.shared_sources = [{ id: "P1", kind: "text", content: "Ortak metin" }];
  rejects(unused, scenarioContext, "unused shared source");
  const dup = good();
  dup.output.shared_sources = [{ id: "P1", kind: "text", content: "a" }, { id: "P1", kind: "text", content: "b" }];
  dup.output.questions[0] = q({ shared_source_id: "P1" });
  rejects(dup, scenarioContext, "duplicate shared id");
});
Deno.test("without a scenario the new fields stay optional and old outputs remain valid", () => {
  const legacy = { ...context, total: 1, topics: [{ topic: "Isı", count: 1 }] };
  check(result, legacy);
  const loose = { output: { questions: [{ ...result.output.questions[0], block_id: "", outcome_ids: [], question_type: "", cognitive_demand: "", intended_difficulty: "", rubric: { criteria: [], alternative_answers: [] }, shared_source_id: "" }], shared_sources: [] }, inputTokens: 1, outputTokens: 1 };
  check(loose, legacy);
  const typed = { output: { questions: [{ ...result.output.questions[0], question_type: "coktan_secmeli" }] }, inputTokens: 1, outputTokens: 1 };
  rejects(typed, legacy, "type/kind consistency applies even without a scenario");
});
Deno.test("saved rows carry the question → outcome → block → source version trace", async () => {
  const f = fixture({ context: scenarioContext, provider_result: good(), lease: "lease" });
  const response = await recoverGeneration(f.db, parent, "id", {});
  assert(response);
  assertEquals(response.status, 200);
  const rows = f.calls[1].args.p_rows as { provenance: Record<string, unknown>; topic: string }[];
  assertEquals(rows.length, 3);
  assertEquals(rows[0].provenance.scenario_version, "cat@2:abcdef012345");
  assertEquals(rows[0].provenance.block_id, "B1");
  assertEquals(rows[0].provenance.outcome_ids, ["MAT.5.3.1"]);
  assertEquals(rows[0].provenance.source_sha256, "d".repeat(64));
  assertEquals(rows[0].provenance.source_cells, { sheet: "5. Sınıf", count_cell: "D7", outcome_cells: ["C7", "C8"] });
  assertEquals(rows[0].provenance.question_type, "acik_uclu");
  assertEquals(rows[0].provenance.cognitive_demand, "uygulama");
  assertEquals(rows[0].provenance.intended_difficulty, "orta");
  assertEquals(rows[0].provenance.rubric, rubric);
  assertEquals(rows[0].provenance.content_fit, "pending_human_review", "a code label is not proof of content fit");
  assertEquals(rows[2].provenance.block_id, "B2");
  assertEquals("rubric" in rows[2].provenance, false, "empty rubric placeholder not stored");
});
