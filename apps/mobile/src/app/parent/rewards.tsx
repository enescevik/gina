import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Collectible } from "@/components/collectible";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Veli: ödül kataloğu + harcama istekleri (onay/teslim/iptal). */
export default function ParentRewardsScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("reward-mystery-box");
  const [cost, setCost] = useState("10");

  const rewards = useQuery({
    queryKey: ["family_rewards_all", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_rewards")
        .select("id, title, icon, cost_stars, active")
        .order("cost_stars");
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["reward_requests", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_requests")
        .select("id, status, cost_snapshot, requested_at, family_rewards(title, icon), children(name)")
        .in("status", ["requested", "approved"])
        .order("requested_at");
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate("reward_requests", familyId ? `family_id=eq.${familyId}` : null, [["reward_requests", familyId]]);

  const addReward = useMutation({
    mutationFn: async () => {
      const costNum = Number(cost);
      if (!title.trim() || !Number.isSafeInteger(costNum) || costNum < 1) throw new Error(t("rewards.invalid"));
      const { error } = await supabase
        .from("family_rewards")
        .insert({ family_id: familyId, title: title.trim(), icon, cost_stars: costNum, created_by: null });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["family_rewards_all", familyId] });
    },
  });

  const toggleReward = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("family_rewards").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["family_rewards_all", familyId] }),
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "decline" | "deliver" | "cancel" }) => {
      const { error } =
        action === "approve"
          ? await supabase.rpc("decide_reward_request", { p_request_id: id, p_approve: true })
          : action === "decline"
            ? await supabase.rpc("decide_reward_request", { p_request_id: id, p_approve: false })
            : action === "deliver"
              ? await supabase.rpc("deliver_reward_request", { p_request_id: id })
              : await supabase.rpc("cancel_reward_request", { p_request_id: id });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["reward_requests", familyId] }),
  });

  return (
    <Screen title={t("rewards.title")} subtitle={t("parentV5.rewardsSubtitle")} loading={rewards.isLoading || requests.isLoading} error={rewards.error ?? requests.error} onRetry={() => { void rewards.refetch(); void requests.refetch(); }}>
      <View className="gap-2 rounded-parent bg-star/15 p-4">
        <Text className="font-display text-xl text-ink">{t("rewards.requests")}</Text>
        {requests.data?.length === 0 ? <Text className="font-body text-gray-600">{t("rewards.noRequests")}</Text> : null}
        {requests.data?.map((request) => (
          <View key={request.id} className="gap-2 rounded-parent bg-white p-3">
            <View style={parentStyles.row}><Collectible slug={request.family_rewards?.icon ?? "reward-mystery-box"} size={80} /><View className="flex-1 gap-1"><Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{request.family_rewards?.title}</Text><Text style={parentStyles.muted}>{request.children?.name} · {t("room.starCount", { count: request.cost_snapshot })}</Text></View></View>
            <View className="flex-row gap-2">
              {request.status === "requested" ? (
                <>
                  <View className="flex-1">
                    <Button title={t("parent.approve")} loading={act.isPending} onPress={() => act.mutate({ id: request.id, action: "approve" })} />
                  </View>
                  <Button variant="ghost" disabled={act.isPending} title={t("rewards.decline")} onPress={() => act.mutate({ id: request.id, action: "decline" })} />
                </>
              ) : (
                <>
                  <View className="flex-1">
                    <Button title={t("rewards.deliver")} loading={act.isPending} onPress={() => act.mutate({ id: request.id, action: "deliver" })} />
                  </View>
                  <Button variant="ghost" disabled={act.isPending} title={t("rewards.cancelRefund")} onPress={() => act.mutate({ id: request.id, action: "cancel" })} />
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={parentStyles.card}>
        <Text className="font-display text-xl text-ink">{t("rewards.catalog")}</Text>
        {rewards.data?.map((reward) => (
          <View key={reward.id} className={`flex-row items-center gap-2 ${reward.active ? "" : "opacity-50"}`}>
            <Collectible slug={reward.icon} size={56} />
            <Text style={[parentStyles.copy, { flex: 1 }]}>{reward.title} · {t("room.starCount", { count: reward.cost_stars })}</Text>
            <Button
              variant="ghost"
              title={reward.active ? t("tasks.pause") : t("tasks.resume")}
              disabled={toggleReward.isPending} loading={toggleReward.isPending && toggleReward.variables?.id === reward.id}
              onPress={() => toggleReward.mutate({ id: reward.id, active: !reward.active })}
            />
          </View>
        ))}
        <Text style={parentStyles.copy}>{t("rewards.chooseIcon")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {["reward-movie-night", "reward-book", "reward-toy", "reward-bike-ride", "reward-park", "reward-ice-cream", "reward-game-with-parent", "reward-mystery-box"].map(slug => <Pressable key={slug}
            accessibilityRole="button" accessibilityLabel={t(`rewardIcon.${slug}`)} accessibilityState={{ selected: icon === slug }}
            onPress={() => setIcon(slug)} style={{ padding: 5, borderRadius: 14, borderWidth: 2, borderColor: icon === slug ? "#0B7F7F" : "#E4DAC8", backgroundColor: icon === slug ? "#E1F2EB" : "#FFFCF6" }}>
            <Collectible slug={slug} size={48} />
          </Pressable>)}
        </View>
        <Field label={t("rewards.newTitle")} value={title} onChangeText={setTitle} placeholder={t("rewards.titlePlaceholder")} />
        <Field label={t("rewards.cost")} keyboardType="number-pad" maxLength={3} value={cost} onChangeText={setCost} />
        <Button variant="secondary" title={t("common.add")} loading={addReward.isPending} disabled={!title.trim()} onPress={() => addReward.mutate()} />
      </View>

      <ErrorText error={addReward.error ?? act.error ?? toggleReward.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
