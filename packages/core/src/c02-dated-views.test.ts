import { describe, expect, it } from "vitest";
import {
  dayPlanSchema,
  dayPlansSchema,
  dayRange,
  routinesForDaySchema,
  templatesForPlanDay,
  educationChangeStateSchema,
  scheduleDayProblem,
  summarizeDayPlan,
} from "./plan-history";
import { deviceBindingsToImport, linkForTitle, subjectDisplay, subjectLinksSchema } from "./subject-synonyms";
import { lessonsForSave, timetableCommandSchema } from "./timetable-command";

const child = "20000000-0000-4000-8000-000000010901";
const plan = (day: string, today: string, extra: Record<string, unknown> = {}) => ({
  child_id: child, day, today, timezone: "Europe/Istanbul", weekday: 5, period: null,
  routines: [{
    id: "30000000-0000-4000-8000-000000010901", revision: 1, current_revision: 2, title: "Kitap oku", icon: "read-book", stars: 2,
    days_of_week: [1, 2, 3, 4, 5, 6, 7], time_of_day: "evening", requires_approval: true, starts_on: "2026-10-01", ends_on: null,
    effective_from: "2026-10-01", known_since: "2026-10-01", status: "known", unknown_before: null,
  }],
  timetable: {
    revision: 2, settings: { start: "09:00", duration: 40, break: 10 }, source: "history",
    lessons: [{ id: "l1", day: 5, title: "MAT", start: "09:00", end: "09:40", subject_id: "subject-math", subject_label_tr: "Matematik", subject_label_en: "Mathematics", subject_source: "lesson" }],
    day_lessons: [{ id: "l1", day: 5, title: "MAT", start: "09:00", end: "09:40", subject_id: "subject-math", subject_label_tr: "Matematik", subject_label_en: "Mathematics", subject_source: "lesson" }],
    effective_from: "2026-11-06", known_since: "2026-11-06", status: "known", unknown_before: null,
  },
  plans: [],
  ...extra,
});

describe("C02 dated views", () => {
  it("parses subject identity, scheduled period and the range contract", () => {
    const scheduled = plan("2026-11-09", "2026-11-06", {
      period: { id: "a0000000-0000-4000-8000-000000000001", academic_year: 2026, grade: 5, school: null, starts_on: "2026-11-09", ends_on: null, reason: "new_year", scheduled: true },
      scheduled_education: { id: "a0000000-0000-4000-8000-000000000001", action: "new_year", starts_on: "2026-11-09", academic_year: 2026, grade: 5, school: null, keep_timetable: false },
    });
    const parsed = dayPlansSchema.parse([plan("2026-11-06", "2026-11-06"), scheduled]);
    expect(parsed[0]!.timetable.day_lessons[0]!.subject_id).toBe("subject-math");
    expect(parsed[1]!.period?.scheduled).toBe(true);
    const base = plan("2026-11-06", "2026-11-06");
    expect(dayPlanSchema.parse({ ...base, timetable: { ...base.timetable, source: "scheduled_change" } }).timetable.source).toBe("scheduled_change");
  });
  it("summarises a day from its own plan and never fills an unknown past day", () => {
    const today = dayPlanSchema.parse(plan("2026-11-06", "2026-11-06"));
    const s = summarizeDayPlan(today, [
      { template_id: "30000000-0000-4000-8000-000000010901", due_date: "2026-11-06", status: "approved" },
      { template_id: "30000000-0000-4000-8000-0000000109ff", due_date: "2026-11-06", status: "done" },
      { template_id: "30000000-0000-4000-8000-000000010901", due_date: "2026-11-05", status: "done" },
    ]);
    expect(s).toEqual({ date: "2026-11-06", due: 2, done: 2, lessons: 1, lessonsUnknown: false, homework: 0 });
    const pastBase = plan("2026-11-01", "2026-11-06");
    const past = dayPlanSchema.parse({ ...pastBase, timetable: { ...pastBase.timetable, status: "unknown_before", unknown_before: "2026-11-06" } });
    expect(summarizeDayPlan(past, [])).toMatchObject({ lessons: null, lessonsUnknown: true });
    expect(dayRange("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("validates the planned education day and the undo state", () => {
    expect(scheduleDayProblem("2026-11-06", "2026-11-06")).toBe("past");
    expect(scheduleDayProblem("2026-11-07", "2026-11-06")).toBeNull();
    expect(scheduleDayProblem("2027-11-07", "2026-11-06")).toBe("too_far");
    expect(scheduleDayProblem("nope", "2026-11-06")).toBe("invalid");
    expect(educationChangeStateSchema.parse({
      child_id: child, today: "2026-11-06", revision: 3, scheduled: null, last_failed: null,
      undo: { period_id: child, previous_period_id: child, reason: "new_year", starts_on: "2026-11-06", changed_on: "2026-11-06", until: "2026-11-20", expired: false, blocked: null, previous: { academic_year: 2025, grade: 4, school: null, starts_on: "2025-09-01" }, restores_timetable: true },
    }).undo?.until).toBe("2026-11-20");
  });
});

describe("C02 day templates and task list contract", () => {
  it("counts the day's routine version, keeps recorded work for others but never as due", () => {
    const p = dayPlanSchema.parse(plan("2026-11-06", "2026-11-06"));
    const live = [
      { id: "30000000-0000-4000-8000-000000010901", title: "Kitap oku (30 dk)", icon: "read-book", stars: 4 },
      { id: "30000000-0000-4000-8000-000000010902", title: "Paused", icon: "task-custom", stars: 1 },
    ];
    const tpl = templatesForPlanDay(p, live);
    expect(tpl[0]).toMatchObject({ title: "Kitap oku", stars: 2, active: true });
    expect(tpl[1]).toMatchObject({ id: live[1]!.id, active: false, days_of_week: [] });
  });
  it("parses routines_for_day with a pending later version", () => {
    const r = routinesForDaySchema.parse({
      child_id: child, day: "2026-11-06",
      routines: [{
        id: "30000000-0000-4000-8000-000000010901", current_revision: 3,
        version: { revision: 2, title: "Kitap oku", icon: "read-book", stars: 2, days_of_week: [1, 2], time_of_day: "evening", requires_approval: true, effective_from: "2026-11-01", known_since: "2026-11-01", status: "known", unknown_before: null },
        next: { revision: 3, effective_from: "2026-11-10", title: "Kitap oku (30 dk)", icon: "read-book", stars: 4, days_of_week: [1, 2] },
      }],
    });
    expect(r.routines[0]!.next?.effective_from).toBe("2026-11-10");
  });
});

describe("C02 subject identity", () => {
  const links = subjectLinksSchema.parse({ child_id: child, links: [{ alias_normalized: "mat", title: "MAT", subject_id: "subject-math", label_tr: "Matematik", label_en: "Mathematics", active: true, source: "manual", revision: 1, linked_at: "2026-11-06T10:00:00Z" }] }).links;
  it("matches names like the server and keeps the original text", () => {
    expect(linkForTitle(links, "Mat")?.subject_id).toBe("subject-math");
    expect(linkForTitle(links, "Fen")).toBeNull();
    expect(subjectDisplay({ title: "MAT", subject_label_tr: "Matematik" })).toEqual({ title: "Matematik", original: "MAT" });
    // Only case/"dersi" differences: the catalogue title in correct Turkish casing replaces the shouting text.
    expect(subjectDisplay({ title: "MATEMATİK DERSİ", subject_label_tr: "Matematik" })).toEqual({ title: "Matematik", original: null });
    expect(subjectDisplay({ title: "Matematik", subject_label_tr: "Matematik" })).toEqual({ title: "Matematik", original: null });
    expect(subjectDisplay({ title: "İNG", subject_label_tr: null })).toEqual({ title: "İNG", original: null });
    expect(subjectDisplay({ title: "MAT", subject_label_tr: "Matematik", subject_label_en: "Mathematics" }, true).title).toBe("Mathematics");
  });
  it("sends only device bindings the server does not have and surfaces conflicts", () => {
    const r = deviceBindingsToImport({
      mat: { subject_id: "subject-math", label_tr: "Matematik", label_en: "Mathematics" },
      fen: { subject_id: "subject-science", label_tr: "Fen Bilimleri", label_en: "Science", title: "FEN" },
      bad: { subject_id: "DROP TABLE", label_tr: "x", label_en: "x" },
    }, links);
    expect(r.same).toEqual(["mat"]);
    expect(r.send).toEqual([{ key: "fen", title: "FEN", subject_id: "subject-science", label_tr: "Fen Bilimleri", label_en: "Science" }]);
    const c = deviceBindingsToImport({ mat: { subject_id: "subject-physics", label_tr: "Fizik", label_en: "Physics" } }, links);
    expect(c.conflicts).toEqual([{ key: "mat", title: "MAT", local: "Fizik", server: "Matematik" }]);
  });
  it("accepts stamped lessons and strips them for save", () => {
    const stored = [{ id: "l1", day: 1, title: "MAT", start: "09:00", end: "09:40", subject_id: "subject-math" }];
    expect(timetableCommandSchema.safeParse({ p_request_id: child, p_child_id: child, p_revision: 1, p_lessons: stored, p_settings: { start: "09:00", duration: 40, break: 10 } }).success).toBe(true);
    expect(lessonsForSave(stored)).toEqual([{ id: "l1", day: 1, title: "MAT", start: "09:00", end: "09:40" }]);
  });
});
