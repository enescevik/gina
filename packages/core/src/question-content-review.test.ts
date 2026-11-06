import { describe, expect, it } from "vitest";
import { readQuestionContentReview } from "./question-content-review";

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
