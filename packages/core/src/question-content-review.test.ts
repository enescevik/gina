import { describe, expect, it } from "vitest";
import { contentReviewNames, questionContentReviewOf, readQuestionContentReview } from "./question-content-review";
import { generationResultSchema } from "./prova-generation-journal";

describe("D10 content review surface", () => {
  const summary = {
    status: "needs_review",
    flags: [
      { code: "person_name", names: ["Elif", "Ali"], fields: ["stem"], suggestion: "x" },
      { code: "person_name", names: ["Ali", " Zeynep "], fields: ["choice_A"], suggestion: "y" },
    ],
  };
  it("reads the generation-result summary (no detector) and the question_bank provenance", () => {
    const fromResult = questionContentReviewOf({ id: "q", stem: "s", content_review: summary });
    expect(fromResult?.detector).toBe("");
    expect(contentReviewNames(fromResult)).toEqual(["Elif", "Ali", "Zeynep"]);
    const fromRow = questionContentReviewOf({ id: "q", provenance: { content_review: { ...summary, detector: "person-name/v1" } } });
    expect(fromRow?.detector).toBe("person-name/v1");
    expect(contentReviewNames(fromRow)).toEqual(["Elif", "Ali", "Zeynep"]);
  });
  it("returns nothing for legacy / unflagged / malformed rows", () => {
    expect(questionContentReviewOf(null)).toBeNull();
    expect(questionContentReviewOf({ id: "q", stem: "s" })).toBeNull();
    expect(questionContentReviewOf({ id: "q", provenance: null })).toBeNull();
    expect(questionContentReviewOf({ content_review: "needs_review" })).toBeNull();
    expect(contentReviewNames(null)).toEqual([]);
  });
  it("journal keeps the summary; a malformed summary never fails the parse", () => {
    const q = {
      id: "00000000-0000-4000-8000-000000000001", topic: "t", kind: "open_ended", difficulty: "orta", stem: "s",
      choices: null, correct_key: null, expected_answer: "a", solution: "b", explanation: null, source_urls: [],
    };
    const base = { ok: true, model: "m", prompt_version: "p", remaining: 1 };
    const parsed = generationResultSchema.parse({ ...base, questions: [{ ...q, content_review: summary }] });
    expect(contentReviewNames(questionContentReviewOf(parsed.questions[0]))).toEqual(["Elif", "Ali", "Zeynep"]);
    const legacy = generationResultSchema.parse({ ...base, questions: [q] });
    expect(questionContentReviewOf(legacy.questions[0])).toBeNull();
    const bad = generationResultSchema.parse({ ...base, questions: [{ ...q, content_review: 42 }] });
    expect(questionContentReviewOf(bad.questions[0])).toBeNull();
  });
});

describe("D9/B6 question content review", () => {
  it("reads the needs_review tag written by prova-generate", () => {
    const provenance = {
      generator: "ai",
      content_review: {
        status: "needs_review",
        detector: "person-name/v1",
        flags: [{ code: "person_name", names: ["Ali", "Elif"], fields: ["stem"], suggestion: "Kişi adı (Ali, Elif) yerine \"bir öğrenci\"…" }],
      },
    };
    expect(readQuestionContentReview(provenance)).toEqual(provenance.content_review);
  });

  it("returns null for legacy, parent or malformed provenance", () => {
    expect(readQuestionContentReview(null)).toBeNull();
    expect(readQuestionContentReview({ generator: "parent" })).toBeNull();
    expect(readQuestionContentReview({ content_review: { status: "ok", flags: [] } })).toBeNull();
    expect(readQuestionContentReview({ content_review: { status: "needs_review", flags: [{ code: "other", names: ["x"] }] } })).toBeNull();
    expect(readQuestionContentReview({ content_review: { status: "needs_review", flags: [{ code: "person_name", names: [] }] } })).toBeNull();
  });
});
