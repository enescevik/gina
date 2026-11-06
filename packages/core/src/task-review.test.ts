import { describe, expect, it } from "vitest";
import {
  BULK_APPLY_LIMIT,
  bulkSelectionState,
  normalizeReturnNote,
  readReturnReason,
  returnRequest,
  reviewErrorKey,
  reviewRequestKey,
  reviewSettled,
  reviewTaskArgs,
  TASK_RETURN_REASONS,
} from "./index";
import tr from "./i18n/tr.json";
import en from "./i18n/en.json";

describe("task return reason (C03)", () => {
  it("normalizes whitespace like the server", () => {
    expect(normalizeReturnNote("  Yatağı\n da   topla ")).toBe("Yatağı da topla");
    expect(normalizeReturnNote(" \n ")).toBeNull();
  });
  it("requires a note only for other, rejects long or orphan notes", () => {
    expect(returnRequest({ reason: "other", note: "" })).toEqual({ ok: false, error: "return_note_required" });
    expect(returnRequest({ reason: "needs_care", note: "a".repeat(141) })).toEqual({ ok: false, error: "return_note_invalid" });
    expect(returnRequest({ reason: null, note: "not" })).toEqual({ ok: false, error: "return_note_invalid" });
    expect(returnRequest({ reason: null, note: "" })).toEqual({ ok: true, reason: null, note: null });
    expect(returnRequest({ reason: "missing_part", note: " Yatak " })).toEqual({ ok: true, reason: "missing_part", note: "Yatak" });
  });
  it("keeps the legacy RPC body when there is no reason", () => {
    const base = { requestId: "r", completionId: "c", completedAt: "t" };
    expect(Object.keys(reviewTaskArgs({ ...base, approve: true }))).toHaveLength(4);
    expect(Object.keys(reviewTaskArgs({ ...base, approve: false }))).toHaveLength(4);
    expect(reviewTaskArgs({ ...base, approve: true, reason: "other", note: "x" })).not.toHaveProperty("p_return_reason");
    expect(reviewTaskArgs({ ...base, approve: false, reason: "other", note: " x " })).toMatchObject({ p_return_reason: "other", p_return_note: "x" });
  });
  it("uses one request key per identical decision", () => {
    const a = reviewRequestKey({ completionId: "c", completedAt: "t", approve: false, reason: "needs_care", note: "x " });
    expect(a).toBe(reviewRequestKey({ completionId: "c", completedAt: "t", approve: false, reason: "needs_care", note: "x" }));
    expect(a).not.toBe(reviewRequestKey({ completionId: "c", completedAt: "t", approve: false, reason: "other", note: "x" }));
    expect(reviewRequestKey({ completionId: "c", completedAt: "t", approve: true, reason: "other", note: "x" }))
      .toBe(reviewRequestKey({ completionId: "c", completedAt: "t", approve: true }));
  });
  it("reads only known reasons from rows", () => {
    expect(readReturnReason({ return_reason: "needs_care", return_note: "Dikkat" })).toEqual({ reason: "needs_care", note: "Dikkat" });
    expect(readReturnReason({ return_reason: "lazy" })).toBeNull();
    expect(readReturnReason(null)).toBeNull();
  });
  it("maps errors and settles cards another parent decided", () => {
    expect(reviewErrorKey("already_reviewed")).toBe("c03.review.alreadyReviewed");
    expect(reviewErrorKey("boom")).toBe("parentHome.reviewError");
    expect(reviewSettled("already_reviewed")).toBe(true);
    expect(reviewSettled("submission_changed")).toBe(false);
  });
  it("has TR/EN copy for every reason, for parent and child", () => {
    for (const dict of [tr, en] as Record<string, any>[]) {
      for (const reason of TASK_RETURN_REASONS) {
        expect(dict.c03.reason[reason]).toBeTruthy();
        expect(dict.c03.childNext[reason]).toBeTruthy();
      }
    }
  });
});

describe("bulk selection state (C03)", () => {
  const row = (id: string, blocked: string | null = null) => ({ type: "event" as const, id, key: { id }, title: id, child_id: null, revision: 1, archived: false, blocked });
  const preview = (truncated: boolean) => ({
    family_id: "00000000-0000-4000-8000-000000000001", today: "2026-11-06", generated_at: "", scope: {}, truncated,
    items: [row("a"), row("b"), row("c", "prova_draft_assigned")],
    summary: { total: 3, archivable: 2, blocked: 1, by_type: {}, blocked_reasons: {} },
  });
  it("never calls a truncated listing 'all'", () => {
    expect(bulkSelectionState({ preview: preview(true), mode: "archive", selected: 2 })).toMatchObject({ truncated: true, selectable: 2, allListedPicked: true });
    expect(bulkSelectionState({ preview: preview(false), mode: "archive", selected: 1 })).toMatchObject({ truncated: false, allListedPicked: false });
  });
  it("flags selections above the apply limit", () => {
    expect(bulkSelectionState({ preview: preview(false), mode: "archive", selected: BULK_APPLY_LIMIT + 1 }).overApplyLimit).toBe(true);
  });
});
