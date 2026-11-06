import { z } from "zod";

// E01 content pre-review: shared types for the backoffice/admin queue. The AI verdict is advisory;
// `ai_approved` is neither a publication nor the admin decision, and the independent educator
// review (X06) remains a separate quality tier. The runtime contract lives in
// supabase/functions/_shared/prereview.ts; these schemas mirror it for clients.

// C09: v2 tells the model that images are not shown (mirrors supabase/functions/_shared/prereview.ts).
export const PREREVIEW_PROMPT_VERSION = "prereview-v2";
export const PREREVIEW_CONFIDENCE_THRESHOLD = 0.85;
export const PREREVIEW_MAX_ATTEMPTS = 3;

export const prereviewKind = z.enum([
  "library_package",
  "contribution_set",
  "curriculum_candidate",
]);
export type PrereviewKind = z.infer<typeof prereviewKind>;
export const prereviewStatus = z.enum([
  "pending",
  "ai_approved",
  "needs_admin",
  "ai_rejected_suggestion",
]);
export type PrereviewStatus = z.infer<typeof prereviewStatus>;
export const prereviewScope = z.enum([
  "library_packages",
  "contribution_sets",
  "curriculum_candidates",
  "all",
]);
export type PrereviewScope = z.infer<typeof prereviewScope>;

export const rubricAnswer = z.enum(["yes", "no", "unsure"]);
export type RubricAnswer = z.infer<typeof rubricAnswer>;
export const RUBRIC_KEYS = [
  "solution_correct",
  "measures_target_skill",
  "age_language_appropriate",
  "copyright_or_copy_suspicion",
  "leaked_exam_suspicion",
] as const;
export type RubricKey = (typeof RUBRIC_KEYS)[number];
export const RUBRIC_PASS: Record<RubricKey, RubricAnswer> = {
  solution_correct: "yes",
  measures_target_skill: "yes",
  age_language_appropriate: "yes",
  copyright_or_copy_suspicion: "no",
  leaked_exam_suspicion: "no",
};
export const prereviewRubric = z.object({
  solution_correct: rubricAnswer,
  measures_target_skill: rubricAnswer,
  age_language_appropriate: rubricAnswer,
  copyright_or_copy_suspicion: rubricAnswer,
  leaked_exam_suspicion: rubricAnswer,
}).strict();
export type PrereviewRubric = z.infer<typeof prereviewRubric>;

export const prereviewFindingCode = z.enum([
  "solution_incorrect",
  "answer_key_mismatch",
  "rubric_incomplete",
  "skill_mismatch",
  "age_or_language",
  "copyright_or_copy",
  "leaked_exam",
  "scenario_count_mismatch",
  "outcome_mismatch",
  "personal_data",
  "unsafe_content",
  "other",
]);
export const prereviewFinding = z.object({
  code: prereviewFindingCode,
  severity: z.enum(["blocking", "advisory"]),
  detail: z.string().trim().min(1).max(1000),
  item: z.string().trim().min(1).max(120).nullable(),
}).strict();
export type PrereviewFinding = z.infer<typeof prereviewFinding>;

/** Model output as validated by the Edge Function. */
export const prereviewOutput = z.object({
  confidence: z.number().min(0).max(1),
  recommendation: z.enum(["approve", "admin_review", "reject"]),
  rubric: prereviewRubric,
  findings: z.array(prereviewFinding).max(40),
  summary: z.string().trim().min(1).max(600),
}).strict();
export type PrereviewOutput = z.infer<typeof prereviewOutput>;

/** Stored verdict (gina.content_prereviews.prereview_verdict). Failure verdicts carry null rubric/model. */
export const prereviewVerdict = z.object({
  model: z.string().nullable(),
  prompt_version: z.string(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  confidence: z.number().min(0).max(1),
  recommendation: z.enum(["approve", "admin_review", "reject"]).optional(),
  decision_reason: z.string(),
  rubric: prereviewRubric.nullable().optional(),
  findings: z.array(prereviewFinding.partial({ item: true })),
  summary: z.string().nullable().optional(),
  input_tokens: z.number().int().nullable().optional(),
  output_tokens: z.number().int().nullable().optional(),
  last_error: z.string().nullable().optional(),
  attempts: z.number().int().optional(),
}).loose();
export type PrereviewVerdict = z.infer<typeof prereviewVerdict>;

/** Row of admin_content_prereviews(). `awaiting_admin` comes from the record's own decision columns. */
export const prereviewRow = z.object({
  target_kind: prereviewKind,
  target_id: z.uuid(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  prompt_version: z.string(),
  prereview_status: prereviewStatus,
  prereview_verdict: prereviewVerdict.nullable(),
  prereview_at: z.string().nullable(),
  attempts: z.number().int().min(0),
  last_error: z.string().nullable(),
  requested_by: z.uuid().nullable(),
  queued_at: z.string(),
  updated_at: z.string(),
  claimed_at: z.string().nullable(),
  awaiting_admin: z.boolean(),
}).strict();
export type PrereviewRow = z.infer<typeof prereviewRow>;

export const prereviewEnqueueResult = z.object({
  scope: prereviewScope,
  queued: z.number().int().min(0),
  requeued: z.number().int().min(0),
  unchanged: z.number().int().min(0),
}).strict();

export interface PrereviewDecision {
  status: Exclude<PrereviewStatus, "pending">;
  reason: string;
}

/** Same threshold rule as the Edge Function; used for previews and tests on the client side. */
export function decidePrereview(
  output: PrereviewOutput,
  threshold = PREREVIEW_CONFIDENCE_THRESHOLD,
): PrereviewDecision {
  const blocking = output.findings.filter((f) => f.severity === "blocking");
  const rubricFails = RUBRIC_KEYS.filter((k) => output.rubric[k] !== RUBRIC_PASS[k]);
  if (output.confidence < threshold) return { status: "needs_admin", reason: "low_confidence" };
  if (output.recommendation === "reject" && blocking.length > 0) {
    return { status: "ai_rejected_suggestion", reason: "blocking_finding" };
  }
  if (blocking.length > 0) return { status: "needs_admin", reason: "blocking_finding" };
  if (rubricFails.length > 0) return { status: "needs_admin", reason: `rubric_${rubricFails[0]}` };
  if (output.recommendation !== "approve") {
    return { status: "needs_admin", reason: "model_requested_review" };
  }
  return { status: "ai_approved", reason: "all_checks_passed" };
}

/** Status the admin sees: the AI column never implies publication or a human decision. */
export function prereviewStatusLabel(status: PrereviewStatus, locale: "tr" | "en"): string {
  const labels: Record<PrereviewStatus, { tr: string; en: string }> = {
    pending: { tr: "AI ön inceleme bekliyor", en: "AI pre-review pending" },
    ai_approved: { tr: "AI uygun buldu (yayın değil)", en: "AI found suitable (not published)" },
    needs_admin: { tr: "BEKLİYOR — yönetici kararı", en: "WAITING — admin decision" },
    ai_rejected_suggestion: { tr: "AI ret önerdi — yönetici karar verir", en: "AI suggests rejection — admin decides" },
  };
  return labels[status][locale];
}
