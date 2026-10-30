import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { Collectible } from "@/components/collectible";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { ParentScreen as Screen, parentStyles, EmptyCard } from "@/components/ui/parent-screen";
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
        .select("id, title, kind, status, timed, duration_minutes, question_ids, children(name, avatar), exam_attempts(id, status, mc_total, mc_correct, finished_at)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate("exam_attempts", familyId ? `family_id=eq.${familyId}` : null, [["exams", familyId]]);

  return (
    <Screen title={t("prova.title")} subtitle={t("prova.subtitle")}
      loading={blueprints.isLoading || bankCount.isLoading || exams.isLoading}
      error={blueprints.error ?? bankCount.error ?? exams.error}
      onRetry={() => { void blueprints.refetch(); void bankCount.refetch(); void exams.refetch(); }}>
      <View style={parentStyles.form}>
        <View style={parentStyles.row}><Collectible slug="display-bookworm" size={64} /><View className="flex-1 gap-1">
          <Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{t("provaV5.library")}</Text>
          <Text style={parentStyles.muted}>{t("prova.bankCount", { count: bankCount.data ?? 0 })} · {t("provaV5.scenarios", { count: blueprints.data?.length ?? 0 })}</Text>
        </View></View>
        <Button title={t("prova.newExam")} onPress={() => router.push("/parent/prova/exam")} />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {([
          ["prova.newQuestion", "/parent/prova/question"], ["prova.ai.generateTitle", "/parent/prova/generate"],
          ["prova.level.title", "/parent/prova/level"], ["prova.progress.title", "/parent/prova/progress"],
          ["prova.booklet.title", "/parent/prova/booklet"],
        ] as const).map(([label, path], index) => <View key={path} style={{ width: index === 4 ? "100%" : "48.5%", flexGrow: 1 }}>
          <Button variant="ghost" title={t(label)} onPress={() => router.push(path)} />
        </View>)}
      </View>
      <Text accessibilityRole="header" style={parentStyles.title}>{t("prova.exams")}</Text>
      {exams.data?.length === 0 ? <EmptyCard title={t("prova.noExams")} slug="display-bookworm" /> : null}
      {exams.data?.map(exam => {
        const attempt = exam.exam_attempts?.[0];
        const finished = attempt?.status === "submitted" || attempt?.status === "graded";
        return <View key={exam.id} style={parentStyles.card}>
          <View style={parentStyles.row}><Avatar slug={exam.children?.avatar} size={56} /><View className="flex-1 gap-1">
            <Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{exam.title}</Text>
            <Text style={parentStyles.muted}>{exam.children?.name} · {t("prova.questionCount", { count: exam.question_ids.length })}{exam.timed ? ` · ${exam.duration_minutes} ${t("prova.min")}` : ` · ${t("prova.untimed")}`}</Text>
          </View></View>
          <Text style={[parentStyles.muted, { color: "#38665C", backgroundColor: "#E6EFE4", padding: 9, borderRadius: 8 }]}>
            {finished ? t("prova.resultMc", { correct: attempt.mc_correct ?? 0, total: attempt.mc_total ?? 0 }) : attempt?.status === "in_progress" ? t("prova.inProgress") : t(`prova.status.${exam.status}`)}
          </Text>
          {exam.kind === "level_test" ? <Text style={parentStyles.muted}>{t("prova.level.badge")}</Text> : null}
          {finished ? <Button variant="secondary" title={t("prova.ai.review")} onPress={() => router.push({ pathname: "/parent/prova/attempt/[attemptId]", params: { attemptId: attempt.id } })} /> : null}
        </View>;
      })}
      <View style={parentStyles.card}>
        <Text accessibilityRole="header" style={parentStyles.title}>{t("prova.blueprints")}</Text>
        {blueprints.data?.length === 0 ? <Text style={parentStyles.muted}>{t("prova.noBlueprints")}</Text> : null}
        {blueprints.data?.map(bp => <View key={bp.id} style={parentStyles.row}>
          <SubjectIcon subject={bp.subject} size={48} variant="illustrated" />
          <Text style={[parentStyles.copy, { flex: 1 }]}>{bp.subject} · {bp.name} · {t("parent.gradeShort", { grade: bp.grade })}</Text>
        </View>)}
        <Button variant="ghost" title={t("prova.newBlueprint")} onPress={() => router.push("/parent/prova/blueprint")} />
      </View>
    </Screen>
  );
}
