import { describe, expect, it } from "vitest";
import {
  bulkArchiveItemsSchema,
  bulkArchivePreviewSchema,
  bulkArchiveScopeSchema,
  bulkItemsFromPreview,
  bulkPreviewRowKey,
  bulkReasonKey,
  bulkRestoreItemsFromPreview,
  readBulkResult,
  summarizeBulkResult,
} from "./bulk-archive";
const fam = "10000000-0000-4000-8000-000000000001";
const child = "20000000-0000-4000-8000-000000000001";
const rid = "30000000-0000-4000-8000-000000000001";
const eid = "35000000-0000-4000-8000-000000000001";
const key = "50000000-0000-4000-8000-000000000001";
const row = (patch: Record<string, unknown>) => ({
  type: "reward",
  id: rid,
  key: { id: rid },
  title: "Sinema",
  child_id: null,
  revision: 1,
  archived: false,
  blocked: null,
  ...patch,
});
const preview = (items: Record<string, unknown>[]) =>
  bulkArchivePreviewSchema.parse({
    family_id: fam,
    today: "2026-11-06",
    generated_at: "2026-11-06T01:00:00Z",
    scope: { types: ["reward"] },
    truncated: false,
    items,
    summary: { total: items.length, archivable: 0, blocked: 0, by_type: {}, blocked_reasons: {} },
  });
describe("bulk archive scope", () => {
  it("requires one type, ordered range and bag/occurrence prerequisites", () => {
    expect(bulkArchiveScopeSchema.safeParse({ types: [] }).success).toBe(false);
    expect(bulkArchiveScopeSchema.safeParse({ types: ["reward"], from: "2026-11-10", to: "2026-11-01" }).success).toBe(false);
    expect(bulkArchiveScopeSchema.safeParse({ types: ["event"], event_scope: "occurrence", from: "2026-11-01", to: "2026-11-02" }).success).toBe(false);
    expect(bulkArchiveScopeSchema.safeParse({ types: ["event"], event_scope: "occurrence", from: "2026-11-01", to: "2026-11-01" }).success).toBe(true);
    expect(bulkArchiveScopeSchema.safeParse({ types: ["school_bag"], from: "2026-11-01", to: "2026-11-05" }).success).toBe(false);
    expect(bulkArchiveScopeSchema.safeParse({ types: ["school_bag"], child_id: child, from: "2026-11-01", to: "2026-11-05", bag_mode: "clear_day" }).success).toBe(true);
    expect(bulkArchiveScopeSchema.safeParse({ types: ["reward"], delete: true }).success).toBe(false);
  });
});
describe("bulk archive items", () => {
  it("shapes each type strictly and bounds the batch", () => {
    expect(bulkArchiveItemsSchema.safeParse([]).success).toBe(false);
    expect(bulkArchiveItemsSchema.safeParse([{ type: "reward", id: rid }]).success).toBe(false);
    expect(bulkArchiveItemsSchema.safeParse([{ type: "exam", id: rid, revision: 1 }]).success).toBe(false);
    expect(bulkArchiveItemsSchema.safeParse([{ type: "school_bag", child_id: child, day: "2026-11-06", mode: "clear_day" }]).success).toBe(true);
    expect(bulkArchiveItemsSchema.safeParse([{ type: "event", id: eid, occurrence_date: "2026-13-01" }]).success).toBe(false);
    expect(bulkArchiveItemsSchema.safeParse(Array.from({ length: 201 }, () => ({ type: "reward", id: rid, revision: 1 }))).success).toBe(false);
  });
  it("turns only archivable, selected preview rows into items with the seen revision", () => {
    const p = preview([
      row({}),
      row({ id: "30000000-0000-4000-8000-000000000002", key: { id: "30000000-0000-4000-8000-000000000002" }, blocked: "reward_has_goals" }),
      row({ type: "event", id: eid, key: { id: eid, occurrence_date: "2026-11-06" }, child_id: child, revision: 3, scope: "occurrence" }),
      row({ type: "school_bag", id: null, key: { child_id: child, day: "2026-11-06", mode: "clear_day" }, child_id: child, day: "2026-11-06", mode: "clear_day", revision: 2, program_revision: 4 }),
    ]);
    expect(bulkItemsFromPreview(p)).toEqual([
      { type: "reward", id: rid, revision: 1 },
      { type: "event", id: eid, revision: 3, occurrence_date: "2026-11-06" },
      { type: "school_bag", child_id: child, day: "2026-11-06", mode: "clear_day", revision: 2, program_revision: 4 },
    ]);
    const selected = new Set([bulkPreviewRowKey({ type: "event", key: { id: eid, occurrence_date: "2026-11-06" } })]);
    expect(bulkItemsFromPreview(p, selected)).toEqual([{ type: "event", id: eid, revision: 3, occurrence_date: "2026-11-06" }]);
    expect(() => bulkItemsFromPreview(p, new Set())).toThrow();
  });
  it("restores only archived rows and never school bags from a list", () => {
    const p = preview([row({ archived: true, revision: 2 }), row({ type: "school_bag", id: null, key: { child_id: child, day: "2026-11-06", mode: "reset_checks" }, child_id: child, archived: true })]);
    expect(bulkRestoreItemsFromPreview(p)).toEqual([{ type: "reward", id: rid, revision: 2 }]);
  });
});
describe("bulk archive results", () => {
  const raw = {
    run_id: key,
    operation: "archive",
    items: [
      { type: "reward", key: { id: rid }, status: "ok", reason: null, result: { id: rid, revision: 2 } },
      { type: "note", key: { id: eid }, status: "skipped", reason: "note_not_author", result: null },
      { type: "exam", key: { id: eid }, status: "skipped", reason: "type_invalid", result: null },
    ],
    summary: { ok: 1, skipped: 2, reasons: { note_not_author: 1, type_invalid: 1 } },
  };
  it("rejects a reply for another key or operation", () => {
    expect(readBulkResult(raw, key, "archive").summary.ok).toBe(1);
    expect(() => readBulkResult(raw, eid, "archive")).toThrow("bulk_result_mismatch");
    expect(() => readBulkResult(raw, key, "restore")).toThrow("bulk_result_mismatch");
  });
  it("summarises partial success with translatable reasons", () => {
    const s = summarizeBulkResult(readBulkResult(raw, key, "archive"));
    expect(s.partial).toBe(true);
    expect(s.reasons.map((r) => r.key)).toEqual(["bulkArchive.reason.note_not_author", "bulkArchive.reason.type_invalid"]);
    expect(bulkReasonKey("something_unexpected")).toBe("bulkArchive.reason.failed");
    expect(bulkReasonKey(null)).toBe("bulkArchive.reason.failed");
  });
});
