import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";

import { Collectible } from "@/components/collectible";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, childStyles } from "@/components/room/child-screen";
import { useActiveChild } from "@/lib/active-child";
import { supabase } from "@/lib/supabase";

/** Çocuk hedef seçer: ailenin ödül kataloğundan biri (set_child_goal RPC). */
export default function ChildGoalScreen() {
  const { t } = useTranslation();
  const { childId, actingAsParent } = useActiveChild();
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
      const { error } = await supabase.rpc("set_child_goal", { p_reward_id: rewardId, p_acting_child_id: actingAsParent ? childId : undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["child_goal", childId] });
      router.back();
    },
  });

  return (
    <Screen tone="child" loading={rewards.isLoading} title={t("goal.pick")}>
      {rewards.data?.length === 0 ? <Text className="font-body text-base text-gray-600">{t("goal.noRewards")}</Text> : null}
      {rewards.data?.map((reward) => (
        <Pressable
          key={reward.id}
          accessibilityRole="button"
          disabled={choose.isPending}
          onPress={() => choose.mutate(reward.id)}
          style={[childStyles.card, childStyles.row]}
        >
          <Collectible slug={reward.icon} size={64} />
          <Text className="flex-1 font-body-bold text-lg text-ink">{reward.title}</Text>
          <Text className="font-display text-base text-ink">⭐ {reward.cost_stars}</Text>
        </Pressable>
      ))}
      <ErrorText error={rewards.error ?? choose.error} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
