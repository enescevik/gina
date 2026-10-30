import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { buildBookletHtml, printBooklet, type BookletChoice, type BookletQuestion } from "@/lib/prova-booklet";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Source = "library" | "exam";

const QUESTION_COLUMNS = "id, topic, kind, difficulty, stem, choices, correct_key, expected_answer, solution";
const DIFFICULTY_ORDER = ["kolay", "orta", "orta_ustu", "zor"];
/** Tek kitapçıkta en fazla soru (PDF boyutu ve yazdırma süresi için). */
const MAX_QUESTIONS = 100;

interface QuestionRow {
  id: string;
  topic: string;
  kind: "multiple_choice" | "open_ended";
  difficulty: string;
  stem: string;
  choices: unknown;
  correct_key: string | null;
  expected_answer: string | null;
  solution: string | null;
}

function toBooklet(q: QuestionRow): BookletQuestion {
  const choices = Array.isArray(q.choices)
    ? (q.choices as unknown[]).flatMap((c) =>
        c && typeof c === "object" && "key" in c && "text" in c ? [{ key: String(c.key), text: String(c.text) } satisfies BookletChoice] : [],
      )
    : null;
  return { ...q, choices };
}

/** Kitapçık: kütüphaneden (ders/sınıf/konular) ya da mevcut bir denemeden yazdırılabilir A4 PDF; cevap anahtarı son sayfada. */
export default function ProvaBookletScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";

  const [source, setSource] = useState<Source>("library");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("5");
  const [topics, setTopics] = useState<string[]>([]);
  const [examId, setExamId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [includeSolutions, setIncludeSolutions] = useState(true);

  const gradeNum = Number(grade) || 5;

  const subjects = useQuery({
    queryKey: ["question_bank_subjects", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank").select("subject, grade");
      if (error) throw error;
      const seen = new Map<string, { subject: string; grade: number }>();
      for (const row of data) seen.set(`${row.subject}|${row.grade}`, row);
      return Array.from(seen.values()).sort((a, b) => a.subject.localeCompare(b.subject, "tr") || a.grade - b.grade);
    },
  });

  const libraryQuestions = useQuery({
    queryKey: ["booklet_library", familyId, subject.trim(), gradeNum],
    enabled: source === "library" && !!familyId && !!subject.trim(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_bank")
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

  const availableTopics = useMemo(() => Array.from(new Set((libraryQuestions.data ?? []).map((q) => q.topic))), [libraryQuestions.data]);

  const questions = useMemo(() => {
    if (source === "exam") return (examQuestions.data ?? []).slice(0, MAX_QUESTIONS);
    const pool = (libraryQuestions.data ?? []).filter((q) => topics.length === 0 || topics.includes(q.topic));
    // Konu sırası korunur, konu içinde kolaydan zora.
    return [...pool]
      .sort(
        (a, b) =>
          availableTopics.indexOf(a.topic) - availableTopics.indexOf(b.topic) ||
          DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty),
      )
      .slice(0, MAX_QUESTIONS);
  }, [source, examQuestions.data, libraryQuestions.data, topics, availableTopics]);

  const defaultTitle =
    source === "exam" ? (selectedExam?.title ?? "") : subject.trim() ? t("prova.booklet.defaultTitle", { subject: subject.trim(), grade: gradeNum }) : "";

  const generate = useMutation({
    mutationFn: async () => {
      if (questions.length === 0) throw new Error(t("prova.booklet.noQuestions"));
      const html = buildBookletHtml({
        title: title.trim() || defaultTitle || t("prova.booklet.title"),
        subtitle: source === "exam" && selectedExam ? `${selectedExam.subject} · ${selectedExam.grade}. ${t("prova.gradeWord")}` : undefined,
        questions: questions.map(toBooklet),
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
        },
      });
      await printBooklet(html, t("prova.booklet.shareTitle"));
    },
  });

  const chip = (active: boolean) => `rounded-full px-3 py-2 ${active ? "bg-teal" : "bg-mist"}`;
  const chipText = (active: boolean) => (active ? "font-semibold text-white" : "text-ink");

  function toggleTopic(topic: string) {
    setTopics((ts) => (ts.includes(topic) ? ts.filter((x) => x !== topic) : [...ts, topic]));
  }

  return (
    <Screen title={t("prova.booklet.title")}>
      <Text className="text-base text-gray-600">{t("prova.booklet.intro")}</Text>

      <View className="flex-row gap-2">
        {(["library", "exam"] as const).map((s) => (
          <Pressable key={s} accessibilityRole="button" onPress={() => setSource(s)} className={chip(source === s)}>
            <Text className={chipText(source === s)}>{t(`prova.booklet.source.${s}`)}</Text>
          </Pressable>
        ))}
      </View>

      {source === "library" ? (
        <>
          {subjects.data && subjects.data.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {subjects.data.map((s) => {
                const active = subject.trim() === s.subject && gradeNum === s.grade;
                return (
                  <Pressable
                    key={`${s.subject}-${s.grade}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setSubject(s.subject);
                      setGrade(String(s.grade));
                      setTopics([]);
                    }}
                    className={chip(active)}
                  >
                    <Text className={chipText(active)}>
                      {s.subject} · {s.grade}. {t("prova.gradeWord")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <View className="flex-[2]">
              <Field label={t("grades.subject")} value={subject} onChangeText={setSubject} />
            </View>
            <View className="flex-1">
              <Field label={t("prova.grade")} keyboardType="number-pad" maxLength={2} value={grade} onChangeText={setGrade} />
            </View>
          </View>
          {availableTopics.length > 0 ? (
            <>
              <Text className="font-body-bold text-sm text-ink dark:text-night-text">{t("prova.booklet.pickTopics")}</Text>
              <View className="flex-row flex-wrap gap-2">
                {availableTopics.map((topic) => (
                  <Pressable key={topic} accessibilityRole="button" onPress={() => toggleTopic(topic)} className={chip(topics.includes(topic))}>
                    <Text className={chipText(topics.includes(topic))}>{topic}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : (
        <View className="gap-2">
          {exams.data?.length === 0 ? <Text className="text-gray-500">{t("prova.noExams")}</Text> : null}
          {exams.data?.map((exam) => (
            <Pressable
              key={exam.id}
              accessibilityRole="button"
              onPress={() => setExamId(exam.id)}
              className={`gap-1 rounded-parent border p-3 ${examId === exam.id ? "border-teal bg-teal-light" : "border-mist"}`}
            >
              <Text className="font-body-bold text-base text-ink dark:text-night-text">{exam.title}</Text>
              <Text className="text-sm text-gray-600">
                {exam.children?.name} · {t("prova.questionCount", { count: exam.question_ids.length })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Field label={t("prova.booklet.titleField")} value={title} onChangeText={setTitle} placeholder={defaultTitle} />
      <View className="flex-row items-center gap-3">
        <Switch value={includeSolutions} onValueChange={setIncludeSolutions} />
        <Text className="flex-1 text-base text-ink dark:text-night-text">{t("prova.booklet.includeSolutions")}</Text>
      </View>

      <Text className="text-sm text-gray-600">{t("prova.selectedCount", { count: questions.length })}</Text>
      <ErrorText error={generate.error ?? subjects.error ?? libraryQuestions.error ?? exams.error ?? examQuestions.error} />
      <Button title={t("prova.booklet.generate")} loading={generate.isPending} disabled={questions.length === 0} onPress={() => generate.mutate()} />
      <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
    </Screen>
  );
}
