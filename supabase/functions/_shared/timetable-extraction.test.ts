import { assertEquals, assertThrows } from "jsr:@std/assert";
import { validateTimetableExtraction } from "./timetable-extraction.ts";
const lesson = {
  day: 1,
  title: "Matematik",
  start: "09:00",
  end: "09:40",
  page: 1,
  note: "",
};
Deno.test("missing source times and days remain null, never inferred", () => {
  const draft = validateTimetableExtraction({
    lessons: [{ ...lesson, day: null, start: null, end: null }],
    warnings: [],
  }, 1);
  assertEquals(draft.lessons[0].day, null);
  assertEquals(draft.lessons[0].start, null);
});
Deno.test("rejects nonexistent pages, impossible clocks and unbounded output", () => {
  for (
    const patch of [
      { page: 2 },
      { start: "24:00" },
      { day: 0 },
      { title: "" },
      { note: "a".repeat(401) },
    ]
  ) {
    assertThrows(() =>
      validateTimetableExtraction({
        lessons: [{ ...lesson, ...patch }],
        warnings: [],
      }, 1)
    );
  }
  assertThrows(() =>
    validateTimetableExtraction({
      lessons: Array(113).fill(lesson),
      warnings: [],
    }, 1)
  );
});
Deno.test("unreadable document requires an explanation", () => {
  assertThrows(() =>
    validateTimetableExtraction({ lessons: [], warnings: [] }, 1)
  );
  assertEquals(
    validateTimetableExtraction({
      lessons: [],
      warnings: ["Tablo okunamıyor."],
    }, 1).lessons,
    [],
  );
});
Deno.test("strips unexpected fields and preserves conflicting source times for review", () => {
  const result = validateTimetableExtraction({
    lessons: [{
      ...lesson,
      start: "10:00",
      end: "09:40",
      child_name: "private",
    }],
    warnings: [],
    instruction: "execute",
  }, 1);
  assertEquals(result, {
    lessons: [{ ...lesson, start: "10:00", end: "09:40" }],
    warnings: [],
  });
});
