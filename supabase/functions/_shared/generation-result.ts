import { fail } from "../_shared/error-contract.ts";
import { json, serviceClient } from "./supabase.ts";
import {
  type AiConfig,
  type AiResult,
  DIFFICULTIES,
  type Difficulty,
  officialUrls,
} from "./prova.ts";
import type { ScenarioProvenance } from "./catalogue-plan.ts";
export const QUESTION_TYPES = [
  "coktan_secmeli",
  "acik_uclu",
  "kisa_cevap",
  "dogru_yanlis",
  "bosluk_doldurma",
  "eslestirme",
] as const;
export const COGNITIVE_DEMANDS = [
  "hatirlama",
  "anlama",
  "uygulama",
  "analiz",
  "degerlendirme",
  "yaratma",
] as const;
export interface QuestionRubric {
  criteria: { text: string; points: number }[];
  alternative_answers?: string[];
}
export interface SharedSource {
  id: string;
  kind: "text" | "table" | "visual_description";
  content: string;
}
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
  /** Scenario provenance (optional, backward compatible; required when the job is catalogue-bound). */
  block_id?: string | null;
  outcome_ids?: string[] | null;
  question_type?: string | null;
  cognitive_demand?: string | null;
  intended_difficulty?: string | null;
  rubric?: QuestionRubric | null;
  shared_source_id?: string | null;
}
export interface GeneratedOutput {
  questions: GeneratedQuestion[];
  /** One entry per shared passage/table/visual; linked questions reference it and are counted separately. */
  shared_sources?: SharedSource[] | null;
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
  /** Present only for catalogue-bound jobs; comes from the private server binding via cataloguePlan. */
  scenario?: ScenarioProvenance | null;
};
const blank = (v: unknown) =>
  v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.length === 0);
const isStringList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max &&
  v.every((s) => typeof s === "string" && s.trim() && s.length <= 200);
function rubricValid(r: unknown): r is QuestionRubric {
  if (!r || typeof r !== "object") return false;
  const v = r as QuestionRubric;
  return Array.isArray(v.criteria) && v.criteria.length >= 1 &&
    v.criteria.length <= 20 &&
    v.criteria.every((c) =>
      c && typeof c.text === "string" && c.text.trim() && c.text.length <= 1000 &&
      typeof c.points === "number" && Number.isFinite(c.points) && c.points > 0 &&
      c.points <= 100
    ) &&
    (blank(v.alternative_answers) || isStringList(v.alternative_answers, 10));
}
/** Per-question scenario trace: block membership, outcome subset, type/demand vocab, rubric and shared source. */
export function validateQuestionProvenance(
  q: GeneratedQuestion,
  context: GenerationContext,
  sharedIds: Set<string>,
) {
  const scenario = context.scenario ?? null;
  const block = scenario?.blocks.find((b) => b.topic === q.topic) ?? null;
  if (scenario && !block) return false;
  if (!blank(q.block_id) && typeof q.block_id !== "string") return false;
  if (block && q.block_id !== block.block_id) return false;
  if (!blank(q.outcome_ids)) {
    if (!isStringList(q.outcome_ids, 20)) return false;
    if (new Set(q.outcome_ids!).size !== q.outcome_ids!.length) return false;
    if (block && !q.outcome_ids!.every((id) => block.outcome_ids.includes(id))) {
      return false;
    }
  } else if (block) return false;
  if (!blank(q.question_type)) {
    if (!QUESTION_TYPES.includes(q.question_type as never)) return false;
    if ((q.question_type === "coktan_secmeli") !== (q.kind === "multiple_choice")) {
      return false;
    }
  }
  if (
    !blank(q.cognitive_demand) &&
    !COGNITIVE_DEMANDS.includes(q.cognitive_demand as never)
  ) return false;
  if (
    !blank(q.intended_difficulty) &&
    !DIFFICULTIES.includes(q.intended_difficulty as Difficulty)
  ) return false;
  // A rubric object with no criteria (schema placeholder) counts as absent.
  const rubricBlank = blank(q.rubric) ||
    (typeof q.rubric === "object" && Array.isArray(q.rubric!.criteria) &&
      q.rubric!.criteria.length === 0);
  if (!rubricBlank && !rubricValid(q.rubric)) return false;
  if (block && q.kind === "open_ended" && rubricBlank) return false;
  if (!blank(q.shared_source_id)) {
    if (typeof q.shared_source_id !== "string" || !sharedIds.has(q.shared_source_id)) {
      return false;
    }
  }
  return true;
}
export function validateGenerationResult(
  result: AiResult<GeneratedOutput>,
  context: GenerationContext,
) {
  const { total, topics, kind } = context;
  const questions = result?.output?.questions;
  const shared = result?.output?.shared_sources;
  const sharedIds = new Set<string>();
  if (!blank(shared)) {
    if (
      !Array.isArray(shared) || shared.length > 30 || shared.some((s) =>
        !s || typeof s.id !== "string" || !s.id.trim() || s.id.length > 60 ||
        !["text", "table", "visual_description"].includes(s.kind) ||
        typeof s.content !== "string" || !s.content.trim() ||
        s.content.length > 4000
      )
    ) throw new Error("ai_result_invalid");
    for (const s of shared!) sharedIds.add(s.id);
    if (sharedIds.size !== shared!.length) throw new Error("ai_result_invalid");
  }
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
          ))) ||
      !validateQuestionProvenance(q, context, sharedIds)
    ) ||
    topics.some((t) =>
      questions.filter((q) => q.topic === t.topic).length !== t.count
    ) ||
    // Every shared passage must be used; a shared source is one identity, linked questions count separately.
    [...sharedIds].some((id) =>
      !questions.some((q) => q.shared_source_id === id)
    )
  ) throw new Error("ai_result_invalid");
}
export async function finishGeneration(
  db: ReturnType<typeof serviceClient>,
  parent: { familyId: string; userId: string },
  requestId: string,
  lease: string,
  context: GenerationContext,
  result: AiResult<GeneratedOutput>,
) {
  if (context.schema !== "gina.generation-context.v1") {
    return fail("generation_context_unsupported", 409);
  }
  try {
    validateGenerationResult(result, context);
  } catch {
    return fail("ai_result_invalid", 502);
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
  const scenario = context.scenario ?? null;
  const sharedById = new Map(
    (result.output.shared_sources ?? []).map((s) => [s.id, s] as const),
  );
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
      const block = scenario?.blocks.find((b) => b.topic === q.topic) ?? null;
      const shared = q.shared_source_id
        ? sharedById.get(q.shared_source_id) ?? null
        : null;
      const trace = {
        ...(scenario
          ? {
            scenario_version: scenario.scenario_version,
            catalogue_id: scenario.catalogue_id,
            catalogue_revision: scenario.revision,
            source_sha256: scenario.source.sha256,
            source_sheet: scenario.source.sheet,
          }
          : {}),
        ...(block || q.block_id
          ? { block_id: block?.block_id ?? q.block_id ?? null }
          : {}),
        ...(block ? { source_cells: block.source_cells } : {}),
        ...(Array.isArray(q.outcome_ids) && q.outcome_ids.length
          ? { outcome_ids: q.outcome_ids }
          : {}),
        ...(q.question_type ? { question_type: q.question_type } : {}),
        ...(q.cognitive_demand
          ? { cognitive_demand: q.cognitive_demand }
          : {}),
        ...(q.intended_difficulty
          ? { intended_difficulty: q.intended_difficulty }
          : {}),
        ...(q.rubric && q.rubric.criteria?.length ? { rubric: q.rubric } : {}),
        // One shared passage keeps one identity; linked questions stay separate rows.
        ...(shared
          ? { shared_source_id: shared.id, shared_source: shared }
          : {}),
        ...(scenario ? { content_fit: "pending_human_review" } : {}),
      };
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
            ...trace,
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

  if (rows.length !== total) return fail("generation_empty", 502);
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
  if (saveError) return fail("save_failed", 500);
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
    return fail(error.code === "42501" ? "forbidden" : "data_failed", error.code === "42501" ? 403 : 503);
  }
  if (!data) {
    return only ? fail("generation_not_started", 409) : null;
  }
  if (data.cached) return json(data.cached);
  // Rezervasyon kodu sözleşmeden geçer (bilinmeyen/ham metin `server_error`); durum eskisiyle aynı 409.
  if (data.error) return fail(String(data.error), 409);
  if (!data.lease || !data.context || !data.provider_result) {
    return fail("ai_result_uncertain", 503);
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
