import { describe, expect, it } from "vitest";
import {
  appendFamilyPage,
  appendTimelinePage,
  assertPreviewFamily,
  closedLimits,
  entitlementTimelineSchema,
  familiesSearchSchema,
  groupWorkqueue,
  normalizeFamilyQuery,
  openedLimits,
  overrideApplyArgs,
  overridePreviewSchema,
  presetUntil,
  readOverrideApplyResult,
  timelineGroup,
  waitingLabel,
  workqueueItemKey,
  workqueueReasonKey,
  workqueueSchema,
} from "./admin-workqueue";

const fam = "10000000-0000-4000-8000-000000009702";
const other = "10000000-0000-4000-8000-000000009701";
const key = "90000000-0000-4000-8000-000000009701";
const item = (patch: Record<string, unknown>) => ({
  role: "support",
  queue: "support",
  key: "tickets_open",
  count: 1,
  oldest_since: "2026-11-04T06:00:00+00:00",
  oldest_waiting_seconds: 172800,
  reason: "parent_waiting",
  ...patch,
});
const effective = { plan: "free", source: "free", expires_at: null };
const preview = (patch: Record<string, unknown> = {}) =>
  overridePreviewSchema.parse({
    as_of: "2026-11-06T01:00:00+00:00",
    family: { id: fam, name: "Diğer aile", timezone: "Europe/Istanbul", created_at: "2026-10-01T00:00:00+00:00", member_count: 1, child_count: 1 },
    request: { plan: "plus", until: "2026-12-06T00:00:00+00:00", reason_ok: true },
    before: effective,
    after: { plan: "plus", source: "comp", expires_at: "2026-12-06T00:00:00+00:00" },
    reverts_to: { ...effective, note: "store_state_unchanged_assumed" },
    changes: [
      { limit: "max_children", before: "2", after: "4", direction: "opens" },
      { limit: "max_notes", before: "20", after: null, direction: "opens" },
      { limit: "history_days", before: "30", after: "365", direction: "opens" },
      { limit: "ai_weekly", before: "false", after: "true", direction: "opens" },
    ],
    conflicts: [],
    presets: [
      { days: 7, until: "2026-11-14T00:00:00+03:00" },
      { days: 30, until: "2026-12-07T00:00:00+03:00" },
      { days: 90, until: "2027-02-05T00:00:00+03:00" },
    ],
    blockers: [],
    can_apply: true,
    replace_required: false,
    ...patch,
  });

describe("workqueue", () => {
  it("groups items by role and sums pending counts", () => {
    const q = workqueueSchema.parse({
      as_of: "2026-11-06T01:00:00+00:00",
      roles: ["support", "finance"],
      items: [item({}), item({ key: "tickets_sla_breached", reason: "waiting_over_24h", count: 3 }), item({ role: "finance", queue: "billing", key: "reconcile_jobs_failed", reason: "manual_store_check_failed", count: 0, oldest_since: null, oldest_waiting_seconds: null })],
    });
    expect(groupWorkqueue(q).map((g) => [g.role, g.pending])).toEqual([["support", 4], ["finance", 0]]);
    expect(workqueueItemKey(q.items[1]!)).toBe("admin.workqueue.tickets_sla_breached");
    expect(workqueueReasonKey(q.items[1]!)).toBe("admin.workqueue.reason.waiting_over_24h");
  });
  it("refuses items for a role the server did not grant", () => {
    const q = workqueueSchema.parse({ as_of: "x", roles: ["support"], items: [item({ role: "finance", queue: "billing", key: "k", reason: "r" })] });
    expect(() => groupWorkqueue(q)).toThrow("workqueue_role_leak");
  });
  it("rejects unknown roles and negative counts", () => {
    expect(workqueueSchema.safeParse({ as_of: "x", roles: ["owner"], items: [] }).success).toBe(false);
    expect(workqueueSchema.safeParse({ as_of: "x", roles: ["support"], items: [item({ count: -1 })] }).success).toBe(false);
  });
  it("labels waiting time in the coarsest sensible unit", () => {
    expect(waitingLabel(null)).toBeNull();
    expect(waitingLabel(59)).toEqual({ unit: "minutes", value: 0 });
    expect(waitingLabel(3599)).toEqual({ unit: "minutes", value: 59 });
    expect(waitingLabel(90000)).toEqual({ unit: "hours", value: 25 });
    expect(waitingLabel(3 * 86400 + 5)).toEqual({ unit: "days", value: 3 });
  });
});

describe("families search", () => {
  const row = (id: string, created: string) => ({
    id, name: "Sayfa", created_at: created, timezone: "Europe/Istanbul", member_count: 1, child_count: 2, archived_child_count: 0, device_count: 1,
    plan: "plus", plan_source: "store", plan_expires_at: "2026-12-01T00:00:00+00:00", store_status: "active", active_override_count: 0,
    last_activity_at: created, matched_on: ["name"],
  });
  it("normalizes the query and bounds its length", () => {
    expect(normalizeFamilyQuery("   ")).toBeNull();
    expect(normalizeFamilyQuery("  Elif ")).toBe("Elif");
    expect(() => normalizeFamilyQuery("x".repeat(121))).toThrow("query_too_long");
  });
  it("requires a cursor exactly when more pages exist", () => {
    const page = { as_of: "x", query: "Sayfa", limit: 50, rows: [], has_more: true, next_cursor: null };
    expect(familiesSearchSchema.safeParse(page).success).toBe(false);
    expect(familiesSearchSchema.safeParse({ ...page, has_more: false }).success).toBe(true);
  });
  it("rejects rows that leak extra columns such as email", () => {
    const page = { as_of: "x", query: null, limit: 50, rows: [{ ...row(fam, "2026-11-01T00:00:00+00:00"), email: "a@b" }], has_more: false, next_cursor: null };
    expect(familiesSearchSchema.safeParse(page).success).toBe(false);
  });
  it("appends disjoint pages in order and drops rows already shown", () => {
    const p1 = familiesSearchSchema.parse({ as_of: "x", query: "Sayfa", limit: 1, rows: [row(fam, "2026-11-02T00:00:00+00:00")], has_more: true, next_cursor: "2026-11-02 00:00:00+00|" + fam });
    const p2 = familiesSearchSchema.parse({ as_of: "x", query: "Sayfa", limit: 1, rows: [row(fam, "2026-11-02T00:00:00+00:00"), row(other, "2026-11-01T00:00:00+00:00")], has_more: false, next_cursor: null });
    const a = appendFamilyPage([], p1, null, null);
    const b = appendFamilyPage(a.rows, p2, p1.next_cursor, a.cursor);
    expect(b.rows.map((r) => r.id)).toEqual([fam, other]);
    expect(b.hasMore).toBe(false);
    expect(() => appendFamilyPage(a.rows, p2, "stale", a.cursor)).toThrow("page_out_of_order");
  });
});

describe("entitlement timeline", () => {
  const timeline = (familyId: string, events: { kind: string; id: string }[], more = false) =>
    entitlementTimelineSchema.parse({
      as_of: "x",
      family: { id: familyId, name: "Yıldız ailesi", timezone: "Europe/Istanbul", created_at: "2026-10-01T00:00:00+00:00", effective: { plan: "plus", source: "store", expires_at: "2026-12-01T00:00:00+00:00" } },
      limit: 50, has_more: more, next_cursor: more ? "c" : null,
      events: events.map((e, i) => ({ occurred_at: `2026-11-0${5 - i}T00:00:00+00:00`, kind: e.kind, id: e.id, family_of: e.kind.startsWith("store_") && e.kind !== "store_check_requested" ? "store" : "operator", data: {} })),
    });
  it("keeps refund, cancellation, compensation and manual verification apart", () => {
    expect(timelineGroup("store_refund")).toBe("refund");
    expect(timelineGroup("store_cancel")).toBe("cancellation");
    expect(timelineGroup("store_revoke")).toBe("revocation");
    expect(timelineGroup("comp_granted")).toBe("compensation");
    expect(timelineGroup("comp_revoked")).toBe("compensation");
    expect(timelineGroup("store_check_requested")).toBe("verification");
    expect(timelineGroup("store_grace")).toBe("lapse");
    expect(new Set(["store_refund", "store_cancel", "comp_granted", "store_check_requested"].map((k) => timelineGroup(k as never))).size).toBe(4);
  });
  it("rejects unknown kinds", () => {
    expect(() => timeline(fam, [{ kind: "store_gift", id: "1" }])).toThrow();
  });
  it("merges pages of the same family only", () => {
    const first = timeline(fam, [{ kind: "store_refund", id: "1" }, { kind: "comp_granted", id: "2" }], true);
    const second = timeline(fam, [{ kind: "comp_granted", id: "2" }, { kind: "store_purchase", id: "3" }]);
    expect(appendTimelinePage(first, second).events.map((e) => e.id)).toEqual(["1", "2", "3"]);
    expect(() => appendTimelinePage(first, timeline(other, []))).toThrow("timeline_family_mismatch");
  });
});

describe("override preview and apply", () => {
  it("accepts a consistent preview and exposes presets and limit changes", () => {
    const p = preview();
    expect(presetUntil(p, 30)).toBe("2026-12-07T00:00:00+03:00");
    expect(openedLimits(p)).toEqual(["max_children", "max_notes", "history_days", "ai_weekly"]);
    expect(closedLimits(p)).toEqual([]);
    expect(assertPreviewFamily(p, fam)).toBe(p);
  });
  it("treats a preview for another family as a wrong target", () => {
    expect(() => assertPreviewFamily(preview(), other)).toThrow("override_wrong_family");
  });
  it("rejects a preview whose can_apply disagrees with its blockers", () => {
    expect(() => preview({ blockers: ["plan_not_above_current"], can_apply: true })).toThrow();
    expect(preview({ blockers: ["plan_not_above_current"], can_apply: false }).can_apply).toBe(false);
    expect(() => preview({ blockers: ["something_else"], can_apply: false })).toThrow();
  });
  it("builds apply arguments with a reused idempotency key", () => {
    const request = { family_id: fam, plan: "plus" as const, until: "2026-12-06T00:00:00+03:00", reason: "  Destek telafisi " };
    expect(overrideApplyArgs(request, key)).toEqual({
      p_family_id: fam, p_plan: "plus", p_until: request.until, p_reason: "Destek telafisi", p_idempotency_key: key, p_replace_conflicts: false,
    });
    expect(overrideApplyArgs(request, key, true).p_replace_conflicts).toBe(true);
    expect(() => overrideApplyArgs(request, "not-a-uuid")).toThrow("idempotency_key_invalid");
  });
  it("validates the apply receipt against the request", () => {
    const request = { family_id: fam, plan: "pro" as const, until: "2026-12-06T00:00:00+03:00", reason: "Yükselt" };
    const ok = { request_id: key, action: "grant", override_id: "74000000-0000-4000-8000-000000009709", family_id: fam, replayed: true };
    expect(readOverrideApplyResult(request, key, ok).replayed).toBe(true);
    expect(() => readOverrideApplyResult(request, key, { ...ok, family_id: other })).toThrow("override_receipt_invalid");
    expect(() => readOverrideApplyResult(request, "90000000-0000-4000-8000-000000009799", ok)).toThrow("override_receipt_invalid");
    expect(() => readOverrideApplyResult(request, key, { ...ok, action: "expire" })).toThrow();
  });
});
