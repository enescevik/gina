import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, Minus, Plus, Trash2 } from "lucide-react-native";
import {
  type BlueprintCommand,
  type BlueprintInput,
  blueprintInputSchema,
  seedIsPersonalized,
  seedProvenanceInput,
} from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { blueprintJournal } from "@/lib/setup-command";
import { useSchoolTimetable } from "@/lib/school-timetable";
import { ChoiceCard, SetupWizard } from "@/components/setup/wizard";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/avatar";
import { IconButton, p, SatinButton, Tag, u } from "@/components/planner/ui";
import { SavedBlueprintProvenance } from "@/components/learning/blueprint-provenance";
type ScenarioSeed = {
  child_id: string;
  subject: string;
  academic_year: string;
  term: number;
  exam: number;
  rows: { topic: string; count: number }[];
  source_url: string;
  label: string;
  school: "known" | "unknown";
};
function readSeed(raw: string | undefined): ScenarioSeed | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ScenarioSeed;
    return Array.isArray(v.rows) && typeof v.label === "string" ? v : null;
  } catch {
    return null;
  }
}
function schoolYear() {
  const now = new Date();
  const year = now.getFullYear() - (now.getMonth() < 7 ? 1 : 0);
  return `${year}-${year + 1}`;
}
export default function BlueprintScreen() {
  const { t } = useTranslation(),
    { session, claims } = useSession(),
    cache = useQueryClient();
  const family = claims?.family_id ?? "";
  const journal = useMemo(
    () => blueprintJournal(session?.user.id ?? "", family),
    [session?.user.id, family],
  );
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), blocked: false };
    } catch {
      return { pending: null, blocked: true };
    }
  });
  const [pending, setPending] = useState<BlueprintCommand | null>(
      initial.pending,
    ),
    [blocked, setBlocked] = useState(initial.blocked);
  const params = useLocalSearchParams<{ seed?: string }>();
  // Senaryo kataloğundan gelen tam dağılım; değişirse "kişiselleştirilmiş çalışma".
  const [seed] = useState(() => initial.pending ? null : readSeed(params.seed));
  const [step, setStep] = useState(() => seed ? 1 : 0),
    [saved, setSaved] = useState(false),
    // C01 UI: kayıttan sonra köken etiketi sunucudaki satırdan okunur (istemci tahmini değil).
    [savedId, setSavedId] = useState<string | null>(null);
  const [form, setForm] = useState<BlueprintInput>(() =>
    initial.pending?.p_input ??
      (seed
        ? {
          child_id: seed.child_id,
          grade: 0,
          subject: seed.subject,
          name: "",
          academic_year: seed.academic_year,
          term: seed.term,
          exam: seed.exam,
          rows: seed.rows,
          source_url: seed.source_url,
          confirmed: true,
        }
        : null) ??
      {
        child_id: "",
        grade: 0,
        subject: "",
        name: "",
        academic_year: schoolYear(),
        term: 1,
        exam: 1,
        rows: [{ topic: "", count: 1 }],
        source_url: "",
        confirmed: true,
      }
  );
  const [confirmed, setConfirmed] = useState(!!initial.pending),
    [showSource, setShowSource] = useState(
      !!initial.pending?.p_input.source_url,
    );
  const children = useQuery({
    queryKey: ["children", family],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select(
        "id,name,grade,avatar",
      ).is("archived_at", null).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!family,
  });
  const child = children.data?.find((c) => c.id === form.child_id) ??
    (children.data?.length === 1 ? children.data[0] : undefined);
  const grade = child?.grade && child.grade >= 1 ? child.grade : form.grade;
  const timetable = useSchoolTimetable(child?.id ?? "");
  const subjects = [
    ...new Set(timetable.data?.lessons.map((l) => l.title) ?? []),
  ];
  const personalized = !!seed && seedIsPersonalized(seed, form.rows);
  const seedTotal = seed?.rows.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const seedTag = seed
    ? t(
      personalized
        ? "provaP02.catalog.personalizedTag"
        : seed.school === "known"
        ? "provaP02.catalog.schoolTag"
        : "provaP02.catalog.studyTag",
    )
    : "";
  const seededName = seed
    ? `${seed.label} · ${seedTag}`.slice(0, 100)
    : "";
  // C01: okul beyanı ve kişiselleştirme sunucuya ayrı alan olarak gider; hiçbiri okul onayı değildir.
  const input = {
    ...form,
    ...(seed ? seedProvenanceInput(seed, form.rows) : {}),
    name: form.name.trim() || seededName,
    grade,
    child_id: child?.id ?? form.child_id,
  };
  const total = form.rows.reduce((sum, r) => sum + r.count, 0);
  const valid = step === 0
    ? !!child && grade >= 1 && grade <= 12 && !!form.subject.trim()
    : blueprintInputSchema.safeParse(input).success && (step < 2 || confirmed);
  const patch = (value: Partial<BlueprintInput>) => {
    setForm((f) => ({ ...f, ...value }));
    setConfirmed(false);
  };
  const row = (index: number, value: Partial<BlueprintInput["rows"][number]>) =>
    patch({
      rows: form.rows.map((r, i) => i === index ? { ...r, ...value } : r),
    });
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/parent/prova");
  const save = useMutation({
    mutationFn: async () => {
      if (blocked) throw Error("blueprint_local_unavailable");
      const existing = journal.read();
      if (!existing && !confirmed) throw Error("blueprint_invalid");
      const command = existing ??
        journal.prepare(blueprintInputSchema.parse(input));
      setPending(command);
      try {
        return await journal.send(command);
      } finally {
        try {
          setPending(journal.read());
        } catch {
          setBlocked(true);
        }
      }
    },
    onSuccess: async (id) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["blueprints", family] }),
        cache.invalidateQueries({ queryKey: ["builder_blueprints", family] }),
      ]);
      setSavedId(id);
      setSaved(true);
    },
  });
  const message = save.error
    ? t(
      `blueprintFlow.errors.${
        [
            "blueprint_invalid",
            "blueprint_grade_mismatch",
            "forbidden",
            "request_conflict",
          ].includes((save.error as Error).message)
          ? (save.error as Error).message
          : "unknown"
      }`,
    )
    : null;
  return (
    <SetupWizard
      title={t("prova.newBlueprint")}
      steps={saved
        ? [t("blueprintFlow.saved")]
        : pending || blocked
        ? [t("setupRecovery.check")]
        : [
          t("blueprintFlow.scope"),
          t("blueprintFlow.distribution"),
          t("betaUx.review"),
        ]}
      step={saved || pending || blocked ? 0 : step}
      setStep={setStep}
      dirty={!saved && !pending &&
        !!(form.name || form.subject || form.rows.some((r) => r.topic))}
      busy={save.isPending}
      valid={saved ||
        (!blocked &&
          (!!pending || (!children.error && !children.isPending && valid)))}
      onClose={close}
      onSave={() => saved ? close() : save.mutate()}
      saveLabel={saved
        ? t("blueprintFlow.back")
        : pending
        ? t("setupRecovery.retry")
        : t("common.save")}
      error={message}
    >
      {saved
        ? (
          <View style={[u.card, { backgroundColor: p.mint }]}>
            <Check color={p.purple} />
            <Text style={u.heading}>{t("blueprintFlow.saved")}</Text>
            <Text style={u.copy}>{t("blueprintFlow.savedHelp")}</Text>
            <SavedBlueprintProvenance id={savedId} />
          </View>
        )
        : blocked
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t("setupRecovery.blockedBody")}
          </Text>
        )
        : pending
        ? (
          <View style={u.card}>
            <Text style={u.heading}>{t("setupRecovery.title")}</Text>
            <Text style={u.copy}>
              {pending.p_input.name} · {pending.p_input.subject} ·{" "}
              {t("parent.gradeShort", { grade: pending.p_input.grade })}
            </Text>
            <Text style={u.copy}>{t("blueprintFlow.pending")}</Text>
          </View>
        )
        : (
          <>
            {children.error
              ? (
                <View>
                  <Text accessibilityRole="alert" style={u.error}>
                    {t("release.genericError")}
                  </Text>
                  <SatinButton
                    secondary
                    title={t("common.retry")}
                    onPress={() => void children.refetch()}
                  />
                </View>
              )
              : null}
            {step === 0
              ? (
                <>
                  <Text style={u.copy}>{t("blueprintFlow.intro")}</Text>
                  <SatinButton secondary title={t("catalogFlow.open")} onPress={()=>router.push("/parent/prova/catalog")}/>

                  {children.data?.map((c) => (
                    <ChoiceCard
                      key={c.id}
                      title={c.name}
                      body={c.grade
                        ? t("parent.gradeShort", { grade: c.grade })
                        : t("provaBuilder.gradeMissing")}
                      art={<Avatar slug={c.avatar} size={48} />}
                      selected={child?.id === c.id}
                      onPress={() =>
                        patch({
                          child_id: c.id,
                          grade: c.grade && c.grade >= 1 ? c.grade : 0,
                          subject: "",
                        })}
                    />
                  ))}
                  {children.data?.length === 0
                    ? (
                      <SatinButton
                        title={t("unified.createFirstChild")}
                        onPress={() => router.push("/parent/menu")}
                      />
                    )
                    : null}
                  {child && (!child.grade || child.grade < 1)
                    ? (
                      <View style={[u.row, { flexWrap: "wrap" }]}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (g) => (
                            <Tag
                              key={g}
                              label={t("parent.gradeShort", { grade: g })}
                              selected={grade === g}
                              onPress={() => patch({ grade: g })}
                            />
                          ),
                        )}
                      </View>
                    )
                    : null}
                  {subjects.length > 0
                    ? (
                      <>
                        <Text style={u.bold}>
                          {t("blueprintFlow.fromTimetable")}
                        </Text>
                        <View style={[u.row, { flexWrap: "wrap" }]}>
                          {subjects.map((s) => (
                            <Tag
                              key={s}
                              label={s}
                              selected={form.subject === s}
                              onPress={() => patch({ subject: s })}
                            />
                          ))}
                        </View>
                      </>
                    )
                    : null}
                  <Field
                    label={t("grades.subject")}
                    value={form.subject}
                    maxLength={80}
                    onChangeText={(subject) => patch({ subject })}
                    hint={t("blueprintFlow.subjectHelp")}
                  />
                </>
              )
              : step === 1
              ? (
                <>
                  <Text style={u.copy}>{t("blueprintFlow.rowHelp")}</Text>
                  {seed
                    ? (
                      <View
                        accessibilityLiveRegion="polite"
                        style={[u.card, { backgroundColor: p.lilac }]}
                      >
                        <Text style={u.bold}>{seedTag}</Text>
                        <Text style={u.copy}>
                          {t(
                            personalized
                              ? "provaP02.catalog.personalizedBody"
                              : "provaP02.catalog.seedBody",
                            {
                              label: seed.label,
                              from: seedTotal,
                              to: total,
                              blocks: seed.rows.length,
                            },
                          )}
                        </Text>
                      </View>
                    )
                    : null}
                  <Field
                    label={t("prova.blueprintName")}
                    value={form.name}
                    maxLength={100}
                    onChangeText={(name) => patch({ name })}
                  />
                  <Field
                    label={t("blueprintFlow.year")}
                    value={form.academic_year}
                    maxLength={9}
                    autoCapitalize="none"
                    onChangeText={(academic_year) => patch({ academic_year })}
                  />
                  <Text style={u.bold}>{t("blueprintFlow.term")}</Text>
                  <View style={u.row}>
                    {[1, 2].map((term) => (
                      <Tag
                        key={term}
                        label={t("blueprintFlow.termNumber", { count: term })}
                        selected={form.term === term}
                        onPress={() => patch({ term })}
                      />
                    ))}
                  </View>
                  <Text style={u.bold}>{t("blueprintFlow.exam")}</Text>
                  <View style={u.row}>
                    {[1, 2].map((exam) => (
                      <Tag
                        key={exam}
                        label={t("blueprintFlow.examNumber", { count: exam })}
                        selected={form.exam === exam}
                        onPress={() => patch({ exam })}
                      />
                    ))}
                  </View>
                  {form.rows.map((r, i) => (
                    <View key={i} style={[u.card, { gap: 12 }]}>
                      <Field
                        label={t("blueprintFlow.topic", { count: i + 1 })}
                        value={r.topic}
                        maxLength={200}
                        onChangeText={(topic) =>
                          row(i, { topic })}
                      />
                      <View
                        style={[u.row, { justifyContent: "space-between" }]}
                      >
                        <Text style={[u.bold, { flex: 1 }]}>
                          {t("blueprintFlow.count")}
                        </Text>
                        <IconButton
                          label={t("blueprintFlow.less", { count: i + 1 })}
                          disabled={r.count <= 1}
                          onPress={() =>
                            row(i, { count: r.count - 1 })}
                        >
                          <Minus color={p.purple} />
                        </IconButton>
                        <Text style={u.heading}>{r.count}</Text>
                        <IconButton
                          label={t("blueprintFlow.more", { count: i + 1 })}
                          disabled={total >= 30}
                          onPress={() => row(i, { count: r.count + 1 })}
                        >
                          <Plus color={p.purple} />
                        </IconButton>
                        <IconButton
                          label={t("blueprintFlow.remove", { count: i + 1 })}
                          disabled={form.rows.length === 1}
                          onPress={() =>
                            patch({
                              rows: form.rows.filter((_, j) => i !== j),
                            })}
                        >
                          <Trash2 color={p.muted} />
                        </IconButton>
                      </View>
                    </View>
                  ))}
                  <SatinButton
                    secondary
                    title={t("blueprintFlow.addRow")}
                    disabled={total >= 30}
                    icon={<Plus color={p.purple} />}
                    onPress={() =>
                      patch({ rows: [...form.rows, { topic: "", count: 1 }] })}
                  />
                  <Text style={u.bold}>
                    {t("blueprintFlow.total", { count: total })}
                  </Text>
                  <Toggle
                    label={t("blueprintFlow.addSource")}
                    value={showSource}
                    onChange={(v) => {
                      setShowSource(v);
                      if (!v) patch({ source_url: "" });
                    }}
                  />
                  {showSource
                    ? (
                      <Field
                        label={t("prova.source")}
                        value={form.source_url}
                        maxLength={2000}
                        autoCapitalize="none"
                        keyboardType="url"
                        onChangeText={(source_url) => patch({ source_url })}
                        hint={t("blueprintFlow.sourceHelp")}
                      />
                    )
                    : null}
                  {!valid
                    ? (
                      <Text style={u.small}>
                        {t("blueprintFlow.validHelp")}
                      </Text>
                    )
                    : null}
                </>
              )
              : (
                <>
                  <View style={[u.card, { backgroundColor: p.mint }]}>
                    <Text style={u.heading}>{input.name}</Text>
                    {seed ? <Text style={u.bold}>{seedTag}</Text> : null}
                    <Text style={u.copy}>
                      {child?.name} · {form.subject} ·{" "}
                      {t("parent.gradeShort", { grade })}
                    </Text>
                    <Text style={u.small}>
                      {form.academic_year} ·{" "}
                      {t("blueprintFlow.termNumber", { count: form.term })} ·
                      {" "}
                      {t("blueprintFlow.examNumber", { count: form.exam })}
                    </Text>
                  </View>
                  {form.rows.map((r, i) => (
                    <View key={i} style={[u.row, { alignItems: "flex-start" }]}>
                      <Text style={[u.copy, { flex: 1 }]}>{r.topic}</Text>
                      <Text style={u.bold}>
                        {t("blueprintFlow.total", { count: r.count })}
                      </Text>
                    </View>
                  ))}
                  <Text style={u.heading}>
                    {t("blueprintFlow.total", { count: total })}
                  </Text>
                  <Text style={u.copy}>{t("blueprintFlow.manualNotice")}</Text>
                  <Toggle
                    label={t(
                      seed && (personalized || seed.school !== "known")
                        ? "provaP02.catalog.studyConfirm"
                        : "blueprintFlow.confirm",
                    )}
                    value={confirmed}
                    onChange={setConfirmed}
                  />
                </>
              )}
          </>
        )}
    </SetupWizard>
  );
}
