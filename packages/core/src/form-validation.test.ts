import { describe, expect, it } from "vitest";
import { isCalendarDate, isClockTime } from "./form-validation";

describe("calendar input", () => {
  it("accepts leap days only in leap years and rejects normalized dates", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-1-01", "invalid"]) {
      expect(isCalendarDate(date)).toBe(false);
    }
  });
  it("requires a real 24-hour clock time", () => {
    for (const time of ["00:00", "09:30", "23:59"]) expect(isClockTime(time)).toBe(true);
    for (const time of ["24:00", "09:60", "9:00", "-1:00", ""]) expect(isClockTime(time)).toBe(false);
  });
});
