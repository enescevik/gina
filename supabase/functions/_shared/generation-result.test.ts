import { assert, assertEquals } from "jsr:@std/assert";
import {
  type GenerationContext,
  recoverGeneration,
} from "./generation-result.ts";
import { serviceClient } from "./supabase.ts";
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
    assertEquals(await response.json(), { error });
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
  assertEquals(await response.json(), { error: "generation_not_started" });
  assertEquals(f.calls.length, 1);
});
