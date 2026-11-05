import { describe, expect, it } from "vitest";
import {
  childDeletionCountLines,
  childDeletionPreviewSchema,
  accountDeletionPreviewSchema,
  deletionErrorKey,
  deletionPreviewSchema,
  deletionTargetSchema,
  formatApproximateBytes,
  isPreviewUsable,
  orderedDeletionWarnings,
  previewSecondsLeft,
  sumChildDeletionCounts,
  type ChildDeletionCounts,
} from "./deletion-preview";

const counts: ChildDeletionCounts = {
  task_routines: 1,
  task_completions: 4,
  pending_task_reviews: 1,
  stars: { events: 2, balance: 7 },
  badges: 0,
  rewards: { requests: 1, pending: 1, goals: 0 },
  notes: { own: 1, shared: 1, child_authored: 0 },
  prova: { exams: 1, attempts: 1, in_progress: 1, answers: 0, study_plans: 0 },
  calendar: { events: 0, timetables: 0, education_periods: 0 },
  grades: 0,
  shares: { total: 1, open: 1 },
  devices: { allowed: 1, active_sessions: 1 },
  ai: { timetable_imports: 0, answer_reviews: 0, inbox: 0 },
  files: { count: 0, bytes: 0, linked_family_files: 0 },
};
const envelope = {
  preview_token: "6f1c2b1a-9c1e-4e5d-8a3b-2d9f0c7e1a11",
  expires_at: "2026-11-06T04:15:00.000Z",
  generated_at: "2026-11-06T04:00:00.000Z",
  ttl_seconds: 900,
  subscription: { affected: false, cancelled_by_deletion: false as const, managed_in_store: true as const },
};
const childPreview = {
  kind: "child" as const,
  child: { id: "20000000-0000-4000-8000-000000009001", name: "Ece", avatar: "avatar-default", grade: 5, family_id: "10000000-0000-4000-8000-000000009001", archived: false, archive_revision: 0 },
  deletes: counts,
  preserved: { co_parent_private_notes: 1, family_notes: 1, family_files: { count: 0, bytes: 0 }, family_questions: 0, family_rewards: 1, prova_drafts_referencing: 0, other_children: 1, usage_receipts: true as const },
  alternatives: { archive_available: true, already_archived: false },
  shares_active: 1,
  warnings: ["in_progress_attempts", "active_device_sessions", "mystery_flag", "co_parent_private_notes_kept"],
  ...envelope,
};

describe("deletion preview contract", () => {
  it("accepts a child preview as returned by deletion_preview()", () => {
    expect(childDeletionPreviewSchema.parse(childPreview).child.name).toBe("Ece");
    expect(deletionPreviewSchema.parse(childPreview).kind).toBe("child");
  });
  it("accepts an account preview with transfer and cascade families", () => {
    const parsed = accountDeletionPreviewSchema.parse({
      kind: "account",
      families: [
        { id: "10000000-0000-4000-8000-000000009001", name: "Shared", mode: "transfer", other_parents: 1, children: [{ id: "20000000-0000-4000-8000-000000009002", name: "Can", archived: false, counts: null }], deletes: { own_notes: 1 }, preserved: { children: 1 } },
        { id: "10000000-0000-4000-8000-000000009003", name: "Single", mode: "cascade", other_parents: 0, children: [{ id: "20000000-0000-4000-8000-000000009003", name: "Oth", archived: false, counts }], deletes: { files: { count: 1, bytes: 2048 } }, preserved: {} },
      ],
      subscriptions: [{ id: "6f1c2b1a-9c1e-4e5d-8a3b-2d9f0c7e1a12", family_id: "10000000-0000-4000-8000-000000009001", platform: "apple", plan: "plus", status: "active", expires_at: "2026-12-06T00:00:00Z", auto_renewing: true, purchased_by_me: true, cancelled_by_deletion: false, managed_in_store: true }],
      alternatives: { archive_available: false, archivable_children: 1 },
      warnings: ["subscription_not_cancelled", "family_deleted"],
      ...envelope,
    });
    expect(parsed.families[1]?.mode).toBe("cascade");
    expect(parsed.subscriptions[0]?.cancelled_by_deletion).toBe(false);
  });
  it("rejects a preview that claims the store subscription was cancelled", () => {
    expect(() => childDeletionPreviewSchema.parse({ ...childPreview, subscription: { ...envelope.subscription, cancelled_by_deletion: true } })).toThrow();
  });
  it("validates deletion targets", () => {
    expect(deletionTargetSchema.parse({ kind: "account" })).toEqual({ kind: "account" });
    expect(deletionTargetSchema.safeParse({ kind: "child", child_id: "nope" }).success).toBe(false);
    expect(deletionTargetSchema.safeParse({ kind: "family" }).success).toBe(false);
  });
});

describe("preview token timing", () => {
  const now = new Date("2026-11-06T04:10:00.000Z");
  it("reports remaining seconds and never negative", () => {
    expect(previewSecondsLeft(childPreview, now)).toBe(300);
    expect(previewSecondsLeft(childPreview, new Date("2026-11-06T05:00:00.000Z"))).toBe(0);
    expect(previewSecondsLeft({ expires_at: "garbage" }, now)).toBe(0);
  });
  it("keeps a safety margin before expiry", () => {
    expect(isPreviewUsable(childPreview, now)).toBe(true);
    expect(isPreviewUsable(childPreview, new Date("2026-11-06T04:14:40.000Z"))).toBe(false);
  });
});

describe("display helpers", () => {
  it("orders known warnings and keeps unknown ones last", () => {
    expect(orderedDeletionWarnings(childPreview.warnings)).toEqual(["active_device_sessions", "in_progress_attempts", "co_parent_private_notes_kept", "mystery_flag"]);
  });
  it("lists only record groups with records", () => {
    const lines = childDeletionCountLines(counts);
    expect(lines.map((l) => l.key)).toEqual(["task_routines", "task_completions", "stars", "reward_requests", "notes", "exams", "attempts", "shares", "devices"]);
    expect(lines.find((l) => l.key === "notes")?.count).toBe(2);
  });
  it("sums cascade children and ignores transfer children", () => {
    expect(sumChildDeletionCounts([{ counts: null }])).toBeNull();
    const total = sumChildDeletionCounts([{ counts }, { counts: null }, { counts }]);
    expect(total?.task_completions).toBe(8);
    expect(total?.stars).toEqual({ events: 4, balance: 14 });
    expect(total?.files.bytes).toBe(0);
  });
  it("formats approximate sizes per locale", () => {
    expect(formatApproximateBytes(0)).toBe("0 KB");
    expect(formatApproximateBytes(2048)).toBe("2 KB");
    expect(formatApproximateBytes(3.2 * 1024 * 1024, "tr")).toBe("3,2 MB");
    expect(formatApproximateBytes(3.2 * 1024 * 1024, "en")).toBe("3.2 MB");
    expect(formatApproximateBytes(5 * 1024 ** 3, "en")).toBe("5 GB");
  });
  it("maps server codes to i18n keys with a generic fallback", () => {
    expect(deletionErrorKey("deletion_preview_stale")).toBe("deletionPreview.error.stale");
    expect(deletionErrorKey("P0001: deletion_preview_expired")).toBe("deletionPreview.error.expired");
    expect(deletionErrorKey("permission denied for function")).toBe("deletionPreview.error.generic");
    expect(deletionErrorKey(null)).toBe("deletionPreview.error.generic");
  });
});
