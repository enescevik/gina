import { z } from "zod";
export const provaBlockSchema = z.object({
  kind: z.enum(["question", "group"]),
  id: z.string().uuid(),
  source: z.enum(["library", "ai", "manual", "document"]),
}).strict();
/**
 * C04: optional exam context carried in the server schema (validate_prova_draft /
 * submit_prova_draft → exams.exam_scope/assessment_track/term/academic_year/
 * education_period_id/school_declared). Drafts saved before C04 have no context.
 */
export const provaContextSchema = z.object({
  scope: z.enum(["subject", "mixed"]),
  track: z.enum(["meb_common", "lgs", "free"]),
  term: z.union([z.literal(1), z.literal(2)]).nullable(),
  program: z.string().trim().min(1).max(80).nullable(),
  academicYear: z.number().int().min(2000).max(2100).nullable(),
  periodId: z.string().uuid().nullable(),
  school: z.string().max(120).nullable(),
  schoolDeclared: z.boolean(),
}).strict();
export type ProvaContext = z.infer<typeof provaContextSchema>;
export const provaDraftSchema = z.object({
  childId: z.string().uuid().nullable(),
  grade: z.number().int().min(1).max(12).nullable(),
  title: z.string().max(160),
  purpose: z.enum(["practice", "written", "trial"]),
  format: z.enum(["school", "meb", "practice"]),
  subjects: z.array(z.string().trim().min(1).max(80)).max(12),
  topics: z.array(z.string().trim().min(1).max(200)).max(30),
  target: z.number().int().min(1).max(100),
  minutes: z.number().int().min(1).max(180).nullable(),
  difficulty: z.enum(["kolay", "orta", "orta_ustu", "zor"]),
  kind: z.enum(["mixed", "multiple_choice", "open_ended"]),
  note: z.string().max(1500),
  step: z.number().int().min(0).max(3),
  blocks: z.array(provaBlockSchema).max(100),
  context: provaContextSchema.optional(),
}).strict().refine(
  (d) => new Set(d.blocks.map((b) => b.id)).size === d.blocks.length,
  "duplicate_block",
);
export type ProvaDraft = z.infer<typeof provaDraftSchema>;
export type ProvaBlock = z.infer<typeof provaBlockSchema>;
export const newProvaDraft = (): ProvaDraft => ({
  childId: null,
  grade: null,
  title: "",
  purpose: "written",
  format: "school",
  subjects: [],
  topics: [],
  target: 10,
  minutes: null,
  difficulty: "orta",
  kind: "open_ended",
  note: "",
  step: 0,
  blocks: [],
});
// Written preparation follows the server's open-ended generation contract,
// including drafts saved before that constraint was reflected in the controls.
export function provaGenerationKind(
  draft: Pick<ProvaDraft, "purpose" | "kind">,
): ProvaDraft["kind"] {
  return draft.purpose === "written" ? "open_ended" : draft.kind;
}
export function appendProvaBlocks(
  draft: ProvaDraft,
  blocks: ProvaBlock[],
): ProvaDraft {
  const ids = new Set(draft.blocks.map((b) => b.id));
  return {
    ...draft,
    blocks: [
      ...draft.blocks,
      ...blocks.filter((b) => {
        if (ids.has(b.id)) return false;
        ids.add(b.id);
        return true;
      }),
    ],
  };
}
export function moveProvaBlock(
  blocks: ProvaBlock[],
  index: number,
  delta: number,
): ProvaBlock[] {
  const next = index + delta;
  if (
    index < 0 || index >= blocks.length || next < 0 || next >= blocks.length
  ) return blocks;
  const copy = [...blocks];
  [copy[index], copy[next]] = [copy[next]!, copy[index]!];
  return copy;
}

export interface ProvaEducationPeriod {
  id: string;
  academic_year: number;
  school: string | null;
  grade: number | null;
}
/** Default context for a draft: mixed when several subjects, free study, current period. */
export function defaultProvaContext(
  draft: Pick<ProvaDraft, "subjects">,
  period: ProvaEducationPeriod | null,
): ProvaContext {
  return {
    scope: draft.subjects.length > 1 ? "mixed" : "subject",
    track: "free",
    term: null,
    program: null,
    academicYear: period?.academic_year ?? null,
    periodId: period?.id ?? null,
    school: period?.school ?? null,
    schoolDeclared: false,
  };
}
export type ProvaContextIssue =
  | "subject_count"
  | "track_grade"
  | "period_changed";
/** Same rules as submit_prova_draft, so the builder can explain them before sending. */
export function provaContextIssues(
  draft: Pick<ProvaDraft, "subjects" | "grade" | "context">,
  current: ProvaEducationPeriod | null,
): ProvaContextIssue[] {
  const c = draft.context;
  if (!c) return [];
  const issues: ProvaContextIssue[] = [];
  if (c.scope === "subject" && draft.subjects.length !== 1) {
    issues.push("subject_count");
  }
  if (c.track === "lgs" && draft.grade !== 8) issues.push("track_grade");
  if (
    c.periodId &&
    (!current || current.id !== c.periodId ||
      (current.school ?? "") !== (c.school ?? "") ||
      (c.academicYear !== null && current.academic_year !== c.academicYear))
  ) issues.push("period_changed");
  return issues;
}
/** Re-confirm the draft against the child's current period (user action after a change). */
export function confirmProvaPeriod(
  context: ProvaContext,
  current: ProvaEducationPeriod | null,
): ProvaContext {
  return {
    ...context,
    periodId: current?.id ?? null,
    school: current?.school ?? null,
    academicYear: current?.academic_year ?? null,
  };
}
/** How many questions a "complete with AI" request should ask for (never negative, max 30). */
export function provaRemainingCount(target: number, current: number): number {
  return Math.max(0, Math.min(30, target - current));
}
