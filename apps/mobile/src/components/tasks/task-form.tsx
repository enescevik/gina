import {
  SuggestionBatch,
  type SuggestionDraft,
} from "@/components/setup/suggestion-batch";
import { AiSuggestions } from "@/components/setup/ai-suggestions";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Minus, Pencil, Plus } from "lucide-react-native";
import {
  type IsoWeekday,
  localDateOf,
  taskTemplateInputSchema,
} from "@gina/core";
import { Avatar } from "@/components/avatar";
import { TASK_ICON_SLUGS } from "@/components/task-icon";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { IconButton, p, u } from "@/components/planner/ui";
import type { PlannerChild } from "@/components/planner/timetable-editor";
import { useSetupSave } from "@/components/setup/use-setup-save";
import { SetupSaveRecovery } from "@/components/setup/save-recovery";
import { ChoiceCard, SetupWizard } from "@/components/setup/wizard";
import { TASK_STARTERS } from "@/components/setup/templates";
import { StarReward, TaskTile } from "./task-visuals";
const DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
export function TaskForm({
  child,
  familyId,
  timeZone,
  onClose,
  onCreated,
}: {
  child: PlannerChild;
  familyId: string;
  timeZone: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [stars, setStars] = useState(1);
  const [days, setDays] = useState<IsoWeekday[]>([1, 2, 3, 4, 5]);
  const [icon, setIcon] = useState("task-custom");
  const [choice, setChoice] = useState<string | null>(null);
  const [allIcons, setAllIcons] = useState(false);
  const saving = useRef(false);
  const [aiDrafts, setAiDrafts] = useState<SuggestionDraft[]>([]);
  const validBatch = aiDrafts.length > 0 &&
    aiDrafts.every((item) =>
      item.title.trim().length > 0 && item.title.trim().length <= 80 &&
      item.days.length > 0
    );
  const { add, pending, blocked } = useSetupSave({
    familyId, kind: "task", childId: child.id,
    items: () => {
      const starts_on = localDateOf(new Date(), timeZone);
      if (choice === "ai") {
        if (!validBatch) throw Error("invalid");
        return aiDrafts.map(({ title, icon, stars, days, source_id }) => ({ title: title.trim(), icon, stars, days, starts_on, ...(source_id ? {source_id} : {}) }));
      }
      const parsed = taskTemplateInputSchema.safeParse({ child_id: child.id, title, icon, stars, days_of_week: days, starts_on });
      if (!parsed.success) throw Error("invalid");
      return [{ title: parsed.data.title, icon, stars, days, starts_on }];
    },
    onSuccess: async () => {
      await Promise.all(
        [
          ["parent_task_templates", familyId, child.id],
          ["task_templates", child.id],
          ["family_task_templates", familyId],
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      );
      onCreated();
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const summary = days.length === 7
    ? t("redesign.everyDay")
    : days.map((d) => t(`weekday.${d}`)).join(" · ");
  const valid = step === 0
    ? choice !== null
    : choice === "ai"
    ? validBatch
    : !!title.trim() && title.trim().length <= 80 && days.length > 0;
  return (
    <SetupWizard
      title={t("tasks.new")}
      steps={pending || blocked ? [t("setupRecovery.check")] : [t("betaUx.choose"), t("betaUx.details"), t("betaUx.review")]}
      step={pending || blocked ? 0 : step}
      setStep={setStep}
      dirty={!pending && !blocked && choice !== null}
      hideContinue={step === 0 && choice === null && !pending && !blocked}
      busy={add.isPending}
      valid={!blocked && (!!pending || valid)}
      onClose={onClose}
      saveLabel={pending || blocked ? t("setupRecovery.retry") : choice === "ai"
        ? t("suggestions.saveSelected", { count: aiDrafts.length })
        : t("taskPremium.save")}
      onSave={() => {
        if (saving.current) return;
        saving.current = true;
        add.mutate();
      }}
      error={add.error
        ? t(
          add.error.message === "invalid"
            ? "taskPremium.invalid"
            : add.error.message.includes("plan_limit")
            ? "betaUx.planLimit"
            : "taskPremium.saveError",
        )
        : null}
    >
      {pending || blocked ? <SetupSaveRecovery pending={pending} blocked={blocked}/> : <>
      <View style={u.row}>
        <Avatar slug={child.avatar} size={44} />
        <Text style={u.bold}>{child.name}</Text>
      </View>
      {step === 0 && (
        <>
          <Text style={u.heading}>{t("betaUx.taskChoose")}</Text>
          <Text style={u.copy}>{t("betaUx.taskChooseBody")}</Text>
          {TASK_STARTERS.map((item) => (
            <ChoiceCard
              key={item.id}
              title={t(`betaUx.taskTemplates.${item.id}`)}
              body={t("room.starCount", { count: item.stars })}
              art={<TaskTile slug={item.icon} size={56} />}
              selected={choice === item.id}
              onPress={() => {
                setChoice(item.id);
                setTitle(t(`betaUx.taskTemplates.${item.id}`));
                setIcon(item.icon);
                setStars(item.stars);
                setDays([...item.days]);
              }}
            />
          ))}
          <ChoiceCard
            title={t("betaUx.customTask")}
            art={<Pencil color={p.purple} />}
            selected={choice === "custom"}
            onPress={() => {
              setChoice("custom");
              setTitle("");
              setIcon("task-custom");
            }}
          />
          <AiSuggestions
            contextId={child.id}
            onPrepare={()=>setChoice(null)}
            allowDocument
            kind="task"
            grade={child.grade}
            onChoose={(items) => {
              setChoice("ai");
              setAiDrafts(
                items.map((item) => ({ ...item, days: item.source_id ? [] : [1, 2, 3, 4, 5] })),
              );
              setStep(1);
            }}
          />
        </>
      )}
      {step === 1 && choice !== "ai" && (
        <>
          <Field
            label={t("taskPremium.title")}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder={t("tasks.titlePlaceholder")}
          />
          <Text style={u.bold}>{t("taskPremium.icon")}</Text>
          <View style={[u.row, { flexWrap: "wrap", gap:6 }]}>
            {(allIcons ? TASK_ICON_SLUGS : [
              "brush-teeth",
              "read-book",
              "tidy-room",
              "pack-school-bag",
              "task-custom",
            ]).map((slug) => (
              <Pressable
                key={slug}
                accessibilityRole="button"
                accessibilityLabel={t(`taskIcon.${slug}`)}
                accessibilityState={{ selected: icon === slug }}
                onPress={() => setIcon(slug)}
                style={{
                  padding: 3,
                  borderWidth: 2,
                  borderRadius: 20,
                  borderColor: icon === slug ? p.purple : "transparent",
                }}
              >
                <TaskTile slug={slug} size={56} />
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAllIcons(!allIcons)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <Text style={[u.bold, { color: p.purple }]}>
              {t(allIcons ? "parentPremium.showLess" : "betaUx.allIcons")}
            </Text>
          </Pressable>
          <View style={[u.row, { justifyContent: "space-between" }]}>
            <View style={u.fill}>
              <Text style={u.bold}>{t("betaUx.taskStars")}</Text>
              <Text style={u.small}>{t("betaUx.taskStarsBody")}</Text>
            </View>
            <IconButton
              label={t("taskPremium.lessStars")}
              disabled={stars === 0}
              onPress={() => setStars(stars - 1)}
            >
              <Minus color={p.purple} />
            </IconButton>
            <Text style={u.heading}>{stars}</Text>
            <IconButton
              label={t("taskPremium.moreStars")}
              disabled={stars === 10}
              onPress={() => setStars(stars + 1)}
            >
              <Plus color={p.purple} />
            </IconButton>
          </View>
          <Text style={u.bold}>{t("taskPremium.whichDays")}</Text>
          <View style={[u.row, { flexWrap: "wrap", gap: 4 }]}>
            {DAYS.map((day) => (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={t(`planner.day${day}`)}
                accessibilityState={{ selected: days.includes(day) }}
                onPress={() =>
                  setDays(
                    days.includes(day)
                      ? days.filter((d) => d !== day)
                      : [...days, day].sort(),
                  )}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  padding: 8,
                  borderRadius: 16,
                  backgroundColor: days.includes(day) ? p.purple : p.lilac,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[
                    u.bold,
                    {
                      color: days.includes(day) ? "#fff" : p.ink,
                      fontSize: 14,
                    },
                  ]}
                >
                  {t(`weekday.${day}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {!days.length && (
            <Text style={u.error}>{t("taskPremium.selectDay")}</Text>
          )}
        </>
      )}
      {step === 2 && choice !== "ai" && (
        <>
          <Text style={u.heading}>{t("betaUx.readyTask")}</Text>
          <Text style={u.copy}>{t("betaUx.taskReviewBody")}</Text>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <View style={u.row}>
              <TaskTile slug={icon} size={80} />
              <View style={u.fill}>
                <Text style={u.heading}>{title}</Text>
                <Text style={u.copy}>{summary}</Text>
                <StarReward count={stars} />
              </View>
            </View>
          </View>
          <Text style={u.small}>{t("betaUx.taskApproval")}</Text>
        </>
      )}
      {step > 0 && choice === "ai"
        ? (
          <SuggestionBatch
            kind="task"
            items={aiDrafts}
            onChange={setAiDrafts}
            review={step === 2}
          />
        )
        : null}
      </>}
    </SetupWizard>
  );
}
