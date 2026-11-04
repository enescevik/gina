import { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { BookOpen, CheckCircle2, Circle, FileText } from "lucide-react-native";
import {
  type LearningPlanContent,
  learningPlanContentSchema,
  type LearningPlanImportCommand,
  type LearningPlanImportView,
  learningPlanImportViewSchema,
} from "@gina/core";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { learningPlanImportJournal } from "@/lib/learning-plan-command";
import {
  chooseLearningDocument,
  type LocalLearningFile,
  uploadLearningFile,
} from "@/lib/learning-files";
import { invokeProvaAi, ProvaAiError } from "@/lib/prova-ai";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Pressable } from "@/components/ui/pressable";
import { ChoiceCard, SetupWizard } from "@/components/setup/wizard";
import { SetupSourceLinks } from "@/components/setup/source-links";
import { SubjectIcon } from "@/components/subject-icon";
import { p, SatinButton, u } from "./ui";
import type { PlannerChild } from "./timetable-editor";
type Row = { index: number; id: string; content: LearningPlanContent };
export function LearningPlanImport(
  { child, date, onClose, onSaved }: {
    child: PlannerChild;
    date: string;
    onClose: () => void;
    onSaved: () => Promise<void>;
  },
) {
  const { t, i18n } = useTranslation(), { session, claims } = useSession();
  const errorText = (e: unknown) => {
    if (e instanceof ProvaAiError) return e.message;
    const code = e && typeof e === "object" && "message" in e
      ? String(e.message)
      : "";
    const key = "prova.ai.errors." + code;
    return i18n.exists(key) ? t(key) : t("planImport.failed");
  };
  const locale = i18n.language.startsWith("en") ? "en" : "tr";
  const journal = useMemo(
    () =>
      learningPlanImportJournal(
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
  const [pending, setPending] = useState<LearningPlanImportCommand | null>(
    recovery.pending,
  );
  const [step, setStep] = useState(pending ? 3 : 0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [source, setSource] = useState<
      { id: string; name: string; mime: string } | null
    >(null),
    [file, setFile] = useState<LocalLearningFile | null>(null);
  const [storageConsent, setStorageConsent] = useState(false),
    [aiConsent, setAiConsent] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<LearningPlanImportView | null>(null),
    [rows, setRows] = useState<Row[]>(recovery.pending?.p_items ?? []),
    [selected, setSelected] = useState<number[]>(
      recovery.pending?.p_items.map((r) => r.index) ?? [],
    ),
    [active, setActive] = useState(recovery.pending?.p_items[0]?.index ?? 0);
  const docs = useQuery({
    queryKey: [
      "learning_plan_sources",
      session?.user.id,
      claims?.family_id,
      child.id,
    ],
    queryFn: async () => {
      const r = await supabase.from("learning_sources").select("id,name,mime")
        .eq("kind", "document").eq("status", "ready").order("created_at", {
          ascending: false,
        }).limit(30);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const locked = busy || !!pending || recovery.blocked;
  const normalize = (r: Row): Row => ({
    ...r,
    content: {
      ...r.content,
      title: r.content.title.trim(),
      subject: r.content.subject.trim(),
      topic: r.content.topic.trim(),
      steps: r.content.steps.map((s) => ({ ...s, label: s.label.trim() }))
        .filter((s) => s.label),
    },
  });
  const chosen = pending?.p_items ??
    rows.filter((r) => selected.includes(r.index)).map(normalize);
  function accept(value: unknown) {
    const v = learningPlanImportViewSchema.parse(value);
    if (v.child_id !== child.id || v.locale !== locale) {
      throw Error("plan_scope_changed");
    }
    setResult(v);
    if (v.draft) {
      setRows(v.draft.items.map((item, index) => ({
        index,
        id: randomUUID(),
        content: {
          kind: item.kind,
          title: item.title,
          subject: item.subject,
          topic: item.topic,
          planned_on: date,
          due_on: item.due_on,
          time: item.time,
          steps: item.steps.map((label) => ({
            id: randomUUID(),
            label,
            checked: false,
          })),
          done: false,
          archived: false,
          source_id: v.source_id,
        },
      })));
      setSelected([]);
      setStep(1);
      setConfirmed(false);
    }
  }
  async function inspect(doc: { id: string; name: string; mime: string }) {
    if (locked) return;
    setBusy(true);
    setError("");
    setSource(doc);
    setFile(null);
    setResult(null);
    setAiConsent(false);
    try {
      const r = await supabase.rpc("get_learning_plan_import", {
        p_child_id: child.id,
        p_source_id: doc.id,
        p_locale: locale,
      });
      if (r.error) throw r.error;
      if (r.data) accept(r.data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function choose() {
    if (locked) return;
    setBusy(true);
    setError("");
    try {
      const f = await chooseLearningDocument();
      if (f) {
        setFile(f);
        setSource(null);
        setResult(null);
        setStorageConsent(false);
        setAiConsent(false);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (locked || !aiConsent || (!source && (!file || !storageConsent))) return;
    setBusy(true);
    setError("");
    try {
      let id = source?.id;
      if (!id && file) {
        await uploadLearningFile(file, "document");
        id = file.id;
        setSource({ id, name: file.name, mime: file.mime });
        await docs.refetch();
      }
      if (!id) throw Error("source_not_ready");
      const value = await invokeProvaAi("learning-plan-import", {
        child_id: child.id,
        source_id: id,
        locale,
        ai_consent: true,
      });
      accept(value);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (busy || recovery.blocked) return;
    setBusy(true);
    setError("");
    try {
      const c = pending ??
        journal.prepare({
          p_import_id: result?.id ?? recovery.pending!.p_import_id,
          p_items: chosen,
        });
      setPending(c);
      await journal.send(c);
      setPending(null);
      await onSaved();
    } catch (e) {
      try {
        setPending(journal.read());
      } catch {
        setError(t("timetableRecovery.storage"));
      }
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function change(patch: Partial<LearningPlanContent>) {
    if (locked) return;
    setConfirmed(false);
    setRows((old) =>
      old.map((r) =>
        r.index === active ? { ...r, content: { ...r.content, ...patch } } : r
      )
    );
  }
  function move(next: number) {
    if (locked) return;
    if (next === 2 && !selected.includes(active)) setActive(selected[0]);
    setStep(next);
  }
  const editing = rows.find((r) => r.index === active);
  const valid = step === 1
    ? selected.length > 0
    : step === 2
    ? chosen.length > 0 && chosen.every((r) =>
      learningPlanContentSchema.safeParse(r.content).success
    )
    : step === 3
    ? !!pending ||
      confirmed && chosen.length > 0 &&
        chosen.every((r) =>
          learningPlanContentSchema.safeParse(r.content).success
        )
    : false;
  const dayText = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(day + "T12:00:00Z"));
  const summary = (r: Row) => (
    <View key={r.id} style={[u.card, { gap: 8 }]}>
      <View style={u.row}>
        <SubjectIcon subject={r.content.subject} size={32} />
        <Text style={[u.heading, u.fill]}>{r.content.title}</Text>
      </View>
      <Text style={u.small}>
        {r.content.subject}
        {r.content.topic ? ` · ${r.content.topic}` : ""}
      </Text>
      <Text style={u.copy}>
        {t("learningPlan.planned")}: {dayText(r.content.planned_on)}
      </Text>
      <Text style={u.copy}>
        {t("learningPlan.due")}:{" "}
        {r.content.due_on ? dayText(r.content.due_on) : t("planImport.noDue")}
        {r.content.time ? ` · ${r.content.time}` : ""}
      </Text>
      {r.content.steps.map((s, i) => (
        <Text key={s.id} style={u.copy}>{i + 1}. {s.label}</Text>
      ))}
    </View>
  );
  return (
    <SetupWizard
      title={t("planImport.title", { name: child.name })}
      steps={[
        t("planImport.document"),
        t("planImport.select"),
        t("planImport.edit"),
        t("planImport.review"),
      ]}
      step={step}
      setStep={move}
      dirty={rows.length > 0 || !!file || !!pending}
      busy={busy}
      valid={valid && !recovery.blocked}
      hideContinue={step === 0}
      error={error || null}
      onClose={onClose}
      onSave={() => void save()}
      saveLabel={t(pending ? "common.retry" : "planImport.save", {
        count: chosen.length,
      })}
    >
      {recovery.blocked
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t("timetableRecovery.storage")}
          </Text>
        )
        : null}
      {pending
        ? (
          <View style={u.card}>
            <Text style={u.copy}>{t("planImport.pending")}</Text>
          </View>
        )
        : null}
      {step === 0
        ? (
          <>
            <View style={[u.card, { backgroundColor: p.lilac, gap: 10 }]}>
              <FileText color={p.purple} size={28} />
              <Text style={u.heading}>{t("planImport.intro")}</Text>
              <Text style={u.copy}>{t("planImport.boundary")}</Text>
            </View>
            <SatinButton
              secondary
              title={t("planImport.pick")}
              disabled={locked}
              onPress={() => void choose()}
            />
            {file
              ? (
                <>
                  <Text style={u.copy}>{file.name}</Text>
                  <Toggle
                    label={t("planImport.storeConsent")}
                    value={storageConsent}
                    onChange={(v) => {
                      if (!locked) setStorageConsent(v);
                    }}
                  />
                </>
              )
              : null}
            <Text style={u.heading}>{t("planImport.saved")}</Text>
            {docs.isPending
              ? <ActivityIndicator color={p.purple} />
              : docs.error
              ? (
                <SatinButton
                  secondary
                  title={t("common.retry")}
                  onPress={() => void docs.refetch()}
                />
              )
              : !docs.data?.length
              ? <Text style={u.small}>{t("planImport.noDocuments")}</Text>
              : null}
            {docs.data?.map((d) => (
              <ChoiceCard
                key={d.id}
                title={d.name}
                body={d.mime === "application/pdf"
                  ? "PDF"
                  : t("planImport.image")}
                selected={source?.id === d.id}
                onPress={() => {
                  if (!locked) void inspect(d);
                }}
                art={<FileText color={p.purple} />}
              />
            ))}
            {source || file
              ? (
                <>
                  <Text style={u.copy}>{t("planImport.cost")}</Text>
                  {result && result.status !== "new"
                    ? (
                      <Text style={u.small}>
                        {t(`planImport.status.${result.status}`)}
                      </Text>
                    )
                    : null}
                  <Toggle
                    label={t("planImport.aiConsent")}
                    value={aiConsent}
                    onChange={(v) => {
                      if (!locked) setAiConsent(v);
                    }}
                  />
                  <SatinButton
                    title={t("planImport.extract")}
                    disabled={locked || !aiConsent ||
                      !!file && !source && !storageConsent}
                    busy={busy}
                    onPress={() => void generate()}
                  />
                </>
              )
              : null}
          </>
        )
        : null}
      {step === 1
        ? (
          <>
            <Text style={u.heading}>{t("planImport.chooseHint")}</Text>
            <Text style={u.copy}>{t("planImport.multiHint")}</Text>
            {result?.draft?.warnings.map((w, i) => (
              <Text key={i} style={u.copy}>{w}</Text>
            ))}
            {source
              ? (
                <SetupSourceLinks
                  sources={[{
                    item_id: source.id,
                    source_id: source.id,
                    name: source.name,
                    mime: source.mime,
                  }]}
                />
              )
              : null}
            {!rows.length
              ? (
                <View style={u.card}>
                  <BookOpen color={p.purple} />
                  <Text style={u.copy}>{t("planImport.empty")}</Text>
                </View>
              )
              : null}
            {rows.map((r) => {
              const applied = !!result?.applied[String(r.index)],
                picked = selected.includes(r.index),
                original = result?.draft?.items[r.index];
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: picked || applied,
                    disabled: locked || applied,
                  }}
                  disabled={locked || applied}
                  onPress={() => {
                    setSelected((s) =>
                      s.includes(r.index)
                        ? s.filter((i) => i !== r.index)
                        : [...s, r.index]
                    );
                    setConfirmed(false);
                  }}
                  style={[u.card, {
                    gap: 8,
                    borderColor: picked ? p.purple : p.line,
                    backgroundColor: applied
                      ? "#F0EEE9"
                      : picked
                      ? p.lilac
                      : "#FFFFFF",
                  }]}
                >
                  <View style={u.row}>
                    {picked || applied
                      ? <CheckCircle2 color={p.purple} />
                      : <Circle color={p.muted} />}
                    <Text style={[u.heading, u.fill]}>{r.content.title}</Text>
                  </View>
                  <Text style={u.copy}>
                    {r.content.subject}
                    {r.content.topic ? ` · ${r.content.topic}` : ""}
                  </Text>
                  <Text style={u.small}>
                    {t("planImport.page", { n: original?.page })} · {applied
                      ? t("planImport.added")
                      : r.content.due_on ?? t("planImport.checkDate")}
                  </Text>
                  {original?.note
                    ? <Text style={u.copy}>{original.note}</Text>
                    : null}
                </Pressable>
              );
            })}
          </>
        )
        : null}
      {step === 2 && editing
        ? (
          <>
            <Text style={u.copy}>{t("planImport.editHint")}</Text>
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {chosen.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active === r.index }}
                  onPress={() => setActive(r.index)}
                  style={{
                    minHeight: 48,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: r.index === active ? p.lilac : "#FFFFFF",
                    maxWidth: "100%",
                  }}
                >
                  <Text style={u.copy}>{r.index + 1}. {r.content.title}</Text>
                </Pressable>
              ))}
            </View>
            <View style={u.row}>
              {(["homework", "study", "course"] as const).map((kind) => (
                <Pressable
                  key={kind}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: editing.content.kind === kind,
                  }}
                  onPress={() => change({ kind })}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    padding: 10,
                    borderRadius: 16,
                    backgroundColor: editing.content.kind === kind
                      ? p.lilac
                      : "#FFFFFF",
                  }}
                >
                  <Text style={u.copy}>{t(`learningPlan.kinds.${kind}`)}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              label={t("learningPlan.name")}
              value={editing.content.title}
              maxLength={120}
              onChangeText={(v) => change({ title: v.trimStart() })}
            />
            <Field
              label={t("learningPlan.subject")}
              value={editing.content.subject}
              maxLength={80}
              onChangeText={(v) => change({ subject: v.trimStart() })}
            />
            <Field
              label={t("learningPlan.topic")}
              value={editing.content.topic}
              maxLength={200}
              onChangeText={(v) => change({ topic: v.trimStart() })}
            />
            <Field
              label={t("learningPlan.planned")}
              value={editing.content.planned_on}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              onChangeText={(planned_on) => change({ planned_on })}
            />
            <Field
              label={t("learningPlan.due")}
              value={editing.content.due_on ?? ""}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              onChangeText={(v) => change({ due_on: v || null })}
            />
            <Field
              label={t("learningPlan.time")}
              value={editing.content.time ?? ""}
              placeholder="HH:mm"
              maxLength={5}
              onChangeText={(v) => change({ time: v || null })}
            />
            <Field
              label={t("planImport.steps")}
              value={editing.content.steps.map((s) => s.label).join("\n")}
              multiline
              onChangeText={(v) =>
                change({
                  steps: v.split("\n").map((label, i) => ({
                    id: editing.content.steps[i]?.id ?? randomUUID(),
                    label,
                    checked: false,
                  })),
                })}
            />
            <Text style={u.small}>{t("planImport.datesHint")}</Text>
            {!learningPlanContentSchema.safeParse(normalize(editing).content)
                .success
              ? <Text style={u.error}>{t("planImport.invalid")}</Text>
              : null}
          </>
        )
        : null}
      {step === 3
        ? (
          <>
            <Text style={u.heading}>
              {t("planImport.summary", { count: chosen.length })}
            </Text>
            {chosen.map(summary)}
            {!pending
              ? (
                <Toggle
                  label={t("planImport.confirm")}
                  value={confirmed}
                  onChange={(v) => {
                    if (!locked) setConfirmed(v);
                  }}
                />
              )
              : null}
            <Text style={u.small}>{t("planImport.boundary")}</Text>
          </>
        )
        : null}
    </SetupWizard>
  );
}
