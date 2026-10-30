import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Prova (veli): senaryolar, soru kütüphanesi özeti, denemeler ve sonuçlar. */
export default function ParentProvaScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";

  const blueprints = useQuery({
    queryKey: ["blueprints", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_blueprints").select("id, name, subject, grade, rows").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const bankCount = useQuery({
    queryKey: ["question_bank_count", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { count, error } = await supabase.from("question_bank").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const exams = useQuery({
    queryKey: ["exams", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, kind, status, timed, duration_minutes, question_ids, children(name), exam_attempts(id, status, mc_total, mc_correct, finished_at)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate("exam_attempts", familyId ? `family_id=eq.${familyId}` : null, [["exams", familyId]]);

  return (
    <Screen title={t("prova.title")}>
      <Text className="text-base text-gray-600">{t("prova.subtitle")}</Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button title={t("prova.newExam")} onPress={() => router.push("/parent/prova/exam")} />
        </View>
        <View className="flex-1">
          <Button variant="secondary" title={t("prova.newQuestion")} onPress={() => router.push("/parent/prova/question")} />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <View className="min-w-[30%] flex-1">
          <Button variant="secondary" title={t("prova.ai.generateTitle")} onPress={() => router.push("/parent/prova/generate")} />
        </View>
        <View className="min-w-[30%] flex-1">
          <Button variant="secondary" title={t("prova.level.title")} onPress={() => router.push("/parent/prova/level")} />
        </View>
        <View className="min-w-[30%] flex-1">
          <Button variant="secondary" title={t("prova.progress.title")} onPress={() => router.push("/parent/prova/progress")} />
        </View>
        <View className="min-w-[30%] flex-1">
          <Button variant="secondary" title={t("prova.booklet.title")} onPress={() => router.push("/parent/prova/booklet")} />
        </View>
      </View>

      <View className="gap-2 rounded-parent bg-white p-4 dark:bg-night-surface">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-xl text-ink dark:text-night-text">{t("prova.exams")}</Text>
          <Text className="text-sm text-gray-500">{t("prova.bankCount", { count: bankCount.data ?? 0 })}</Text>
        </View>
        {exams.data?.length === 0 ? <Text className="text-gray-500">{t("prova.noExams")}</Text> : null}
        {exams.data?.map((exam) => {
          const attempt = exam.exam_attempts?.[0];
          const finished = attempt?.status === "submitted" || attempt?.status === "graded";
          return (
            <Pressable
              key={exam.id}
              accessibilityRole="button"
              disabled={!finished}
              onPress={() => attempt && router.push({ pathname: "/parent/prova/attempt/[attemptId]", params: { attemptId: attempt.id } })}
              className="gap-1 rounded-parent border border-mist p-3 active:bg-teal-light"
            >
              <Text className="font-body-bold text-base text-ink dark:text-night-text">
                {exam.kind === "level_test" ? `🎯 ${t("prova.level.badge")} · ` : ""}
                {exam.title}
              </Text>
              <Text className="text-sm text-gray-600">
                {exam.children?.name} · {t("prova.questionCount", { count: exam.question_ids.length })}
                {exam.timed ? ` · ${exam.duration_minutes} ${t("prova.min")}` : ` · ${t("prova.untimed")}`}
              </Text>
              <Text className="text-sm text-teal-dark">
                {finished
                  ? t("prova.resultMc", { correct: attempt.mc_correct ?? 0, total: attempt.mc_total ?? 0 })
                  : attempt?.status === "in_progress"
                    ? t("prova.inProgress")
                    : t(`prova.status.${exam.status}`)}
                {finished ? ` · ${t("prova.ai.review")} ›` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2 rounded-parent bg-white p-4 dark:bg-night-surface">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-xl text-ink dark:text-night-text">{t("prova.blueprints")}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/parent/prova/blueprint")}>
            <Text className="font-semibold text-teal-dark">+ {t("prova.newBlueprint")}</Text>
          </Pressable>
        </View>
        {blueprints.data?.length === 0 ? <Text className="text-gray-500">{t("prova.noBlueprints")}</Text> : null}
        {blueprints.data?.map((bp) => (
          <Text key={bp.id} className="text-base text-ink dark:text-night-text">
            • {bp.subject} {bp.grade}. {t("prova.gradeWord")} — {bp.name} ({Array.isArray(bp.rows) ? bp.rows.length : 0} {t("prova.topicWord")})
          </Text>
        ))}
      </View>

      <ErrorText error={blueprints.error ?? exams.error ?? bankCount.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
