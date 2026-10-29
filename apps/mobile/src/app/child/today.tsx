import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { DEFAULT_TIMEZONE, localDateOf, starBalance, templatesDueOn } from "@gina/core";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { refreshClaims, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Çocuğun "Bugün" ekranı: bugün düşen görevler, tik, yıldız bakiyesi. */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const childId = claims?.child_id ?? "";
  const today = localDateOf(new Date(), DEFAULT_TIMEZONE);
  const queryClient = useQueryClient();

  const templates = useQuery({
    queryKey: ["task_templates", childId],
    enabled: !!childId,
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
    enabled: !!childId,
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
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.from("star_events").select("delta").eq("child_id", childId);
      if (error) throw error;
      return starBalance(data);
    },
  });

  const complete = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.rpc("complete_task", {
        p_template_id: templateId,
        p_due_date: today,
        p_client_id: Crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["task_completions", childId, today] }),
  });

  // Veli onayladığında ya da görev eklediğinde tablet anında yenilenir.
  useRealtimeInvalidate("task_completions", childId ? `child_id=eq.${childId}` : null, [["task_completions", childId, today]]);
  useRealtimeInvalidate("star_events", childId ? `child_id=eq.${childId}` : null, [["star_events", childId]]);
  useRealtimeInvalidate("task_templates", childId ? `child_id=eq.${childId}` : null, [["task_templates", childId]]);

  const due = templatesDueOn(templates.data ?? [], today);
  const byTemplate = new Map((completions.data ?? []).map((c) => [c.template_id, c]));

  async function logout() {
    await supabase.rpc("child_logout");
    await refreshClaims();
    queryClient.clear();
    router.replace("/child");
  }

  return (
    <Screen tone="child" title={t("child.today")}>
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
            disabled={!!completion || complete.isPending}
            onPress={() => complete.mutate(task.id)}
            className={`min-h-20 flex-row items-center justify-between rounded-child p-5 ${
              status === "approved" ? "bg-green-light" : status === "done" ? "bg-star/30" : "bg-white active:bg-teal-light dark:bg-night-surface"
            }`}
          >
            <View className="flex-1">
              <Text className="text-xl font-semibold text-ink">{task.title}</Text>
              <Text className="text-sm text-gray-600">
                {status === "approved" ? t("child.approved") : status === "done" ? t("child.waitingApproval") : `${task.stars} ⭐`}
              </Text>
            </View>
            <Text className="text-3xl">{status === "approved" ? "✅" : status === "done" ? "⏳" : "⬜️"}</Text>
          </Pressable>
        );
      })}
      <Button variant="secondary" size="child" title={t("child.calendar")} onPress={() => router.push("/child/calendar")} />
      <Button variant="ghost" title={t("child.switchProfile")} onPress={() => void logout()} />
    </Screen>
  );
}
