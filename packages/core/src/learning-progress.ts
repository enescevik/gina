import { z } from "zod";
const count = z.number().int().nonnegative();
const counts = {
  total: count,
  correct: count,
  partial: count,
  wrong: count,
  blank: count,
  pending: count,
};
const reconciles = (
  v: {
    total: number;
    correct: number;
    partial: number;
    wrong: number;
    blank: number;
    pending: number;
  },
) => v.total === v.correct + v.partial + v.wrong + v.blank + v.pending;
const evidence = z.object({
  attempt_id: z.uuid(),
  question_id: z.uuid(),
  state: z.enum(["correct", "partial", "wrong", "blank", "pending"]),
  finished_at: z.string(),
});
export const learningProgressSchema = z.object({
  version: z.literal(1),
  from: z.iso.date(),
  through: z.iso.date(),
  timezone: z.string(),
  summary: z.object({
    ...counts,
    unique_questions: count,
    repeats: count,
    attempts: count,
  }).refine((v) => reconciles(v) && v.total === v.unique_questions + v.repeats),
  weeks: z.array(
    z.object({ ...counts, week_start: z.iso.date() }).refine(reconciles),
  ),
  topics: z.array(
    z.object({
      ...counts,
      grade: z.number().int().min(1).max(12),
      subject: z.string(),
      topic: z.string(),
      curriculum: z.string().nullable(),
      unique_questions: count,
      last_at: z.string(),
      limited_observation: z.boolean(),
      evidence: z.array(evidence).max(5),
    }).refine(reconciles),
  ),
}).refine(
  (v) =>
    v.weeks.reduce((sum, w) => sum + w.total, 0) === v.summary.total &&
    v.topics.reduce((sum, t) => sum + t.total, 0) === v.summary.total,
  "report_counts_disagree",
);
export type LearningProgress = z.infer<typeof learningProgressSchema>;
export type ProgressTopic = LearningProgress["topics"][number];
export function progressTopicKey(
  topic: Pick<ProgressTopic, "grade" | "subject" | "topic" | "curriculum">,
) {
  return JSON.stringify([
    topic.grade,
    topic.subject,
    topic.topic,
    topic.curriculum,
  ]);
}
/** A review queue for the parent, not a diagnostic or an ability prediction. */
export function progressNextStep(report: LearningProgress):
  | { kind: "review"; count: number; evidence: z.infer<typeof evidence>[] }
  | {
    kind: "practice";
    topic: ProgressTopic;
    evidence: z.infer<typeof evidence>[];
  }
  | { kind: "observe" } {
  if (report.summary.pending > 0) {
    return {
      kind: "review",
      count: report.summary.pending,
      evidence: report.topics.flatMap((t) =>
        t.evidence.filter((e) => e.state === "pending")
      ).slice(0, 3),
    };
  }
  const topic =
    report.topics.filter((t) =>
      !t.limited_observation && t.wrong + t.partial > 0
    )
      .sort((a, b) =>
        (b.wrong + b.partial) - (a.wrong + a.partial) ||
        progressTopicKey(a).localeCompare(progressTopicKey(b))
      )[0];
  if (!topic) return { kind: "observe" };
  return {
    kind: "practice",
    topic,
    evidence: topic.evidence.filter((e) =>
      e.state === "wrong" || e.state === "partial"
    ).slice(0, 3),
  };
}
