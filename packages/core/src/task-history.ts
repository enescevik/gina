import { z } from "zod";
import { templatesDueOn, type RecurringTemplate } from "./recurrence";
export const taskSnapshotSchema = z.object({
  title: z.string(),
  icon: z.string(),
  stars: z.number(),
  origin: z.enum(["submission", "migration"]),
});
export function taskSnapshot(value: unknown) {
  const result = taskSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
/** A submitted occurrence remains visible even if its routine has since changed. */
export function tasksWithRecordedWork<
  T extends RecurringTemplate & { title: string; icon: string; stars: number },
>(
  templates: readonly T[],
  completions: readonly {
    template_id: string;
    due_date: string;
    task_snapshot?: unknown;
  }[],
  date: string,
): (T & { available: boolean })[] {
  const due = new Set(templatesDueOn(templates, date).map((t) => t.id));
  const recorded = new Map(
    completions
      .filter((c) => c.due_date === date)
      .map((c) => [c.template_id, c]),
  );
  return templates
    .filter((t) => due.has(t.id) || recorded.has(t.id))
    .map((t) => {
      const frozen = taskSnapshot(recorded.get(t.id)?.task_snapshot);
      return {
        ...t,
        ...(frozen
          ? { title: frozen.title, icon: frozen.icon, stars: frozen.stars }
          : {}),
        available: due.has(t.id),
      };
    });
}
const routineSummary = z.object({
  title: z.string(),
  icon: z.string(),
  stars: z.number(),
  days_of_week: z.array(z.number()),
  time_of_day: z.string(),
  requires_approval: z.boolean(),
  active: z.boolean(),
  archived_at: z.string().nullable(),
});
export const taskRoutineHistorySchema = z.object({
  rows: z.array(
    z.object({
      revision: z.number(),
      action: z.string(),
      before_value: routineSummary.nullable(),
      after_value: routineSummary,
      created_at: z.string(),
    }),
  ),
  has_more: z.boolean(),
  pending: z.number(),
  returned: z.number(),
});
export type RoutineSummary = z.infer<typeof routineSummary>;
