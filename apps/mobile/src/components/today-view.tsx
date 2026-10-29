import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { localDateOf, starBalance, templatesDueOn } from "@gina/core";

import { TaskIcon } from "@/components/task-icon";
import { ErrorText } from "@/components/ui/screen";
import { useFamilyTimezone } from "@/lib/family";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";

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

  const stars = useQuery({
    queryKey: ["star_events", childId],
    queryFn: async () => {
      const { data, error } = await supabase.from("star_events").select("delta").eq("child_id", childId);
      if (error) throw error;
      return starBalance(data);
    },
  });

  // Veli onayladığında ya da görev eklediğinde ekran anında yenilenir.
  useRealtimeInvalidate("task_completions", `child_id=eq.${childId}`, [["task_completions", childId, today]]);
  useRealtimeInvalidate("star_events", `child_id=eq.${childId}`, [["star_events", childId]]);
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

  const due = templatesDueOn(templates.data ?? [], today);
  const byTemplate = new Map((completions.data ?? []).map((c) => [c.template_id, c]));

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between rounded-child bg-star/20 p-4">
        <Text className="text-lg font-semibold text-ink">{t("child.stars")}</Text>
        <Text className="text-3xl font-bold text-ink">⭐ {stars.data ?? 0}</Text>
      </View>
      <ErrorText error={templates.error ?? completions.error ?? complete.error} />
      {due.length === 0 && templates.isSuccess ? (
        <Text className="text-lg text-ink dark:text-night-text">{t("child.allDone")}</Text>
      ) : null}
      {due.map((task) => {
        const completion = byTemplate.get(task.id);
        const status = completion?.status;
        return (
          <Pressable
            key={task.id}
            accessibilityRole="button"
            disabled={(!!completion && status !== "returned") || complete.isPending}
            onPress={() => complete.mutate(task.id)}
            className={`min-h-20 flex-row items-center justify-between rounded-child p-5 ${
              status === "approved" ? "bg-green-light" : status === "done" ? "bg-star/30" : status === "returned" ? "bg-coral-light active:bg-teal-light" : "bg-white active:bg-teal-light dark:bg-night-surface"
            }`}
          >
            <TaskIcon slug={task.icon} size={44} />
            <View className="ml-4 flex-1">
              <Text className="text-xl font-semibold text-ink">{task.title}</Text>
              <Text className="text-sm text-gray-600">
                {status === "approved" ? t("child.approved") : status === "done" ? t("child.waitingApproval") : status === "returned" ? t("child.returnedTryAgain") : `${task.stars} ⭐`}
              </Text>
            </View>
            <Text className="text-3xl">{status === "approved" ? "✅" : status === "done" ? "⏳" : status === "returned" ? "🔁" : "⬜️"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
