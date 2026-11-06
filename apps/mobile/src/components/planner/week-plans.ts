// C02: one dated contract for every week view. `plan_for_days(child, from, to)` returns `plan_for_day`
// for each day, so the parent home, the calendar week strip/overview and the child's Today count the same
// records: that day's routine version, that day's timetable version (or "unknown" for a past day the
// history does not know) and the subject identity the parent confirmed.
import { useQueries } from "@tanstack/react-query";
import {
  dayPlansSchema,
  subjectDisplay,
  summarizeDayPlan,
  zonedIso,
  type DayPlan,
  type DaySummary,
  type Occurrence,
} from "@gina/core";
import type { WeekEvent } from "@/components/calendar/week-list";
import { supabase } from "@/lib/supabase";

type LooseRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

export const weekPlansKey = (familyId: string, childId: string, from: string, to: string) =>
  ["plan_for_days", familyId, childId, from, to] as const;

/** One `plan_for_days` read per child; same order as `childIds`. */
export function useWeekPlans(familyId: string, childIds: string[], from: string, to: string) {
  return useQueries({
    queries: childIds.map((id) => ({
      queryKey: weekPlansKey(familyId, id, from, to),
      enabled: !!familyId && !!from && !!to,
      queryFn: async (): Promise<DayPlan[]> => {
        const { data, error } = await rpc("plan_for_days", { p_child_id: id, p_from: from, p_to: to });
        if (error) throw error;
        return dayPlansSchema.parse(data);
      },
    })),
  });
}

/**
 * The day's lessons from that day's timetable version, as calendar occurrences. The catalogue title is
 * shown when the parent confirmed one; the original document text stays in `notes` (provenance).
 * Rows are `plan:`-prefixed: past days are read-only, today/later open the program editor.
 */
export function dayLessonOccurrences(plan: DayPlan, timeZone: string, english = false): Occurrence<WeekEvent>[] {
  // A past day older than every known timetable version shows the note only: the oldest known (= later)
  // program is not presented as that day's lessons.
  if (plan.day < plan.today && plan.timetable.status === "unknown_before") return [];
  return plan.timetable.day_lessons
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((l) => {
      const starts = zonedIso(plan.day, l.start, timeZone);
      const ends = zonedIso(plan.day, l.end, timeZone);
      const shown = subjectDisplay(l, english);
      return {
        date: plan.day,
        startsAt: new Date(starts),
        endsAt: new Date(ends),
        event: {
          id: `plan:${plan.child_id}:${plan.timetable.revision}:${l.id}`,
          title: shown.title,
          notes: shown.original,
          type: "school",
          child_id: plan.child_id,
          starts_at: starts,
          ends_at: ends,
          all_day: false,
          rrule: null,
          location: null,
          timetable_entry_key: `plan:${l.id}`,
        } as WeekEvent,
      };
    });
}

/** Per-day totals across the children in scope. `lessons` is null when any child's past day is unknown. */
export function weekSummaries(
  plans: (DayPlan[] | undefined)[],
  days: string[],
  completions: readonly { child_id?: string; template_id: string | null; due_date: string; status: string }[],
  childIds: string[],
): Record<string, DaySummary> {
  const out: Record<string, DaySummary> = {};
  for (const date of days) {
    const total: DaySummary = { date, due: 0, done: 0, lessons: 0, lessonsUnknown: false, homework: 0 };
    plans.forEach((list, i) => {
      const plan = list?.find((p) => p.day === date);
      if (!plan) return;
      const s = summarizeDayPlan(plan, completions.filter((c) => !c.child_id || c.child_id === childIds[i]));
      total.due += s.due;
      total.done += s.done;
      total.homework += s.homework;
      if (s.lessons === null) total.lessonsUnknown = true;
      else if (total.lessons !== null) total.lessons += s.lessons;
    });
    if (total.lessonsUnknown && total.lessons === 0) total.lessons = null;
    out[date] = total;
  }
  return out;
}
