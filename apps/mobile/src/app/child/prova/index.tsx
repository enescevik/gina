import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen, ChildColumns, childStyles } from "@/components/room/child-screen";
import { useChildMode } from "@/lib/child-mode";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Çocuk Prova: atanmış denemeler ve tamamlananların sonucu (kitaplıktan açılır; tablette ve telefonda çocuk modunda). */
export default function ChildProvaScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const { actingChild } = useChildMode();
  const childId = claims?.child_id ?? actingChild?.id ?? "";

  const exams = useQuery({
    queryKey: ["child_exams", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, status, timed, duration_minutes, question_ids, exam_attempts(status, mc_total, mc_correct)")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate("exam_attempts", childId ? `child_id=eq.${childId}` : null, [["child_exams", childId]]);

  const open = (exams.data ?? []).filter((e) => e.status === "assigned");
  const done = (exams.data ?? []).filter((e) => e.status === "completed");

  return (
    <Screen tone="child" surface="desk" loading={exams.isLoading} title={t("prova.title")}>
      <ChildColumns rail={<View style={{ gap: 12 }}>
      <Text accessibilityRole="header" className="font-display text-lg text-ink">{t("prova.toDo")}</Text>
      {open.length === 0 ? <Text className="font-body text-base text-gray-600">{t("prova.nothingAssigned")}</Text> : null}
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
            <Text className="font-display text-lg text-ink">{exam.title}</Text>
            <Text className="font-body text-sm text-gray-600">
              {t("prova.questionCount", { count: exam.question_ids.length })}
              {exam.timed ? ` · ${exam.duration_minutes} ${t("prova.min")}` : ` · ${t("prova.untimed")}`}
            </Text>
          </View>
          <View className="rounded-button bg-teal px-4 py-2">
            <Text className="font-body-bold text-white">{resuming ? t("prova.continue") : t("room.start")}</Text>
          </View>
        </Pressable>
        );
      })}
      </View>}>
      {done.length > 0 ? <Text accessibilityRole="header" className="mt-2 font-display text-lg text-ink">{t("prova.done")}</Text> : null}
      {done.map((exam) => {
        const attempt = exam.exam_attempts?.[0];
        return (
          <View
            key={exam.id}
            accessible
            accessibilityLabel={`${exam.title}, ${t("prova.status.completed")}, ${t("prova.resultMc", { correct: attempt?.mc_correct ?? 0, total: attempt?.mc_total ?? 0 })}`}
            className="flex-row items-center gap-3 rounded-child bg-green-light p-4"
          >
            <SubjectIcon subject={exam.title} size={48} variant="illustrated" />
            <View className="flex-1">
              <Text className="font-body-bold text-base text-ink">{exam.title}</Text>
              <Text className="font-body text-sm text-gray-700">
                {t("prova.resultMc", { correct: attempt?.mc_correct ?? 0, total: attempt?.mc_total ?? 0 })}
              </Text>
            </View>
          </View>
        );
      })}
      </ChildColumns>
      <ErrorText error={exams.error} />
      <Button variant="ghost" title={t("child.today")} onPress={() => router.back()} />
    </Screen>
  );
}
