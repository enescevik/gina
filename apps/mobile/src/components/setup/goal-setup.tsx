import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useChildGoal } from "@/lib/use-child-goal";
import { Avatar } from "@/components/avatar";
import { RewardTile, RewardCost } from "@/components/rewards/reward-visuals";
import { SatinButton, u, p } from "@/components/planner/ui";
import { ChoiceCard, SetupWizard } from "./wizard";
export function GoalSetup({
  initialChild,
  onClose,
  onSaved,
  onCreateReward,
}: {
  initialChild?: string;
  onClose: () => void;
  onSaved: () => void;
  onCreateReward: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [childId, setChildId] = useState(initialChild ?? "");
  const [rewardId, setRewardId] = useState("");
  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,name,grade,avatar")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const child =
    children.data?.find((c) => c.id === childId) ??
    (children.data?.length === 1 ? children.data[0] : undefined);
  const goal = useChildGoal(child?.id ?? "");
  const rewards = useQuery({
    queryKey: ["family_rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_rewards")
        .select("id,title,icon,cost_stars")
        .eq("active", true)
        .order("cost_stars");
      if (error) throw error;
      return data;
    },
  });
  const reward = rewards.data?.find((r) => r.id === rewardId);
  const save = useMutation({
    mutationFn: async () => {
      if (!child || !reward) throw Error("invalid");
      const { error } = await supabase.rpc("set_child_goal", {
        p_reward_id: reward.id,
        p_acting_child_id: child.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["child_goal"] });
      onSaved();
    },
  });
  const loading = children.isLoading || rewards.isLoading;
  const error = children.error ?? rewards.error ?? goal.error;
  return (
    <SetupWizard
      title={t("betaUx.chooseGoal")}
      steps={[t("betaUx.choose"), t("betaUx.review")]}
      step={step}
      setStep={setStep}
      dirty={!!rewardId}
      valid={!!child && !!reward && !error && !loading}
      busy={save.isPending}
      onClose={onClose}
      onSave={() => save.mutate()}
      saveLabel={t("betaUx.setGoal")}
      error={save.error ? t("betaUx.goalSaveError") : null}
    >
      {loading && <ActivityIndicator color={p.purple} />}
      {error && (
        <View style={u.card}>
          <Text style={u.error}>{t("release.genericError")}</Text>
          <SatinButton
            title={t("common.retry")}
            onPress={() => {
              void children.refetch();
              void rewards.refetch();
              void goal.refetch();
            }}
          />
        </View>
      )}
      {step === 0 && (
        <>
          <Text style={u.heading}>{t("betaUx.goalChoose")}</Text>
          <Text style={u.copy}>{t("betaUx.goalChooseBody")}</Text>
          {(children.data?.length ?? 0) > 1
            ? children.data?.map((c) => (
                <ChoiceCard
                  key={c.id}
                  title={c.name}
                  art={<Avatar slug={c.avatar} size={42} />}
                  selected={child?.id === c.id}
                  onPress={() => setChildId(c.id)}
                />
              ))
            : child && (
                <View style={u.row}>
                  <Avatar slug={child.avatar} size={42} />
                  <Text style={u.bold}>{child.name}</Text>
                </View>
              )}
          {rewards.data?.map((r) => (
            <ChoiceCard
              key={r.id}
              title={r.title}
              body={t("room.starCount", { count: r.cost_stars })}
              art={<RewardTile slug={r.icon} size={64} />}
              selected={rewardId === r.id}
              onPress={() => setRewardId(r.id)}
            />
          ))}
          {!loading && !error && !rewards.data?.length && (
            <View style={{ gap: 12 }}>
              <Text style={u.copy}>{t("betaUx.goalNeedsReward")}</Text>
              <SatinButton
                title={t("rewardPremium.new")}
                onPress={onCreateReward}
              />
            </View>
          )}
        </>
      )}
      {step === 1 && reward && child && (
        <>
          <Text style={u.heading}>
            {t("betaUx.goalReview", { name: child.name })}
          </Text>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <View style={u.row}>
              <RewardTile slug={reward.icon} size={96} />
              <View style={u.fill}>
                <Text style={u.heading}>{reward.title}</Text>
                <RewardCost count={reward.cost_stars} />
              </View>
            </View>
          </View>
          <Text style={u.copy}>{t("betaUx.goalNoSpend")}</Text>
          {goal.data && (
            <Text style={u.small}>
              {t("betaUx.goalReplaces", { title: goal.data.rewardTitle })}
            </Text>
          )}
        </>
      )}
    </SetupWizard>
  );
}
