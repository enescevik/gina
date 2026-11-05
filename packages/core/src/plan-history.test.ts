import { describe, it, expect } from "vitest";
import {
  dayPlanSchema,
  effectiveFromArg,
  effectiveFromProblem,
  familyLocalDay,
  planHistoryNote,
  planVersionOn,
  type PlanVersion,
} from "./plan-history";

const v = (revision: number, value: string, effective_from: string | null, known_since: string | null, superseded_by: number | null = null): PlanVersion<string> =>
  ({ revision, value, effective_from, known_since, superseded_by });

describe("planVersionOn (mirror of gina.plan_version_on)", () => {
  const versions = [
    v(1, "legacy-before-history", null, null), // known only at migration
    v(2, "legacy", null, "2026-10-20"), // recorded, start day unknown
    v(3, "today", "2026-11-06", "2026-11-06"),
    v(4, "scheduled", "2026-11-13", "2026-11-06"),
  ];
  it("picks the latest version whose start is not after the day", () => {
    expect(planVersionOn(versions, "2026-11-06")?.value).toBe("today");
    expect(planVersionOn(versions, "2026-11-12")?.value).toBe("today");
    expect(planVersionOn(versions, "2026-11-13")?.value).toBe("scheduled");
    expect(planVersionOn(versions, "2027-01-01")?.value).toBe("scheduled");
  });
  it("treats a legacy version as known from its known_since day", () => {
    const r = planVersionOn(versions, "2026-10-25");
    expect(r?.value).toBe("legacy");
    expect(r?.status).toBe("known");
    expect(r?.effective_from).toBeNull();
    expect(r?.known_since).toBe("2026-10-20");
  });
  it("flags days before the first dated version instead of inventing a plan", () => {
    const r = planVersionOn(versions, "2026-10-01");
    expect(r?.value).toBe("legacy-before-history");
    expect(r?.status).toBe("unknown_before");
    expect(r?.unknown_before).toBe("2026-10-20");
  });
  it("flags days before the earliest version when nothing is known at migration", () => {
    const r = planVersionOn(versions.slice(1), "2026-10-01");
    expect(r?.value).toBe("legacy");
    expect(r?.status).toBe("unknown_before");
    expect(r?.unknown_before).toBe("2026-10-20");
  });
  it("skips superseded schedules", () => {
    const withSupersede = [...versions.slice(0, 4), v(5, "newer-immediate", "2026-11-07", "2026-11-07")];
    withSupersede[3] = v(4, "scheduled", "2026-11-13", "2026-11-06", 5);
    expect(planVersionOn(withSupersede, "2026-11-20")?.value).toBe("newer-immediate");
  });
  it("returns null without versions", () => {
    expect(planVersionOn([], "2026-11-06")).toBeNull();
  });
});

describe("effective day choice", () => {
  it("defaults to today, rejects the past and more than a year ahead", () => {
    expect(effectiveFromProblem("2026-11-06", "2026-11-06")).toBeNull();
    expect(effectiveFromProblem("2026-11-13", "2026-11-06")).toBeNull();
    expect(effectiveFromProblem("2026-11-05", "2026-11-06")).toBe("past");
    expect(effectiveFromProblem("2027-11-07", "2026-11-06")).toBe("too_far");
    expect(effectiveFromProblem("2027-11-06", "2026-11-06")).toBeNull();
    expect(effectiveFromProblem("nope", "2026-11-06")).toBe("invalid");
  });
  it("omits the argument when the parent keeps today, so old receipts keep matching", () => {
    expect(effectiveFromArg(null, "2026-11-06")).toEqual({});
    expect(effectiveFromArg("2026-11-06", "2026-11-06")).toEqual({});
    expect(effectiveFromArg("2026-11-13", "2026-11-06")).toEqual({ p_effective_from: "2026-11-13" });
  });
});

describe("family-local day", () => {
  it("flips at local midnight, not UTC midnight", () => {
    expect(familyLocalDay(new Date("2026-11-05T20:30:00Z"), "Europe/Istanbul")).toBe("2026-11-05");
    expect(familyLocalDay(new Date("2026-11-05T21:30:00Z"), "Europe/Istanbul")).toBe("2026-11-06");
    expect(familyLocalDay(new Date("2026-11-05T21:30:00Z"), "America/New_York")).toBe("2026-11-05");
  });
});

describe("plan_for_day contract", () => {
  const sample = {
    child_id: "20000000-0000-4000-8000-000000009601",
    day: "2026-11-05",
    today: "2026-11-06",
    timezone: "Europe/Istanbul",
    weekday: 4,
    period: { id: "a0000000-0000-4000-8000-000000000001", academic_year: 2025, grade: 4, school: "A", starts_on: "2025-09-01", ends_on: "2026-11-06", reason: "initial" },
    routines: [{
      id: "30000000-0000-4000-8000-000000009601", revision: 1, current_revision: 4, title: "Kitap oku", icon: "read-book", stars: 2,
      days_of_week: [1, 2, 3, 4, 5, 6, 7], time_of_day: "any", requires_approval: true, starts_on: "2026-10-07", ends_on: null,
      effective_from: "2026-10-07", known_since: "2026-11-06", status: "known", unknown_before: null,
    }],
    timetable: {
      revision: 1, lessons: [{ id: "l1", day: 4, title: "Matematik", start: "09:00", end: "09:40" }],
      day_lessons: [{ id: "l1", day: 4, title: "Matematik", start: "09:00", end: "09:40" }],
      settings: { start: "09:00", duration: 40, break: 10 }, source: "period_snapshot", period_id: "a0000000-0000-4000-8000-000000000001",
      effective_from: null, known_since: "2026-11-06", status: "period_snapshot", unknown_before: "2026-11-06",
    },
    plans: [{
      id: "60000000-0000-4000-8000-000000009601", revision: 1, current_revision: 2,
      content: { kind: "homework", title: "Kesirler", subject: "Matematik", topic: "", planned_on: "2026-11-04", due_on: "2026-11-08", time: null, steps: [], done: false, archived: false },
      source_id: null, done_at: null, effective_from: "2026-11-06", known_since: "2026-11-06", status: "unknown_before", unknown_before: "2026-11-06",
    }],
  };
  it("parses the server shape and derives the notes a day view needs", () => {
    const plan = dayPlanSchema.parse(sample);
    expect(planHistoryNote(plan.routines[0]!, plan.today)).toBe("none");
    expect(planHistoryNote(plan.timetable)).toBe("period_snapshot");
    expect(planHistoryNote(plan.plans[0]!)).toBe("unknown_before");
    expect(planHistoryNote({ status: "known", effective_from: null, known_since: "2026-10-20" })).toBe("legacy");
    expect(planHistoryNote({ status: "known", effective_from: "2026-11-13", known_since: "2026-11-06" }, "2026-11-06")).toBe("scheduled");
  });
});
