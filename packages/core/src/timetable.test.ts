import { describe, it, expect } from "vitest";
import {
  validateLessons,
  nextLessonTimes,
  validLessonSettings,
  DEFAULT_LESSON_SETTINGS as settings,
  type Lesson,
} from "./timetable";
const lesson: Lesson = {
  id: "one",
  day: 1,
  title: "Matematik",
  start: "09:00",
  end: "09:40",
};
describe("weekly school timetable", () => {
  it("rejects overlap but permits adjacent periods and other days", () => {
    expect(
      validateLessons([
        lesson,
        { ...lesson, id: "two", start: "09:30", end: "10:00" },
      ]),
    ).toBe("overlap");
    expect(
      validateLessons([
        lesson,
        { ...lesson, id: "two", start: "09:40", end: "10:20" },
      ]),
    ).toBeNull();
    expect(
      validateLessons([lesson, { ...lesson, id: "two", day: 2 }]),
    ).toBeNull();
  });
  it("rejects duplicate keys, invalid days/times and midnight wrapping", () => {
    expect(validateLessons([lesson, lesson])).toBe("invalid");
    for (const change of [
      { day: 0 },
      { day: 8 },
      { start: "9:00" },
      { end: "24:00" },
      { end: "08:00" },
      { title: " " },
    ])
      expect(validateLessons([{ ...lesson, ...change }])).toBe("invalid");
  });
  it("derives next period from latest end, not row ordering", () => {
    expect(nextLessonTimes([], 1, settings)).toEqual({
      start: "09:00",
      end: "09:40",
    });
    expect(
      nextLessonTimes(
        [lesson, { ...lesson, id: "two", start: "10:00", end: "10:40" }],
        1,
        settings,
      ),
    ).toEqual({ start: "10:50", end: "11:30" });
    expect(
      nextLessonTimes([{ ...lesson, end: "23:50" }], 1, settings),
    ).toBeNull();
  });
  it("validates lesson and break settings", () => {
    expect(validLessonSettings(settings)).toBe(true);
    for (const change of [
      { duration: 0 },
      { duration: 2.5 },
      { break: -1 },
      { start: "25:00" },
    ])
      expect(validLessonSettings({ ...settings, ...change })).toBe(false);
  });
});
