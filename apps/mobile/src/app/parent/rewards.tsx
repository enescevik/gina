import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
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
  const [cost, setCost] = useState("10");

  const rewards = useQuery({
    queryKey: ["family_rewards_all", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_rewards")
        .select("id, title, cost_stars, active")
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
        .select("id, status, cost_snapshot, requested_at, family_rewards(title), children(name)")
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
      if (!title.trim() || Number.isNaN(costNum) || costNum < 1) throw new Error(t("rewards.invalid"));
      const { error } = await supabase
        .from("family_rewards")
        .insert({ family_id: familyId, title: title.trim(), cost_stars: costNum, created_by: null });
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
    <Screen title={t("rewards.title")}>
      <View className="gap-2 rounded-parent bg-star/15 p-4">
        <Text className="font-display text-xl text-ink">{t("rewards.requests")}</Text>
        {requests.data?.length === 0 ? <Text className="font-body text-gray-600">{t("rewards.noRequests")}</Text> : null}
        {requests.data?.map((request) => (
          <View key={request.id} className="gap-2 rounded-parent bg-white p-3">
            <Text className="font-body-bold text-base text-ink">
              {request.family_rewards?.title} · {request.children?.name} · ⭐ {request.cost_snapshot}
            </Text>
            <View className="flex-row gap-2">
              {request.status === "requested" ? (
                <>
                  <View className="flex-1">
                    <Button title={t("parent.approve")} loading={act.isPending} onPress={() => act.mutate({ id: request.id, action: "approve" })} />
                  </View>
                  <Button variant="ghost" title={t("rewards.decline")} onPress={() => act.mutate({ id: request.id, action: "decline" })} />
                </>
              ) : (
                <>
                  <View className="flex-1">
                    <Button title={t("rewards.deliver")} loading={act.isPending} onPress={() => act.mutate({ id: request.id, action: "deliver" })} />
                  </View>
                  <Button variant="ghost" title={t("rewards.cancelRefund")} onPress={() => act.mutate({ id: request.id, action: "cancel" })} />
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2 rounded-parent border border-mist p-4">
        <Text className="font-display text-xl text-ink dark:text-night-text">{t("rewards.catalog")}</Text>
        {rewards.data?.map((reward) => (
          <View key={reward.id} className={`flex-row items-center gap-2 ${reward.active ? "" : "opacity-50"}`}>
            <Text className="font-body flex-1 text-base text-ink dark:text-night-text">
              🎁 {reward.title} · ⭐ {reward.cost_stars}
            </Text>
            <Button
              variant="ghost"
              title={reward.active ? t("tasks.pause") : t("tasks.resume")}
              onPress={() => toggleReward.mutate({ id: reward.id, active: !reward.active })}
            />
          </View>
        ))}
        <Field label={t("rewards.newTitle")} value={title} onChangeText={setTitle} placeholder={t("rewards.titlePlaceholder")} />
        <Field label={t("rewards.cost")} keyboardType="number-pad" maxLength={3} value={cost} onChangeText={setCost} />
        <Button variant="secondary" title={t("common.add")} loading={addReward.isPending} disabled={!title.trim()} onPress={() => addReward.mutate()} />
      </View>

      <ErrorText error={rewards.error ?? requests.error ?? addReward.error ?? act.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
