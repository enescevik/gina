import {useFutureLearningReady} from "@/lib/future-learning";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { attachBookletImages, buildBookletHtml, printBooklet, type BookletChoice, type BookletLabels, type BookletQuestion } from "@/lib/prova-booklet";
import type { TFunction } from "i18next";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Source = "library" | "exam" | "favorites";

const QUESTION_COLUMNS = "id, topic, kind, difficulty, stem, choices, correct_key, expected_answer, solution, interaction_type, payload";
const DIFFICULTY_ORDER = ["kolay", "orta", "orta_ustu", "zor"];
/** Tek kitapçıkta en fazla soru (PDF boyutu ve yazdırma süresi için). */
const MAX_QUESTIONS = 100;

interface QuestionRow {
  id: string;
  subject?: string;
  grade?: number;
  topic: string;
  kind: "multiple_choice" | "open_ended" | "structured";
  interaction_type?: string | null;
  payload?: unknown;
  difficulty: string;
  stem: string;
  choices: unknown;
  correct_key: string | null;
  expected_answer: string | null;
  solution: string | null;
}

function bookletStructuredLabels(t: TFunction): BookletLabels["structured"] {
  const k = (key: string, vars?: Record<string, unknown>) => t(`prova.qt.author.booklet.${key}`, vars);
  return {
    type: (type) => t(`prova.qt.author.type.${type}`),
    trueShort: k("trueShort"),
    falseShort: k("falseShort"),
    tfHelp: k("tfHelp"),
    fillHelpBank: k("fillHelpBank"),
    fillHelpBankReuse: k("fillHelpBankReuse"),
    fillHelpKeyboard: k("fillHelpKeyboard"),
    wordBank: k("wordBank"),
    matchingHelp: k("matchingHelp"),
    matchingHelpMany: k("matchingHelpMany"),
    numericAnswer: k("numericAnswer"),
    numericUnit: k("numericUnit"),
    numericWork: k("numericWork"),
    orderingHelp: k("orderingHelp"),
    orderingHelpSentence: k("orderingHelpSentence"),
    classificationHelp: k("classificationHelp"),
    capacity: (n) => k("capacity", { count: n }),
    acceptedOrder: (n) => k("acceptedOrder", { n }),
    conversion: (unit, factor, base) => k("conversion", { unit, factor, base }),
    tolerance: (abs) => k("tolerance", { abs }),
    relTolerance: (pct) => k("relTolerance", { pct }),
    unitWeight: (pct) => k("unitWeight", { pct }),
    processRequired: k("processRequired"),
    caseInsensitive: k("caseInsensitive"),
    keyUnavailable: k("keyUnavailable"),
    markHelp: (unit, max) => k(max ? "markHelpMax" : "markHelp", { unit: k(`unit_${unit}`), count: max }),
    errorFixHelp: (unit) => k("errorFixHelp", { unit: k(`unit_${unit}`) }),
    multiHelp: (count) => (count ? k("multiHelpCount", { count }) : k("multiHelpAll")),
    stage: (n) => k("stage", { n }),
    regionHelp: k("regionHelp"),
    regionCountHelp: (n) => k("regionCount", { count: n }),
    crosswordAcross: t("prova.qt.crossword.across"),
    crosswordDown: t("prova.qt.crossword.down"),
    clockRead: k("clockRead"),
    clockSet: k("clockSet"),
    clockTime: k("clockTime"),
    stimulusAlt: k("stimulusAlt"),
    regionCount: (n) => k("regionCount", { count: n }),
    accept12h: k("accept12h"),
    parentScores: k("parentScores"),
    fixPolicyReview: k("fixPolicyReview"),
  };
}

function toBooklet(q: QuestionRow): BookletQuestion {
  const choices = Array.isArray(q.choices)
    ? (q.choices as unknown[]).flatMap((c) =>
        c && typeof c === "object" && "key" in c && "text" in c ? [{ key: String(c.key), text: String(c.text) } satisfies BookletChoice] : [],
      )
    : null;
  return { ...q, choices };
}

/** Kitapçık: kütüphaneden (ders/sınıf/konular) ya da mevcut bir denemeden yazdırılabilir A4 PDF. Öğrenci nüshası ve cevap anahtarı ayrı belgelerdir. */
export default function ProvaBookletScreen() {
  const ready=useFutureLearningReady();
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const params = useLocalSearchParams<{ source?: string; grade?: string }>();
  const userId = session?.user.id;
  const familyId = claims?.family_id ?? "";

  const [source, setSource] = useState<Source>(params.source === "favorites" ? "favorites" : "library");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState(() => /^[1-9]$|^1[0-2]$/.test(params.grade ?? "") ? Number(params.grade) : 5);
  const [topics, setTopics] = useState<string[]>([]);
  const [examId, setExamId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [includeSolutions, setIncludeSolutions] = useState(true);

  const gradeNum = grade;

  const subjects = useQuery({
    queryKey: ["question_bank_subjects", familyId],
    enabled: source === "library" && !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("current_question_bank").select("subject, grade");
      if (error) throw error;
      const seen = new Map<string, { subject: string; grade: number }>();
      for (const row of data) seen.set(`${row.subject}|${row.grade}`, row);
      return Array.from(seen.values()).sort((a, b) => a.subject.localeCompare(b.subject, "tr") || a.grade - b.grade);
    },
  });

  const favoriteQuestions = useQuery({
    queryKey: ["booklet_favorites", familyId, userId],
    enabled: ready && source === "favorites" && !!familyId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_reactions")
        .select(`question_bank(${QUESTION_COLUMNS},grade,subject)`)
        .eq("family_id", familyId).eq("parent_user_id", userId!)
        .order("created_at", { ascending: false }).order("question_id").limit(500);
      if (error) throw error;
      return (data as unknown as { question_bank: QuestionRow | null }[]).flatMap(r => r.question_bank ? [r.question_bank] : []);
    },
  });
  const favoriteSubjects = useMemo(() => {
    const seen = new Map<string, { subject: string; grade: number }>();
    for (const q of favoriteQuestions.data ?? []) if (q.subject && q.grade) seen.set(`${q.grade}:${q.subject}`, { subject: q.subject, grade: q.grade });
    return [...seen.values()].sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject, "tr"));
  }, [favoriteQuestions.data]);
  const libraryQuestions = useQuery({
    queryKey: ["booklet_library", familyId, subject.trim(), gradeNum],
    enabled: source === "library" && !!familyId && !!subject.trim(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("current_question_bank")
        .select(QUESTION_COLUMNS)
        .eq("subject", subject.trim())
        .eq("grade", gradeNum)
        .order("topic")
        .limit(500);
      if (error) throw error;
      return data as QuestionRow[];
    },
  });

  const exams = useQuery({
    queryKey: ["booklet_exams", familyId],
    enabled: source === "exam" && !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, subject, grade, question_ids, children(name)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  const selectedExam = exams.data?.find((e) => e.id === examId) ?? null;

  const examQuestions = useQuery({
    queryKey: ["booklet_exam_questions", examId],
    enabled: source === "exam" && !!selectedExam,
    queryFn: async () => {
      const ids = selectedExam?.question_ids ?? [];
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("question_bank").select(QUESTION_COLUMNS).in("id", ids);
      if (error) throw error;
      // Denemedeki sırayı koru.
      const byId = new Map((data as QuestionRow[]).map((q) => [q.id, q]));
      return ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as QuestionRow] : []));
    },
  });

  const bookletPool = useMemo(() => source === "favorites"
    ? (favoriteQuestions.data ?? []).filter(q => q.grade === gradeNum && (!subject.trim() || q.subject === subject.trim()))
    : libraryQuestions.data ?? [], [source, favoriteQuestions.data, libraryQuestions.data, gradeNum, subject]);
  const availableTopics = useMemo(() => Array.from(new Set(bookletPool.map(q => q.topic))), [bookletPool]);
  const subjectOptions = source === "favorites" ? favoriteSubjects : subjects.data;

  const questions = useMemo(() => {
    if (source === "exam") return (examQuestions.data ?? []).slice(0, MAX_QUESTIONS);
    const pool = bookletPool.filter((q) => topics.length === 0 || topics.includes(q.topic));
    // Konu sırası korunur, konu içinde kolaydan zora.
    return [...pool]
      .sort(
        (a, b) =>
          availableTopics.indexOf(a.topic) - availableTopics.indexOf(b.topic) ||
          DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty),
      )
      .slice(0, MAX_QUESTIONS);
  }, [source, examQuestions.data, bookletPool, topics, availableTopics]);

  const defaultTitle =
    source === "exam" ? (selectedExam?.title ?? "") : source === "favorites" ? t("questionLikes.bookletTitle", {grade:gradeNum}) : subject.trim() ? t("prova.booklet.defaultTitle", { subject: subject.trim(), grade: gradeNum }) : "";

  const generate = useMutation({
    mutationFn: async (copy: "student" | "key") => {
      if (questions.length === 0) throw new Error(t("prova.booklet.noQuestions"));
      const baseTitle = title.trim() || defaultTitle || t("prova.booklet.title");
      // Özel anahtar yalnız cevap anahtarı nüshasında ve yalnız veli RPC'siyle alınır; öğrenci nüshasına hiç girmez.
      let keys = new Map<string, unknown>();
      const structuredIds = questions.filter((q) => q.kind === "structured").map((q) => q.id);
      if (copy === "key" && structuredIds.length) {
        const { data, error } = await supabase.rpc("get_question_answer_keys", { p_question_ids: structuredIds });
        if (error) throw error;
        keys = new Map(((data ?? []) as unknown as { question_id: string; key: unknown }[]).map((k) => [k.question_id, k.key]));
      }
      const rows = questions.map((q) => {
        const b = toBooklet(q);
        return copy === "key" && q.kind === "structured" ? { ...b, answer_key: keys.get(q.id) } : b;
      });
      const html = buildBookletHtml({
        copy,
        title: copy === "key"
          ? `${baseTitle} · ${t("prova.booklet.answerKey")}`
          : baseTitle,
        subtitle: source === "exam" && selectedExam ? `${selectedExam.subject} · ${selectedExam.grade}. ${t("prova.gradeWord")}` : undefined,
        questions: await attachBookletImages(rows),
        includeSolutions,
        labels: {
          answerKey: t("prova.booklet.answerKey"),
          name: t("prova.booklet.nameField"),
          date: t("prova.booklet.dateField"),
          topics: t("prova.booklet.topics"),
          questionCount: t("prova.questionCount", { count: questions.length }),
          solution: t("prova.booklet.solution"),
          expected: t("prova.booklet.expected"),
          difficulty: (d) => t(`prova.difficulty.${d}`),
          structured: bookletStructuredLabels(t),
        },
      });
      await printBooklet(
        html,
        t(copy === "key" ? "provaP02.booklet.keyShare" : "provaP02.booklet.studentShare"),
      );
    },
  });

  const chip = (active: boolean) => `min-h-12 min-w-12 items-center justify-center rounded-full border px-4 py-2 ${active ? "bg-teal-dark border-teal-dark" : "bg-[#FFFFFF] border-[#D9D3E6]"}`;
  const chipText = (active: boolean) => (active ? "font-body-bold text-white" : "font-body text-ink");

  function toggleTopic(topic: string) {
    setTopics((ts) => (ts.includes(topic) ? ts.filter((x) => x !== topic) : [...ts, topic]));
  }

  if(source==="favorites"&&!ready)return <Screen title={t("futureLearning.unavailable")}>{null}</Screen>;
  return (
    <Screen title={t("prova.booklet.title")} subtitle={t("unified.bookletHelp")} loading={subjects.isLoading || exams.isLoading} error={subjects.error ?? exams.error} onRetry={() => { void subjects.refetch(); void exams.refetch(); }}>
      <View style={parentStyles.card}>
      <Text className="font-body text-base text-gray-600">{t("provaP02.booklet.intro")}</Text>

      <View className="flex-row gap-2">
        {(["library", "exam", "favorites"] as const).filter(s=>s!=="favorites"||ready).map((s) => (
          <Pressable key={s} accessibilityRole="button" onPress={() => {setSource(s);setTopics([]);setSubject("");}} accessibilityState={{ selected: source === s }} aria-pressed={source === s} className={chip(source === s)}>
            <Text className={chipText(source === s)}>{t(`prova.booklet.source.${s}`)}</Text>
          </Pressable>
        ))}
      </View>

      {source !== "exam" ? (
        <>
          {subjectOptions && subjectOptions.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {subjectOptions.map((s) => {
                const active = subject.trim() === s.subject && gradeNum === s.grade;
                return (
                  <Pressable
                    key={`${s.subject}-${s.grade}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setSubject(s.subject);
                      setGrade(s.grade);
                      setTopics([]);
                    }}
                    accessibilityState={{ selected: active }} aria-pressed={active} className={chip(active)}
                  >
                    <Text className={chipText(active)}>
                      {s.subject} · {s.grade}. {t("prova.gradeWord")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {source === "favorites" ? <>
            <Text style={parentStyles.muted}>{t("questionLikes.bookletHelp")}</Text>
            {subject ? <Button variant="ghost" title={t("questionLikes.allSubjects")} onPress={() => {setSubject("");setTopics([]);}} /> : null}
          </> : <Field label={t("grades.subject")} value={subject} onChangeText={value=>{setSubject(value);setTopics([]);}} />}
          {/* Q00-C12-T3: sınıf serbest metin değil; 1–12 arası tek dokunuşla seçilir. */}
          <Text nativeID="booklet-grade-label" className="font-body-bold text-sm text-ink">{t("prova.grade")}</Text>
          <View accessibilityRole="radiogroup" aria-labelledby="booklet-grade-label" className="flex-row flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <Pressable
                key={g}
                accessibilityRole="radio"
                accessibilityLabel={t("parent.gradeShort", { grade: g })}
                accessibilityState={{ checked: grade === g }}
                aria-checked={grade === g}
                onPress={() => {
                  if (g !== grade) {setTopics([]);if(source === "favorites")setSubject("");}
                  setGrade(g);
                }}
                className={chip(grade === g)}
              >
                <Text className={chipText(grade === g)}>{g}</Text>
              </Pressable>
            ))}
          </View>
          {availableTopics.length > 0 ? (
            <>
              <Text className="font-body-bold text-sm text-ink">{t("prova.booklet.pickTopics")}</Text>
              <View className="flex-row flex-wrap gap-2">
                {availableTopics.map((topic) => (
                  <Pressable key={topic} accessibilityRole="button" onPress={() => toggleTopic(topic)} accessibilityState={{ selected: topics.includes(topic) }} aria-pressed={topics.includes(topic)} className={chip(topics.includes(topic))}>
                    <Text className={chipText(topics.includes(topic))}>{topic}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : (
        <View className="gap-2">
          {exams.data?.length === 0 ? <Text className="font-body text-gray-500">{t("prova.noExams")}</Text> : null}
          {exams.data?.map((exam) => (
            <Pressable
              key={exam.id}
              accessibilityRole="button"
              onPress={() => setExamId(exam.id)}
              className={`gap-1 rounded-parent border p-3 ${examId === exam.id ? "border-teal bg-teal-light" : "border-mist"}`}
            >
              <Text className="font-body-bold text-base text-ink">{exam.title}</Text>
              <Text className="font-body text-sm text-gray-600">
                {exam.children?.name} · {t("prova.questionCount", { count: exam.question_ids.length })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Field label={t("prova.booklet.titleField")} value={title} onChangeText={setTitle} placeholder={defaultTitle} />
      <View className="flex-row items-center gap-3">
        <Toggle value={includeSolutions} onChange={setIncludeSolutions} label={t("prova.booklet.includeSolutions")} />
      </View>

      <Text className="font-body text-sm text-gray-600">{t("prova.selectedCount", { count: questions.length })}</Text>
      <ErrorText error={generate.error ?? subjects.error ?? libraryQuestions.error ?? favoriteQuestions.error ?? exams.error ?? examQuestions.error} />
      <Text className="font-body text-sm text-gray-600">{t("provaP02.booklet.twoCopies")}</Text>
      {questions.some((q) => q.kind === "structured")
        ? (
          <View testID="qt-booklet-paper-note" style={{ backgroundColor: "#EDF7F1", borderColor: "#D4E9DD", borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 }}>
            <Text style={parentStyles.copy}>{t("prova.qt.author.booklet.paperNote")}</Text>
            <Text style={parentStyles.muted}>{t("prova.qt.author.booklet.keyPrivate")}</Text>
          </View>
        )
        : null}
      <Button title={t("provaP02.booklet.student")} loading={generate.isPending && generate.variables === "student"} disabled={questions.length === 0 || generate.isPending} onPress={() => generate.mutate("student")} />
      <Button variant="secondary" title={t("provaP02.booklet.key")} loading={generate.isPending && generate.variables === "key"} disabled={questions.length === 0 || generate.isPending} onPress={() => generate.mutate("key")} />
      <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
    </View>
    </Screen>
  );
}
