import { describe, it, expect } from "vitest";
import { tasksWithRecordedWork, taskSnapshot } from "./task-history";
const template = {
  id: "t",
  title: "New title",
  icon: "task-custom",
  stars: 5,
  days_of_week: [1],
  starts_on: "2026-01-01",
  ends_on: null,
  active: true,
};
const completed = {
  template_id: "t",
  due_date: "2026-11-02",
  task_snapshot: {
    title: "Original title",
    icon: "read-book",
    stars: 2,
    origin: "submission",
  },
};
describe("recorded task projection", () => {
  it("preserves original title, icon and stars while routine changes", () => {
    expect(
      tasksWithRecordedWork([template], [completed], "2026-11-02")[0],
    ).toMatchObject({
      title: "Original title",
      icon: "read-book",
      stars: 2,
      available: true,
    });
  });
  it("keeps completed work visible when archived and disables new action", () => {
    expect(
      tasksWithRecordedWork(
        [{ ...template, active: false }],
        [completed],
        "2026-11-02",
      )[0],
    ).toMatchObject({ title: "Original title", available: false });
  });
  it("retains submitted work on a removed weekday", () => {
    expect(
      tasksWithRecordedWork(
        [{ ...template, days_of_week: [2] }],
        [completed],
        "2026-11-02",
      ),
    ).toHaveLength(1);
  });
  it("does not carry a completion onto another day", () => {
    expect(
      tasksWithRecordedWork([template], [completed], "2026-11-09")[0]?.title,
    ).toBe("New title");
  });
  it("does not invent submissions for a paused uncompleted routine", () => {
    expect(
      tasksWithRecordedWork([{ ...template, active: false }], [], "2026-11-02"),
    ).toEqual([]);
  });
  it("supports legacy entries without pretending to know original values", () => {
    expect(taskSnapshot(null)).toBeNull();
    expect(
      tasksWithRecordedWork(
        [template],
        [{ ...completed, task_snapshot: null }],
        "2026-11-02",
      )[0]?.title,
    ).toBe("New title");
  });
});
