import { describe, expect, it } from "vitest";
import { attemptSummary } from "./attempt-summary";

describe("submitted attempt summary", () => {
  const pending = { mc_total: 0, mc_correct: 0, open_total: null, open_graded: null };
  it("shows pending review when the finish response precedes trigger totals", () => {
    expect(attemptSummary(pending, [{ kind: "open_ended" }])).toEqual({
      mcTotal: 0, mcCorrect: 0, pendingReview: true,
    });
  });
  it("keeps authoritative graded totals, including zero", () => {
    expect(attemptSummary({ ...pending, open_total: 1, open_graded: 1 }, [
      { kind: "open_ended" },
    ]).pendingReview).toBe(false);
    expect(attemptSummary({ ...pending, open_total: 0 }, [
      { kind: "open_ended" },
    ]).pendingReview).toBe(false);
  });
  it("preserves multiple-choice scores in a mixed exam", () => {
    expect(attemptSummary({ ...pending, mc_total: 2, mc_correct: 1 }, [
      { kind: "multiple_choice" }, { kind: "multiple_choice" }, { kind: "open_ended" },
    ])).toEqual({ mcTotal: 2, mcCorrect: 1, pendingReview: true });
  });
  it("does not invent review work for a multiple-choice-only exam", () => {
    expect(attemptSummary({ ...pending, mc_total: 1, mc_correct: 1 }, [
      { kind: "multiple_choice" },
    ]).pendingReview).toBe(false);
  });
});
