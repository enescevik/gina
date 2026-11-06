import { describe, expect, it } from "vitest";
import { contributionDecision, contributionDetail } from "./contribution";
import { contributionTrailSchema, questionsToFix } from "./library-lifecycle";

const base = {
  request: "00000000-0000-4000-8000-000000000001",
  id: "00000000-0000-4000-8000-000000000002",
  note: "Bir soru düzeltilmeli.",
  teachers: {},
  confirmed: true as const,
};

describe("D3 question notes", () => {
  it("accepts question notes only with a rejection", () => {
    expect(contributionDecision.parse({ ...base, approve: false, question_notes: { q2: "  Cevap 4 olmalı.  " } }).question_notes)
      .toEqual({ q2: "Cevap 4 olmalı." });
    expect(contributionDecision.safeParse({ ...base, approve: true, question_notes: { q2: "Cevap 4 olmalı." } }).success).toBe(false);
    expect(contributionDecision.safeParse({ ...base, approve: false, question_notes: { q2: "x" } }).success).toBe(false);
  });

  it("keeps commands stored before D3 valid", () => {
    expect(contributionDecision.parse({ ...base, approve: false }).question_notes).toBeUndefined();
  });

  it("reads question notes from the review detail and the family trail", () => {
    const detail = contributionDetail.parse({
      id: base.id,
      status: "rejected",
      package_id: null,
      review_note: "Genel not",
      question_notes: { q2: "Cevap 4 olmalı." },
      media: null,
      snapshot: { title: "Pasta", body: "", grade: 5, subject: "Matematik", grouped: true, questions: [] },
    });
    expect(detail.question_notes?.q2).toBe("Cevap 4 olmalı.");
    const trail = contributionTrailSchema.parse({
      chain_id: base.id,
      family_id: null,
      current: base.id,
      steps: [{
        id: base.id,
        version: 1,
        status: "rejected",
        created_at: "2026-11-06T10:00:00Z",
        supersedes_id: null,
        title: "Pasta",
        question_count: 2,
        decision: "rejected",
        review_note: "Genel not",
        reviewed_at: "2026-11-06T11:00:00Z",
        package_id: null,
        prereview_status: null,
        prereview_at: null,
        package_status: null,
        questions: [
          { key: "q1", position: 1, excerpt: "İki dilim kaçta kaçtır?", note: null },
          { key: "q2", position: 2, excerpt: "Yarısı kaç dilimdir?", note: "Cevap 4 olmalı." },
        ],
      }],
    });
    expect(questionsToFix(trail.steps[0]!).map((q) => q.position)).toEqual([2]);
    expect(questionsToFix({})).toEqual([]);
  });
});
