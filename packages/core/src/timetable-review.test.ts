import { describe, expect, it } from "vitest";
import {
  changeTimetableBreak,
  editTimetableCell,
  inferBellPattern,
  normalizeLessonTitle,
  scheduleTimetable,
  swapTimetableCells,
  type TimetableCell,
  timetableDay,
} from "./timetable-review";
const rows: TimetableCell[] = [1, 2, 3, 4, 5].flatMap((day) =>
  Array.from(
    { length: 8 },
    (_, i) => ({
      id: `${day}_${i}`,
      day,
      title: i === 0 ? "MAT" : "İNG",
      start: null,
      end: null,
    }),
  )
);
const pattern = {
  start: "08:30",
  duration: 40,
  break: 10,
  lunchAfter: 4,
  lunchMinutes: 60,
};
describe("weekly photograph review", () => {
  it("expands known Turkish abbreviations and retains unknown words without inventing a subject", () => {
    expect(normalizeLessonTitle("MAT.").title).toBe("Matematik");
    expect(normalizeLessonTitle("İNG").title).toBe("İngilizce");
    expect(normalizeLessonTitle("SOS").title).toBe("Sosyal Bilgiler");
    expect(normalizeLessonTitle("ahlak VE vatandaş")).toEqual({
      title: "Ahlak ve Vatandaş",
      matched: false,
    });
  });
  it("schedules 40 source lessons by period, with a lunch gap and no mutation", () => {
    const next = scheduleTimetable(rows, [1, 2, 3, 4, 5], pattern);
    expect(next[0]!.start).toBe("08:30");
    expect(next[3]!.end).toBe("11:40");
    expect(next[4]!.start).toBe("12:40");
    expect(next[7]!.end).toBe("15:50");
    expect(rows[0]!.start).toBeNull();
  });
  it("increasing one break shifts only later lessons of that day and keeps durations", () => {
    const base = scheduleTimetable(rows, [1, 2, 3, 4, 5], pattern),
      next = changeTimetableBreak(base, "1_0", 20);
    expect(next[0]!).toEqual(base[0]!);
    expect(next[1]!.start).toBe("09:30");
    expect(next[7]!.end).toBe("16:00");
    expect(next[8]!).toEqual(base[8]!);
  });
  it("end-time editing can shift later lessons while preserving lunch", () => {
    const base = scheduleTimetable(rows, [1, 2, 3, 4, 5], pattern);
    const next = editTimetableCell(base, { ...base[0]!, end: "09:20" }, true);
    expect(next[1]!.start).toBe("09:30");
    expect(next[4]!.start).toBe("12:50");
  });
  it("cross-day exchange preserves identities, notes and original slots", () => {
    const base = scheduleTimetable(rows, [1, 2, 3, 4, 5], pattern),
      next = swapTimetableCells(base, "1_0", "2_2");
    expect(next.find((r) => r.id === "1_0")).toMatchObject({
      day: 2,
      start: "10:10",
      title: "MAT",
    });
    expect(next.find((r) => r.id === "2_2")).toMatchObject({
      day: 1,
      start: "08:30",
      title: "İNG",
    });
    expect(new Set(next.map((r) => r.id)).size).toBe(40);
  });
  it("rejects midnight overflow atomically and retains partial source order", () => {
    expect(() => scheduleTimetable(rows, [1], { ...pattern, start: "23:00" }))
      .toThrow("dayFull");
    expect(
      timetableDay([{ ...rows[0]!, start: "10:00", end: "10:40" }, rows[1]!], 1)
        .map((r) => r.id),
    ).toEqual(["1_0", "1_1"]);
  });
  it("excluded lessons do not consume a period or lose their source", () => {
    const next = scheduleTimetable([{ ...rows[0]!, included: false }, rows[1]!], [
      1,
    ], pattern);
    expect(next[0]!.start).toBeNull();
    expect(next[1]!.start).toBe("08:30");
    expect(() =>
      changeTimetableBreak(
        [
          { ...next[0]!, start: "08:00", end: "08:30" },
          next[1]!,
        ],
        next[0]!.id,
        20,
      )
    ).toThrow("invalid");
  });
});

it("reopening times preserves the existing lunch break", () => {
  const saved = scheduleTimetable(rows, [1], pattern);
  expect(
    inferBellPattern(saved, 1, { start: "09:00", duration: 40, break: 10 }),
  ).toEqual(pattern);
});
