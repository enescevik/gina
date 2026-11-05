import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react-native";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

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
  const familyId = useSession().claims?.family_id;
  useRealtimeInvalidate("reward_catalog_sync", familyId ? `family_id=eq.${familyId}` : null, [["family_rewards"], ["child_goal"]]);
  const [selected, setSelected] = useState<string | null>(null);

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
    <Screen tone="child" surface="collection" loading={rewards.isLoading} title={t("goal.pick")}>
      <Text style={childStyles.copy}>{t("betaUx.childGoalHint")}</Text>
      {rewards.data?.length === 0 ? <View style={[childStyles.card, { alignItems: "center" }]}><Collectible slug="reward-mystery-box" size={110}/><Text style={childStyles.copy}>{t("goal.noRewards")}</Text></View> : null}
      {rewards.data?.map((reward) => (
        <Pressable
          key={reward.id}
          accessibilityRole="button"
          disabled={choose.isPending}
          accessibilityState={{ selected: selected === reward.id, disabled: choose.isPending }}
          onPress={() => setSelected(reward.id)}
          style={[childStyles.card, childStyles.row, selected === reward.id && { borderColor: "#6042DE", backgroundColor: "#F0ECFC" }]}
        >
          <Collectible slug={reward.icon} size={64} />
          <Text className="flex-1 font-body-bold text-lg text-ink">{reward.title}</Text>
          <View style={{flexDirection:"row",alignItems:"center",gap:4}}><Star size={18} color="#AA7623" fill="#F7D38D"/><Text className="font-body-bold text-base text-ink">{reward.cost_stars}</Text></View>
        </Pressable>
      ))}
      {selected && <Button title={t("betaUx.childGoalReview")} loading={choose.isPending} onPress={() => choose.mutate(selected)}/>}
      <ErrorText error={rewards.error ?? choose.error} />
      <Button variant="ghost" title={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
