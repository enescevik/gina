import { EducationChangeStatus } from "./education-change";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { ArrowRightLeft } from "lucide-react-native";
import {
  defaultTransferDecisions,
  periodTransferPreviewSchema,
  periodTransferResultSchema,
  planDecisionValid,
  routineCopyDiff,
  routineDecisionValid,
  summarizePeriodTransfer,
  transferDecisionsValid,
  transferItemsPayload,
  type PeriodTransferDecisions,
  type PeriodTransferPreview,
  type PeriodTransferResult,
  type PlanDecision,
  type RoutineDecision,
  type TransferPlan,
  type TransferRoutine,
} from "@gina/core";
import type { EducationState } from "./education-period";
import { supabase } from "@/lib/supabase";
import { SetupWizard, ChoiceCard } from "@/components/setup/wizard";
import { DateChoice } from "@/components/ui/date-time-choice";
import { Toggle } from "@/components/ui/toggle";
import { p, u, SatinButton, Tag } from "@/components/planner/ui";

// Selective transfer from the most recently closed period into the current one.
// Old submissions, answers and stars never move; every old record gets an explicit fate.
export function PeriodTransfer({
  child,
  education,
}: {
  child: { id: string; name: string; archived_at: string | null };
  education: EducationState;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<PeriodTransferResult | null>(null);
  const from = education.history[0];
  const to = education.current;
  // C02: planned change + 14-day undo live next to the transfer card (same screen, same period data).
  const status = <EducationChangeStatus child={child} />;
  if (!from || !to) return status;
  return (
    <>
    {status}
    <View style={[u.card, { backgroundColor: p.mint }]}>
      <View style={u.row}>
        <ArrowRightLeft color={p.purple} size={26} />
        <Text style={[u.bold, u.fill]}>{t("periodTransfer.open")}</Text>
      </View>
      <Text style={u.copy}>{t("periodTransfer.openBody")}</Text>
      {saved && (
        <Text
          accessibilityLiveRegion="polite"
          style={[u.bold, { color: "#287460" }]}
        >
          {t("periodTransfer.saved", {
            routines: saved.created_routines.length,
            plans: saved.created_plans.length,
          })}
        </Text>
      )}
      {child.archived_at ? (
        <Text style={u.copy}>{t("periodTransfer.locked")}</Text>
      ) : (
        <SatinButton
          secondary
          title={t("periodTransfer.open")}
          onPress={() => {
            setSaved(null);
            setOpen(true);
          }}
        />
      )}
      {open && (
        <PeriodTransferWizard
          child={child}
          fromId={from.id}
          toId={to.id}
          onClose={() => setOpen(false)}
          onSaved={(result) => {
            setOpen(false);
            setSaved(result);
          }}
        />
      )}
    </View>
    </>
  );
}

function PeriodTransferWizard({
  child,
  fromId,
  toId,
  onClose,
  onSaved,
}: {
  child: { id: string; name: string };
  fromId: string;
  toId: string;
  onClose: () => void;
  onSaved: (result: PeriodTransferResult) => void;
}) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [edited, setEdited] = useState<{
    source: PeriodTransferPreview;
    decisions: PeriodTransferDecisions;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ["period_transfer_preview", child.id, fromId, toId],
    queryFn: async () => {
      const r = await supabase.rpc("preview_education_period_transfer", {
        p_child_id: child.id,
        p_from_period_id: fromId,
        p_to_period_id: toId,
      });
      if (r.error) throw r.error;
      return periodTransferPreviewSchema.parse(r.data);
    },
  });
  const data = preview.data;
  // Decisions belong to the list the parent actually saw; a refreshed list starts over.
  const decisions = data
    ? edited?.source === data
      ? edited.decisions
      : defaultTransferDecisions(data)
    : null;
  const update = (fn: (d: PeriodTransferDecisions) => PeriodTransferDecisions) => {
    if (data && decisions) setEdited({ source: data, decisions: fn(decisions) });
  };
  const request = useRef({ id: randomUUID(), payload: "" });
  const saving = useRef(false);
  const save = useMutation({
    mutationFn: async () => {
      if (!data || !decisions || !transferDecisionsValid(decisions, data))
        throw Error("transfer_invalid");
      const args = {
        p_child_id: child.id,
        p_from_period_id: fromId,
        p_to_period_id: toId,
        p_revision: data.revision,
        p_items: transferItemsPayload(decisions, data),
      };
      const payload = JSON.stringify(args);
      if (request.current.payload && request.current.payload !== payload)
        request.current.id = randomUUID();
      request.current.payload = payload;
      const r = await supabase.rpc("transfer_education_period_items", {
        ...args,
        p_request_id: request.current.id,
      });
      if (r.error) throw r.error;
      return periodTransferResultSchema.parse(r.data);
    },
    onSuccess: async (result) => {
      await cache.invalidateQueries();
      onSaved(result);
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const conflict =
    !!save.error &&
    /education_changed|transfer_changed|task_routine_changed|plan_changed|transfer_period|request_conflict/.test(
      save.error.message,
    );
  const locked = !!save.error && /child_archived/.test(save.error.message);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value + "T12:00:00Z"));
  const year = (value: { academic_year: number }) =>
    t("education.yearValue", {
      year: value.academic_year,
      next: value.academic_year + 1,
    });
  const empty = !!data && !data.routines.length && !data.plans.length;
  const ready = !!data && !!decisions;
  const valid =
    ready && !empty && !data.archived && transferDecisionsValid(decisions, data);
  const setRoutine = (next: RoutineDecision) =>
    update((d) => ({ ...d, routines: d.routines.map((x) => (x.id === next.id ? next : x)) }));
  const setPlan = (next: PlanDecision) =>
    update((d) => ({ ...d, plans: d.plans.map((x) => (x.id === next.id ? next : x)) }));
  const summary = ready ? summarizePeriodTransfer(decisions, data) : null;
  return (
    <SetupWizard
      title={`${child.name} · ${t("periodTransfer.title")}`}
      steps={[
        t("periodTransfer.stepRoutines"),
        t("periodTransfer.stepPlans"),
        t("periodTransfer.stepReview"),
      ]}
      step={step}
      setStep={setStep}
      dirty={
        !!decisions &&
        (decisions.routines.some((x) => x.action !== "pause") ||
          decisions.plans.some((x) => x.action !== "archive"))
      }
      busy={save.isPending || preview.isLoading}
      valid={step < 2 ? ready && !empty && !data.archived : valid}
      onClose={onClose}
      saveLabel={t("periodTransfer.confirm")}
      onSave={() => {
        if (saving.current) return;
        saving.current = true;
        save.mutate();
      }}
      error={
        preview.error
          ? t("periodTransfer.previewError")
          : save.error
            ? t(
                locked
                  ? "periodTransfer.locked"
                  : conflict
                    ? "periodTransfer.changed"
                    : "periodTransfer.error",
              )
            : null
      }
    >
      {data && (
        <Text style={u.bold}>
          {t("periodTransfer.fromTo", { from: year(data.from), to: year(data.to) })}
        </Text>
      )}
      {data?.archived && <Text style={u.copy}>{t("periodTransfer.locked")}</Text>}
      {ready && empty && <Text style={u.copy}>{t("periodTransfer.nothing")}</Text>}
      {ready && step === 0 && (
        <>
          <Text style={u.copy}>{t("periodTransfer.routinesIntro")}</Text>
          {!data.routines.length && (
            <Text style={u.copy}>{t("periodTransfer.noRoutines")}</Text>
          )}
          {data.routines.map((routine) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              decision={decisions.routines.find((x) => x.id === routine.id)!}
              preview={data}
              editing={editing === routine.id}
              onEdit={() => setEditing(editing === routine.id ? null : routine.id)}
              onChange={setRoutine}
              date={date}
            />
          ))}
        </>
      )}
      {ready && step === 1 && (
        <>
          <Text style={u.copy}>{t("periodTransfer.plansIntro")}</Text>
          {!data.plans.length && (
            <Text style={u.copy}>{t("periodTransfer.noPlans")}</Text>
          )}
          {data.plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              decision={decisions.plans.find((x) => x.id === plan.id)!}
              preview={data}
              editing={editing === plan.id}
              onEdit={() => setEditing(editing === plan.id ? null : plan.id)}
              onChange={setPlan}
              date={date}
            />
          ))}
        </>
      )}
      {ready && summary && step === 2 && (
        <>
          <View style={{ gap: 6, borderLeftWidth: 3, borderColor: p.line, paddingLeft: 16 }}>
            <Text style={u.small}>{t("periodTransfer.before")}</Text>
            <Text style={u.bold}>{year(data.from)}</Text>
            {data.routines.map((routine) => {
              const d = decisions.routines.find((x) => x.id === routine.id)!;
              return (
                <Text key={routine.id} style={u.copy}>
                  {routine.title} — {t(`periodTransfer.action.${d.action}`)}
                </Text>
              );
            })}
            {data.plans.map((plan) => {
              const d = decisions.plans.find((x) => x.id === plan.id)!;
              return (
                <Text key={plan.id} style={u.copy}>
                  {plan.title} — {t(`periodTransfer.action.${d.action}`)}
                </Text>
              );
            })}
          </View>
          <View style={{ gap: 6, borderLeftWidth: 3, borderColor: p.purple, paddingLeft: 16 }}>
            <Text style={u.small}>{t("periodTransfer.after")}</Text>
            <Text style={u.heading}>{year(data.to)}</Text>
            <Text style={u.copy}>{t("periodTransfer.summaryRoutines", summary.routines)}</Text>
            <Text style={u.copy}>{t("periodTransfer.summaryPlans", summary.plans)}</Text>
            {decisions.routines
              .filter((d) => d.action === "copy")
              .map((d) => {
                const source = data.routines.find((x) => x.id === d.id)!;
                return (
                  <Text key={d.id} style={u.bold}>
                    {source.title} · {d.days_of_week.map((x) => t(`weekday.${x}`)).join(" · ")} ·{" "}
                    {date(d.starts_on)}
                    {d.ends_on ? ` – ${date(d.ends_on)}` : ""}
                  </Text>
                );
              })}
            {decisions.plans
              .filter((d) => d.action === "copy")
              .map((d) => {
                const source = data.plans.find((x) => x.id === d.id)!;
                return (
                  <Text key={d.id} style={u.bold}>
                    {source.title} · {date(d.planned_on)}
                    {d.due_on ? ` → ${date(d.due_on)}` : ""}
                  </Text>
                );
              })}
          </View>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <Text style={u.copy}>
              {t("periodTransfer.summaryEvidence", {
                pending: summary.pendingWork,
                stars: summary.starsEarned,
                checked: summary.checkedSteps,
              })}
            </Text>
            <Text style={u.small}>{t("periodTransfer.summaryLinked")}</Text>
          </View>
        </>
      )}
      {(conflict || !!preview.error) && (
        <SatinButton
          secondary
          title={t("periodTransfer.reload")}
          onPress={() => {
            save.reset();
            setStep(0);
            setEditing(null);
            void preview.refetch();
          }}
        />
      )}
    </SetupWizard>
  );
}

function RoutineRow({
  routine,
  decision,
  preview,
  editing,
  onEdit,
  onChange,
  date,
}: {
  routine: TransferRoutine;
  decision: RoutineDecision;
  preview: PeriodTransferPreview;
  editing: boolean;
  onEdit: () => void;
  onChange: (next: RoutineDecision) => void;
  date: (value: string) => string;
}) {
  const { t } = useTranslation();
  const copy = decision.action === "copy";
  const diff = routineCopyDiff(routine, decision);
  const diffs = [
    diff.days && t("periodTransfer.diffDays"),
    diff.starts_on && t("periodTransfer.diffStart"),
    diff.ends_on && t("periodTransfer.diffEnd"),
  ].filter(Boolean);
  const valid = routineDecisionValid(decision, preview);
  return (
    <View style={{ gap: 10 }}>
      <ChoiceCard
        multiple
        title={routine.title}
        body={`${routine.days_of_week.map((x) => t(`weekday.${x}`)).join(" · ")} · ${t(`routine.time.${routine.time_of_day}`)} · ${t("betaUx.taskStars")}: ${routine.stars}`}
        selected={copy}
        onPress={() => onChange({ ...decision, action: copy ? "pause" : "copy" })}
      />
      <Text style={u.small}>
        {t("periodTransfer.evidence", {
          approved: routine.approved,
          pending: routine.pending,
          returned: routine.returned,
          stars: routine.stars_earned,
        })}
      </Text>
      {copy ? (
        <>
          <Text style={u.small}>
            {diffs.length
              ? t("periodTransfer.diff", { items: diffs.join(", ") })
              : t("periodTransfer.same")}
          </Text>
          <SatinButton
            secondary
            title={t(editing ? "periodTransfer.close" : "periodTransfer.edit")}
            onPress={onEdit}
          />
          {editing && (
            <View style={{ gap: 12 }}>
              <Text style={u.bold}>{t("periodTransfer.days")}</Text>
              <View style={[u.row, { flexWrap: "wrap" }]}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <Tag
                    key={day}
                    label={t(`weekday.${day}`)}
                    selected={decision.days_of_week.includes(day)}
                    onPress={() =>
                      onChange({
                        ...decision,
                        days_of_week: decision.days_of_week.includes(day)
                          ? decision.days_of_week.filter((d) => d !== day)
                          : [...decision.days_of_week, day].sort(),
                      })
                    }
                  />
                ))}
              </View>
              <DateChoice
                label={t("periodTransfer.startsOn")}
                value={decision.starts_on}
                onChange={(value) => onChange({ ...decision, starts_on: value })}
                today={preview.today}
              />
              {decision.ends_on === null ? (
                <SatinButton
                  secondary
                  title={t("periodTransfer.setEnd")}
                  onPress={() => onChange({ ...decision, ends_on: decision.starts_on })}
                />
              ) : (
                <>
                  <DateChoice
                    label={t("periodTransfer.endsOn")}
                    value={decision.ends_on}
                    onChange={(value) => onChange({ ...decision, ends_on: value })}
                    today={preview.today}
                  />
                  <SatinButton
                    secondary
                    title={t("periodTransfer.clearEnd")}
                    onPress={() => onChange({ ...decision, ends_on: null })}
                  />
                </>
              )}
            </View>
          )}
          {!valid && (
            <Text accessibilityRole="alert" style={u.error}>
              {t("periodTransfer.invalidRoutine")}
            </Text>
          )}
          {!editing && (
            <Text style={u.small}>
              {t("periodTransfer.startsOn")}: {date(decision.starts_on)}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={u.small}>{t("periodTransfer.unselectedRoutine")}</Text>
          <Toggle
            label={t("periodTransfer.keepRunning")}
            value={decision.action === "keep"}
            onChange={(value) => onChange({ ...decision, action: value ? "keep" : "pause" })}
          />
        </>
      )}
    </View>
  );
}

function PlanRow({
  plan,
  decision,
  preview,
  editing,
  onEdit,
  onChange,
  date,
}: {
  plan: TransferPlan;
  decision: PlanDecision;
  preview: PeriodTransferPreview;
  editing: boolean;
  onEdit: () => void;
  onChange: (next: PlanDecision) => void;
  date: (value: string) => string;
}) {
  const { t } = useTranslation();
  const copy = decision.action === "copy";
  const valid = planDecisionValid(decision, preview);
  return (
    <View style={{ gap: 10 }}>
      <ChoiceCard
        multiple
        title={plan.title}
        body={`${t(`learningPlan.kinds.${plan.kind}`)}${plan.subject ? ` · ${plan.subject}` : ""} · ${date(plan.planned_on)}${plan.due_on ? ` → ${date(plan.due_on)}` : ""}`}
        selected={copy}
        onPress={() => onChange({ ...decision, action: copy ? "archive" : "copy" })}
      />
      {plan.steps > 0 && (
        <Text style={u.small}>
          {t("periodTransfer.stepsEvidence", { checked: plan.steps_checked, total: plan.steps })}
        </Text>
      )}
      {copy ? (
        <>
          <SatinButton
            secondary
            title={t(editing ? "periodTransfer.close" : "periodTransfer.edit")}
            onPress={onEdit}
          />
          {editing && (
            <View style={{ gap: 12 }}>
              <DateChoice
                label={t("periodTransfer.plannedOn")}
                value={decision.planned_on}
                onChange={(value) => onChange({ ...decision, planned_on: value })}
                today={preview.today}
              />
              {decision.due_on === null ? (
                <SatinButton
                  secondary
                  title={t("periodTransfer.setDue")}
                  onPress={() => onChange({ ...decision, due_on: decision.planned_on })}
                />
              ) : (
                <>
                  <DateChoice
                    label={t("periodTransfer.dueOn")}
                    value={decision.due_on}
                    onChange={(value) => onChange({ ...decision, due_on: value })}
                    today={preview.today}
                  />
                  <SatinButton
                    secondary
                    title={t("periodTransfer.clearDue")}
                    onPress={() => onChange({ ...decision, due_on: null })}
                  />
                </>
              )}
            </View>
          )}
          {!valid && (
            <Text accessibilityRole="alert" style={u.error}>
              {t("periodTransfer.invalidPlan")}
            </Text>
          )}
          {!editing && (
            <Text style={u.small}>
              {t("periodTransfer.plannedOn")}: {date(decision.planned_on)}
              {decision.due_on
                ? ` · ${t("periodTransfer.dueOn")}: ${date(decision.due_on)}`
                : ` · ${t("periodTransfer.noDue")}`}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={u.small}>{t("periodTransfer.unselectedPlan")}</Text>
          <Toggle
            label={t("periodTransfer.keepRunning")}
            value={decision.action === "keep"}
            onChange={(value) => onChange({ ...decision, action: value ? "keep" : "archive" })}
          />
        </>
      )}
    </View>
  );
}
