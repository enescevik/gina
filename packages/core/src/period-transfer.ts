import { z } from "zod";
import { isCalendarDate } from "./form-validation";

// Selective period transfer: the parent decides, per record, whether an old-period
// routine or unfinished plan item continues in the new period as a NEW linked record.
// Submitted work, answers and stars never move; unselected records are paused/archived
// explicitly or kept running by explicit choice. Nothing is deleted.
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const period = z.object({
  id: z.string().uuid(),
  academic_year: z.number().int(),
  grade: z.number().int().nullable(),
  school: z.string().nullable(),
  starts_on: date,
  ends_on: date.nullable(),
  reason: z.string(),
});
export const transferRoutineSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int(),
  title: z.string(),
  icon: z.string(),
  stars: z.number().int(),
  days_of_week: z.array(z.number().int().min(1).max(7)),
  time_of_day: z.enum(["morning", "afternoon", "evening", "any"]),
  requires_approval: z.boolean(),
  starts_on: date,
  ends_on: date.nullable(),
  pending: z.number().int(),
  returned: z.number().int(),
  approved: z.number().int(),
  stars_earned: z.number().int(),
});
export const transferPlanSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int(),
  kind: z.enum(["homework", "study", "course"]),
  title: z.string(),
  subject: z.string(),
  planned_on: date,
  due_on: date.nullable(),
  time: z.string().nullable(),
  steps: z.number().int(),
  steps_checked: z.number().int(),
});
export const periodTransferPreviewSchema = z.object({
  revision: z.number().int(),
  today: date,
  archived: z.boolean(),
  from: period,
  to: period,
  routines: z.array(transferRoutineSchema),
  plans: z.array(transferPlanSchema),
});
export type PeriodTransferPreview = z.infer<typeof periodTransferPreviewSchema>;
export type TransferRoutine = z.infer<typeof transferRoutineSchema>;
export type TransferPlan = z.infer<typeof transferPlanSchema>;

export type RoutineDecision = {
  id: string;
  revision: number;
  action: "copy" | "pause" | "keep";
  days_of_week: number[];
  starts_on: string;
  ends_on: string | null;
};
export type PlanDecision = {
  id: string;
  revision: number;
  action: "copy" | "archive" | "keep";
  planned_on: string;
  due_on: string | null;
};
export type PeriodTransferDecisions = {
  routines: RoutineDecision[];
  plans: PlanDecision[];
};

/** Default: nothing is selected yet; unselected records pause/archive with the old period. */
export function defaultTransferDecisions(
  preview: PeriodTransferPreview,
): PeriodTransferDecisions {
  const start = preview.today > preview.to.starts_on ? preview.today : preview.to.starts_on;
  return {
    routines: preview.routines.map((r) => ({
      id: r.id,
      revision: r.revision,
      action: "pause",
      days_of_week: [...r.days_of_week],
      starts_on: start,
      ends_on: null,
    })),
    plans: preview.plans.map((p) => ({
      id: p.id,
      revision: p.revision,
      action: "archive",
      planned_on: p.planned_on > start ? p.planned_on : start,
      due_on: p.due_on && p.due_on >= start ? p.due_on : null,
    })),
  };
}

export function routineDecisionValid(
  decision: RoutineDecision,
  preview: Pick<PeriodTransferPreview, "to" | "today">,
) {
  if (decision.action !== "copy") return true;
  const days = decision.days_of_week;
  const distinct = new Set(days).size === days.length;
  const window = isCalendarDate(decision.starts_on) &&
    decision.starts_on >= preview.to.starts_on &&
    decision.starts_on <= addDays(preview.today, 365);
  const end = decision.ends_on === null ||
    (isCalendarDate(decision.ends_on) && decision.ends_on >= decision.starts_on);
  return days.length > 0 && days.length <= 7 && distinct && window && end;
}

export function planDecisionValid(
  decision: PlanDecision,
  preview: Pick<PeriodTransferPreview, "to" | "today">,
) {
  if (decision.action !== "copy") return true;
  const window = isCalendarDate(decision.planned_on) &&
    decision.planned_on >= preview.to.starts_on &&
    decision.planned_on <= addDays(preview.today, 365);
  const due = decision.due_on === null ||
    (isCalendarDate(decision.due_on) && decision.due_on >= decision.planned_on);
  return window && due;
}

export function transferDecisionsValid(
  decisions: PeriodTransferDecisions,
  preview: PeriodTransferPreview,
) {
  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  return (
    sameSet(decisions.routines.map((x) => x.id), preview.routines.map((x) => x.id)) &&
    sameSet(decisions.plans.map((x) => x.id), preview.plans.map((x) => x.id)) &&
    decisions.routines.every((d) => routineDecisionValid(d, preview)) &&
    decisions.plans.every((d) => planDecisionValid(d, preview))
  );
}

/** Before/after counts shown on the review step. Nothing here is deleted or moved. */
export function summarizePeriodTransfer(
  decisions: PeriodTransferDecisions,
  preview: PeriodTransferPreview,
) {
  const count = <T extends { action: string }>(rows: T[], action: string) =>
    rows.filter((x) => x.action === action).length;
  return {
    routines: {
      total: decisions.routines.length,
      copy: count(decisions.routines, "copy"),
      pause: count(decisions.routines, "pause"),
      keep: count(decisions.routines, "keep"),
    },
    plans: {
      total: decisions.plans.length,
      copy: count(decisions.plans, "copy"),
      archive: count(decisions.plans, "archive"),
      keep: count(decisions.plans, "keep"),
    },
    pendingWork: preview.routines.reduce((n, r) => n + r.pending + r.returned, 0),
    starsEarned: preview.routines.reduce((n, r) => n + r.stars_earned, 0),
    checkedSteps: preview.plans.reduce((n, p) => n + p.steps_checked, 0),
  };
}

/** Changes between the source routine and its planned copy, for the "same routine, what differs" view. */
export function routineCopyDiff(source: TransferRoutine, decision: RoutineDecision) {
  const days = [...source.days_of_week].sort().join() !== [...decision.days_of_week].sort().join();
  return {
    days,
    starts_on: decision.starts_on !== source.starts_on,
    ends_on: decision.ends_on !== source.ends_on,
  };
}

/** Server payload: only the fields the parent changed travel; the server fills the rest from the source. */
export function transferItemsPayload(
  decisions: PeriodTransferDecisions,
  preview: PeriodTransferPreview,
) {
  const routines = decisions.routines.map((d) => {
    const base = { id: d.id, revision: d.revision, action: d.action };
    if (d.action !== "copy") return base;
    const source = preview.routines.find((r) => r.id === d.id)!;
    const diff = routineCopyDiff(source, d);
    return {
      ...base,
      ...(diff.days ? { days_of_week: d.days_of_week } : {}),
      starts_on: d.starts_on,
      ...(d.ends_on ? { ends_on: d.ends_on } : {}),
    };
  });
  const plans = decisions.plans.map((d) => {
    const base = { id: d.id, revision: d.revision, action: d.action };
    if (d.action !== "copy") return base;
    return { ...base, planned_on: d.planned_on, due_on: d.due_on };
  });
  return { routines, plans };
}

export const periodTransferResultSchema = z.object({
  child_id: z.string().uuid(),
  from_period_id: z.string().uuid(),
  to_period_id: z.string().uuid(),
  revision: z.number().int(),
  created_routines: z.array(z.object({ id: z.string(), source_routine_id: z.string(), title: z.string(), starts_on: date })),
  paused_routines: z.array(z.string()),
  kept_routines: z.array(z.string()),
  created_plans: z.array(z.object({ id: z.string(), source_item_id: z.string(), title: z.string(), planned_on: date })),
  archived_plans: z.array(z.string()),
  kept_plans: z.array(z.string()),
});
export type PeriodTransferResult = z.infer<typeof periodTransferResultSchema>;

function addDays(day: string, days: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
