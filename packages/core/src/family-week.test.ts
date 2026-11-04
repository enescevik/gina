import { describe, expect, it } from "vitest";
import { recordedWeek, type WeekRecord } from "./family-week";
const row = (id: string, status: string, extra: Partial<WeekRecord> = {}) => ({
  id,
  status,
  child_id: "child",
  due_date: "2026-11-03",
  ...extra,
});
const count = (rows: WeekRecord[]) =>
  recordedWeek(rows, ["child"], "2026-11-02", "2026-11-04");
describe("recorded family week", () => {
  it("separates parent approval, pending and returned without a completion percentage", () =>
    expect(
      count([row("a", "approved"), row("b", "done"), row("c", "returned")]),
    ).toEqual({ approved: 1, pending: 1, returned: 1 }));
  it("does not turn absent or unknown entries into failures", () => {
    expect(count([])).toEqual({ approved: 0, pending: 0, returned: 0 });
    expect(count([row("a", "planned")])).toEqual({
      approved: 0,
      pending: 0,
      returned: 0,
    });
  });
  it("excludes another child, future days and dates outside the visible week", () =>
    expect(
      count([
        row("a", "approved", { child_id: "other" }),
        row("b", "approved", { due_date: "2026-11-05" }),
        row("c", "done", { due_date: "2026-11-01" }),
        row("d", "done", { due_date: "2026-02-30" }),
      ]),
    ).toEqual({ approved: 0, pending: 0, returned: 0 }));
  it("ignores duplicate record identities", () =>
    expect(count([row("a", "approved"), row("a", "approved")]).approved).toBe(
      1,
    ));
  it("rejects an invalid date range", () =>
    expect(
      recordedWeek(
        [row("a", "approved")],
        ["child"],
        "2026-11-04",
        "2026-11-02",
      ),
    ).toEqual({ approved: 0, pending: 0, returned: 0 }));
});
