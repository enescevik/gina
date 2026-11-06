import { describe, expect, it } from "vitest";
import {
  attemptEndedByTime,
  attemptSummary,
  openAnswerPresent,
  openAnswerState,
  parseAttemptSummary,
} from "./attempt-summary";

const stroke = {
  version: 1,
  width: 1000,
  height: 1400,
  elements: [{ id: "a", type: "stroke", color: "#201951", size: 4, points: [[1, 1], [2, 2]] }],
};

describe("submitted attempt summary", () => {
  const pending = { mc_total: 0, mc_correct: 0, open_total: null, open_graded: null };
  it("shows pending review when the finish response precedes trigger totals", () => {
    expect(attemptSummary(pending, [{ kind: "open_ended" }])).toMatchObject({
      mcTotal: 0, mcCorrect: 0, pendingReview: true, provisional: true, reviewState: "pending_review",
      pendingOpenCount: 1, unansweredOpenCount: 0, scorePct: null,
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
    ])).toMatchObject({ mcTotal: 2, mcCorrect: 1, pendingReview: true });
  });
  it("does not invent review work for a multiple-choice-only exam", () => {
    expect(attemptSummary({ ...pending, mc_total: 1, mc_correct: 1 }, [
      { kind: "multiple_choice" },
    ]).pendingReview).toBe(false);
  });
});

describe("P04 pending / unanswered / provisional", () => {
  it("drawing-only and blank answers are not graded; score is a provisional MC-only result", () => {
    const s = attemptSummary({
      status: "submitted", mc_total: 1, mc_correct: 1, open_total: 2, open_graded: 0,
      open_pending: 1, open_unanswered: 1, provisional: true, score_pct: 100,
    }, []);
    expect(s).toMatchObject({
      pendingReview: true, pendingOpenCount: 1, unansweredOpenCount: 1, provisional: true,
      scorePct: 100, reviewState: "pending_review",
    });
  });
  it("explicit parent zero closes the attempt as graded, not provisional", () => {
    expect(attemptSummary({
      status: "graded", mc_total: 1, mc_correct: 1, open_total: 2, open_graded: 2,
      open_pending: 0, open_unanswered: 0, provisional: false, score_pct: 60,
    }, [])).toMatchObject({ provisional: false, reviewState: "graded", scorePct: 60, unansweredOpenCount: 0 });
  });
  it("legacy graded rows (new columns null) stay graded with their stored score", () => {
    expect(attemptSummary({
      status: "graded", mc_total: 0, mc_correct: 0, open_total: 2, open_graded: 2, score_pct: 0,
      open_pending: null, open_unanswered: null, provisional: null,
    }, [])).toMatchObject({ provisional: false, reviewState: "graded", scorePct: 0, pendingOpenCount: 0, unansweredOpenCount: 0 });
  });
  it("legacy submitted rows treat every missing score as pending", () => {
    expect(attemptSummary({ status: "submitted", mc_total: 0, mc_correct: 0, open_total: 3, open_graded: 1 }, []))
      .toMatchObject({ pendingOpenCount: 2, unansweredOpenCount: 0, provisional: true, reviewState: "pending_review" });
  });
  it("in-progress attempts are reported as such", () => {
    expect(attemptSummary({ status: "in_progress", mc_total: null, mc_correct: null, open_total: null, open_graded: null }, [
      { kind: "open_ended" },
    ]).reviewState).toBe("in_progress");
  });
});

describe("open answer presence mirrors the server rule", () => {
  it("text or ink counts; blank, source-only and empty notebooks do not", () => {
    expect(openAnswerPresent({ answer_text: "Bir yıldızdır." })).toBe(true);
    expect(openAnswerPresent({ answer_text: "  " })).toBe(false);
    expect(openAnswerPresent({ answer_text: null, answer_document: stroke })).toBe(true);
    expect(openAnswerPresent({ answer_document: { ...stroke, elements: [] } })).toBe(false);
    expect(openAnswerPresent({ answer_document: { ...stroke, elements: [{ id: "s", type: "source" }] } })).toBe(false);
    expect(openAnswerPresent({ answer_document: { ...stroke, elements: [{ id: "t", type: "text", text: "  " }] } })).toBe(false);
    expect(openAnswerPresent({ answer_document: { ...stroke, elements: [{ id: "t", type: "text", text: "cevap" }] } })).toBe(true);
    expect(openAnswerPresent({ answer_document: "garbage" })).toBe(false);
  });
  it("state: score wins, then presence, else unanswered (never an implicit zero)", () => {
    expect(openAnswerState({ score: 0, answer_text: "" })).toBe("graded");
    expect(openAnswerState({ score: null, answer_document: stroke })).toBe("pending");
    expect(openAnswerState({ score: null, answer_text: "" })).toBe("unanswered");
  });
});

describe("get_attempt_summary payload", () => {
  const base = {
    id: "60000000-0000-4000-8000-000000010141",
    exam_id: "50000000-0000-4000-8000-000000010131",
    child_id: "20000000-0000-4000-8000-000000010101",
    status: "submitted", review_state: "pending_review",
    mc_total: 1, mc_correct: 1, open_total: 2, open_graded: 0,
    pending_open_count: 1, unanswered_open_count: 1, provisional: true, score_pct: 100,
    started_at: "2026-11-06T01:00:00+00:00", finished_at: "2026-11-06T01:10:00+00:00", graded_at: null,
  };
  it("parses parent payload with per-question states and child payload without them", () => {
    const parent = parseAttemptSummary({
      ...base,
      open_answers: [
        { question_id: "40000000-0000-4000-8000-000000010121", position: 2, state: "pending", score: null, graded_by: null, has_text: false, has_document: true },
        { question_id: "40000000-0000-4000-8000-000000010122", position: 3, state: "unanswered", score: null, graded_by: null, has_text: false, has_document: false },
      ],
    });
    expect(parent?.open_answers?.map((a) => a.state)).toEqual(["pending", "unanswered"]);
    expect(parseAttemptSummary(base)?.open_answers).toBeUndefined();
  });
  it("rejects malformed payloads instead of guessing", () => {
    expect(parseAttemptSummary({ ...base, provisional: "yes" })).toBeNull();
    expect(parseAttemptSummary(null)).toBeNull();
  });
});

describe("attemptEndedByTime (D4-2)", () => {
  const deadline = "2026-11-06T10:10:00.000Z";
  it("süre dolduktan sonra biten süreli denemeyi tanır", () => {
    expect(attemptEndedByTime({ status: "submitted", deadline_at: deadline, finished_at: "2026-11-06T10:10:02.000Z" })).toBe(true);
  });
  it("cihaz saati biraz ilerideyken (pay içinde) de süre doldu sayar", () => {
    expect(attemptEndedByTime({ status: "submitted", deadline_at: deadline, finished_at: "2026-11-06T10:09:57.000Z" })).toBe(true);
  });
  it("süre bitmeden gönderilen denemede false", () => {
    expect(attemptEndedByTime({ status: "graded", deadline_at: deadline, finished_at: "2026-11-06T10:04:00.000Z" })).toBe(false);
  });
  it("süresiz, bitmemiş ya da bozuk satırda false", () => {
    expect(attemptEndedByTime({ status: "submitted", deadline_at: null, finished_at: deadline })).toBe(false);
    expect(attemptEndedByTime({ status: "in_progress", deadline_at: deadline, finished_at: deadline })).toBe(false);
    expect(attemptEndedByTime({ status: "submitted", deadline_at: deadline, finished_at: null })).toBe(false);
    expect(attemptEndedByTime({ status: "submitted", deadline_at: "x", finished_at: deadline })).toBe(false);
  });
});
