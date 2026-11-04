import { describe, expect, it } from "vitest";
import {
  makeRepeatCalendarDrafts,
  readRepeatCalendarReceipt,
  repeatCalendarCommandSchema,
} from "./repeat-calendar";
import { planCalendarItems } from "./study-plan";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const command = () =>
  repeatCalendarCommandSchema.parse({
    p_request_id: id(1),
    p_attempt_id: id(2),
    p_source_hash: "a".repeat(64),
    p_question_ids: [id(3)],
    p_items: [{
      day: 1,
      title: "Birlikte tekrar",
      notes: "Çözümü birlikte konuşalım.",
      starts_at: "2026-11-05T14:00:00Z",
      minutes: 15,
    }],
  });
describe("reviewed repeat calendar", () => {
  it("makes editable, unselected 1/3/7-day suggestions across months", () => {
    const d = makeRepeatCalendarDrafts(
      "2026-12-30",
      "Tekrar",
      "Birlikte konuşun",
    );
    expect(d.map((x) => x.date)).toEqual([
      "2026-12-31",
      "2027-01-02",
      "2027-01-06",
    ]);
    expect(d.every((x) => !x.selected)).toBe(true);
    expect(() => planCalendarItems(d, "Europe/Istanbul", "2026-12-30")).toThrow(
      "plan_empty",
    );
  });
  it("preserves chosen time zone and edited dates", () => {
    const d = makeRepeatCalendarDrafts(
      "2026-11-04",
      "Tekrar",
      "Birlikte konuşun",
    );
    d[0]!.selected = true;
    d[0]!.time = "18:30";
    expect(planCalendarItems(d, "Europe/Istanbul", "2026-11-04")[0]?.starts_at)
      .toBe("2026-11-05T15:30:00.000Z");
  });
  it("rejects duplicate question/day selections and unbounded schedules", () => {
    const c = command();
    for (
      const wrong of [
        { ...c, p_question_ids: [id(3), id(3)] },
        { ...c, p_items: [...c.p_items, ...c.p_items] },
        { ...c, p_items: [{ ...c.p_items[0], day: 4 }] },
        { ...c, p_items: [{ ...c.p_items[0], minutes: 0 }] },
      ]
    ) expect(repeatCalendarCommandSchema.safeParse(wrong).success).toBe(false);
  });
  it("only acknowledges the exact request and complete unique event mapping", () => {
    const c = command(),
      r = {
        request: id(1),
        attempt_id: id(2),
        items: [{ day: 1, event_id: id(4) }],
      };
    expect(readRepeatCalendarReceipt(r, c)).toEqual(r);
    for (
      const wrong of [{ ...r, request: id(9) }, { ...r, attempt_id: id(9) }, {
        ...r,
        items: [],
      }, { ...r, items: [{ day: 2, event_id: id(4) }] }]
    ) expect(() => readRepeatCalendarReceipt(wrong, c)).toThrow();
  });
});
