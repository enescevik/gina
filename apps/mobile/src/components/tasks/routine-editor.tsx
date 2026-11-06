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
  effectiveFromArg,
  effectiveFromProblem,
  localDateOf,
  taskRoutineHistorySchema,
  type Database,
  type RoutineSummary,
} from "@gina/core";
import { SetupWizard } from "@/components/setup/wizard";
import { DateChoice } from "@/components/ui/date-time-choice";
import { effectiveFromLabel } from "@/components/planner/plan-history-note";
import { useFamilyTimezone } from "@/lib/family";
import { Field } from "@/components/ui/field";
import { NumberChoice } from "@/components/ui/number-choice";
import { FormSection } from "@/components/ui/parent-screen";
import { Pressable } from "@/components/ui/pressable";
import { ReportPicker } from "@/components/learning/learning-progress-view";
import { SatinButton, Tag, p, u } from "@/components/planner/ui";
import { TaskTile } from "./task-visuals";
import { supabase } from "@/lib/supabase";
import { invalidateTaskState } from "@/lib/task-cache";
export type Routine = Database["public"]["Tables"]["task_templates"]["Row"];
type Action = "save" | "pause" | "resume" | "archive" | "restore";
/**
 * L04: a later start day for an edit. The live `task_templates` row takes the new settings at once;
 * screens that read the dated contract keep today on the old version. Since C02 the calendar, the child's
 * Today, the parent home (`plan_for_day`/`plan_for_days`) and the task list (`routines_for_day`) all do,
 * so the task list opens the picker. Callers pass `allowFutureEffective` only from such a screen.
 */
export function RoutineEditor({
  row,
  childName,
  familyId,
  onClose,
  onSaved,
  allowFutureEffective = false,
}: {
  row: Routine;
  childName: string;
  familyId: string;
  onClose: () => void;
  onSaved: (action: Action) => void;
  allowFutureEffective?: boolean;
}) {
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const effectiveProblem = allowFutureEffective ? effectiveFromProblem(effectiveFrom, today) : null;
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 700 && fontScale < 1.4;
  const { t, i18n } = useTranslation(),
    cache = useQueryClient();
  const [step, setStep] = useState(0),
    [action, setAction] = useState<Action>("save");
  const [title, setTitle] = useState(row.title),
    [stars, setStars] = useState(row.stars),
    [days, setDays] = useState(row.days_of_week);
  const [time, setTime] = useState(row.time_of_day),
    [approval, setApproval] = useState(row.requires_approval);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const value = {
    title: title.trim(),
    icon: row.icon,
    stars,
    days_of_week: days,
    time_of_day: time,
    requires_approval: approval,
  };
  const dirty =
    title.trim() !== row.title ||
    stars !== row.stars ||
    JSON.stringify(days) !== JSON.stringify(row.days_of_week) ||
    time !== row.time_of_day ||
    approval !== row.requires_approval;
  const history = useInfiniteQuery({
    queryKey: ["task_routine_history", familyId, row.id],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("task_routine_history", {
        p_id: row.id,
        ...(pageParam ? { p_before_revision: pageParam } : {}),
      });
      if (error) throw error;
      return taskRoutineHistorySchema.parse(data);
    },
    getNextPageParam: (last) =>
      last.has_more ? last.rows.at(-1)?.revision : undefined,
  });
  const valid =
    !!history.data &&
    !history.error &&
    (action !== "save"
      ? !!history.data && !history.error
      : !row.archived_at &&
        dirty &&
        !!title.trim() &&
        title.trim().length <= 80 &&
        days.length > 0 &&
        !effectiveProblem);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        p_id: row.id,
        p_revision: row.revision,
        p_action: action,
        p_value: action === "save" ? value : {},
        // Omitted (not null) when the parent keeps today, so an older receipt still matches.
        ...(action === "save" && allowFutureEffective ? effectiveFromArg(effectiveFrom, today) : {}),
      };
      const signature = JSON.stringify(payload);
      if (request.current?.signature !== signature)
        request.current = { signature, id: randomUUID() };
      const { error } = await supabase.rpc("change_task_routine", {
        ...payload,
        p_request_id: request.current.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateTaskState(cache),
        cache.invalidateQueries({
          queryKey: ["parent_task_templates", familyId],
        }),
        cache.invalidateQueries({
          queryKey: ["family_task_templates", familyId],
        }),
        cache.invalidateQueries({ queryKey: ["task_templates", row.child_id] }),
        cache.invalidateQueries({
          queryKey: ["task_routine_history", familyId, row.id],
        }),
        cache.invalidateQueries({ queryKey: ["plan_for_day", familyId] }),
        cache.invalidateQueries({ queryKey: ["plan_for_days", familyId] }),
        cache.invalidateQueries({ queryKey: ["routines_for_day", familyId] }),
      ]);
      onSaved(action);
    },
  });
  const summary = (v: RoutineSummary) => (
    <View style={{ gap: 8 }}>
      <Text style={u.heading}>{v.title}</Text>
      <Text style={u.copy}>
        {v.days_of_week.map((day) => t(`weekday.${day}`)).join(" · ")}
      </Text>
      <Text style={u.copy}>
        {t("room.starCount", { count: v.stars })} ·{" "}
        {t(`routine.time.${v.time_of_day}`)}
      </Text>
      <Text style={u.small}>
        {t(v.requires_approval ? "routine.approvalOn" : "routine.approvalOff")}
      </Text>
      <Text style={u.small}>
        {t(
          v.archived_at
            ? "routine.archived"
            : v.active
              ? "taskPremium.activeLabel"
              : "taskPremium.pausedLabel",
        )}
      </Text>
    </View>
  );
  const changedSummary = (v: RoutineSummary) => (
    <View style={{ gap: 8 }}>
      <Text style={u.heading}>{v.title}</Text>
      <Text style={u.copy}>{t("room.starCount", { count: v.stars })}</Text>
      {JSON.stringify(days) !== JSON.stringify(row.days_of_week) && (
        <Text style={u.copy}>
          {v.days_of_week.map((d) => t(`weekday.${d}`)).join(" · ")}
        </Text>
      )}
      {time !== row.time_of_day && (
        <Text style={u.copy}>{t(`routine.time.${v.time_of_day}`)}</Text>
      )}
      {approval !== row.requires_approval && (
        <Text style={u.copy}>
          {t(
            v.requires_approval ? "routine.approvalOn" : "routine.approvalOff",
          )}
        </Text>
      )}
    </View>
  );
  const choose = (next: Action) => {
    setAction(next);
    setStep(1);
  };
  return (
    <SetupWizard
      title={`${childName} · ${t("routine.details")}`}
      steps={[t("routine.details"), t("routine.review")]}
      step={step}
      setStep={(n) => {
        setStep(n);
        if (n === 0) setAction("save");
      }}
      dirty={dirty || action !== "save"}
      busy={save.isPending}
      valid={valid}
      hideContinue={step === 0 && !!row.archived_at}
      onSave={() => save.mutate()}
      onClose={onClose}
      saveLabel={t(`routine.action.${action}`)}
      error={
        save.error
          ? t(
              save.error.message.includes("task_routine_changed")
                ? "routine.changed"
                : save.error.message.includes("plan_effective_past")
                ? "planHistory.effectivePast"
                : save.error.message.includes("plan_effective_invalid")
                ? "planHistory.effectiveTooFar"
                : save.error.message.includes("child_archived")
                  ? "childArchive.locked"
                  : "routine.failed",
            )
          : null
      }
    >
      {step === 0 ? (
        <>
          <View style={u.row}>
            <TaskTile slug={row.icon} size={64} />
            <Text style={[u.copy, u.fill]}>{t("routine.help")}</Text>
          </View>
          {!row.archived_at ? (
            <>
              <Field
                label={t("taskPremium.title")}
                value={title}
                editable={!save.isPending}
                onChangeText={setTitle}
                maxLength={80}
              />
              <Text style={u.bold}>{t("taskPremium.whichDays")}</Text>
              <View style={[u.row, { flexWrap: "wrap" }]}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <Tag
                    key={day}
                    label={t(`weekday.${day}`)}
                    selected={days.includes(day)}
                    onPress={() =>
                      !save.isPending &&
                      setDays(
                        days.includes(day)
                          ? days.filter((d) => d !== day)
                          : [...days, day].sort(),
                      )
                    }
                  />
                ))}
              </View>
              {!days.length && (
                <Text style={u.error}>{t("routine.chooseDay")}</Text>
              )}
              <NumberChoice
                label={t("betaUx.taskStars")}
                value={stars}
                disabled={save.isPending}
                onChange={setStars}
                min={0}
                max={10}
                step={1}
                presets={[0, 1, 2, 3, 5]}
              />
              <Text style={u.bold}>{t("routine.timeLabel")}</Text>
              <ReportPicker
                label={t("routine.timeLabel")}
                value={time}
                options={(
                  ["any", "morning", "afternoon", "evening"] as const
                ).map((v) => ({ value: v, label: t(`routine.time.${v}`) }))}
                onChange={(v) => {
                  if (!save.isPending) setTime(v);
                }}
              />
              <Text style={u.bold}>{t("routine.approvalLabel")}</Text>
              <ReportPicker
                label={t("routine.approvalLabel")}
                value={approval ? "on" : "off"}
                options={[
                  { value: "on", label: t("routine.approvalOn") },
                  { value: "off", label: t("routine.approvalOff") },
                ]}
                onChange={(v) => {
                  if (!save.isPending) setApproval(v === "on");
                }}
              />
              <Text style={u.bold}>{t("dayPlan.effectiveTitle")}</Text>
              {allowFutureEffective ? (
                <>
                  <DateChoice
                    label={t("planHistory.effectiveFrom")}
                    value={effectiveFrom}
                    today={today}
                    disabled={save.isPending}
                    hint={t("dayPlan.effectiveHelp")}
                    onChange={setEffectiveFrom}
                  />
                  {effectiveProblem ? (
                    <Text accessibilityRole="alert" style={u.error}>
                      {t(effectiveProblem === "too_far" ? "planHistory.effectiveTooFar" : "planHistory.effectivePast")}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={u.copy}>{t("dayPlan.effectiveTodayOnly")}</Text>
              )}
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
                <Text style={u.small}>{t("routine.historyHelp")}</Text>
                {history.data?.pages
                  .flatMap((p) => p.rows)
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
            <Text style={u.small}>{t("routine.manageHelp")}</Text>
            {(row.archived_at
              ? ["restore"]
              : [row.active ? "pause" : "resume", "archive"]
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
                  {t(`routine.action.${a}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={u.heading}>{t(`routine.action.${action}`)}</Text>
          <Text style={u.copy}>{t(`routine.effect.${action}`)}</Text>
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
              {action === "save" ? changedSummary(row) : summary(row)}
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
                {changedSummary({ ...row, ...value })}
              </View>
            )}
          </View>
          {action === "save" && (
            <Text style={u.small}>{t("routine.onlyChanges")}</Text>
          )}
          {action === "save" && (
            <Text style={u.bold}>
              {t("dayPlan.effectiveReview", {
                date: effectiveFromLabel(
                  allowFutureEffective ? effectiveFrom : today,
                  today,
                  (key, options) => t(key, options),
                  i18n.language,
                ),
              })}
            </Text>
          )}
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <Text style={u.bold}>{t("routine.preserved")}</Text>
            <Text style={u.copy}>
              {t("routine.pending", {
                count: history.data?.pages[0]?.pending ?? 0,
              })}
            </Text>
            <Text style={u.copy}>
              {t("routine.returned", {
                count: history.data?.pages[0]?.returned ?? 0,
              })}
            </Text>
            <Text style={u.small}>{t("routine.preservedHelp")}</Text>
          </View>
        </>
      )}
    </SetupWizard>
  );
}
