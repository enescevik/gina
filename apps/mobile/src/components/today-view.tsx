import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View, useWindowDimensions } from "react-native";

import { localDateOf, starBalance, templatesDueOn, type CompletionStatus } from "@gina/core";

import { LARGE_FONT_REFLOW_ABOVE } from "@/components/room/layout";
import { NineSlice, SkinIcon, SkinPressable, SkinProgress } from "@/components/room/nine-slice";
import { SkinTaskCard, sortForBoard } from "@/components/room/skin-task-card";
import { ErrorText } from "@/components/ui/screen";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useChildExamCount } from "@/lib/use-child-exam-count";
import { useChildGoal } from "@/lib/use-child-goal";

export interface TodayViewProps {
  childId: string;
  /**
   * Veli telefonundaki çocuk modu: tik complete_task(p_acting_child_id) ile atılır.
   * Tablette (cihaz oturumu) null bırakılır; çocuk kimliği JWT claim'inden gelir.
   */
  actingAsParent?: boolean;
}

/** Çocuğun "Bugün" listesi: bugün düşen görevler, tik, yıldız bakiyesi. Tablet ve veli-telefonu çocuk modu paylaşır. */
export function TodayView({ childId, actingAsParent = false }: TodayViewProps) {
  const { t } = useTranslation();
  const timeZone = useFamilyTimezone();
  const today = localDateOf(new Date(), timeZone);
  const queryClient = useQueryClient();

  const templates = useQuery({
    queryKey: ["task_templates", childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id, title, icon, stars, days_of_week, starts_on, ends_on, active, sort_order")
        .eq("child_id", childId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const completions = useQuery({
    queryKey: ["task_completions", childId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id, template_id, status")
        .eq("child_id", childId)
        .eq("due_date", today);
      if (error) throw error;
      return data;
    },
  });

  // Anahtar use-child-today'deki ham satır listesinden ayrı: bu sorgu bakiyeyi (sayı) önbelleğe yazar.
  const stars = useQuery({
    queryKey: ["star_balance", childId],
    queryFn: async () => {
      const { data, error } = await supabase.from("star_events").select("delta").eq("child_id", childId);
      if (error) throw error;
      return starBalance(data);
    },
  });

  // Veli onayladığında ya da görev eklediğinde ekran anında yenilenir.
  useRealtimeInvalidate("task_completions", `child_id=eq.${childId}`, [["task_completions", childId, today]]);
  useRealtimeInvalidate("star_events", `child_id=eq.${childId}`, [["star_balance", childId]]);
  useRealtimeInvalidate("task_templates", `child_id=eq.${childId}`, [["task_templates", childId]]);

  const complete = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc("complete_task", {
        p_template_id: templateId,
        p_due_date: today,
        p_client_id: Crypto.randomUUID(),
        ...(actingAsParent ? { p_acting_child_id: childId } : {}),
      });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["task_completions", childId, today] }),
  });

  // Prova kartı: dar akışta kitaplığın karşılığı; atanmış deneme sayısı rozet olarak.
  const examCount = useChildExamCount(childId).data ?? 0;
  const goal = useChildGoal(childId);
  const { width, fontScale } = useWindowDimensions();
  // Dar telefon/büyük yazı: görev kâğıdında çip metnin altına iner (minimumLogicalSize altına sıkıştırılmaz).
  const stacked = width < 600 || fontScale > LARGE_FONT_REFLOW_ABOVE;

  const due = templatesDueOn(templates.data ?? [], today);
  const byTemplate = new Map((completions.data ?? []).map((c) => [c.template_id, c]));
  const statusOf = (id: string) => (byTemplate.get(id)?.status ?? null) as CompletionStatus | null;
  const doneCount = due.filter((task) => statusOf(task.id) === "done" || statusOf(task.id) === "approved").length;
  const nextTaskId = due.find((task) => statusOf(task.id) === null || statusOf(task.id) === "returned")?.id;
  const balance = stars.data ?? 0;
  const goalData = goal.data;
  const remaining = goalData ? Math.max(0, goalData.cost - balance) : 0;

  // Odam kaplamalarıyla dikey akış: oda küçültülmez; aynı pano/kâğıt/çip/bilet dili alt alta akar.
  const goalBody = (
    <>
      <Text className="font-display text-xl text-teal-dark">{t("room.myGoal")}</Text>
      {goalData ? (
        <>
          <Text className="text-center font-display text-2xl text-ink">{goalData.rewardTitle}</Text>
          <Text className="font-body-bold text-base text-ink">
            {t("room.goalProgress", { stars: Math.min(balance, goalData.cost), cost: goalData.cost })}
          </Text>
          <SkinProgress value={balance / goalData.cost} style={{ alignSelf: "stretch", marginVertical: 4 }} />
          <Text className="font-display text-xl text-ink">{remaining === 0 ? t("goal.reached") : t("room.starsLeft", { count: remaining })}</Text>
        </>
      ) : goal.isLoading ? (
        <ActivityIndicator color="#0B7F7F" />
      ) : (
        <Text className="font-body-bold text-lg text-teal-dark">{t("goal.pickCta")}</Text>
      )}
    </>
  );

  return (
    <View className="gap-4">
      <View className="flex-row" accessible accessibilityLabel={`${t("child.stars")}: ${t("room.starCount", { count: balance })}`}>
        <NineSlice skin="pill-star" contentClassName="justify-center">
          <Text className="font-body-bold text-lg text-ink">{t("room.starCount", { count: balance })}</Text>
        </NineSlice>
      </View>

      {actingAsParent ? (
        <NineSlice skin={goalData ? "ticket-goal" : "ticket-goal-empty"} contentClassName="items-center justify-center">
          {goalBody}
        </NineSlice>
      ) : (
        <SkinPressable
          skin={goalData ? "ticket-goal" : "ticket-goal-empty"}
          onPress={() => router.push("/child/goal")}
          accessibilityLabel={goalData ? `${t("room.myGoal")}: ${goalData.rewardTitle}` : `${t("room.myGoal")}: ${t("goal.pickCta")}`}
          contentClassName="items-center justify-center"
        >
          {goalBody}
        </SkinPressable>
      )}

      <ErrorText error={templates.error ?? completions.error ?? complete.error} />

      <NineSlice skin="panel-generic" contentStyle={{ gap: 10 }}>
        <View>
          <Text accessibilityRole="header" className="font-display text-2xl text-ink">
            {t("room.todayTasks")}
          </Text>
          <Text className="font-body text-base text-ink/80">{t("room.completedOf", { done: doneCount, total: due.length })}</Text>
          {due.length > 0 ? (
            <View className="mt-1 flex-row flex-wrap gap-1.5" accessible={false} importantForAccessibility="no-hide-descendants">
              {due.map((task) => (
                <SkinIcon
                  key={task.id}
                  skin={statusOf(task.id) === "done" || statusOf(task.id) === "approved" ? "progress-dot-filled" : "progress-dot-empty"}
                  size={16}
                />
              ))}
            </View>
          ) : null}
        </View>
        {templates.isLoading ? <ActivityIndicator color="#0B7F7F" /> : null}
        {due.length === 0 && templates.isSuccess ? <Text className="font-body text-lg text-ink">{t("child.allDone")}</Text> : null}
        {sortForBoard(due.map((task) => ({ ...task, status: statusOf(task.id) }))).map((task) => (
          <SkinTaskCard
            key={task.id}
            task={task}
            s={1}
            stacked={stacked}
            isNext={task.id === nextTaskId}
            completing={complete.isPending}
            onComplete={() => complete.mutate(task.id)}
          />
        ))}
      </NineSlice>

      {/* Prova kapısı (geniş ekrandaki kitaplığın dar akış karşılığı) */}
      <SkinPressable
        skin="panel-generic"
        accessibilityLabel={examCount > 0 ? `${t("prova.title")}, ${t("prova.waitingCount", { count: examCount })}` : t("prova.title")}
        accessibilityHint={examCount > 0 ? undefined : t("prova.noneWaiting")}
        onPress={() => router.push(actingAsParent ? "/parent/child-mode/prova" : "/child/prova")}
        contentClassName="flex-row items-center"
      >
        <Text className="text-4xl">📚</Text>
        <View className="ml-4 flex-1">
          <Text className="font-display text-xl text-ink">{t("prova.title")}</Text>
          <Text className="font-body text-sm text-ink/80">
            {examCount > 0 ? t("prova.waitingCount", { count: examCount }) : t("prova.noneWaiting")}
          </Text>
        </View>
        {examCount > 0 ? (
          <View className="h-8 min-w-8 items-center justify-center rounded-full bg-coral px-2">
            <Text className="text-base font-bold text-white">{examCount}</Text>
          </View>
        ) : (
          <Text className="font-display text-2xl text-ink/70">›</Text>
        )}
      </SkinPressable>
    </View>
  );
}
