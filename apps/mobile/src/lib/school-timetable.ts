import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_LESSON_SETTINGS,
  type Lesson,
  type LessonSettings,
} from "@gina/core";
import { supabase } from "./supabase";
import { useRealtimeInvalidate } from "./realtime";
export function useSchoolTimetable(childId: string) {
  const query = useQuery({
    queryKey: ["school_timetable", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_timetables")
        .select("revision,lessons,settings")
        .eq("child_id", childId)
        .maybeSingle();
      if (error) throw error;
      return {
        revision: data?.revision ?? 0,
        lessons: (data?.lessons ?? []) as unknown as Lesson[],
        settings: (data?.settings ??
          DEFAULT_LESSON_SETTINGS) as unknown as LessonSettings,
      };
    },
  });
  useRealtimeInvalidate(
    "school_timetables",
    childId ? `child_id=eq.${childId}` : null,
    [["school_timetable", childId], ["events"], ["child_events"]],
  );
  return query;
}
