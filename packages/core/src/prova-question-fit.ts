import { z } from "zod";
import type { ProvaContext, ProvaDraft } from "./prova-draft";
import type { ProvaGenerationRecord } from "./prova-generation-journal";
import { normalizeSubjectAlias } from "./subject-synonyms";

/** D1: get_prova_question_fit — question-level term/program tag + the child's parent-confirmed subject id. */
export const provaQuestionFitSchema = z.object({
  child_id: z.string().uuid(),
  subjects: z.array(z.object({
    alias_normalized: z.string(),
    title: z.string(),
    subject_id: z.string(),
    label_tr: z.string(),
    label_en: z.string(),
  }).passthrough()),
  questions: z.array(z.object({
    question_id: z.string().uuid(),
    subject: z.string(),
    subject_id: z.string().nullable(),
    subject_label_tr: z.string().nullable(),
    subject_label_en: z.string().nullable(),
    term: z.number().int().min(1).max(2).nullable(),
    program: z.string().nullable(),
    period_source: z.enum(["draft", "catalogue", "parent"]).nullable(),
  })),
});
export type ProvaQuestionFit = z.infer<typeof provaQuestionFitSchema>;
export type ProvaQuestionFitRow = ProvaQuestionFit["questions"][number];
export function readProvaQuestionFit(value: unknown): ProvaQuestionFit {
  return provaQuestionFitSchema.parse(value);
}

/** Same normalization as gina.normalize_subject_alias (server compares programs with it). */
export const normalizeProvaLabel = normalizeSubjectAlias;

export type ProvaPeriodIssue = "term" | "program";
/** Mirrors gina.prova_period_mismatches: only a known tag against a known draft value is a mismatch. */
export function provaQuestionPeriodIssues(
  context: Pick<ProvaContext, "term" | "program"> | undefined,
  row: Pick<ProvaQuestionFitRow, "term" | "program"> | undefined,
): ProvaPeriodIssue[] {
  if (!context || !row) return [];
  const issues: ProvaPeriodIssue[] = [];
  if (row.term !== null && context.term !== null && row.term !== context.term) {
    issues.push("term");
  }
  if (
    row.program !== null && context.program !== null &&
    normalizeProvaLabel(row.program) !== normalizeProvaLabel(context.program)
  ) issues.push("program");
  return issues;
}

/** Add or remove the parent's explicit acceptance for some questions (kept sorted/unique, max 200). */
export function setProvaFitAccepted(
  draft: ProvaDraft,
  ids: string[],
  accepted: boolean,
): ProvaDraft {
  const current = new Set(draft.fitAccepted ?? []);
  for (const id of ids) {
    if (accepted) current.add(id);
    else current.delete(id);
  }
  const list = [...current].sort().slice(0, 200);
  const { fitAccepted: _drop, ...rest } = draft;
  return list.length ? { ...rest, fitAccepted: list } : rest;
}

type AiQuestion = NonNullable<ProvaGenerationRecord["result"]>["questions"][number];
export type ProvaAiUnit =
  | { kind: "question"; id: string; question: AiQuestion }
  | {
    kind: "group";
    id: string;
    title: string;
    body: string;
    questions: AiQuestion[];
  };
/**
 * One AI generation as selectable units: a server-made shared-source group is ONE unit (never split, its
 * passage shown once); other questions are single units. Order follows the generated question order.
 */
export function provaAiUnits(
  result: ProvaGenerationRecord["result"] | undefined,
): ProvaAiUnit[] {
  if (!result) return [];
  const groups = new Map((result.groups ?? []).map((g) => [g.id, g] as const));
  const seen = new Set<string>();
  const units: ProvaAiUnit[] = [];
  for (const q of result.questions) {
    const g = q.group_id ? groups.get(q.group_id) : undefined;
    if (!g) {
      units.push({ kind: "question", id: q.id, question: q });
      continue;
    }
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    const members = g.question_ids.map((id) =>
      result.questions.find((x) => x.id === id)
    ).filter((x): x is AiQuestion => !!x).map((x) => ({
      ...x,
      stem: x.prompt ?? x.stem,
    }));
    units.push({
      kind: "group",
      id: g.id,
      title: g.title,
      body: g.body,
      questions: members,
    });
  }
  return units;
}
