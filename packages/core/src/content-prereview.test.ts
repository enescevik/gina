import { describe, expect, it } from "vitest";
import {
  decidePrereview,
  PREREVIEW_CONFIDENCE_THRESHOLD,
  prereviewEnqueueResult,
  prereviewOutput,
  prereviewRow,
  prereviewStatusLabel,
  prereviewVerdict,
  RUBRIC_PASS,
} from "./content-prereview";

const clean = {
  confidence: 0.9,
  recommendation: "approve" as const,
  rubric: { ...RUBRIC_PASS },
  findings: [],
  summary: "Uygun.",
};
const hash = "a".repeat(64);

describe("content pre-review contract", () => {
  it("accepts a clean model output and rejects off-shape ones", () => {
    expect(prereviewOutput.parse(clean)).toEqual(clean);
    expect(prereviewOutput.safeParse({ ...clean, confidence: 1.5 }).success).toBe(false);
    expect(prereviewOutput.safeParse({ ...clean, rubric: { ...clean.rubric, solution_correct: "maybe" } }).success).toBe(false);
    expect(prereviewOutput.safeParse({ ...clean, extra: true }).success).toBe(false);
    expect(prereviewOutput.safeParse({ ...clean, findings: [{ code: "other", severity: "blocking", detail: "x" }] }).success).toBe(false);
  });
  it("applies the same threshold as the server", () => {
    expect(decidePrereview(clean)).toEqual({ status: "ai_approved", reason: "all_checks_passed" });
    expect(decidePrereview({ ...clean, confidence: PREREVIEW_CONFIDENCE_THRESHOLD }).status).toBe("ai_approved");
    expect(decidePrereview({ ...clean, confidence: 0.84 })).toEqual({ status: "needs_admin", reason: "low_confidence" });
    expect(decidePrereview({ ...clean, rubric: { ...clean.rubric, leaked_exam_suspicion: "unsure" } }).reason).toBe("rubric_leaked_exam_suspicion");
    expect(decidePrereview({ ...clean, findings: [{ code: "rubric_incomplete", severity: "blocking", detail: "x", item: null }] }).status).toBe("needs_admin");
    expect(decidePrereview({ ...clean, findings: [{ code: "other", severity: "advisory", detail: "x", item: null }] }).status).toBe("ai_approved");
    expect(decidePrereview({ ...clean, recommendation: "reject", findings: [{ code: "leaked_exam", severity: "blocking", detail: "x", item: "q1" }] }).status).toBe("ai_rejected_suggestion");
    expect(decidePrereview({ ...clean, recommendation: "reject" }).status).toBe("needs_admin");
    expect(decidePrereview({ ...clean, recommendation: "admin_review" }).reason).toBe("model_requested_review");
  });
  it("parses stored verdicts, failure verdicts and admin rows", () => {
    const verdict = prereviewVerdict.parse({
      model: "synthetic-model",
      prompt_version: "prereview-v1",
      content_hash: hash,
      confidence: 0.9,
      recommendation: "approve",
      decision_reason: "all_checks_passed",
      rubric: RUBRIC_PASS,
      findings: [],
      summary: "Uygun.",
      input_tokens: 100,
      output_tokens: 40,
    });
    expect(verdict.decision_reason).toBe("all_checks_passed");
    const failure = prereviewVerdict.parse({
      model: null,
      prompt_version: "prereview-v1",
      content_hash: hash,
      confidence: 0,
      decision_reason: "retry_limit",
      findings: [{ code: "other", severity: "advisory", detail: "anthropic_529" }],
      last_error: "anthropic_529",
      attempts: 3,
    });
    expect(failure.rubric).toBeUndefined();
    const row = prereviewRow.parse({
      target_kind: "curriculum_candidate",
      target_id: "6d4399b9-46b1-47ba-bc6b-5558f48c4c7b",
      content_hash: hash,
      prompt_version: "prereview-v1",
      prereview_status: "needs_admin",
      prereview_verdict: failure,
      prereview_at: "2026-11-06T02:00:00Z",
      attempts: 3,
      last_error: "anthropic_529",
      requested_by: null,
      queued_at: "2026-11-06T01:00:00Z",
      updated_at: "2026-11-06T02:00:00Z",
      claimed_at: null,
      awaiting_admin: true,
    });
    expect(row.awaiting_admin).toBe(true);
    expect(prereviewRow.safeParse({ ...row, lease: "x" }).success).toBe(false);
    expect(prereviewEnqueueResult.parse({ scope: "all", queued: 3, requeued: 0, unchanged: 0 }).queued).toBe(3);
  });
  it("labels never present the AI verdict as a publication", () => {
    expect(prereviewStatusLabel("ai_approved", "tr")).toContain("yayın değil");
    expect(prereviewStatusLabel("ai_approved", "en")).toContain("not published");
    expect(prereviewStatusLabel("needs_admin", "tr")).toContain("BEKLİYOR");
    expect(prereviewStatusLabel("ai_rejected_suggestion", "en")).toContain("admin decides");
  });
});
