import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";
import { Field } from "@/components/ui/field";
import { IconButton, p, Tag, u } from "@/components/planner/ui";
import { StarReward, TaskTile } from "@/components/tasks/task-visuals";
import { RewardCost, RewardTile } from "@/components/rewards/reward-visuals";
import type { SetupSuggestion } from "./ai-suggestions";
export type SuggestionDraft = SetupSuggestion & { days: number[] };
export function SuggestionBatch({ kind, items, onChange, review = false }: {
  kind: "task" | "reward";
  items: SuggestionDraft[];
  onChange: (items: SuggestionDraft[]) => void;
  review?: boolean;
}) {
  const { t } = useTranslation();
  const patch = (index: number, value: Partial<SuggestionDraft>) =>
    onChange(
      items.map((item, i) => i === index ? { ...item, ...value } : item),
    );
  return (
    <View style={{ gap: 16 }}>
      <Text style={u.heading}>
        {t("suggestions.batchTitle", { count: items.length })}
      </Text>
      <Text style={u.small}>
        {t(review ? "suggestions.reviewHelp" : "suggestions.editHelp")}
      </Text>
      {items.map((item, index) => (
        <View
          key={index}
          style={[u.card, {
            backgroundColor: review ? p.lilac : "#FFFFFF",
            gap: 12,
          }]}
        >
          <View style={u.row}>
            {kind === "task"
              ? <TaskTile slug={item.icon} size={56} />
              : <RewardTile slug={item.icon} size={56} />}
            <Text style={[u.bold, u.fill]}>{item.title}</Text>
            {review
              ? kind === "task"
                ? <StarReward count={item.stars} />
                : <RewardCost count={item.stars} />
              : null}
          </View>
          {!review
            ? (
              <>
                <Field
                  label={t(
                    kind === "task"
                      ? "taskPremium.title"
                      : "rewardPremium.name",
                  )}
                  value={item.title}
                  maxLength={80}
                  onChangeText={(title) => patch(index, { title })}
                />
                <View style={u.row}>
                  <Text style={[u.bold, u.fill]}>
                    {t(kind === "task" ? "betaUx.taskStars" : "rewards.cost")}
                  </Text>
                  <IconButton
                    label={t("taskPremium.lessStars")}
                    disabled={item.stars <= 1}
                    onPress={() => patch(index, { stars: item.stars - 1 })}
                  >
                    <Minus color={p.purple} />
                  </IconButton>
                  <Text style={u.heading}>{item.stars}</Text>
                  <IconButton
                    label={t("taskPremium.moreStars")}
                    disabled={item.stars >= (kind === "task" ? 10 : 999)}
                    onPress={() => patch(index, { stars: item.stars + 1 })}
                  >
                    <Plus color={p.purple} />
                  </IconButton>
                </View>
              </>
            )
            : null}
          {kind === "task"
            ? review
              ? (
                <Text style={u.copy}>
                  {item.days.map((day) => t(`weekday.${day}`)).join(" · ")}
                </Text>
              )
              : (
                <>
                  <Text style={u.bold}>{t("taskPremium.whichDays")}</Text>
                  <View style={[u.row, { flexWrap: "wrap" }]}>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <Tag
                        key={day}
                        label={t(`weekday.${day}`)}
                        selected={item.days.includes(day)}
                        onPress={() =>
                          patch(index, {
                            days: item.days.includes(day)
                              ? item.days.filter((d) => d !== day)
                              : [...item.days, day].sort(),
                          })}
                      />
                    ))}
                  </View>
                  {!item.days.length
                    ? <Text style={u.error}>{t("taskPremium.selectDay")}</Text>
                    : null}
                </>
              )
            : null}
        </View>
      ))}
    </View>
  );
}
