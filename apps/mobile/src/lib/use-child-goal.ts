import { useQuery } from "@tanstack/react-query";

import { useRealtimeInvalidate } from "./realtime";
import { supabase } from "./supabase";

export interface ChildGoal {
  id: string;
  rewardTitle: string;
  rewardIcon: string;
  cost: number;
}

/** Çocuğun aktif hedefi (ödül bilgisiyle); yoksa null. */
export function useChildGoal(childId: string) {
  const query = useQuery({
    queryKey: ["child_goal", childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildGoal | null> => {
      const { data, error } = await supabase
        .from("child_goals")
        .select("id, family_rewards(title, icon, cost_stars)")
        .eq("child_id", childId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!data?.family_rewards) return null;
      return {
        id: data.id,
        rewardTitle: data.family_rewards.title,
        rewardIcon: data.family_rewards.icon,
        cost: data.family_rewards.cost_stars,
      };
    },
  });
  useRealtimeInvalidate("child_goals" as never, childId ? `child_id=eq.${childId}` : null, [["child_goal", childId]]);
  return query;
}
