import { AiSuggestions } from "@/components/setup/ai-suggestions";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pencil } from "lucide-react-native";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { p, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { SetupWizard, ChoiceCard } from "@/components/setup/wizard";
import { REWARD_STARTERS } from "@/components/setup/templates";
import { REWARD_ICONS, RewardCost, RewardTile } from "./reward-visuals";
export function RewardForm({
  familyId,
  onClose,
  onCreated,
}: {
  familyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("10");
  const [icon, setIcon] = useState("reward-mystery-box");
  const saving = useRef(false);
  const validCost = /^\d{1,3}$/.test(cost) && Number(cost) >= 1;
  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim() || title.trim().length > 80 || !validCost || !familyId)
        throw Error("invalid");
      const { error } = await supabase.from("family_rewards").insert({
        family_id: familyId,
        title: title.trim(),
        icon,
        cost_stars: Number(cost),
        created_by: null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all(
        [
          ["family_rewards_all", familyId],
          ["family_rewards"],
          ["child_goal"],
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      );
      onCreated();
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  return (
    <SetupWizard
      title={t("rewardPremium.new")}
      steps={[t("betaUx.choose"), t("betaUx.details"), t("betaUx.review")]}
      step={step}
      setStep={setStep}
      dirty={choice !== null}
      busy={add.isPending}
      valid={step === 0 ? choice !== null : !!title.trim() && validCost}
      onClose={onClose}
      saveLabel={t("rewardPremium.save")}
      onSave={() => {
        if (saving.current) return;
        saving.current = true;
        add.mutate();
      }}
      error={
        add.error
          ? t(
              add.error.message === "invalid"
                ? "rewards.invalid"
                : "rewardPremium.saveError",
            )
          : null
      }
    >
      {step === 0 && (
        <>
          <Text style={u.heading}>{t("betaUx.rewardChoose")}</Text>
          <Text style={u.copy}>{t("betaUx.rewardChooseBody")}</Text>
          {REWARD_STARTERS.map((item) => (
            <ChoiceCard
              key={item.id}
              title={t(`betaUx.rewardTemplates.${item.id}`)}
              body={t("room.starCount", { count: item.cost })}
              art={<RewardTile slug={item.icon} size={56} />}
              selected={choice === item.id}
              onPress={() => {
                setChoice(item.id);
                setTitle(t(`betaUx.rewardTemplates.${item.id}`));
                setIcon(item.icon);
                setCost(String(item.cost));
              }}
            />
          ))}
          <ChoiceCard
            title={t("betaUx.customReward")}
            art={<Pencil color={p.purple} />}
            selected={choice === "custom"}
            onPress={() => {
              setChoice("custom");
              setTitle("");
              setIcon("reward-mystery-box");
            }}
          />
          <AiSuggestions
            kind="reward"
            onChoose={(item) => {
              setChoice("ai");
              setTitle(item.title);
              setCost(String(item.stars));
              setIcon(item.icon);
            }}
          />
        </>
      )}
      {step === 1 && (
        <>
          <Field
            label={t("rewardPremium.name")}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder={t("rewards.titlePlaceholder")}
          />
          <Text style={u.bold}>{t("rewards.chooseIcon")}</Text>
          <View style={[u.row, { flexWrap: "wrap" }]}>
            {REWARD_ICONS.map((slug) => (
              <Pressable
                key={slug}
                accessibilityRole="button"
                accessibilityLabel={t(`rewardIcon.${slug}`)}
                accessibilityState={{ selected: icon === slug }}
                onPress={() => setIcon(slug)}
                style={{
                  padding: 3,
                  borderRadius: 21,
                  borderWidth: 2,
                  borderColor: icon === slug ? p.purple : "transparent",
                }}
              >
                <RewardTile slug={slug} size={56} />
              </Pressable>
            ))}
          </View>
          <Field
            label={t("rewards.cost")}
            keyboardType="number-pad"
            maxLength={3}
            value={cost}
            onChangeText={(value) => setCost(value.replace(/\D/g, ""))}
          />
          <Text style={u.copy}>{t("betaUx.rewardCostHelp")}</Text>
          {!validCost && (
            <Text style={u.error}>{t("rewardPremium.invalidCost")}</Text>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <Text style={u.heading}>{t("betaUx.readyReward")}</Text>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <View style={u.row}>
              <RewardTile slug={icon} size={96} />
              <View style={u.fill}>
                <Text style={u.heading}>{title}</Text>
                <RewardCost count={Number(cost)} />
              </View>
            </View>
          </View>
          <Text style={u.copy}>{t("betaUx.rewardReviewBody")}</Text>
          <Text style={u.small}>
            {t("betaUx.rewardEstimate", { days: Math.ceil(Number(cost) / 3) })}
          </Text>
        </>
      )}
    </SetupWizard>
  );
}
