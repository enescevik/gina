import { z } from "zod";
import { isCalendarDate } from "./form-validation";

// Dated plan history (L04). Every routine, timetable and learning-plan version carries the
// family-local day it applies from (effective_from) and the day it became known (known_since).
// Versions older than the history keep effective_from null; a day before the first known
// version is reported as unknown instead of being filled in from later settings.
const day = z.string().refine(isCalendarDate);

/** How confident the server is that this version really applied on the requested day. */
export const planVersionStatusSchema = z.enum([
  "known", // a dated or recorded version covers the day
  "unknown_before", // the day precedes every known version; content shown is the oldest known one
  "period_snapshot", // timetable only: the closed period's snapshot stands in for lost versions
  "none", // timetable only: nothing was ever saved
]);
export type PlanVersionStatus = z.infer<typeof planVersionStatusSchema>;

const dated = {
  effective_from: day.nullable(),
  known_since: day.nullable(),
  status: planVersionStatusSchema,
  unknown_before: day.nullable(),
};

export const dayPlanRoutineSchema = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  current_revision: z.number().int(),
  title: z.string(),
  icon: z.string(),
  stars: z.number().int(),
  days_of_week: z.array(z.number().int().min(1).max(7)),
  time_of_day: z.enum(["morning", "afternoon", "evening", "any"]),
  requires_approval: z.boolean(),
  starts_on: day,
  ends_on: day.nullable(),
  source_routine_id: z.uuid().nullable().optional(),
  ...dated,
});
export const dayPlanLessonSchema = z.object({
  id: z.string(),
  day: z.number().int().min(1).max(7),
  /** The name as written by the parent or in the source document; never replaced by the catalogue. */
  title: z.string(),
  start: z.string(),
  end: z.string(),
  // C02: parent-confirmed catalogue identity (null when unlinked or the catalogue entry is gone).
  subject_id: z.string().nullable().optional(),
  subject_label_tr: z.string().nullable().optional(),
  subject_label_en: z.string().nullable().optional(),
  subject_source: z.enum(["lesson", "link"]).nullable().optional(),
});
export const dayPlanTimetableSchema = z.object({
  revision: z.number().int(),
  lessons: z.array(dayPlanLessonSchema),
  day_lessons: z.array(dayPlanLessonSchema),
  settings: z.object({ start: z.string(), duration: z.number(), break: z.number() }),
  source: z.enum(["history", "period_snapshot", "none", "scheduled_change"]),
  period_id: z.uuid().nullable().optional(),
  ...dated,
});
export const dayPlanItemSchema = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  current_revision: z.number().int(),
  content: z.object({
    kind: z.enum(["homework", "study", "course"]),
    title: z.string(),
    subject: z.string(),
    topic: z.string(),
    planned_on: day,
    due_on: day.nullable(),
    time: z.string().nullable(),
    steps: z.array(z.object({ id: z.string(), label: z.string(), checked: z.boolean() })),
    done: z.boolean(),
    archived: z.boolean(),
  }).loose(),
  source_id: z.uuid().nullable(),
  done_at: z.string().nullable(),
  ...dated,
});
export const dayPlanPeriodSchema = z.object({
  id: z.uuid(),
  academic_year: z.number().int(),
  grade: z.number().int().nullable(),
  school: z.string().nullable(),
  starts_on: day,
  ends_on: day.nullable(),
  reason: z.string(),
  /** C02: a planned (not yet applied) education change covers this day. */
  scheduled: z.boolean().optional(),
});
export const scheduledEducationSchema = z.object({
  id: z.uuid(),
  action: z.enum(["new_year", "transfer"]),
  starts_on: day,
  academic_year: z.number().int(),
  grade: z.number().int().nullable(),
  school: z.string().nullable(),
  keep_timetable: z.boolean(),
});
/** `plan_for_day(p_child_id, p_day)` result. */
export const dayPlanSchema = z.object({
  child_id: z.uuid(),
  day,
  today: day,
  timezone: z.string(),
  weekday: z.number().int().min(1).max(7),
  period: dayPlanPeriodSchema.nullable(),
  routines: z.array(dayPlanRoutineSchema),
  timetable: dayPlanTimetableSchema,
  plans: z.array(dayPlanItemSchema),
  scheduled_education: scheduledEducationSchema.nullable().optional(),
});
export type DayPlan = z.infer<typeof dayPlanSchema>;
/** `plan_for_days(p_child_id, p_from, p_to)`: the same contract for every day of a range (≤ 42). */
export const dayPlansSchema = z.array(dayPlanSchema);
export type ScheduledEducation = z.infer<typeof scheduledEducationSchema>;
export type DayPlanRoutine = z.infer<typeof dayPlanRoutineSchema>;
export type DayPlanTimetable = z.infer<typeof dayPlanTimetableSchema>;
export type DayPlanItem = z.infer<typeof dayPlanItemSchema>;

/** Which note a day entry deserves. `legacy` = in effect since known_since, start day never recorded. */
export type PlanHistoryNote = "none" | "legacy" | "unknown_before" | "period_snapshot" | "scheduled";
export function planHistoryNote(
  entry: Pick<DayPlanRoutine, "status" | "effective_from" | "known_since">,
  today?: string,
): PlanHistoryNote {
  if (entry.status === "unknown_before") return "unknown_before";
  if (entry.status === "period_snapshot") return "period_snapshot";
  if (entry.status === "none") return "none";
  if (entry.effective_from === null) return "legacy";
  if (today && entry.effective_from > today) return "scheduled";
  return "none";
}

/** Parent's effective-day choice: default today; the past is closed; at most a year ahead. */
export const EFFECTIVE_FROM_MAX_DAYS = 365;
export type EffectiveFromProblem = "past" | "too_far" | "invalid";
export function effectiveFromProblem(value: string, today: string): EffectiveFromProblem | null {
  if (!isCalendarDate(value) || !isCalendarDate(today)) return "invalid";
  if (value < today) return "past";
  if (value > addDays(today, EFFECTIVE_FROM_MAX_DAYS)) return "too_far";
  return null;
}
/** Payload field: omitted (not null) when the parent keeps the default, so old receipts keep matching. */
export function effectiveFromArg(value: string | null | undefined, today: string): { p_effective_from?: string } {
  return value && value !== today ? { p_effective_from: value } : {};
}

/** A version as the server stores it; `superseded` versions are skipped by the resolver. */
export type PlanVersion<V> = {
  revision: number;
  value: V;
  effective_from: string | null;
  known_since: string | null;
  superseded_by?: number | null;
};
export type ResolvedVersion<V> = PlanVersion<V> & {
  status: "known" | "unknown_before";
  unknown_before: string | null;
};
/**
 * Mirrors `gina.plan_version_on`: the version in effect on a day is the latest one whose start
 * (effective_from, else known_since) is not after the day. A version with neither start is
 * "known at migration" and only ever reported as unknown_before the next dated version.
 */
export function planVersionOn<V>(versions: readonly PlanVersion<V>[], day: string): ResolvedVersion<V> | null {
  const live = versions.filter((v) => v.superseded_by == null);
  if (!live.length) return null;
  const start = (v: PlanVersion<V>) => v.effective_from ?? v.known_since;
  const sorted = [...live].sort((a, b) => cmp(start(a), start(b)) || a.revision - b.revision);
  const nextKnown = sorted.map(start).filter((s): s is string => s !== null).sort()[0] ?? null;
  const covering = sorted.filter((v) => start(v) === null || (start(v) as string) <= day);
  if (covering.length) {
    const pick = covering[covering.length - 1]!;
    return start(pick) === null
      ? { ...pick, status: "unknown_before", unknown_before: nextKnown }
      : { ...pick, status: "known", unknown_before: null };
  }
  const earliest = sorted[0]!;
  return { ...earliest, status: "unknown_before", unknown_before: start(earliest) ?? nextKnown };
}
function cmp(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/** Local calendar day of an instant in a family's zone (`families.timezone`), same rule as the server. */
export function familyLocalDay(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dayValue: string, days: number) {
  const d = new Date(dayValue + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Calendar days from..to inclusive (YYYY-MM-DD, no timezone shift). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * C02 shared day summary for home, child Today, week strip and task list. Counts come only from the
 * day's own plan (that day's routine and timetable versions); a past day the history does not know is
 * reported as unknown instead of being filled with today's program.
 */
export type DaySummary = {
  date: string;
  /** Routines that apply that day plus recorded work for routines no longer in the plan. */
  due: number;
  done: number;
  lessons: number | null;
  lessonsUnknown: boolean;
  homework: number;
};
export function summarizeDayPlan(
  plan: DayPlan,
  completions: readonly { template_id: string | null; due_date: string; status: string }[],
): DaySummary {
  const dayWork = completions.filter((c) => c.due_date === plan.day);
  const routineIds = new Set(plan.routines.map((r) => r.id));
  const extra = new Set(dayWork.filter((c) => c.template_id && !routineIds.has(c.template_id)).map((c) => c.template_id));
  const done = dayWork.filter((c) => c.status === "done" || c.status === "approved").length;
  const unknown = plan.day < plan.today &&
    (plan.timetable.status === "unknown_before" || plan.timetable.status === "none");
  return {
    date: plan.day,
    due: plan.routines.length + extra.size,
    done,
    lessons: unknown ? null : plan.timetable.day_lessons.length,
    lessonsUnknown: unknown,
    homework: plan.plans.filter((p) => !p.content.done).length,
  };
}

/** Education change state (`education_change_state`): open plan, last failure and the 14-day undo. */
export const educationChangeStateSchema = z.object({
  child_id: z.uuid(),
  today: day,
  revision: z.number().int(),
  scheduled: z.object({
    id: z.uuid(),
    action: z.enum(["new_year", "transfer"]),
    academic_year: z.number().int(),
    grade: z.number().int().nullable(),
    school: z.string().nullable(),
    starts_on: day,
    keep_timetable: z.boolean(),
    status: z.literal("scheduled"),
  }).loose().nullable(),
  last_failed: z.object({
    id: z.uuid(),
    action: z.enum(["new_year", "transfer"]),
    starts_on: day,
    failure: z.string().nullable(),
  }).nullable(),
  undo: z.object({
    period_id: z.uuid(),
    previous_period_id: z.uuid(),
    reason: z.enum(["new_year", "transfer"]),
    starts_on: day,
    changed_on: day,
    until: day,
    expired: z.boolean(),
    blocked: z.enum(["transfer"]).nullable(),
    previous: z.object({
      academic_year: z.number().int(),
      grade: z.number().int().nullable(),
      school: z.string().nullable(),
      starts_on: day,
    }),
    restores_timetable: z.boolean(),
  }).nullable(),
});
export type EducationChangeState = z.infer<typeof educationChangeStateSchema>;
/** Planned change day: tomorrow at the earliest, at most a year ahead (server rule). */
export function scheduleDayProblem(value: string, today: string): "past" | "too_far" | "invalid" | null {
  if (!isCalendarDate(value) || !isCalendarDate(today)) return "invalid";
  if (value <= today) return "past";
  if (value > addDays(today, 365)) return "too_far";
  return null;
}

/**
 * C02: the routines a day's view counts, taken from that day's plan (the routine version in force that
 * day). Live rows that are not in the plan are kept only so recorded work for them can still be shown
 * (never as due: `active=false`, no weekdays).
 */
export function templatesForPlanDay<L extends { id: string; title: string; icon: string; stars: number }>(
  plan: DayPlan,
  live: readonly L[],
) {
  const planned = plan.routines.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon,
    stars: r.stars,
    days_of_week: r.days_of_week,
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    active: true,
  }));
  const ids = new Set(planned.map((r) => r.id));
  const rest = live.filter((l) => !ids.has(l.id)).map((l) => ({
    id: l.id,
    title: l.title,
    icon: l.icon,
    stars: l.stars,
    days_of_week: [] as number[],
    starts_on: plan.day,
    ends_on: null as string | null,
    active: false,
  }));
  return [...planned, ...rest];
}

/** `routines_for_day(p_child_id, p_day)`: every routine's version on the day (any weekday) + a later pending one. */
export const routinesForDaySchema = z.object({
  child_id: z.uuid(),
  day,
  routines: z.array(z.object({
    id: z.uuid(),
    current_revision: z.number().int(),
    version: z.object({
      revision: z.number().int(),
      title: z.string(),
      icon: z.string(),
      stars: z.number().int(),
      days_of_week: z.array(z.number().int()),
      time_of_day: z.string(),
      requires_approval: z.boolean(),
      ...dated,
    }).nullable(),
    next: z.object({
      revision: z.number().int(),
      effective_from: day,
      title: z.string(),
      icon: z.string(),
      stars: z.number().int(),
      days_of_week: z.array(z.number().int()),
    }).nullable(),
  })),
});
export type RoutinesForDay = z.infer<typeof routinesForDaySchema>;
