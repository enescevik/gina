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
  title: z.string(),
  start: z.string(),
  end: z.string(),
});
export const dayPlanTimetableSchema = z.object({
  revision: z.number().int(),
  lessons: z.array(dayPlanLessonSchema),
  day_lessons: z.array(dayPlanLessonSchema),
  settings: z.object({ start: z.string(), duration: z.number(), break: z.number() }),
  source: z.enum(["history", "period_snapshot", "none"]),
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
});
export type DayPlan = z.infer<typeof dayPlanSchema>;
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
