import { useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  rewardHistorySchema,
  type Database,
  type RewardSummary,
} from "@gina/core";
import { SetupWizard } from "@/components/setup/wizard";
import { Field } from "@/components/ui/field";
import { NumberChoice } from "@/components/ui/number-choice";
import { FormSection } from "@/components/ui/parent-screen";
import { Pressable } from "@/components/ui/pressable";
import { SatinButton, p, u } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { RewardCost, RewardTile } from "./reward-visuals";
export type EditableReward = Pick<
  Database["public"]["Tables"]["family_rewards"]["Row"],
  "id" | "title" | "icon" | "cost_stars" | "active" | "revision" | "archived_at"
>;
type Action = "save" | "pause" | "resume" | "archive" | "restore";
export function RewardEditor({
  row,
  familyId,
  onClose,
  onSaved,
  onGoals,
}: {
  row: EditableReward;
  familyId: string;
  onClose: () => void;
  onSaved: (action: Action) => void;
  onGoals: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 700 && fontScale < 1.4;
  const { t, i18n } = useTranslation(),
    cache = useQueryClient();
  const [step, setStep] = useState(0),
    [action, setAction] = useState<Action>("save");
  const [title, setTitle] = useState(row.title),
    [cost, setCost] = useState(row.cost_stars);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const dirty = title.trim() !== row.title || cost !== row.cost_stars;
  const history = useInfiniteQuery({
    queryKey: ["reward_history", familyId, row.id],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("reward_history", {
        p_id: row.id,
        ...(pageParam ? { p_before_revision: pageParam } : {}),
      });
      if (error) throw error;
      return rewardHistorySchema.parse(data);
    },
    getNextPageParam: (last) =>
      last.has_more ? last.rows.at(-1)?.revision : undefined,
  });
  const impact = history.data?.pages[0],
    hasGoals = !!impact?.goals.length;
  const valid =
    !!impact &&
    !history.error &&
    (action === "save"
      ? !row.archived_at &&
        !hasGoals &&
        dirty &&
        !!title.trim() &&
        title.trim().length <= 80
      : action !== "archive" || !hasGoals);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        p_id: row.id,
        p_revision: row.revision,
        p_action: action,
        p_value:
          action === "save" ? { title: title.trim(), cost_stars: cost } : {},
      };
      const signature = JSON.stringify(payload);
      if (request.current?.signature !== signature)
        request.current = { signature, id: randomUUID() };
      const { error } = await supabase.rpc("change_reward", {
        ...payload,
        p_request_id: request.current.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all(
        [
          ["family_rewards_all", familyId],
          ["family_rewards"],
          ["child_goal"],
          ["reward_history", familyId, row.id],
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      );
      onSaved(action);
    },
  });
  const summary = (value: RewardSummary) => (
    <View style={{ gap: 8 }}>
      <Text style={u.heading}>{value.title}</Text>
      <RewardCost count={value.cost_stars} />
      <Text style={u.small}>
        {t(
          value.archived_at
            ? "rewardEdit.archived"
            : value.active
              ? "rewardPremium.active"
              : "rewardPremium.inactive",
        )}
      </Text>
    </View>
  );
  const choose = (a: Action) => {
    setAction(a);
    setStep(1);
  };
  return (
    <SetupWizard
      title={t("rewardEdit.details")}
      steps={[t("rewardEdit.details"), t("routine.review")]}
      step={step}
      setStep={(n) => {
        setStep(n);
        if (n === 0) setAction("save");
      }}
      dirty={dirty || action !== "save"}
      busy={save.isPending}
      valid={valid}
      hideContinue={step === 0 && (!!row.archived_at || hasGoals)}
      onSave={() => save.mutate()}
      onClose={onClose}
      saveLabel={t(`rewardEdit.action.${action}`)}
      error={
        save.error
          ? t(
              save.error.message.includes("reward_changed")
                ? "rewardEdit.changed"
                : save.error.message.includes("reward_has_goals")
                  ? "rewardEdit.goalConflict"
                  : "rewardEdit.failed",
            )
          : null
      }
    >
      {step === 0 ? (
        <>
          <View style={u.row}>
            <RewardTile slug={row.icon} size={80} />
            <Text style={[u.copy, u.fill]}>{t("rewardEdit.help")}</Text>
          </View>
          {hasGoals && (
            <View style={[u.card, { backgroundColor: p.mint }]}>
              <Text style={u.heading}>{t("rewardEdit.goalProtected")}</Text>
              <Text style={u.copy}>{t("rewardEdit.goalHelp")}</Text>
              {impact?.goals.map((goal) => (
                <Text key={goal.child_id} style={u.bold}>
                  {goal.name}
                  {goal.archived ? ` · ${t("rewardEdit.archivedProfile")}` : ""}
                </Text>
              ))}
              {!dirty && (
                <SatinButton
                  secondary
                  title={t("rewardEdit.goals")}
                  onPress={onGoals}
                />
              )}
            </View>
          )}
          {!row.archived_at && !hasGoals ? (
            <>
              <Field
                label={t("rewardEdit.title")}
                value={title}
                editable={!save.isPending}
                onChangeText={setTitle}
                maxLength={80}
              />
              <NumberChoice
                label={t("rewardEdit.cost")}
                value={cost}
                onChange={setCost}
                disabled={save.isPending}
                min={1}
                max={500}
                step={1}
                presets={[10, 20, 50, 100, 200]}
              />
            </>
          ) : (
            summary(row)
          )}
          <FormSection title={t("routine.history")}>
            {history.isPending ? (
              <Text style={u.copy}>{t("release.loading")}</Text>
            ) : history.error ? (
              <SatinButton
                title={t("common.retry")}
                onPress={() => void history.refetch()}
              />
            ) : (
              <>
                <Text style={u.small}>{t("rewardEdit.historyHelp")}</Text>
                {history.data?.pages
                  .flatMap((page) => page.rows)
                  .map((item) => (
                    <View key={item.revision} style={u.card}>
                      <Text style={u.bold}>
                        {t(`routine.event.${item.action}`)} ·{" "}
                        {new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.created_at))}
                      </Text>
                      {item.before_value && (
                        <>
                          <Text style={u.small}>{t("education.before")}</Text>
                          {summary(item.before_value)}
                        </>
                      )}
                      <Text style={u.small}>{t("education.after")}</Text>
                      {summary(item.after_value)}
                    </View>
                  ))}
                {!history.data?.pages[0]?.rows.length && (
                  <Text style={u.copy}>{t("routine.noHistory")}</Text>
                )}
                {history.hasNextPage && (
                  <SatinButton
                    secondary
                    title={t("schoolScores.older")}
                    busy={history.isFetchingNextPage}
                    onPress={() => void history.fetchNextPage()}
                  />
                )}
              </>
            )}
          </FormSection>
          <View
            style={{
              borderTopWidth: 1,
              borderColor: p.line,
              paddingTop: 12,
              gap: 6,
            }}
          >
            <Text style={u.small}>{t("rewardEdit.manageHelp")}</Text>
            {(row.archived_at
              ? ["restore"]
              : [
                  row.active ? "pause" : "resume",
                  ...(!hasGoals ? ["archive"] : []),
                ]
            ).map((a) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                disabled={
                  save.isPending || history.isPending || !!history.error
                }
                onPress={() => choose(a as Action)}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text
                  style={[
                    u.bold,
                    { color: a === "archive" ? "#A43135" : p.purple },
                  ]}
                >
                  {t(`rewardEdit.action.${a}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={u.heading}>{t(`rewardEdit.action.${action}`)}</Text>
          <Text style={u.copy}>{t(`rewardEdit.effect.${action}`)}</Text>
          {action !== "save" && dirty && (
            <Text style={u.copy}>{t("schoolScores.unsavedIgnored")}</Text>
          )}
          <View
            style={{
              flexDirection: wide && action === "save" ? "row" : "column",
              gap: 12,
            }}
          >
            <View
              style={[
                u.card,
                wide && action === "save" && { flex: 1, minWidth: 0 },
              ]}
            >
              <Text style={u.small}>{t("education.before")}</Text>
              {summary(row)}
            </View>
            {action === "save" && (
              <View
                style={[
                  u.card,
                  { backgroundColor: p.mint },
                  wide && { flex: 1, minWidth: 0 },
                ]}
              >
                <Text style={u.small}>{t("education.after")}</Text>
                {summary({ ...row, title: title.trim(), cost_stars: cost })}
              </View>
            )}
          </View>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <Text style={u.bold}>{t("rewardEdit.preserved")}</Text>
            <Text style={u.copy}>
              {t("routine.pending", { count: impact?.pending ?? 0 })}
            </Text>
            <Text style={u.copy}>
              {t("rewardEdit.approved", { count: impact?.approved ?? 0 })}
            </Text>
            <Text style={u.small}>{t("rewardEdit.preservedHelp")}</Text>
          </View>
        </>
      )}
    </SetupWizard>
  );
}
