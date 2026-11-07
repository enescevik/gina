import { describe, expect, it } from "vitest";
import {
  libraryFileSchema,
  libraryPendingSchema,
  libraryReviewCommandSchema,
  libraryInteractionSchema,
  localLibraryPreview,
} from "./library-review";
import qtFixtures from "./question-types/fixtures.json";
const uuid = "00000000-0000-4000-8000-000000000001";
const teacher = {
  correct_key: null,
  expected_answer: "secret answer",
  solution: "solution",
  explanation: "explain",
  common_misconception: "misconception",
  next_step: "next",
  rubric: {
    max_points: 2,
    scoring: "score",
    criteria: [{ id: "c1", points: 2, criterion: "reasoning" }],
    missing_answer: "unanswered",
    review_required: true,
  },
};
const make = () => ({
  p_request_id: uuid,
  p_bundle: {
    schema: "gina.library-import.v1",
    package_key: "sample",
    revision: 1,
    previous_hash: null,
    title: "Sample package",
    grade: 5,
    subject: "Math",
    provenance: {},
    assets: [],
    sources: [
      {
        key: "passage",
        title: "Shared text",
        body: "A shared passage",
        alt: "",
        asset_key: null,
        minimum_reading_width: 0,
        provenance: {},
      },
    ],
    questions: [1, 2].map((n) => ({
      key: `q${n}`,
      revision: 1,
      source_key: "passage",
      student: {
        grade: 5,
        subject: "Math",
        topic: "Geometry",
        kind: "open_ended",
        difficulty: "kolay",
        stem: "Explain the answer",
        choices: [],
      },
      teacher: JSON.parse(JSON.stringify(teacher)) as typeof teacher,
      metadata: {},
    })),
  },
});
describe("library editorial contracts", () => {
  it("validates all twelve enabled structured contracts and rejects disabled crossword", () => {
    for (const item of qtFixtures.content.filter((item) => item.valid)) {
      const interaction = { type: item.type, schema_version: 1, payload: item.payload, answer_key: item.key };
      expect(libraryInteractionSchema.safeParse(interaction).success, item.name).toBe(item.type !== "crossword");
    }
  });
  it("keeps typed content in private metadata and validates its key at import", () => {
    const value = make();
    const interaction = { type: "true_false", schema_version: 1, payload: { statements: [{ id: "a", text: "A statement" }] }, answer_key: { answers: { a: true } } };
    value.p_bundle.questions[0]!.metadata = { interaction };
    expect(libraryFileSchema.safeParse(value).success).toBe(true);
    interaction.answer_key.answers = {} as { a: boolean };
    expect(libraryFileSchema.safeParse(value).success).toBe(false);
  });
  it("preserves a shared text and full teacher criteria without inventing an image", () => {
    const file = libraryFileSchema.parse(make());
    const d = localLibraryPreview(file);
    expect(d.sources).toHaveLength(1);
    expect(d.sources[0]?.png_base64).toBeNull();
    expect(d.questions.map((q) => q.source_key)).toEqual([
      "passage",
      "passage",
    ]);
    expect(d.questions[0]?.teacher).toEqual(teacher);
  });
  it("rejects hidden answers in student keys", () => {
    const value = make();
    Object.assign(value.p_bundle.questions[0]!.student, {
      expected_answer: "leak",
    });
    expect(() => libraryFileSchema.parse(value)).toThrow();
  });
  it("rejects broken source links, unused context and duplicate identities", () => {
    const value = make();
    value.p_bundle.questions[0]!.source_key = "missing";
    expect(() => libraryFileSchema.parse(value)).toThrow();
    const duplicate = make();
    duplicate.p_bundle.questions[1]!.key = "q1";
    expect(() => libraryFileSchema.parse(duplicate)).toThrow();
    const unused = make();
    unused.p_bundle.sources.push({
      ...unused.p_bundle.sources[0]!,
      key: "unused",
    });
    expect(() => libraryFileSchema.parse(unused)).toThrow();
  });
  it("rejects wrong grade and non-additive rubric", () => {
    const value = make();
    value.p_bundle.questions[0]!.student.grade = 6;
    expect(() => libraryFileSchema.parse(value)).toThrow();
    const rubric = make();
    rubric.p_bundle.questions[0]!.teacher.rubric.max_points = 3;
    expect(() => libraryFileSchema.parse(rubric)).toThrow();
  });
  it("requires explanation for correction requests, allows explicit not-reviewed", () => {
    const value = {
      action: "review",
      package_id: uuid,
      question_key: "q1",
      question_revision: 1,
      expected_review_revision: 0,
      outcome: "changes_requested",
      note: "  ",
    };
    expect(() => libraryReviewCommandSchema.parse(value)).toThrow();
    expect(
      libraryReviewCommandSchema.parse({ ...value, outcome: "unreviewed" })
        .outcome,
    ).toBe("unreviewed");
    expect(() =>
      libraryReviewCommandSchema.parse({
        ...value,
        outcome: "publish",
        note: "publish now",
      }),
    ).toThrow();
  });
  it("never replaces the durable import identity", () => {
    const file = libraryFileSchema.parse(make());
    expect(
      libraryPendingSchema.parse({
        request: uuid,
        payload: { action: "import", file },
      }).request,
    ).toBe(uuid);
    expect(() =>
      libraryPendingSchema.parse({
        request: "00000000-0000-4000-8000-000000000002",
        payload: { action: "import", file },
      }),
    ).toThrow();
  });
});
