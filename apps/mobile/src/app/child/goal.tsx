import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Çocuk hedef seçer: ailenin ödül kataloğundan biri (set_child_goal RPC). */
export default function ChildGoalScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const childId = claims?.child_id ?? "";
  const queryClient = useQueryClient();

  const rewards = useQuery({
    queryKey: ["family_rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_rewards")
        .select("id, title, icon, cost_stars")
        .eq("active", true)
        .order("cost_stars");
      if (error) throw error;
      return data;
    },
  });

  const choose = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("set_child_goal", { p_reward_id: rewardId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["child_goal", childId] });
      router.back();
    },
  });

  return (
    <Screen tone="child" title={t("goal.pick")}>
      {rewards.data?.length === 0 ? <Text className="text-base text-gray-600">{t("goal.noRewards")}</Text> : null}
      {rewards.data?.map((reward) => (
        <Pressable
          key={reward.id}
          accessibilityRole="button"
          disabled={choose.isPending}
          onPress={() => choose.mutate(reward.id)}
          className="min-h-16 flex-row items-center gap-3 rounded-child bg-white p-4 active:bg-teal-light dark:bg-night-surface"
        >
          <Text className="text-2xl">🎁</Text>
          <Text className="flex-1 font-body-bold text-lg text-ink dark:text-night-text">{reward.title}</Text>
          <Text className="font-display text-base text-ink dark:text-night-text">⭐ {reward.cost_stars}</Text>
        </Pressable>
      ))}
      <ErrorText error={rewards.error ?? choose.error} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
