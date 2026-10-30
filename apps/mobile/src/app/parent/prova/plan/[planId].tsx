import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import type { StudyPlanBody } from "@/lib/prova-ai";
import { supabase } from "@/lib/supabase";

interface WeakTopic {
  topic: string;
  pct: number | null;
}

/** Çalışma planı (veli): zayıf konular, günlük tekrar satırları, görev önerileri; onayla / arşivle. */
export default function StudyPlanScreen() {
  const { t } = useTranslation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const queryClient = useQueryClient();

  const plan = useQuery({
    queryKey: ["study_plan", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("id, subject, grade, status, weak_topics, plan, created_at, attempt_id, children(name)")
        .eq("id", planId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: "approved" | "archived") => {
      const { error } = await supabase.rpc("set_study_plan_status", { p_plan_id: planId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["study_plan", planId] });
      void queryClient.invalidateQueries({ queryKey: ["study_plans_for_attempt"] });
    },
  });

  const p = plan.data;
  const body = (p?.plan ?? {}) as StudyPlanBody;
  const weak = (Array.isArray(p?.weak_topics) ? p.weak_topics : []) as unknown as WeakTopic[];

  return (
    <Screen title={t("prova.ai.planTitle")}>
      {p ? (
        <>
          <View className="gap-1 rounded-parent bg-white p-4 dark:bg-night-surface">
            <Text className="text-sm text-gray-600">
              {p.children?.name} · {p.subject} {p.grade}. {t("prova.gradeWord")} · {t(`prova.ai.planStatus.${p.status}`)}
            </Text>
            {body.ozet ? <Text className="text-base text-ink dark:text-night-text">{body.ozet}</Text> : null}
          </View>

          {weak.length ? (
            <View className="gap-1 rounded-parent bg-teal-light p-4">
              <Text className="font-body-bold text-base text-ink">{t("prova.ai.weak")}</Text>
              {weak.map((w) => (
                <Text key={w.topic} className="text-sm text-ink">
                  • {w.topic}
                  {w.pct !== null ? ` — %${w.pct}` : ""}
                </Text>
              ))}
            </View>
          ) : null}

          <View className="gap-2 rounded-parent bg-white p-4 dark:bg-night-surface">
            <Text className="font-display text-xl text-ink dark:text-night-text">{t("prova.ai.planDays")}</Text>
            {body.gunler?.map((g) => (
              <View key={g.gun} className="gap-0.5 rounded-parent border border-mist p-3">
                <Text className="font-body-bold text-base text-ink dark:text-night-text">
                  {t("prova.ai.dayN", { n: g.gun })} · {g.konu}
                </Text>
                <Text className="text-sm text-gray-600">
                  {g.etkinlik} · {t("prova.ai.minutes", { count: g.sure_dk })}
                </Text>
              </View>
            ))}
          </View>

          {body.gorev_onerileri?.length ? (
            <View className="gap-1 rounded-parent bg-white p-4 dark:bg-night-surface">
              <Text className="font-display text-xl text-ink dark:text-night-text">{t("prova.ai.taskIdeas")}</Text>
              {body.gorev_onerileri.map((g) => (
                <Text key={g} className="text-base text-ink dark:text-night-text">
                  • {g}
                </Text>
              ))}
              <Text className="text-xs text-gray-500">{t("prova.ai.taskIdeasHint")}</Text>
            </View>
          ) : null}

          {p.status === "draft" ? (
            <Button title={t("prova.ai.approvePlan")} loading={setStatus.isPending} onPress={() => setStatus.mutate("approved")} />
          ) : null}
          {p.status !== "archived" ? (
            <Button variant="secondary" title={t("prova.ai.archivePlan")} onPress={() => setStatus.mutate("archived")} />
          ) : null}
        </>
      ) : null}
      <ErrorText error={plan.error ?? setStatus.error} />
      <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
    </Screen>
  );
}
