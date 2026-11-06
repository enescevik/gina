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
import { useChildGoal } from "@/lib/use-child-goal";
import { useFamilyTimezone } from "@/lib/family";
import { localDateOf, readChildStarBalance } from "@gina/core";
import { supabase } from "@/lib/supabase";

/** Çocuk hedef seçer: ailenin ödül kataloğundan biri (set_child_goal RPC). */
export default function ChildGoalScreen() {
  const { t } = useTranslation();
  const { childId, actingAsParent, path } = useActiveChild();
  const current = useChildGoal(childId);
  const today = localDateOf(new Date(), useFamilyTimezone());
  // Aynı önbellek anahtarı Dünyam ile paylaşılır; bakiye sunucuda hesaplanır.
  const balance = useQuery({
    queryKey: ["star_events", childId, today],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("child_star_balance", { p_child_id: childId, p_day: today });
      if (error) throw error;
      return readChildStarBalance(data);
    },
  });
  const stars = balance.data?.balance ?? 0;
  // Derin bağlantıda (web yenileme) geçmiş yoksa Dünyam'a dön: sayfada takılı kalma.
  const leave = () => (router.canGoBack() ? router.back() : router.replace(path("today")));
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
      leave();
    },
  });

  const selectedReward = rewards.data?.find((r) => r.id === selected);
  return (
    <Screen tone="child" surface="collection" loading={rewards.isLoading} title={t("goal.pick")}>
      <Text style={childStyles.copy}>{t("betaUx.childGoalHint")}</Text>
      <View testID="goal-balance" style={[childStyles.card, childStyles.row]} accessible accessibilityLabel={balance.isSuccess ? t("goal.balance", { count: stars }) : undefined}>
        <Star size={26} color="#AA7623" fill="#F7D38D" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[childStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{balance.isSuccess ? t("goal.balance", { count: stars }) : balance.error ? t("goal.balanceUnknown") : "…"}</Text>
          {current.data ? <Text style={[childStyles.copy, { fontSize: 14 }]}>{t("goal.currentGoal", { title: current.data.rewardTitle, cost: current.data.cost })}</Text> : null}
          <Text style={[childStyles.copy, { fontSize: 14 }]}>{t("goal.keepStars")}</Text>
        </View>
      </View>
      {rewards.data?.length === 0 ? <View style={[childStyles.card, { alignItems: "center" }]}><Collectible slug="reward-mystery-box" size={110}/><Text style={childStyles.copy}>{t("goal.noRewards")}</Text></View> : null}
      {rewards.data?.map((reward) => (
        <Pressable
          key={reward.id}
          accessibilityRole="button"
          disabled={choose.isPending}
          accessibilityState={{ selected: selected === reward.id, disabled: choose.isPending }}
          aria-pressed={selected === reward.id}
          onPress={() => setSelected(reward.id)}
          style={[childStyles.card, childStyles.row, selected === reward.id && { borderColor: "#6042DE", backgroundColor: "#F0ECFC" }]}
        >
          <Collectible slug={reward.icon} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text className="font-body-bold text-lg text-ink">{reward.title}</Text>
            {current.data?.rewardTitle === reward.title && current.data.cost === reward.cost_stars ? <Text style={[childStyles.copy, { fontSize: 13 }]}>{t("goal.isCurrent")}</Text> : null}
          </View>
          <View style={{flexDirection:"row",alignItems:"center",gap:4}}><Star size={18} color="#AA7623" fill="#F7D38D"/><Text className="font-body-bold text-base text-ink">{reward.cost_stars}</Text></View>
        </Pressable>
      ))}
      {selectedReward ? <View testID="goal-summary" style={[childStyles.card, { gap: 6, borderColor: "#6042DE" }]} accessibilityLiveRegion="polite">
        <Text style={[childStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{t("goal.summaryTitle", { title: selectedReward.title })}</Text>
        <Text style={childStyles.copy}>{t("goal.summaryCost", { cost: selectedReward.cost_stars })}</Text>
        {balance.isSuccess ? <Text style={childStyles.copy}>{stars >= selectedReward.cost_stars ? t("goal.summaryEnough") : t("goal.summaryLeft", { count: selectedReward.cost_stars - stars, stars })}</Text> : null}
        <Text style={[childStyles.copy, { fontSize: 14 }]}>{current.data ? t("goal.summaryChange") : t("goal.summaryFree")}</Text>
      </View> : null}
      {selected && <Button title={t("betaUx.childGoalReview")} loading={choose.isPending} onPress={() => choose.mutate(selected)}/>}
      <ErrorText error={rewards.error ?? choose.error} />
      <Button variant="ghost" title={t("common.cancel")} onPress={leave} />
    </Screen>
  );
}
