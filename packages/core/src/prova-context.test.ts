import { describe, expect, it } from "vitest";
import {
  confirmProvaPeriod,
  defaultProvaContext,
  newProvaDraft,
  parseRubricInput,
  provaContextIssues,
  readQuestionRubric,
  provaContextSchema,
  provaDraftSchema,
  provaRemainingCount,
} from "./prova-draft";

describe("C04 prova context", () => {
  const period = {
    id: "80000000-0000-4000-8000-000000011001",
    academic_year: 2026,
    school: "Okul",
    grade: 6,
  };
  const base = {
    ...newProvaDraft(),
    childId: "20000000-0000-4000-8000-000000011001",
    grade: 6,
    subjects: ["Matematik"],
  };
  it("keeps legacy drafts (no context) valid", () => {
    expect(provaDraftSchema.safeParse(base).success).toBe(true);
    expect(provaContextIssues(base, null)).toEqual([]);
  });
  it("validates context strictly", () => {
    const context = defaultProvaContext(base, period);
    expect(context).toMatchObject({
      scope: "subject",
      track: "free",
      periodId: period.id,
      school: "Okul",
      academicYear: 2026,
      schoolDeclared: false,
    });
    expect(defaultProvaContext({ subjects: ["A", "B"] }, null)).toMatchObject({
      scope: "mixed",
      periodId: null,
    });
    expect(provaDraftSchema.safeParse({ ...base, context }).success).toBe(true);
    expect(
      provaDraftSchema.safeParse({ ...base, context: { ...context, term: 3 } })
        .success,
    ).toBe(false);
    expect(
      provaDraftSchema.safeParse({ ...base, context: { ...context, extra: 1 } })
        .success,
    ).toBe(false);
    expect(provaContextSchema.safeParse({ ...context, track: "official" }).success)
      .toBe(false);
  });
  it("explains the same issues the server rejects", () => {
    const context = defaultProvaContext(base, period);
    expect(
      provaContextIssues({ ...base, subjects: ["Matematik", "Fen"], context }, period),
    ).toEqual(["subject_count"]);
    expect(
      provaContextIssues({ ...base, context: { ...context, track: "lgs" } }, period),
    ).toEqual(["track_grade"]);
    expect(
      provaContextIssues(
        { ...base, grade: 8, context: { ...context, track: "lgs" } },
        period,
      ),
    ).toEqual([]);
    expect(provaContextIssues({ ...base, context }, { ...period, school: "Yeni" }))
      .toEqual(["period_changed"]);
    expect(
      provaContextIssues({ ...base, context }, {
        ...period,
        id: "80000000-0000-4000-8000-000000011003",
      }),
    ).toEqual(["period_changed"]);
    expect(provaContextIssues({ ...base, context }, null)).toEqual([
      "period_changed",
    ]);
    const fixed = confirmProvaPeriod(context, { ...period, school: "Yeni" });
    expect(
      provaContextIssues({ ...base, context: fixed }, { ...period, school: "Yeni" }),
    ).toEqual([]);
  });
  it("parses editor text into the server rubric shape", () => {
    expect(parseRubricInput("0,5\n yarım \n\n0,5", "Böleni bulur | 40\nSonuç | 60"))
      .toEqual({
        alternative_answers: ["0,5", "yarım"],
        criteria: [{ text: "Böleni bulur", points: 40 }, {
          text: "Sonuç",
          points: 60,
        }],
      });
    expect(parseRubricInput("", "")).toEqual({
      alternative_answers: [],
      criteria: [],
    });
    expect(parseRubricInput("", "puansız satır")).toBeNull();
    expect(parseRubricInput("", "a | 80\nb | 40")).toBeNull();
  });
  it("reads provenance rubric defensively", () => {
    expect(readQuestionRubric({ generator: "parent" })).toEqual({
      criteria: [],
      alternative_answers: [],
    });
    expect(
      readQuestionRubric({
        rubric: {
          criteria: [{ text: "x", points: 5 }, { text: "" }],
          alternative_answers: ["y", 2],
        },
      }),
    ).toEqual({ criteria: [{ text: "x", points: 5 }], alternative_answers: ["y"] });
  });
  it("D13: reads rubric.assesses when valid; legacy/invalid stays absent; editor never emits it", () => {
    const base = { criteria: [{ text: "x", points: 100 }], alternative_answers: [] };
    expect(readQuestionRubric({ rubric: { ...base, assesses: "process" } }).assesses).toBe("process");
    expect(readQuestionRubric({ rubric: { ...base, assesses: "result" } }).assesses).toBe("result");
    expect("assesses" in readQuestionRubric({ rubric: base })).toBe(false);
    expect("assesses" in readQuestionRubric({ rubric: { ...base, assesses: "" } })).toBe(false);
    expect("assesses" in readQuestionRubric({ rubric: { ...base, assesses: "both" } })).toBe(false);
    // gina.valid_question_rubric accepts only {criteria, alternative_answers}.
    expect(Object.keys(parseRubricInput("0,5", "Sonuç | 100")!).sort()).toEqual(["alternative_answers", "criteria"]);
  });
  it("counts the remaining AI questions for one request", () => {
    expect(provaRemainingCount(10, 3)).toBe(7);
    expect(provaRemainingCount(3, 5)).toBe(0);
    expect(provaRemainingCount(100, 0)).toBe(30);
  });
});
