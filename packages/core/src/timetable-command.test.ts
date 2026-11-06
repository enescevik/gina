import { describe, expect, it } from "vitest";
import {
  readTimetableReceipt,
  timetableCommandSchema,
} from "./timetable-command";
const id = "00000000-0000-4000-8000-000000000001",
  child = "00000000-0000-4000-8000-000000000002";
const input = {
  p_request_id: id,
  p_child_id: child,
  p_revision: 3,
  p_lessons: [{
    id: "math",
    day: 1,
    title: "Matematik",
    start: "09:00",
    end: "09:40",
  }],
  p_settings: { start: "09:00", duration: 40, break: 10 },
};
describe("durable timetable saves", () => {
  it("accepts exact acknowledged revision, including an empty program", () => {
    const command = timetableCommandSchema.parse(input);
    expect(
      readTimetableReceipt(
        { request: id, child_id: child, revision: 4 },
        command,
      ).revision,
    ).toBe(4);
    expect(timetableCommandSchema.parse({ ...input, p_lessons: [] }).p_lessons)
      .toEqual([]);
  });
  it("accepts the dated receipt returned since dated plan history", () => {
    const command = timetableCommandSchema.parse(input);
    expect(
      readTimetableReceipt(
        { request: id, child_id: child, revision: 4, effective_from: "2026-11-06" },
        command,
      ).revision,
    ).toBe(4);
    expect(() =>
      readTimetableReceipt(
        { request: id, child_id: child, revision: 4, effective_from: "yarın" },
        command,
      )
    ).toThrow();
  });
  it("does not acknowledge a different child, request or revision", () => {
    for (
      const patch of [{ request: child }, { child_id: id }, { revision: 3 }, {
        revision: 5,
      }, { extra: true }]
    ) {
      expect(() =>
        readTimetableReceipt({
          request: id,
          child_id: child,
          revision: 4,
          ...patch,
        }, input)
      ).toThrow();
    }
  });
  it("rejects malformed persisted data instead of dropping fields", () => {
    for (
      const patch of [
        { p_revision: -1 },
        { p_settings: { ...input.p_settings, timezone: "Europe/Istanbul" } },
        { p_lessons: [{ ...input.p_lessons[0], notes: "hidden" }] },
        { p_settings: { ...input.p_settings, duration: 0 } },
      ]
    ) {
      expect(timetableCommandSchema.safeParse({ ...input, ...patch }).success)
        .toBe(false);
    }
  });
  it("rejects duplicate or overlapping saved lessons", () => {
    expect(
      timetableCommandSchema.safeParse({
        ...input,
        p_lessons: [...input.p_lessons, ...input.p_lessons],
      }).success,
    ).toBe(false);
    expect(
      timetableCommandSchema.safeParse({
        ...input,
        p_lessons: [...input.p_lessons, {
          ...input.p_lessons[0],
          id: "science",
          start: "09:30",
          end: "10:10",
        }],
      }).success,
    ).toBe(false);
  });
  it("allows adjacent lessons but rejects invalid clock values and blank names", () => {
    expect(
      timetableCommandSchema.safeParse({
        ...input,
        p_lessons: [...input.p_lessons, {
          ...input.p_lessons[0],
          id: "science",
          start: "09:40",
          end: "10:20",
        }],
      }).success,
    ).toBe(true);
    for (
      const patch of [{ start: "25:00" }, { end: "09:00" }, { title: "  " }]
    ) {
      expect(
        timetableCommandSchema.safeParse({
          ...input,
          p_lessons: [{ ...input.p_lessons[0], ...patch }],
        }).success,
      ).toBe(false);
    }
  });
});
