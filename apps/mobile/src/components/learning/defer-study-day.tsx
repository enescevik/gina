import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { parentStyles } from "@/components/ui/parent-screen";
import { supabase } from "@/lib/supabase";

export function DeferStudyDay({ childId, familyId }: { childId: string; familyId: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const key = ["study_day_deferral", familyId, childId];
  const day = useQuery({
    queryKey: key,
    retry: false,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_study_day_deferral", { p_child_id: childId });
      if (error) throw error;
      return data[0];
    },
  });
  const defer = useMutation({
    mutationFn: async () => {
      if (!day.data) throw new Error("study_day_unavailable");
      const { data, error } = await supabase.rpc("defer_study_day", {
        p_child_id: childId,
        p_day: day.data.day,
      });
      if (error) throw error;
      return { ...data[0], day: day.data.day };
    },
    onSettled: () => cache.invalidateQueries({ queryKey: key }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["plan_for_days", familyId, childId] }),
        cache.invalidateQueries({ queryKey: ["plan_for_day", familyId, childId] }),
        cache.invalidateQueries({ queryKey: ["events", familyId] }),
        cache.invalidateQueries({ queryKey: ["child_events", familyId, childId] }),
        cache.invalidateQueries({ queryKey: ["repeat_calendar", familyId] }),
      ]);
    },
  });

  if (!day.data) return null;
  const result = day.data.deferred ? day.data : defer.data?.day === day.data.day ? defer.data : null;
  return (
    <View style={{ gap: 8 }}>
      {!day.data.deferred ? <ConfirmAction
        title={t("deferStudyDay.action")}
        message={t("deferStudyDay.confirm")}
        busy={defer.isPending}
        onConfirm={() => defer.mutate()}
      /> : null}
      {result ? (
        <Text accessibilityLiveRegion="polite" style={parentStyles.copy}>
          {result.task_count || result.repeat_count
            ? t("deferStudyDay.result", { tasks: result.task_count, repeats: result.repeat_count })
            : t("deferStudyDay.empty")}
        </Text>
      ) : null}
      {defer.error ? (
        <Text accessibilityRole="alert" style={parentStyles.copy}>
          {t("deferStudyDay.error")}
        </Text>
      ) : null}
    </View>
  );
}
