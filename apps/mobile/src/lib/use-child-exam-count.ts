import { useQuery } from "@tanstack/react-query";

import { useRealtimeInvalidate } from "./realtime";

import { supabase } from "./supabase";

/** Çocuğa atanmış (status 'assigned') deneme sayısı; kitaplık ve dar akıştaki Prova kartı rozeti. */
export function useChildExamCount(childId: string) {
  useRealtimeInvalidate("exams", childId ? `child_id=eq.${childId}` : null, [["child_exam_count", childId]]);
  return useQuery({
    queryKey: ["child_exam_count", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exams")
        .select("id", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("status", "assigned");
      if (error) throw error;
      return count ?? 0;
    },
  });
}
