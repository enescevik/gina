import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Linking, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BookOpen, Check } from "lucide-react-native";
import {
  canonicalSubject,
  type CatalogBlueprintCommand,
  type CatalogScenario,
  catalogScenarioSchema,
  curriculumSourceFreshnessSchema,
} from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { catalogBlueprintJournal } from "@/lib/setup-command";
import { useSchoolTimetable } from "@/lib/school-timetable";
import { ChoiceCard, SetupWizard } from "@/components/setup/wizard";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/avatar";
import { p, SatinButton, Tag, u } from "@/components/planner/ui";

const year = () => {
  const d = new Date(), y = d.getFullYear() - (d.getMonth() < 7 ? 1 : 0);
  return `${y}-${y + 1}`;
};
export default function CatalogScreen() {
  const { t } = useTranslation(),
    { session, claims } = useSession(),
    cache = useQueryClient();
  const family = claims?.family_id ?? "";
  const journal = useMemo(
    () => catalogBlueprintJournal(session?.user.id ?? "", family),
    [session?.user.id, family],
  );
  const [initial] = useState(() => {
    try {
      return { pending: journal.read(), blocked: false };
    } catch {
      return { pending: null, blocked: true };
    }
  });
  const [pending, setPending] = useState<CatalogBlueprintCommand | null>(
      initial.pending,
    ),
    [blocked, setBlocked] = useState(initial.blocked);
  const [step, setStep] = useState(0),
    [saved, setSaved] = useState(false),
    [childId, setChildId] = useState(""),
    [subject, setSubject] = useState(""),
    [academicYear, setAcademicYear] = useState(year),
    [term, setTerm] = useState(1),
    [exam, setExam] = useState(1),
    [selection, setSelection] = useState<CatalogScenario | null>(null),
    [confirmed, setConfirmed] = useState(false),
    // M01 protokolü: "Okulun senaryosunu biliyorum" / "Henüz bilmiyorum". İkincisinde seçim
    // çalışma senaryosudur; okul doğrulaması yapılmış gibi kaydedilmez.
    [schoolKnown, setSchoolKnown] = useState<"known" | "unknown" | null>(null);
  const children = useQuery({
    queryKey: ["children", family],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select(
        "id,name,grade,avatar",
      ).is("archived_at", null).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const child = children.data?.find((c) => c.id === childId) ??
    (children.data?.length === 1 ? children.data[0] : undefined);
  const timetable = useSchoolTimetable(child?.id ?? "");
  const subjects = [
    ...new Set([
      ...(timetable.data?.lessons.map((l) => canonicalSubject(l.title)) ?? []),
      ...(child?.grade && child.grade >= 9
        ? [
          "Matematik",
          "Türk Dili ve Edebiyatı",
          "Fizik",
          "Kimya",
          "Biyoloji",
          "Tarih",
          "Coğrafya",
          "İngilizce",
        ]
        : [
          "Matematik",
          "Türkçe",
          "Fen Bilimleri",
          "Sosyal Bilgiler",
          "Din Kültürü ve Ahlak Bilgisi",
          "İngilizce",
        ]),
    ]),
  ];
  const scopeValid = !!child && !!child.grade && child.grade >= 5 &&
    child.grade <= 12 && !!subject.trim() &&
    /^20\d{2}-20\d{2}$/.test(academicYear) &&
    Number(academicYear.slice(5)) === Number(academicYear.slice(0, 4)) + 1;
  const scenarios = useQuery({
    queryKey: [
      "curriculum_scenarios",
      family,
      child?.id,
      academicYear,
      term,
      exam,
      subject,
    ],
    enabled: scopeValid && step > 0 && !pending && !saved,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_curriculum_scenarios", {
        p_child_id: child!.id,
        p_year: academicYear,
        p_term: term,
        p_exam: exam,
        p_subject: subject.trim(),
      });
      if (error) throw error;
      return catalogScenarioSchema.array().parse(data);
    },
  });
  // Source freshness is informational: never a file, never a scenario choice, never official endorsement.
  const freshness = useQuery({
    queryKey: ["curriculum_source_freshness", family, academicYear, term, subject],
    enabled: scopeValid && step > 0 && !pending && !saved,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_curriculum_source_freshness",
        { p_year: academicYear, p_term: term, p_subject: subject.trim() },
      );
      if (error) throw error;
      return curriculumSourceFreshnessSchema.parse(data);
    },
  });
  const selected = scenarios.data?.find((s) =>
    s.id === selection?.id && s.revision === selection.revision &&
    s.content_hash === selection.content_hash
  );
  const changed = !!selection && !!scenarios.data && !selected;
  function reset() {
    setSelection(null);
    setConfirmed(false);
  }
  // Tam senaryo dağılımını elle düzenlenebilir dağılım ekranına taşır. Orada blok/adet
  // değişirse "kişiselleştirilmiş çalışma" etiketi gösterilir; resmî uygunluk iddiası yok.
  function openAsStudy(scenario: CatalogScenario) {
    const rows = scenario.candidate.blocks.map((b, i) => ({
      topic: `${i + 1}. ${b.outcomes[0]?.code ? `${b.outcomes[0].code} ` : ""}${
        b.outcomes[0]?.text ?? ""
      }`.slice(0, 200).trim(),
      count: b.count,
    }));
    router.push({
      pathname: "/parent/prova/blueprint",
      params: {
        seed: JSON.stringify({
          child_id: child?.id ?? "",
          subject: subject.trim(),
          academic_year: academicYear,
          term,
          exam,
          rows,
          source_url: scenario.candidate.source_url,
          label: scenario.candidate.label,
          school: schoolKnown === "known" ? "known" : "unknown",
        }),
      },
    });
  }
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/parent/prova");
  const save = useMutation({
    mutationFn: async () => {
      if (blocked) throw Error("blueprint_local_unavailable");
      const existing = journal.read();
      if (
        !existing && (!confirmed || !selected || !child || scenarios.isError)
      ) throw Error("curriculum_school_confirmation_required");
      const command = existing ??
        journal.prepare({
          child_id: child!.id,
          catalogue_id: selected!.id,
          revision: selected!.revision,
          subject: subject.trim(),
          confirmed: true,
        });
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
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["blueprints", family] }),
        cache.invalidateQueries({ queryKey: ["builder_blueprints", family] }),
      ]);
      setSaved(true);
    },
    onError: () => {
      void scenarios.refetch();
    },
  });
  const error = save.error
    ? t(
      `catalogFlow.errors.${
        [
            "curriculum_unavailable",
            "curriculum_revision_conflict",
            "curriculum_scope_mismatch",
            "curriculum_school_confirmation_required",
            "request_conflict",
            "forbidden",
          ].includes((save.error as Error).message)
          ? (save.error as Error).message
          : "unknown"
      }`,
    )
    : null;
  return (
    <SetupWizard
      title={t("catalogFlow.title")}
      steps={saved
        ? [t("blueprintFlow.saved")]
        : pending || blocked
        ? [t("setupRecovery.check")]
        : [
          t("blueprintFlow.scope"),
          t("catalogFlow.choose"),
          t("betaUx.review"),
        ]}
      step={saved || pending || blocked ? 0 : step}
      setStep={setStep}
      dirty={!saved && !pending && !!selection}
      busy={save.isPending}
      valid={saved ||
        (!blocked && (!!pending || (!children.isError && (step === 0
          ? scopeValid
          : !!selected && !scenarios.isError &&
            (step === 1 || confirmed || schoolKnown === "unknown")))))}
      onClose={close}
      onSave={() =>
        saved
          ? close()
          : schoolKnown === "unknown" && selected && !pending
          ? openAsStudy(selected)
          : save.mutate()}
      saveLabel={saved
        ? t("blueprintFlow.back")
        : pending
        ? t("setupRecovery.retry")
        : schoolKnown === "unknown"
        ? t("provaP02.catalog.useAsStudy")
        : t("catalogFlow.save")}
      error={changed ? null : error}
    >
      {saved
        ? (
          <View style={[u.card, { backgroundColor: p.mint }]}>
            <Check color={p.purple} />
            <Text style={u.heading}>{t("blueprintFlow.saved")}</Text>
            <Text style={u.copy}>{t("catalogFlow.saved")}</Text>
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
            <Text style={u.copy}>{t("catalogFlow.pending")}</Text>
          </View>
        )
        : (
          <>
            {children.isError
              ? (
                <View>
                  <Text style={u.error}>{t("release.genericError")}</Text>
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
                  <Text style={u.copy}>{t("catalogFlow.intro")}</Text>
                  {children.data?.map((c) => (
                    <ChoiceCard
                      key={c.id}
                      title={c.name}
                      body={c.grade
                        ? t("parent.gradeShort", { grade: c.grade })
                        : t("provaBuilder.gradeMissing")}
                      art={<Avatar slug={c.avatar} size={48} />}
                      selected={child?.id === c.id}
                      onPress={() => {
                        setChildId(c.id);
                        reset();
                      }}
                    />
                  ))}
                  {child && (!child.grade || child.grade < 5)
                    ? <Text style={u.copy}>{t("catalogFlow.gradeHelp")}</Text>
                    : null}
                  {children.data?.length === 0
                    ? (
                      <SatinButton
                        title={t("unified.createFirstChild")}
                        onPress={() => router.push("/parent/menu")}
                      />
                    )
                    : null}
                  <Text style={u.bold}>{t("catalogFlow.subject")}</Text>
                  <View style={[u.row, { flexWrap: "wrap" }]}>
                    {subjects.map((s) => (
                      <Tag
                        key={s}
                        label={s}
                        selected={s === subject}
                        onPress={() => {
                          setSubject(s);
                          reset();
                        }}
                      />
                    ))}
                  </View>
                  <Field
                    label={t("catalogFlow.otherSubject")}
                    value={subject}
                    maxLength={80}
                    onChangeText={(v) => {
                      setSubject(v);
                      reset();
                    }}
                  />
                  <Field
                    label={t("catalogFlow.year")}
                    value={academicYear}
                    maxLength={9}
                    onChangeText={(v) => {
                      setAcademicYear(v);
                      reset();
                    }}
                  />
                  <Text style={u.bold}>{t("catalogFlow.term")}</Text>
                  <View style={u.row}>
                    {[1, 2].map((n) => (
                      <Tag
                        key={n}
                        label={t("catalogFlow.termNumber", { n })}
                        selected={term === n}
                        onPress={() => {
                          setTerm(n);
                          reset();
                        }}
                      />
                    ))}
                  </View>
                  <Text style={u.bold}>{t("catalogFlow.exam")}</Text>
                  <View style={u.row}>
                    {[1, 2].map((n) => (
                      <Tag
                        key={n}
                        label={t("catalogFlow.examNumber", { n })}
                        selected={exam === n}
                        onPress={() => {
                          setExam(n);
                          reset();
                        }}
                      />
                    ))}
                  </View>
                </>
              )
              : null}
            {step > 0
              ? (
                <>
                  <Text style={u.copy}>
                    {child?.name} · {subject} · {academicYear} ·{" "}
                    {t("catalogFlow.termNumber", { n: term })} ·{" "}
                    {t("catalogFlow.examNumber", { n: exam })}
                  </Text>
                  {freshness.isPending
                    ? (
                      <Text style={u.copy}>
                        {t("provaP02.catalog.freshnessChecking")}
                      </Text>
                    )
                    : freshness.isError
                    ? (
                      <Text accessibilityRole="alert" style={u.error}>
                        {t("provaP02.catalog.freshnessUnknown")}{" "}
                        {t("catalogFlow.freshness.freeStudy")}
                      </Text>
                    )
                    : null}
                  {freshness.data?.last_checked_at
                    ? (
                      <Text style={u.copy}>
                        {t("provaP02.catalog.lastChecked", {
                          date: new Date(freshness.data.last_checked_at)
                            .toLocaleDateString(),
                        })}
                      </Text>
                    )
                    : null}
                  {freshness.data
                    ? (
                      <Text
                        accessibilityRole={freshness.data.status === "verified"
                          ? undefined
                          : "alert"}
                        style={freshness.data.status === "verified"
                          ? u.copy
                          : u.error}
                      >
                        {t(`catalogFlow.freshness.${freshness.data.status}`, {
                          date: freshness.data.last_approved_retrieved_at
                            ? new Date(
                              freshness.data.last_approved_retrieved_at,
                            ).toLocaleDateString()
                            : "—",
                        })}
                        {freshness.data.alternative === "free_study"
                          ? ` ${t("catalogFlow.freshness.freeStudy")}`
                          : ""}
                      </Text>
                    )
                    : null}
                  {scenarios.isPending
                    ? <Text style={u.copy}>{t("common.loading")}</Text>
                    : scenarios.isError
                    ? (
                      <View>
                        <Text accessibilityRole="alert" style={u.error}>
                          {t("release.genericError")}
                        </Text>
                        <SatinButton
                          secondary
                          title={t("common.retry")}
                          onPress={() => void scenarios.refetch()}
                        />
                      </View>
                    )
                    : null}
                  {changed
                    ? (
                      <Text accessibilityRole="alert" style={u.error}>
                        {t("catalogFlow.changed")}
                      </Text>
                    )
                    : null}
                  {step === 1 && scenarios.data?.length === 0
                    ? (
                      <View style={u.card}>
                        <BookOpen color={p.purple} />
                        <Text style={u.heading}>
                          {t("catalogFlow.emptyTitle")}
                        </Text>
                        <Text style={u.copy}>{t("catalogFlow.empty")}</Text>
                        <SatinButton
                          secondary
                          title={t("catalogFlow.manual")}
                          onPress={() =>
                            router.replace("/parent/prova/blueprint")}
                        />
                      </View>
                    )
                    : null}
                  {step === 1 && scenarios.data?.length
                    ? (
                      <>
                        <Text style={u.bold}>
                          {t("provaP02.catalog.schoolQuestion")}
                        </Text>
                        <ChoiceCard
                          title={t("provaP02.catalog.known")}
                          body={t("provaP02.catalog.knownBody")}
                          selected={schoolKnown === "known"}
                          onPress={() => {
                            setSchoolKnown("known");
                            reset();
                          }}
                        />
                        <ChoiceCard
                          title={t("provaP02.catalog.unknown")}
                          body={t("provaP02.catalog.unknownBody")}
                          selected={schoolKnown === "unknown"}
                          onPress={() => {
                            setSchoolKnown("unknown");
                            reset();
                          }}
                        />
                        {schoolKnown
                          ? (
                            <Text style={u.bold}>
                              {t(
                                schoolKnown === "known"
                                  ? "provaP02.catalog.pickSchool"
                                  : "provaP02.catalog.pickStudy",
                              )}
                            </Text>
                          )
                          : null}
                      </>
                    )
                    : null}
                  {step === 1 && schoolKnown
                    ? scenarios.data?.map((s) => (
                      <ChoiceCard
                        key={s.id}
                        title={schoolKnown === "unknown"
                          ? `${t("provaP02.catalog.studyTag")} · ${s.candidate.label}`
                          : s.candidate.label}
                        body={`${s.programme}\n${s.school_scope}\n${
                          t("catalogFlow.count", {
                            n: s.candidate.question_count,
                          })
                        }`}
                        selected={s.id === selected?.id}
                        onPress={() => {
                          setSelection(s);
                          setConfirmed(false);
                        }}
                      />
                    ))
                    : null}
                  {step === 2 && selected
                    ? (
                      <>
                        <View style={[u.card, { backgroundColor: p.lilac }]}>
                          <Text style={u.heading}>
                            {selected.candidate.label}
                          </Text>
                          <Text style={u.copy}>{selected.programme}</Text>
                          <Text style={u.bold}>
                            {t("catalogFlow.schoolScope")}
                          </Text>
                          <Text style={u.copy}>{selected.school_scope}</Text>
                        </View>
                        <Text style={u.bold}>{t("catalogFlow.outcomes")}</Text>
                        {selected.candidate.blocks.map((b, i) => (
                          <View key={i} style={u.card}>
                            <Text style={u.bold}>
                              {t("catalogFlow.block", {
                                n: i + 1,
                                count: b.count,
                              })}
                            </Text>
                            {b.outcomes.map((o) => (
                              <Text key={o.cell} style={u.copy}>{o.text}</Text>
                            ))}
                          </View>
                        ))}
                        <SatinButton
                          secondary
                          title={t("catalogFlow.source")}
                          onPress={() =>
                            void Linking.openURL(selected.candidate.source_url)}
                        />
                        <SatinButton
                          secondary
                          title={t("catalogFlow.programmeSource")}
                          onPress={() =>
                            void Linking.openURL(selected.programme_url)}
                        />
                        <Text style={u.bold}>
                          {t("provaP02.catalog.fullDistribution", {
                            blocks: selected.candidate.blocks.length,
                            count: selected.candidate.question_count,
                          })}
                        </Text>
                        {schoolKnown === "unknown"
                          ? (
                            <View style={[u.card, { backgroundColor: p.lilac }]}>
                              <Text style={u.bold}>
                                {t("provaP02.catalog.studyTag")}
                              </Text>
                              <Text style={u.copy}>
                                {t("provaP02.catalog.unknownNotice")}
                              </Text>
                            </View>
                          )
                          : (
                            <>
                              <Text style={u.copy}>
                                {t("catalogFlow.notice")}
                              </Text>
                              <Toggle
                                label={t("catalogFlow.confirm")}
                                value={confirmed}
                                onChange={setConfirmed}
                              />
                              <SatinButton
                                secondary
                                title={t("provaP02.catalog.customize")}
                                onPress={() => openAsStudy(selected)}
                              />
                            </>
                          )}
                      </>
                    )
                    : null}
                </>
              )
              : null}
          </>
        )}
    </SetupWizard>
  );
}
