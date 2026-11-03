import { expect, it } from "vitest";
import {
  type LearningProgress,
  learningProgressSchema,
  progressNextStep,
  progressTopicKey,
} from "./learning-progress";
function report(): LearningProgress {
  const c = {
    total: 1,
    correct: 0,
    wrong: 0,
    partial: 0,
    blank: 0,
    pending: 1,
  };
  return {
    version: 1,
    from: "2026-11-01",
    through: "2026-11-03",
    timezone: "Europe/Istanbul",
    summary: { ...c, unique_questions: 1, repeats: 0, attempts: 1 },
    weeks: [{ ...c, week_start: "2026-11-02" }],
    topics: [{
      ...c,
      grade: 5,
      subject: "Matematik",
      topic: "Kesir",
      curriculum: null,
      unique_questions: 1,
      last_at: "2026-11-03T10:00:00Z",
      limited_observation: true,
      evidence: [],
    }],
  };
}
it("rejects a chart that excludes pending responses from its total", () => {
  const r = report();
  expect(learningProgressSchema.safeParse(r).success).toBe(true);
  r.weeks[0]!.total = 0;
  expect(learningProgressSchema.safeParse(r).success).toBe(false);
});
it("does not convert pending work into weakness advice", () => {
  expect(progressNextStep(report()).kind).toBe("review");
});
it("keeps grade and program in every topic identity", () => {
  const a = report().topics[0]!;
  expect(progressTopicKey(a)).not.toBe(progressTopicKey({ ...a, grade: 6 }));
  expect(progressTopicKey(a)).not.toBe(
    progressTopicKey({ ...a, curriculum: "v2" }),
  );
});
it("does not label a single incorrect observation as a practice priority", () => {
  const r = report();
  r.summary.pending = 0;
  r.topics[0]!.pending = 0;
  r.topics[0]!.wrong = 1;
  expect(progressNextStep(r).kind).toBe("observe");
});
