import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { StudyPlanCalendar } from "@/components/learning/study-plan-calendar";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen } from "@/components/ui/parent-screen";

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
        .select(
          "id, subject, grade, status, weak_topics, plan, created_at, updated_at, family_id, child_id, attempt_id, children(name), families(timezone)",
        )
        .eq("id", planId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: "approved" | "archived") => {
      const { error } = await supabase.rpc("set_study_plan_status", {
        p_plan_id: planId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["study_plan", planId] });
      void queryClient.invalidateQueries({
        queryKey: ["study_plans_for_attempt"],
      });
    },
  });

  const p = plan.data;
  const rawBody =
    p?.plan && typeof p.plan === "object" && !Array.isArray(p.plan)
      ? p.plan
      : {};
  const body = {
    ozet: typeof rawBody.ozet === "string" ? rawBody.ozet : "",
    gunler: rawBody.gunler,
    gorev_onerileri: Array.isArray(rawBody.gorev_onerileri)
      ? rawBody.gorev_onerileri.filter((x): x is string =>
        typeof x === "string"
      )
      : [],
  };
  const weak = (Array.isArray(p?.weak_topics) ? p.weak_topics : []).filter(
    (x) =>
      x && typeof x === "object" && !Array.isArray(x) &&
      typeof x.topic === "string" &&
      (x.pct === null ||
        (typeof x.pct === "number" && Number.isFinite(x.pct) && x.pct >= 0 &&
          x.pct <= 100)),
  ) as unknown as WeakTopic[];

  return (
    <Screen
      title={t("prova.ai.planTitle")}
      loading={plan.isLoading}
      error={plan.error}
      onRetry={() => {
        void plan.refetch();
      }}
    >
      {p
        ? (
          <>
            <View className="gap-1 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
              <Text className="font-body text-sm text-gray-600">
                {p.children?.name} · {p.subject} {p.grade}.{" "}
                {t("prova.gradeWord")} · {t(`prova.ai.planStatus.${p.status}`)}
              </Text>
              <Text className="font-body-bold text-base text-ink">
                {t("planCalendar.suggestion")}
              </Text>
              {body.ozet
                ? (
                  <Text className="font-body text-base text-ink">
                    {body.ozet}
                  </Text>
                )
                : null}
            </View>

            {weak.length
              ? (
                <View className="gap-1 rounded-parent bg-teal-light p-4">
                  <Text className="font-body-bold text-base text-ink">
                    {t("planCalendar.observation")}
                  </Text>
                  <Text className="font-body text-sm text-gray-600">
                    {t("planCalendar.observationHint")}
                  </Text>
                  {weak.map((w) => (
                    <Text key={w.topic} className="font-body text-sm text-ink">
                      • {w.topic}
                      {w.pct !== null ? ` — %${w.pct}` : ""}
                    </Text>
                  ))}
                </View>
              )
              : null}

            {p.families?.timezone
              ? (
                <StudyPlanCalendar
                  key={p.id + ":" + p.updated_at}
                  planId={p.id}
                  childId={p.child_id}
                  familyId={p.family_id}
                  updatedAt={p.updated_at}
                  body={body}
                  timeZone={p.families.timezone}
                  archived={p.status === "archived"}
                  onRefresh={() => plan.refetch()}
                />
              )
              : null}

            {body.gorev_onerileri?.length
              ? (
                <View className="gap-1 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
                  <Text className="font-display text-xl text-ink">
                    {t("prova.ai.taskIdeas")}
                  </Text>
                  {body.gorev_onerileri.map((g) => (
                    <Text key={g} className="font-body text-base text-ink">
                      • {g}
                    </Text>
                  ))}
                  <Text className="font-body text-xs text-gray-500">
                    {t("prova.ai.taskIdeasHint")}
                  </Text>
                </View>
              )
              : null}

            {p.status !== "archived"
              ? (
                <Button
                  variant="ghost"
                  title={t("prova.ai.archivePlan")}
                  disabled={setStatus.isPending}
                  onPress={() => setStatus.mutate("archived")}
                />
              )
              : null}
          </>
        )
        : null}
      <ErrorText error={plan.error ?? setStatus.error} />
    </Screen>
  );
}
