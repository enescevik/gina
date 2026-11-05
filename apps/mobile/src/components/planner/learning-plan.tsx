import { GuidedField } from "@/components/ui/guided-field";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQueries, useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
} from "lucide-react-native";
import {
  isCalendarDate,
  localDateOf,
  type LearningPlanCommand,
  type LearningPlanContent,
  learningPlanContentSchema,
  learningPlanForDay,
  learningPlanListSchema,
  type LearningPlanRow,
  learningPlanRowSchema,
} from "@gina/core";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { learningPlanJournal } from "@/lib/learning-plan-command";
import { DateChoice, TimeChoice } from "@/components/ui/date-time-choice";
import { Toggle } from "@/components/ui/toggle";
import { Pressable } from "@/components/ui/pressable";
import { ChoiceCard, SetupWizard } from "@/components/setup/wizard";
import { SetupSourceLinks } from "@/components/setup/source-links";
import { SubjectIcon } from "@/components/subject-icon";
import { IconButton, p, SatinButton, u } from "./ui";
import type { PlannerChild } from "./timetable-editor";
import { LearningPlanImport } from "./learning-plan-import";
type Props = {
  child: PlannerChild;
  date: string;
  from: string;
  to: string;
  childMode: boolean;
};
export function useLearningPlan(
  childId: string | undefined,
  from: string,
  to: string,
) {
  const { session, claims } = useSession();
  return useQuery(learningPlanQuery(session?.user.id, claims?.family_id, childId, from, to));
}
function learningPlanQuery(userId: string | undefined, familyId: string | null | undefined, childId: string | undefined, from: string, to: string) {
  return {
    queryKey: [
      "learning_plan",
      userId,
      familyId,
      childId,
      from,
      to,
    ],
    enabled: !!childId && !!familyId,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_learning_plan", {
        p_child_id: childId!,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return learningPlanListSchema.parse(data);
    },
  };
}
/** Share the individual-child cache; the family view must not silently pick child one. */
export function useFamilyLearningPlans(childIds: string[], from: string, to: string) {
  const { session, claims } = useSession();
  return useQueries({ queries: childIds.map(id => learningPlanQuery(session?.user.id, claims?.family_id, id, from, to)) });
}
export function LearningPlanSection(props: Props) {
  const { claims, session } = useSession();
  return (
    <PlanSection
      key={`${session?.user.id}:${claims?.family_id}:${props.child.id}`}
      {...props}
    />
  );
}
function PlanSection({ child, date, from, to, childMode }: Props) {
  const { t, i18n } = useTranslation(), { claims, session } = useSession();
  const journal = useMemo(
    () =>
      learningPlanJournal(
        session?.user.id ?? "",
        claims?.family_id ?? "",
        child.id,
      ),
    [session?.user.id, claims?.family_id, child.id],
  );
  const [recovery] = useState(() => {
    try {
      return { pending: journal.read(), blocked: false };
    } catch {
      return { pending: null, blocked: true };
    }
  });
  const [pending, setPending] = useState<LearningPlanCommand | null>(
    recovery.pending,
  );
  const [editing, setEditing] = useState<LearningPlanRow | null | undefined>(
    undefined,
  );
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useLearningPlan(child.id, from, to);
  async function recover() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    try {
      await journal.send(pending);
      setPending(null);
      await query.refetch();
    } catch {
      try {
        setPending(journal.read());
      } catch {
        setError(t("timetableRecovery.storage"));
      }
      setError(t("learningPlan.saveError"));
    } finally {
      setBusy(false);
    }
  }
  const rows = learningPlanForDay(query.data?.items ?? [], date);
  const visible = history
    ? (query.data?.items ?? []).filter((r) =>
      r.content.done || r.content.archived
    )
    : rows.filter((r) => !r.content.done);
  const dateText = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(day + "T12:00:00Z"));
  return (
    <View
      style={{
        gap: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderColor: p.line,
      }}
    >
      <View
        style={[u.row, { justifyContent: "space-between", flexWrap: "wrap" }]}
      >
        <View style={u.fill}>
          <Text style={u.heading}>{t("learningPlan.title")}</Text>
          <Text style={u.small}>{child.name}</Text>
        </View>
        {!childMode && !pending && !recovery.blocked
          ? (
            <IconButton
              label={t("learningPlan.add")}
              onPress={() => setEditing(null)}
            >
              <Plus color={p.purple} />
            </IconButton>
          )
          : null}
      </View>
      {!childMode && !pending && !recovery.blocked ? <Pressable accessibilityRole="button" onPress={() => setImporting(true)} style={{minHeight:48,justifyContent:"center"}}><Text style={[u.copy,{color:p.purple}]}>{t("planImport.open")}</Text></Pressable> : null}
      {pending || recovery.blocked
        ? (
          <View style={u.card}>
            <Text style={u.copy}>
              {t(
                recovery.blocked
                  ? "timetableRecovery.storage"
                  : "learningPlan.pending",
              )}
            </Text>
            {pending
              ? (
                <SatinButton
                  title={t("setupRecovery.retry")}
                  disabled={busy}
                  onPress={() => void recover()}
                />
              )
              : null}
          </View>
        )
        : null}
      {query.isPending ? <ActivityIndicator color={p.purple} /> : query.error
        ? (
          <>
            <Text style={u.error}>{t("learningPlan.loadError")}</Text>
            <SatinButton
              secondary
              title={t("common.retry")}
              onPress={() => void query.refetch()}
            />
          </>
        )
        : (
          <>
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {[false, true].map((value) => (
                <Pressable
                  key={String(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: history === value }}
                  onPress={() => setHistory(value)}
                  style={{
                    minHeight: 48,
                    paddingHorizontal: 16,
                    justifyContent: "center",
                    borderRadius: 18,
                    backgroundColor: history === value
                      ? p.lilac
                      : "transparent",
                  }}
                >
                  <Text
                    style={[u.bold, {
                      color: history === value ? p.purple : p.muted,
                    }]}
                  >
                    {t(value ? "learningPlan.history" : "learningPlan.open")}
                  </Text>
                </Pressable>
              ))}
            </View>
            {visible.length
              ? visible.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={row.content.title}
                  disabled={!!pending || recovery.blocked}
                  onPress={() => setEditing(row)}
                  style={[u.row, {
                    paddingVertical: 14,
                    gap: 12,
                    borderBottomWidth: 1,
                    borderColor: p.line,
                  }]}
                >
                  <SubjectIcon
                    subject={row.content.subject || row.content.title}
                    size={44}
                    variant="svg"
                    appearance="planner"
                  />
                  <View style={u.fill}>
                    <Text style={u.bold}>{row.content.title}</Text>
                    <Text style={u.small}>
                      {t(`learningPlan.kinds.${row.content.kind}`)}
                      {row.content.subject ? ` · ${row.content.subject}` : ""}
                      {row.content.time ? ` · ${row.content.time}` : ""}
                    </Text>
                    <Text
                      style={[u.small, {
                        color: row.content.due_on &&
                            row.content.due_on < (query.data?.today ?? date) &&
                            !row.content.done
                          ? p.purple
                          : p.muted,
                      }]}
                    >
                      {row.content.archived
                        ? t("learningPlan.archived")
                        : row.content.done
                        ? t("learningPlan.done")
                        : row.content.due_on
                        ? t("learningPlan.dueLabel", {
                          date: dateText(row.content.due_on),
                        })
                        : t("learningPlan.noDue")}
                    </Text>
                    {row.content.steps.length
                      ? (
                        <Text style={u.small}>
                          {t("learningPlan.stepsCount", {
                            done: row.content.steps.filter((s) =>
                              s.checked
                            ).length,
                            total: row.content.steps.length,
                          })}
                        </Text>
                      )
                      : null}
                  </View>
                  {row.content.done
                    ? <CheckCircle2 color="#278B76" />
                    : <ChevronRight color={p.purple} />}
                </Pressable>
              ))
              : (
                <View style={[u.row, { paddingVertical: 18, gap: 12 }]}>
                  <BookOpen size={38} color={p.purple} />
                  <Text style={[u.copy, u.fill]}>
                    {t(
                      history
                        ? "learningPlan.emptyHistory"
                        : childMode
                        ? "learningPlan.childEmpty"
                        : "learningPlan.empty",
                    )}
                  </Text>
                </View>
              )}
          </>
        )}
      {error
        ? <Text accessibilityRole="alert" style={u.error}>{error}</Text>
        : null}
      {importing ? <LearningPlanImport child={child} date={date} onClose={() => setImporting(false)} onSaved={async () => {setImporting(false);await query.refetch();}}/> : null}
      {editing !== undefined
        ? (
          <PlanEditor
            child={child}
            childMode={childMode}
            initial={editing}
            date={date}
            journal={journal}
            onClose={() => setEditing(undefined)}
            onSaved={async () => {
              setEditing(undefined);
              await query.refetch();
            }}
            onPending={(c) => setPending(c)}
          />
        )
        : null}
    </View>
  );
}
function PlanEditor(
  {
    child,
    childMode,
    initial,
    date,
    journal,
    onClose,
    onSaved,
    onPending,
  }: {
    child: PlannerChild;
    childMode: boolean;
    initial: LearningPlanRow | null;
    date: string;
    journal: ReturnType<typeof learningPlanJournal>;
    onClose: () => void;
    onSaved: () => Promise<void>;
    onPending: (c: LearningPlanCommand | null) => void;
  },
) {
  const { t, i18n } = useTranslation(),
    { width } = useWindowDimensions(),
    { session, claims } = useSession();
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const current = useQuery({
    queryKey: [
      "learning_plan_item",
      session?.user.id,
      claims?.family_id,
      child.id,
      initial?.id,
    ],
    enabled: !!initial,
    initialData: initial,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_learning_plan_item", {
        p_child_id: child.id,
        p_id: initial!.id,
      });
      if (error) throw error;
      return data === null ? null : learningPlanRowSchema.parse(data);
    },
  });
  const latest = current.data;
  const [id] = useState(() => initial?.id ?? randomUUID());
  const [source, setSource] = useState(initial), [step, setStep] = useState(0);
  const [content, setContent] = useState<LearningPlanContent>(() =>
    initial?.content ??
      {
        kind: "homework",
        title: "",
        subject: "",
        topic: "",
        planned_on: date,
        due_on: null,
        time: null,
        steps: [],
        done: false,
        archived: false,
        source_id: null,
      }
  );
  const [label, setLabel] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<LearningPlanCommand | null>(null),
    [storageError, setStorageError] = useState(false),
    [chooseSource, setChooseSource] = useState(false);
  const docs = useQuery({
    queryKey: [
      "learning_plan_sources",
      session?.user.id,
      claims?.family_id,
      child.id,
    ],
    enabled: chooseSource && !childMode,
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_sources").select(
        "id,name,mime",
      ).eq("kind", "document").eq("status", "ready").order("created_at", {
        ascending: false,
      }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  const dirty =
    JSON.stringify(content) !== JSON.stringify(source?.content ?? null) ||
    !!label.trim();
  const remoteChanged = !!source && !!latest &&
    latest.revision > source.revision;
  const locked = busy || !!pending || storageError;
  const change = (v: Partial<LearningPlanContent>) => {
    if (!locked) setContent((c) => ({ ...c, ...v }));
  };
  const valid = learningPlanContentSchema.safeParse(content).success &&
    !label.trim() && (!childMode || (!content.archived && dirty));
  const dateText = (day: string) =>
    isCalendarDate(day)
      ? new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(day + "T12:00:00Z"))
      : day;
  async function save() {
    if (
      busy || storageError ||
      (!pending &&
        (!valid || remoteChanged ||
          (!!initial && (!latest || !!current.error))))
    ) return;
    setBusy(true);
    setError("");
    try {
      const c = pending ??
        journal.prepare({
          p_id: id,
          p_revision: source?.revision ?? 0,
          p_content: content,
        });
      setPending(c);
      onPending(c);
      await journal.send(c);
      setPending(null);
      onPending(null);
      await onSaved();
    } catch (e) {
      try {
        const c = journal.read();
        setPending(c);
        onPending(c);
      } catch {
        setStorageError(true);
      }
      const message = (e as Error).message;
      if (message === "plan_changed") void current.refetch();
      setError(
        t(
          message === "plan_changed"
            ? "learningPlan.changed"
            : message === "plan_limit"
            ? "learningPlan.limit"
            : message === "plan_date"
            ? "learningPlan.dateError"
            : "learningPlan.saveError",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const linkedSource = source?.source?.id === content.source_id
    ? source.source
    : docs.data?.find((doc) => doc.id === content.source_id);
  const summary = (
    <View style={{ gap: 14 }}>
      <View style={[u.row, { gap: 12 }]}>
        <SubjectIcon
          subject={content.subject || content.title}
          size={56}
          variant="svg"
          appearance="planner"
        />
        <View style={u.fill}>
          <Text style={u.heading}>{content.title}</Text>
          <Text style={u.copy}>
            {[content.subject, content.topic].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
      <Text style={u.copy}>
        {t("learningPlan.planned")}: {dateText(content.planned_on)}
        {content.time ? ` · ${content.time}` : ""}
      </Text>
      <Text style={u.copy}>
        {content.due_on
          ? t("learningPlan.dueLabel", { date: dateText(content.due_on) })
          : t("learningPlan.noDue")}
      </Text>
      {content.steps.map((s, i) =>
        initial
          ? (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${i + 1}. ${s.label}`}
              accessibilityState={{
                checked: s.checked,
                disabled: locked || content.archived,
              }}
              aria-checked={s.checked}
              disabled={locked || content.archived}
              onPress={() =>
                change({
                  steps: content.steps.map((item) =>
                    item.id === s.id
                      ? { ...item, checked: !item.checked }
                      : item
                  ),
                })}
              style={[u.row, {
                minHeight: 56,
                padding: 12,
                borderRadius: 18,
                backgroundColor: s.checked ? "#E3F5ED" : p.lilac,
              }]}
            >
              {s.checked
                ? <CheckCircle2 size={24} color="#278B76" />
                : <Circle size={24} color={p.muted} />}
              <Text style={[u.copy, u.fill]}>{s.label}</Text>
            </Pressable>
          )
          : (
            <View key={s.id} style={[u.row, { minHeight: 48, gap: 12 }]}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: p.lilac,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={u.bold}>{i + 1}</Text>
              </View>
              <Text style={[u.copy, u.fill]}>{s.label}</Text>
            </View>
          )
      )}
      {initial
        ? (
          <Toggle
            label={t("learningPlan.markDone")}
            value={content.done}
            disabled={locked || content.archived}
            onChange={(done) => change({ done })}
          />
        )
        : null}
      <Text style={u.small}>{t("learningPlan.noReward")}</Text>
      {!childMode && content.source_id
        ? linkedSource
          ? (
            <SetupSourceLinks
              sources={[{
                item_id: id,
                source_id: linkedSource.id,
                ...linkedSource,
              }]}
            />
          )
          : <Text style={u.small}>{t("learningPlan.sourceGone")}</Text>
        : null}
      {!childMode && initial
        ? (
          <Toggle
            label={t("learningPlan.archive")}
            value={content.archived}
            disabled={locked}
            onChange={(archived) => change({ archived })}
          />
        )
        : null}
    </View>
  );
  return (
    <SetupWizard
      title={t(
        childMode
          ? "learningPlan.myPlan"
          : initial
          ? "learningPlan.edit"
          : "learningPlan.add",
      )}
      steps={pending || storageError
        ? [t("setupRecovery.check")]
        : childMode
        ? [t("learningPlan.myPlan")]
        : [t("learningPlan.what"), t("learningPlan.when"), t("betaUx.review")]}
      step={pending || storageError ? 0 : step}
      setStep={setStep}
      dirty={dirty && !pending && !storageError}
      busy={busy}
      valid={!storageError &&
        (!!pending ||
          (!remoteChanged && (!initial || (!!latest && !current.error)) &&
            (childMode || step === 2
              ? valid
              : step === 0
              ? !!content.title.trim()
              : valid)))}
      onSave={() => void save()}
      onClose={onClose}
      saveLabel={t(pending ? "setupRecovery.retry" : "common.save")}
      error={error || null}
    >
      {pending || storageError
        ? (
          <Text style={u.copy}>
            {t(
              storageError
                ? "timetableRecovery.storage"
                : "learningPlan.pending",
            )}
          </Text>
        )
        : (
          <>
            <Text style={u.bold}>{child.name}</Text>
            {initial && (current.error || !latest)
              ? (
                <View style={u.card}>
                  <Text style={u.error}>{t("learningPlan.loadError")}</Text>
                  <SatinButton
                    secondary
                    title={t("common.retry")}
                    onPress={() => void current.refetch()}
                  />
                </View>
              )
              : null}
            {remoteChanged
              ? (
                <View style={u.card}>
                  <Text style={u.copy}>{t("learningPlan.changed")}</Text>
                  <SatinButton
                    secondary
                    title={t("learningPlan.reload")}
                    onPress={() => {
                      if (latest) {
                        setSource(latest);
                        setContent(latest.content);
                        setLabel("");
                        setError("");
                      }
                    }}
                  />
                </View>
              )
              : null}
            {childMode || step === 2 ? summary : step === 0
              ? (
                <>
                  <View
                    style={{
                      flexDirection: width >= 800 ? "row" : "column",
                      gap: 10,
                    }}
                  >
                    {(["homework", "study", "course"] as const).map((kind) => (
                      <View
                        key={kind}
                        style={width >= 800 ? u.fill : undefined}
                      >
                        <ChoiceCard
                          title={t(`learningPlan.kinds.${kind}`)}
                          selected={content.kind === kind}
                          onPress={() => change({ kind, title: content.catalog_id ? "" : content.title, catalog_id: null })}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={u.small}>
                    {t(
                      content.kind === "course"
                        ? "learningPlan.courseHelp"
                        : "learningPlan.planHelp",
                    )}
                  </Text>
                  <GuidedField childId={child.id} kind={content.kind} label={t("learningPlan.name")} value={content.title} maxLength={120} disabled={locked} onChange={(title,id)=>change({ title, catalog_id:id })} />
                  <GuidedField childId={child.id} kind={"subject"} label={t("learningPlan.subject")} value={content.subject} maxLength={80} disabled={locked} onChange={(subject,id)=>change({ subject, subject_id:id })} />
                  <GuidedField childId={child.id} kind="topic" subject={content.subject_id ?? content.subject} label={t("learningPlan.topic")} value={content.topic} maxLength={200} disabled={locked} onChange={(topic)=>change({topic})} />
                  {!childMode
                    ? (
                      <>
                        <SatinButton
                          secondary
                          title={t("learningPlan.attach")}
                          onPress={() => setChooseSource(!chooseSource)}
                        />
                        {chooseSource
                          ? (
                            <>
                              <Text style={u.small}>
                                {t("learningPlan.sourceHelp")}
                              </Text>
                              {docs.isPending
                                ? <ActivityIndicator />
                                : docs.error
                                ? (
                                  <SatinButton
                                    secondary
                                    title={t("common.retry")}
                                    onPress={() => void docs.refetch()}
                                  />
                                )
                                : docs.data?.length
                                ? docs.data.map((doc) => (
                                  <ChoiceCard
                                    key={doc.id}
                                    title={doc.name}
                                    selected={content.source_id === doc.id}
                                    onPress={() =>
                                      change({ source_id: doc.id })}
                                  />
                                ))
                                : (
                                  <Text style={u.copy}>
                                    {t("learningPlan.noSources")}
                                  </Text>
                                )}
                            </>
                          )
                          : null}
                        {content.source_id
                          ? (
                            <SatinButton
                              secondary
                              title={t("learningPlan.detach")}
                              onPress={() => change({ source_id: null })}
                            />
                          )
                          : null}
                      </>
                    )
                    : null}
                </>
              )
              : (
                <>
                  <DateChoice label={t("learningPlan.planned")} value={content.planned_on} onChange={(planned_on) => change({ planned_on })} today={today} disabled={locked} />
                  <Toggle
                    label={t("learningPlan.hasDue")}
                    value={!!content.due_on}
                    onChange={(v) =>
                      change({
                        due_on: v
                          ? (isCalendarDate(content.planned_on)
                            ? content.planned_on
                            : date)
                          : null,
                      })}
                  />
                  {content.due_on !== null
                    ? (
                      <>
                        <DateChoice label={t("learningPlan.due")} hint={t("learningPlan.dueHelp")} value={content.due_on} onChange={(due_on) => change({ due_on })} today={today} disabled={locked} />
                      </>
                    )
                    : null}
                  <Toggle
                    label={t("learningPlan.hasTime")}
                    value={content.time !== null}
                    onChange={(v) => change({ time: v ? "16:00" : null })}
                  />
                  {content.time !== null
                    ? (
                      <TimeChoice label={t("learningPlan.time")} value={content.time} onChange={(time) => change({ time })} disabled={locked} />
                    )
                    : null}
                  <Text style={u.heading}>{t("learningPlan.steps")}</Text>
                  <Text style={u.small}>{t("learningPlan.stepsHelp")}</Text>
                  {content.steps.map((s, i) => (
                    <View key={s.id} style={u.row}>
                      <Text style={[u.copy, u.fill]}>{i + 1}. {s.label}</Text>
                      <IconButton
                        label={t("learningPlan.removeStep", { name: s.label })}
                        onPress={() =>
                          change({
                            steps: content.steps.filter((x) => x.id !== s.id),
                          })}
                      >
                        <Trash2 size={20} color={p.muted} />
                      </IconButton>
                    </View>
                  ))}
                  {content.steps.length < 12
                    ? (
                      <>
                        <GuidedField childId={child.id} kind="step" label={t("learningPlan.stepName")} value={label} maxLength={120} onChange={setLabel} />
                        <SatinButton
                          secondary
                          title={t("learningPlan.addStep")}
                          disabled={!label.trim()}
                          onPress={() => {
                            change({
                              steps: [...content.steps, {
                                id: randomUUID(),
                                label: label.trim(),
                                checked: false,
                              }],
                            });
                            setLabel("");
                          }}
                        />
                      </>
                    )
                    : null}
                  {!valid
                    ? (
                      <Text style={u.small}>
                        {t(
                          label.trim()
                            ? "learningPlan.unsavedStep"
                            : "learningPlan.checkDates",
                        )}
                      </Text>
                    )
                    : null}
                </>
              )}
          </>
        )}
    </SetupWizard>
  );
}
