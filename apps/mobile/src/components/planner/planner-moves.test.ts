import { describe, expect, it } from "vitest";
import type { Lesson, TimetableCell } from "@gina/core";
import {
  bagSuggestions,
  bindingFor,
  cellDoubts,
  copyDayPlan,
  distributePlanDates,
  moveTimetableCellToDay,
  readEmptyCellId,
  subjectBindingStore,
} from "./planner-moves";

const settings = { start: "08:30", duration: 40, break: 10 };
const cell = (id: string, day: number, start: string | null, end: string | null, title = id): TimetableCell => ({ id, day, title, start, end });

describe("moveTimetableCellToDay", () => {
  it("appends after the last lesson using the day's bell gap and keeps duration", () => {
    const rows = [cell("a", 1, "08:30", "09:10"), cell("b", 1, "09:20", "10:00"), cell("c", 2, "08:30", "09:10")];
    const next = moveTimetableCellToDay(rows, "a", 2, settings);
    expect(next.find((r) => r.id === "a")).toMatchObject({ day: 2, start: "09:20", end: "10:00" });
    // Nothing else is touched or overwritten.
    expect(next.find((r) => r.id === "b")).toEqual(rows[1]);
    expect(next.find((r) => r.id === "c")).toEqual(rows[2]);
    expect(next).toHaveLength(3);
  });
  it("starts an empty day at the parent's first lesson time", () => {
    const next = moveTimetableCellToDay([cell("a", 1, "10:00", "10:45")], "a", 3, settings);
    expect(next[0]).toMatchObject({ day: 3, start: "08:30", end: "09:15" });
  });
  it("skipped empty periods keep bell spacing", () => {
    const rows = [cell("a", 1, "08:30", "09:10"), cell("b", 2, "08:30", "09:10")];
    const next = moveTimetableCellToDay(rows, "a", 2, settings, 2);
    expect(next.find((r) => r.id === "a")).toMatchObject({ start: "10:10", end: "10:50" });
  });
  it("never invents a clock for untimed sources", () => {
    const rows = [cell("a", 1, null, null), cell("b", 2, "08:30", "09:10")];
    expect(moveTimetableCellToDay(rows, "a", 2, settings).find((r) => r.id === "a")).toMatchObject({ day: 2, start: null, end: null });
    const untimedDay = [cell("a", 1, "08:30", "09:10"), cell("b", 2, null, null)];
    expect(moveTimetableCellToDay(untimedDay, "a", 2, settings).find((r) => r.id === "a")).toMatchObject({ start: null, end: null });
  });
  it("rejects a move that passes midnight and excluded lessons", () => {
    expect(() => moveTimetableCellToDay([cell("a", 1, "08:00", "09:00"), cell("b", 2, "22:30", "23:30")], "a", 2, settings)).toThrow("dayFull");
    expect(() => moveTimetableCellToDay([{ ...cell("a", 1, "08:00", "09:00"), included: false }], "a", 2, settings)).toThrow("invalid");
  });
  it("parses empty cell ids", () => {
    expect(readEmptyCellId("empty:3:5")).toEqual({ day: 3, slot: 5 });
    expect(readEmptyCellId("abc")).toBeNull();
  });
});

describe("copyDayPlan", () => {
  const l = (id: string, day: number, start: string, title: string): Lesson => ({ id, day, start, end: start.replace(/:(\d)0/, ":$14"), title });
  it("shows before/after and replaces only target days", () => {
    let n = 0;
    const lessons = [l("m1", 1, "08:30", "Mat"), l("m2", 1, "09:20", "Türkçe"), l("t1", 2, "08:30", "Fen"), l("w1", 3, "08:30", "Müzik")];
    const { lessons: next, preview } = copyDayPlan(lessons, 1, [2, 1, 2], () => `k${n++}`);
    expect(preview).toHaveLength(1);
    expect(preview[0].before.map((x) => x.title)).toEqual(["Fen"]);
    expect(preview[0].after.map((x) => x.title)).toEqual(["Mat", "Türkçe"]);
    expect(next.filter((x) => x.day === 2).map((x) => x.id)).toEqual(["k0", "k1"]);
    expect(next.find((x) => x.id === "w1")).toBeTruthy();
    expect(next.filter((x) => x.day === 1)).toHaveLength(2);
  });
});

describe("cellDoubts", () => {
  it("flags missing time, unknown source name and reader notes", () => {
    expect(cellDoubts({ ...cell("a", 1, null, null, "Xyz"), originalTitle: "XYZ", note: "silik" })).toEqual(["time", "name", "note"]);
    expect(cellDoubts({ ...cell("a", 1, "08:30", "09:10", "Matematik"), originalTitle: "MAT" })).toEqual([]);
  });
});

describe("distributePlanDates", () => {
  it("fills chosen weekdays, earliest due first, never past due", () => {
    // 2026-11-06 is a Friday.
    const items = [
      { index: 0, due_on: null, planned_on: "2026-11-06" },
      { index: 1, due_on: "2026-11-09", planned_on: "2026-11-06" },
      { index: 2, due_on: "2026-11-20", planned_on: "2026-11-06" },
      { index: 3, due_on: "2026-11-01", planned_on: "2026-11-06" },
      { index: 4, due_on: "2026-11-09", planned_on: "2026-11-06" },
    ];
    const out = distributePlanDates(items, { start: "2026-11-06", weekdays: [1, 2, 3, 4, 5], perDay: 1 });
    expect(out.map((x) => [x.index, x.planned_on, x.capped, x.blocked])).toEqual([
      [0, "2026-11-11", false, false],
      [1, "2026-11-06", false, false],
      [2, "2026-11-10", false, false],
      [3, "2026-11-06", false, true],
      [4, "2026-11-09", false, false],
    ]);
  });
  it("caps at due date when the days run out", () => {
    const out = distributePlanDates(
      [0, 1, 2].map((i) => ({ index: i, due_on: "2026-11-07", planned_on: "2026-11-06" })),
      { start: "2026-11-06", weekdays: [5, 6], perDay: 1 },
    );
    expect(out.map((x) => [x.planned_on, x.capped])).toEqual([["2026-11-06", false], ["2026-11-07", false], ["2026-11-07", true]]);
  });
  it("returns nothing without weekdays", () => {
    expect(distributePlanDates([{ index: 0, due_on: null, planned_on: "2026-11-06" }], { start: "2026-11-06", weekdays: [], perDay: 2 })).toEqual([]);
  });
});

describe("bagSuggestions and subject bindings", () => {
  it("derives editable hints from distinct lesson names", () => {
    expect(bagSuggestions([{ title: "Matematik" }, { title: "MATEMATİK" }, { title: "Beden Eğitimi" }, { title: "Görsel Sanatlar" }])).toEqual([
      { kind: "book", subject: "Matematik" },
      { kind: "notebook", subject: "Matematik" },
      { kind: "pe", subject: "Beden Eğitimi" },
      { kind: "art", subject: "Görsel Sanatlar" },
    ]);
  });
  it("stores bindings per scope and keyed by normalised name", () => {
    const mem = new Map<string, string>();
    const store = { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v), remove: (k: string) => void mem.delete(k), keys: () => [...mem.keys()] };
    const a = subjectBindingStore(store, "u", "f", "c1"), b = subjectBindingStore(store, "u", "f", "c2");
    a.bind("MAT.", { subject_id: "subject-math", label_tr: "Matematik", label_en: "Mathematics" });
    expect(bindingFor(a.read(), "mat")?.subject_id).toBe("subject-math");
    expect(b.read()).toEqual({});
    a.bind("mat", null);
    expect(a.read()).toEqual({});
    expect(subjectBindingStore(store, "", "f", "c1").bind("mat", { subject_id: "subject-math", label_tr: "", label_en: "" })).toEqual({});
  });
});
