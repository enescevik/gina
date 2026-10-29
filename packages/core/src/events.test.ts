import { describe, expect, it } from "vitest";

import { occurrencesBetween, parseRrule, weeklyRrule, zonedIso } from "./events";

const TZ = "Europe/Istanbul";

describe("parseRrule / weeklyRrule", () => {
  it("haftalık kuralı okur ve yazar", () => {
    expect(parseRrule("FREQ=WEEKLY;BYDAY=MO,WE")).toEqual({ freq: "WEEKLY", byDay: [1, 3], until: null });
    expect(weeklyRrule([3, 1], "2027-06-19")).toBe("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20270619");
    expect(parseRrule("FREQ=MONTHLY")).toBeNull();
  });
});

describe("zonedIso", () => {
  it("İstanbul saatini UTC'ye çevirir (UTC+3)", () => {
    expect(zonedIso("2026-11-02", "09:00", TZ)).toBe("2026-11-02T06:00:00.000Z");
  });
});

describe("occurrencesBetween", () => {
  const math = {
    id: "math",
    starts_at: zonedIso("2026-09-14", "09:00", TZ),
    ends_at: zonedIso("2026-09-14", "09:40", TZ),
    all_day: false,
    rrule: "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20270619",
  };
  const dentist = {
    id: "dentist",
    starts_at: zonedIso("2026-11-05", "15:30", TZ),
    ends_at: null,
    all_day: false,
    rrule: null,
  };

  it("ders programını haftaya açar, tek seferlik etkinliği ekler, saatleri korur", () => {
    const list = occurrencesBetween([math, dentist], "2026-11-02", "2026-11-08", TZ);
    expect(list.map((o) => `${o.event.id}@${o.date}`)).toEqual(["math@2026-11-02", "math@2026-11-04", "dentist@2026-11-05"]);
    expect(list[0]?.startsAt.toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(list[0]?.endsAt?.toISOString()).toBe("2026-11-02T06:40:00.000Z");
  });

  it("iptal edilen oluşumu ve UNTIL sonrasını atlar", () => {
    const cancelled = new Set(["math:2026-11-04"]);
    expect(occurrencesBetween([math], "2026-11-02", "2026-11-08", TZ, cancelled).map((o) => o.date)).toEqual(["2026-11-02"]);
    expect(occurrencesBetween([math], "2027-06-21", "2027-06-27", TZ)).toEqual([]);
  });
});
