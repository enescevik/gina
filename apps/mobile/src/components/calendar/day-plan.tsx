// L04 UI: the calendar reads `plan_for_day(child, day)` for the selected day. Past days show the
// routine/timetable/bell version that applied that day (with an honesty note when the history does
// not know it); today and later keep the live events, and routines always come from the server's
// day plan so a change scheduled for a later day never shows up early.
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import {
  dayPlanSchema,
  planHistoryNote,
  zonedIso,
  type DayPlan,
  type DayPlanRoutine,
  type Occurrence,
  type PlanHistoryNote as PlanHistoryNoteKind,
} from "@gina/core";
import type { WeekEvent } from "@/components/calendar/week-list";
import { TaskTile } from "@/components/tasks/task-visuals";
import { PlanHistoryNote } from "@/components/planner/plan-history-note";
import { p, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";

export const dayPlanKey = (familyId: string, childId: string, day: string) =>
  ["plan_for_day", familyId, childId, day] as const;

/** One `plan_for_day` read per child in scope; same order as `childIds`. */
export function useDayPlans(familyId: string, childIds: string[], day: string) {
  return useQueries({
    queries: childIds.map((id) => ({
      queryKey: dayPlanKey(familyId, id, day),
      enabled: !!familyId && !!day,
      queryFn: async (): Promise<DayPlan> => {
        const { data, error } = await supabase.rpc("plan_for_day", {
          p_child_id: id,
          p_day: day,
        });
        if (error) throw error;
        return dayPlanSchema.parse(data);
      },
    })),
  });
}

/**
 * The day's lessons from the timetable version that applied that day, as calendar occurrences so the
 * agenda renders them like the live rows. Ids are prefixed `plan:` and the rows are read-only.
 */
export function planLessons(plan: DayPlan, timeZone: string): Occurrence<WeekEvent>[] {
  return plan.timetable.day_lessons
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((l) => {
      const starts = zonedIso(plan.day, l.start, timeZone);
      const ends = zonedIso(plan.day, l.end, timeZone);
      return {
        date: plan.day,
        startsAt: new Date(starts),
        endsAt: new Date(ends),
        event: {
          id: `plan:${plan.child_id}:${plan.timetable.revision}:${l.id}`,
          title: l.title,
          type: "school",
          child_id: plan.child_id,
          starts_at: starts,
          ends_at: ends,
          all_day: false,
          rrule: null,
          location: null,
          timetable_entry_key: `plan:${l.id}`,
        },
      };
    });
}
export const isPlanRow = (e: WeekEvent) => e.id.startsWith("plan:");

/**
 * "Known since, start not recorded" only matters when looking back; on today/later days every
 * migrated row would carry it. Unknown/snapshot and scheduled notes always show.
 */
export function showPlanNote(note: PlanHistoryNoteKind, day: string, today: string) {
  return note !== "none" && (note !== "legacy" || day < today);
}

/** Routines that apply on the day; legacy/unknown versions carry their note. */
export function RoutineRows({
  routines,
  today,
  day,
  childName,
}: {
  routines: { routine: DayPlanRoutine; childId: string }[];
  today: string;
  day: string;
  childName?: (childId: string) => string | null;
}) {
  const { t } = useTranslation();
  const order = { morning: 0, afternoon: 1, evening: 2, any: 3 } as const;
  const sorted = routines
    .slice()
    .sort((a, b) => order[a.routine.time_of_day] - order[b.routine.time_of_day] || a.routine.title.localeCompare(b.routine.title));
  return (
    <View style={{ gap: 8 }}>
      {sorted.map(({ routine: r, childId }) => {
        const who = childName?.(childId);
        return (
          <View key={`${childId}:${r.id}`} style={{ gap: 6 }}>
            <View
              accessible
              accessibilityLabel={`${r.title}, ${t(`routine.time.${r.time_of_day}`)}, ${t("room.starCount", { count: r.stars })}${who ? `, ${who}` : ""}`}
              style={[
                u.row,
                {
                  minHeight: 56,
                  padding: 8,
                  borderRadius: 18,
                  backgroundColor: "#F4FBF8",
                  borderWidth: 1,
                  borderColor: "#D7F1E7",
                },
              ]}
            >
              <TaskTile slug={r.icon} size={40} />
              <View style={u.fill}>
                <Text style={u.bold}>{r.title}</Text>
                <Text style={[u.small, { marginTop: 2 }]}>
                  {t(`routine.time.${r.time_of_day}`)} · {t("room.starCount", { count: r.stars })}
                  {who ? ` · ${who}` : ""}
                </Text>
              </View>
            </View>
            {showPlanNote(planHistoryNote(r, today), day, today) ? <PlanHistoryNote entry={r} today={today} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Small section heading used under the day: lessons, events, tasks, homework. */
export function DaySectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <View style={[u.row, { justifyContent: "space-between", marginTop: 6 }]}>
      <Text accessibilityRole="header" style={[u.bold, { color: p.muted }]}>
        {title}
      </Text>
      {count !== undefined ? <Text style={u.small}>{count}</Text> : null}
    </View>
  );
}
