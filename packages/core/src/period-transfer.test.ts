import { describe, it, expect } from "vitest";
import {
  defaultTransferDecisions,
  periodTransferPreviewSchema,
  routineCopyDiff,
  summarizePeriodTransfer,
  transferDecisionsValid,
  transferItemsPayload,
  type PeriodTransferPreview,
} from "./period-transfer";

const preview: PeriodTransferPreview = periodTransferPreviewSchema.parse({
  revision: 2,
  today: "2026-11-05",
  archived: false,
  from: { id: "a0000000-0000-4000-8000-000000000001", academic_year: 2025, grade: 4, school: "A", starts_on: "2025-09-01", ends_on: "2026-11-05", reason: "initial" },
  to: { id: "a0000000-0000-4000-8000-000000000002", academic_year: 2026, grade: 5, school: "A", starts_on: "2026-11-05", ends_on: null, reason: "new_year" },
  routines: [
    { id: "b0000000-0000-4000-8000-000000000001", revision: 3, title: "Kitap oku", icon: "read-book", stars: 2, days_of_week: [1, 2, 3, 4, 5], time_of_day: "evening", requires_approval: true, starts_on: "2025-09-20", ends_on: null, pending: 1, returned: 0, approved: 12, stars_earned: 24 },
    { id: "b0000000-0000-4000-8000-000000000002", revision: 1, title: "Çanta", icon: "pack-school-bag", stars: 1, days_of_week: [1, 2, 3, 4, 5, 6, 7], time_of_day: "any", requires_approval: false, starts_on: "2025-10-01", ends_on: null, pending: 0, returned: 1, approved: 3, stars_earned: 3 },
  ],
  plans: [
    { id: "c0000000-0000-4000-8000-000000000001", revision: 4, kind: "homework", title: "Kesirler", subject: "Matematik", planned_on: "2026-10-30", due_on: "2026-11-02", time: "17:00", steps: 2, steps_checked: 1 },
  ],
});

describe("period transfer decisions", () => {
  it("defaults to pausing/archiving old records and never moves them into the past", () => {
    const d = defaultTransferDecisions(preview);
    expect(d.routines.map((r) => r.action)).toEqual(["pause", "pause"]);
    expect(d.routines[0]!.starts_on).toBe("2026-11-05");
    expect(d.plans[0]!.action).toBe("archive");
    expect(d.plans[0]!.planned_on).toBe("2026-11-05");
    expect(d.plans[0]!.due_on).toBeNull();
    expect(transferDecisionsValid(d, preview)).toBe(true);
  });
  it("rejects a copy that starts before the new period, has no days, or misses a candidate", () => {
    const d = defaultTransferDecisions(preview);
    d.routines[0]!.action = "copy";
    d.routines[0]!.starts_on = "2026-11-04";
    expect(transferDecisionsValid(d, preview)).toBe(false);
    d.routines[0]!.starts_on = "2026-11-06";
    d.routines[0]!.days_of_week = [];
    expect(transferDecisionsValid(d, preview)).toBe(false);
    d.routines[0]!.days_of_week = [1, 3];
    expect(transferDecisionsValid(d, preview)).toBe(true);
    expect(transferDecisionsValid({ ...d, plans: [] }, preview)).toBe(false);
  });
  it("summarizes before/after without touching earned evidence", () => {
    const d = defaultTransferDecisions(preview);
    d.routines[0]!.action = "copy";
    d.plans[0]!.action = "keep";
    const s = summarizePeriodTransfer(d, preview);
    expect(s.routines).toEqual({ total: 2, copy: 1, pause: 1, keep: 0 });
    expect(s.plans).toEqual({ total: 1, copy: 0, archive: 0, keep: 1 });
    expect(s.pendingWork).toBe(2);
    expect(s.starsEarned).toBe(27);
    expect(s.checkedSteps).toBe(1);
  });
  it("sends only changed copy fields and keeps non-copy decisions minimal", () => {
    const d = defaultTransferDecisions(preview);
    d.routines[0]!.action = "copy";
    d.routines[0]!.days_of_week = [1, 3, 5];
    d.plans[0]!.action = "copy";
    d.plans[0]!.due_on = "2026-11-10";
    const payload = transferItemsPayload(d, preview);
    expect(payload.routines[0]).toEqual({ id: preview.routines[0]!.id, revision: 3, action: "copy", days_of_week: [1, 3, 5], starts_on: "2026-11-05" });
    expect(payload.routines[1]).toEqual({ id: preview.routines[1]!.id, revision: 1, action: "pause" });
    expect(payload.plans[0]).toEqual({ id: preview.plans[0]!.id, revision: 4, action: "copy", planned_on: "2026-11-05", due_on: "2026-11-10" });
    expect(routineCopyDiff(preview.routines[0]!, d.routines[0]!)).toEqual({ days: true, starts_on: true, ends_on: false });
  });
});
