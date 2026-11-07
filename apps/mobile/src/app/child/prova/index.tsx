import { attemptSummary } from "@gina/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { SubjectIcon } from "@/components/subject-icon";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, ChildColumns, ChildEmptyState, childStyles } from "@/components/room/child-screen";
import { useChildMode } from "@/lib/child-mode";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** P04 sütunları üretilmiş tiplerde henüz yok; satır elle tiplenir. */
interface ChildAttempt {
  status: "in_progress" | "submitted" | "graded";
  mc_total: number | null;
  mc_correct: number | null;
  open_total: number | null;
  open_graded: number | null;
  open_pending: number | null;
  open_unanswered: number | null;
  provisional: boolean | null;
  created_at: string;
}
interface ChildExam {
  id: string;
  title: string;
  status: string;
  timed: boolean;
  duration_minutes: number | null;
  question_ids: string[];
  exam_attempts: ChildAttempt[] | null;
}
const CHILD_EXAM_SELECT: string =
  "id, title, status, timed, duration_minutes, question_ids, exam_attempts(status, mc_total, mc_correct, open_total, open_graded, open_pending, open_unanswered, provisional, created_at)";

/** Çocuk Prova: atanmış denemeler ve tamamlananların sonucu (kitaplıktan açılır; tablette ve telefonda çocuk modunda). */
export default function ChildProvaScreen() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { claims } = useSession();
  const { actingChild } = useChildMode();
  const childId = claims?.child_id ?? actingChild?.id ?? "";

  const exams = useQuery({
    queryKey: ["child_exams", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select(CHILD_EXAM_SELECT)
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ChildExam[];
    },
  });
  useRealtimeInvalidate("exams", childId ? `child_id=eq.${childId}` : null, [["child_exams", childId]]);
  useRealtimeInvalidate("exam_attempts", childId ? `child_id=eq.${childId}` : null, [["child_exams", childId]]);

  const open = (exams.data ?? []).filter((e) => e.status === "assigned");
  const done = (exams.data ?? []).filter((e) => e.status === "completed");

  return (
    <Screen tone="child" surface="desk" loading={exams.isLoading} title={t("prova.title")}>
      <ChildColumns rail={<View style={{ gap: 12 }}>
      <Text accessibilityRole="header" className="font-body-bold text-lg text-ink">{t("prova.toDo")}</Text>
      {open.length === 0 && !exams.error ? <ChildEmptyState kind="study" title={t("prova.nothingAssigned")} body={t("betaUx.childStudyEmpty")}/> : null}
      {open.map((exam) => {
        const resuming = exam.exam_attempts?.some((a) => a.status === "in_progress") ?? false;
        const meta = `${t("prova.questionCount", { count: exam.question_ids.length })}, ${exam.timed ? `${exam.duration_minutes} ${t("prova.min")}` : t("prova.untimed")}`;
        return (
        <Pressable
          key={exam.id}
          accessibilityRole="button"
          accessibilityLabel={`${exam.title}, ${meta}`}
          accessibilityHint={resuming ? t("prova.a11yContinueHint") : t("prova.a11yStartHint")}
          onPress={() => router.push({
              pathname: actingChild ? "/parent/child-mode/prova/[examId]" : "/child/prova/[examId]",
              params: { examId: exam.id },
            })}
          style={[childStyles.card, { minHeight: 96, flexDirection: "row", flexWrap: "wrap", alignItems: "center" }]}
        >
          <SubjectIcon subject={exam.title} size={56} variant="illustrated" />
          <View className="flex-1">
            <Text className="font-body-bold text-lg text-ink">{exam.title}</Text>
            <Text className="font-body text-sm text-gray-600">
              {t("prova.questionCount", { count: exam.question_ids.length })}
              {exam.timed ? ` · ${exam.duration_minutes} ${t("prova.min")}` : ` · ${t("prova.untimed")}`}
            </Text>
          </View>
          <View style={{borderRadius:16, backgroundColor:"#6042DE", paddingHorizontal:16, paddingVertical:12}}>
            <Text className="font-body-bold text-white">{resuming ? t("prova.continue") : t("room.start")}</Text>
          </View>
        </Pressable>
        );
      })}
      </View>}>
      {done.length > 0 ? <Text accessibilityRole="header" className="mt-2 font-body-bold text-lg text-ink">{t("prova.done")}</Text> : null}
      {done.map((exam) => {
        // En son bitmiş deneme; veli ekranıyla aynı sayaçlar (attemptSummary). Puan yargısı yok:
        // karma sınavda şıklı sonuç "Ara sonuç" olarak + "ebeveynin inceleyecek" birlikte görünür.
        const attempt = [...(exam.exam_attempts ?? [])]
          .filter((a) => a.status !== "in_progress")
          .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
        const s = attempt ? attemptSummary(attempt, []) : null;
        const pendingReview = s?.reviewState === "pending_review";
        const hasMc = (s?.mcTotal ?? 0) > 0;
        const resultLabel = hasMc
          ? t("prova.resultMc", { correct: s?.mcCorrect ?? 0, total: s?.mcTotal ?? 0 })
          : t(pendingReview ? "prova.openEndedNote" : "prova.status.completed");
        const pendingNote = pendingReview && hasMc ? t("prova.openEndedPending") : null;
        return (
          <Pressable
            key={exam.id}
            accessibilityRole="button"
            accessibilityHint={t("prova.viewResult")}
            onPress={() => {
              void cache.invalidateQueries({ queryKey: ["attempt", exam.id], exact: true });
              router.push({
                pathname: actingChild ? "/parent/child-mode/prova/[examId]" : "/child/prova/[examId]",
                params: { examId: exam.id },
              });
            }}
            accessibilityLabel={`${exam.title}, ${t("prova.status.completed")}, ${pendingNote ? `${t("prova.provisionalResult")}, ` : ""}${resultLabel}${pendingNote ? `, ${pendingNote}` : ""}`}
            className="flex-row items-center gap-3 rounded-child bg-green-light p-4"
          >
            <SubjectIcon subject={exam.title} size={48} variant="illustrated" />
            <View className="flex-1">
              <Text className="font-body-bold text-base text-ink">{exam.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                {pendingNote ? (
                  <View style={{ borderRadius: 999, backgroundColor: "#FFF6E3", borderWidth: 1, borderColor: "#E9C77E", paddingHorizontal: 10, paddingVertical: 2 }}>
                    <Text className="font-body-bold text-sm text-ink">{t("prova.provisionalResult")}</Text>
                  </View>
                ) : null}
                <Text className="font-body text-sm text-gray-700">{resultLabel}</Text>
              </View>
              {pendingNote ? <Text className="font-body-bold text-purple">{pendingNote}</Text> : null}
              <Text className="mt-2 font-body-bold text-purple">{t("prova.viewResult")}</Text>
            </View>
          </Pressable>
        );
      })}
      </ChildColumns>
      <ErrorText tone="child" error={exams.error} />
    </Screen>
  );
}
