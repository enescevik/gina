import { json, serviceClient } from "./supabase.ts";
import {
  type AiConfig,
  type AiResult,
  DIFFICULTIES,
  type Difficulty,
  officialUrls,
} from "./prova.ts";
export interface GeneratedQuestion {
  topic: string;
  kind: "multiple_choice" | "open_ended";
  difficulty: Difficulty;
  stem: string;
  choices: { key: string; text: string }[];
  correct_key: string;
  distractor_notes: { key: string; why: string }[];
  expected_answer: string;
  solution: string;
  explanation: string;
  source_urls: string[];
}

export type GenerationContext = {
  schema: "gina.generation-context.v1";
  subject: string;
  grade: number;
  total: number;
  topics: { topic: string; count: number }[];
  kind: "mixed" | "multiple_choice" | "open_ended";
  difficulty: Difficulty;
  locale: "tr" | "en";
  scenarioCode: string | null;
  blueprintSource: string | null;
  blueprintSnapshot: Record<string, unknown> | null;
  draftScope: { id: string; version: number; purpose: unknown } | null;
  document: { id: string; sha256: string } | null;
  ai: AiConfig;
  promptVersion: string;
  promptHash: string;
  systemPrompt: string;
  userPrompt: string;
  catalogueBound: boolean;
};
export function validateGenerationResult(
  result: AiResult<{ questions: GeneratedQuestion[] }>,
  context: GenerationContext,
) {
  const { total, topics, kind } = context;
  const questions = result?.output?.questions;
  if (
    !Array.isArray(questions) || questions.length !== total ||
    questions.some((q) =>
      !q || typeof q.stem !== "string" || !q.stem.trim() ||
      q.stem.length > 10000 ||
      typeof q.expected_answer !== "string" || !q.expected_answer.trim() ||
      typeof q.solution !== "string" || !q.solution.trim() ||
      typeof q.topic !== "string" || !topics.some((t) => t.topic === q.topic) ||
      !["multiple_choice", "open_ended"].includes(q.kind) ||
      (kind !== "mixed" && q.kind !== kind) ||
      (q.kind === "multiple_choice" &&
        (!Array.isArray(q.choices) || q.choices.length !== 4 ||
          new Set(q.choices.map((c) => c?.key)).size !== 4 ||
          q.choices.some((c) =>
            !c || !["A", "B", "C", "D"].includes(c.key) ||
            typeof c.text !== "string" || !c.text.trim()
          ) ||
          !q.choices.some((c) => c.key === q.correct_key))) ||
      (q.explanation !== undefined && typeof q.explanation !== "string") ||
      (q.distractor_notes !== undefined &&
        (!Array.isArray(q.distractor_notes) ||
          q.distractor_notes.some((n) =>
            !n || typeof n.key !== "string" || typeof n.why !== "string"
          )))
    ) ||
    topics.some((t) =>
      questions.filter((q) => q.topic === t.topic).length !== t.count
    )
  ) throw new Error("ai_result_invalid");
}
export async function finishGeneration(
  db: ReturnType<typeof serviceClient>,
  parent: { familyId: string; userId: string },
  requestId: string,
  lease: string,
  context: GenerationContext,
  result: AiResult<{ questions: GeneratedQuestion[] }>,
) {
  if (context.schema !== "gina.generation-context.v1") {
    return json({ error: "generation_context_unsupported" }, 409);
  }
  try {
    validateGenerationResult(result, context);
  } catch {
    return json({ error: "ai_result_invalid" }, 502);
  }
  const {
    total,
    kind,
    topics,
    grade,
    subject,
    scenarioCode,
    difficulty,
    locale,
    blueprintSource,
    blueprintSnapshot,
    draftScope,
    document,
    ai,
    promptHash,
    userPrompt,
  } = context;
  const createdAt = new Date().toISOString();
  const rows = (result.output.questions ?? [])
    .slice(0, total)
    .filter((q) => q.stem?.trim())
    .filter((q) => kind === "mixed" || q.kind === kind)
    .map((q) => {
      const isMc = q.kind === "multiple_choice";
      const choices = isMc ? (q.choices ?? []).slice(0, 4) : null;
      const validMc = isMc && choices?.length === 4 &&
        new Set(choices.map((c) => c.key)).size === 4 && choices.every((c) =>
          ["A", "B", "C", "D"].includes(c.key) && c.text?.trim()
        ) && choices.some((c) =>
          c.key === q.correct_key
        );
      const notes = isMc && q.distractor_notes?.length
        ? `\n\n${locale === "tr" ? "Çeldiriciler" : "Distractors"}: ${
          q.distractor_notes.map((d) => `${d.key}) ${d.why}`).join(" ")
        }`
        : "";
      const sources = officialUrls(blueprintSource ? [blueprintSource] : []);
      return {
        valid: !!q.expected_answer?.trim() && !!q.solution?.trim() &&
          (isMc ? validMc : q.kind === "open_ended"),
        row: {
          family_id: parent.familyId,
          grade,
          subject,
          topic: q.topic?.trim() || topics[0].topic,
          scenario_code: scenarioCode,
          kind: q.kind,
          difficulty: DIFFICULTIES.includes(q.difficulty)
            ? q.difficulty
            : difficulty,
          stem: q.stem.trim(),
          choices,
          correct_key: isMc ? q.correct_key : null,
          expected_answer: q.expected_answer?.trim() || null,
          solution: q.solution?.trim() || null,
          explanation: ((q.explanation?.trim() ?? "") + notes).trim() || null,
          source_urls: [...new Set(sources)],
          provenance: {
            generator: "ai",
            ...(blueprintSnapshot ? { blueprint: blueprintSnapshot } : {}),
            ...(draftScope
              ? { draft_id: draftScope.id, draft_version: draftScope.version }
              : {}),
            ...(document
              ? {
                document_source_id: document.id,
                document_sha256: document.sha256,
              }
              : {}),
            model: ai.model,
            prompt_version: context.promptVersion,
            settings_prompt_version: ai.promptVersion,
            prompt_hash: promptHash,
            prompt: {
              system: context.systemPrompt,
              user: JSON.parse(userPrompt),
            },
            requested_by: parent.userId,
            created_at: createdAt,
          },
          created_by: parent.userId,
        },
      };
    })
    .filter((x) => x.valid)
    .map((x) => x.row);

  if (rows.length !== total) return json({ error: "generation_empty" }, 502);
  const { data: completed, error: saveError } = await db.rpc(
    "complete_prova_generation_v2",
    {
      p_id: requestId,
      p_lease: lease,
      p_rows: rows,
      p_model: ai.model,
      p_prompt_version: context.promptVersion,
      p_input: result.inputTokens,
      p_output: result.outputTokens,
    },
  );
  // A transport failure may follow a successful commit: keep the job for a same-ID retry.
  if (saveError) return json({ error: "save_failed" }, 500);
  return json(completed);
}
/** Resume persisted work before reading mutable plan/model/draft settings; never invokes a provider. */
export async function recoverGeneration(
  db: ReturnType<typeof serviceClient>,
  parent: { familyId: string; userId: string },
  requestId: string,
  intent: Record<string, unknown>,
  only = false,
) {
  const { data, error } = await db.rpc("resume_prova_generation", {
    p_id: requestId,
    p_family_id: parent.familyId,
    p_user_id: parent.userId,
    p_intent: intent,
  });
  if (error) {
    return json(
      { error: error.code === "42501" ? "forbidden" : "data_failed" },
      error.code === "42501" ? 403 : 503,
    );
  }
  if (!data) {
    return only ? json({ error: "generation_not_started" }, 409) : null;
  }
  if (data.cached) return json(data.cached);
  if (data.error) return json({ error: data.error }, 409);
  if (!data.lease || !data.context || !data.provider_result) {
    return json({ error: "ai_result_uncertain" }, 503);
  }
  return finishGeneration(
    db,
    parent,
    requestId,
    data.lease,
    data.context,
    data.provider_result,
  );
}
