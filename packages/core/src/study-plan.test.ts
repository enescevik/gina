import { describe, expect, it } from "vitest";
import {
  makePlanCalendarDrafts,
  planCalendarItems,
  studyPlanConflicts,
} from "./study-plan";
const body = {
  gunler: [{
    gun: 1,
    konu: "Üçgenler",
    etkinlik: "Kenarları karşılaştır.",
    sure_dk: 15,
  }, { gun: 3, konu: "Çevre", etkinlik: "Bir şekil çiz.", sure_dk: 20 }],
};
describe("parent study plan application", () => {
  it("starts unselected and preserves skipped days", () => {
    const rows = makePlanCalendarDrafts(body, "2026-11-03");
    expect(rows.map((r) => [r.date, r.selected])).toEqual([[
      "2026-11-03",
      false,
    ], ["2026-11-05", false]]);
  });
  it("requires a deliberate selection", () =>
    expect(() =>
      planCalendarItems(
        makePlanCalendarDrafts(body, "2026-11-03"),
        "Europe/Istanbul",
        "2026-11-03",
      )
    ).toThrow("plan_empty"));
  it("uses the family clock and selected days only", () => {
    const rows = makePlanCalendarDrafts(body, "2026-11-03");
    rows[1]!.selected = true;
    expect(planCalendarItems(rows, "Europe/Istanbul", "2026-11-03")).toEqual([{
      day: 3,
      title: "Çevre",
      notes: "Bir şekil çiz.",
      minutes: 20,
      starts_at: "2026-11-05T14:00:00.000Z",
    }]);
  });
  it("rejects malformed or duplicate AI days", () => {
    expect(() =>
      makePlanCalendarDrafts(
        { gunler: [body.gunler[0], body.gunler[0]] },
        "2026-11-03",
      )
    ).toThrow();
    expect(() =>
      makePlanCalendarDrafts(
        { gunler: [{ ...body.gunler[0], sure_dk: 900 }] },
        "2026-11-03",
      )
    ).toThrow();
  });
  it("rejects past days, impossible dates and invalid durations", () => {
    for (
      const change of [
        { date: "2026-11-02" },
        { date: "2026-02-30" },
        { minutes: 0 },
        { minutes: NaN },
        { title: " " },
        { time: "25:00" },
      ]
    ) {
      const rows = makePlanCalendarDrafts(body, "2026-11-03");
      Object.assign(rows[0]!, { selected: true }, change);
      expect(() => planCalendarItems(rows, "Europe/Istanbul", "2026-11-03"))
        .toThrow("plan_invalid");
    }
  });
  it("rejects overlapping selected sessions but allows touching edges", () => {
    const rows = makePlanCalendarDrafts(body, "2026-11-03");
    rows.forEach((r) => {
      r.selected = true;
      r.date = "2026-11-03";
    });
    expect(() => planCalendarItems(rows, "Europe/Istanbul", "2026-11-03"))
      .toThrow("plan_overlap");
    rows[1]!.time = "17:15";
    expect(planCalendarItems(rows, "Europe/Istanbul", "2026-11-03"))
      .toHaveLength(2);
  });
  it("does not silently shift a missing daylight-saving time", () => {
    const rows = makePlanCalendarDrafts(body, "2027-03-28");
    Object.assign(rows[0]!, { selected: true, time: "02:30" });
    expect(() => planCalendarItems(rows, "Europe/Berlin", "2027-03-01"))
      .toThrow("plan_invalid");
  });
});

describe("calendar overlap review", () => {
  it("checks recurring lessons, exceptions, family events and multi-day spans", () => {
    const rows = makePlanCalendarDrafts(body, "2026-11-03");
    rows[0]!.selected = true;
    const items = planCalendarItems(rows, "Europe/Istanbul", "2026-11-03");
    const events = [{
      id: "lesson",
      title: "Kurs",
      starts_at: "2026-10-27T13:30:00Z",
      ends_at: "2026-10-27T14:30:00Z",
      all_day: false,
      rrule: "FREQ=WEEKLY;BYDAY=TU",
    }, {
      id: "trip",
      title: "Aile gezisi",
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: "2026-11-05T00:00:00Z",
      all_day: true,
      rrule: null,
    }];
    expect(studyPlanConflicts(items, events, "Europe/Istanbul")[0]!.titles)
      .toEqual(["Aile gezisi", "Kurs"]);
    expect(
      studyPlanConflicts(
        items,
        events,
        "Europe/Istanbul",
        new Set(["lesson:2026-11-03"]),
      )[0]!.titles,
    ).toEqual(["Aile gezisi"]);
  });
});
