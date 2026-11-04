import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { repeatCalendarSourceSchema } from "@gina/core";
import { ParentScreen } from "@/components/ui/parent-screen";
import { RepeatCalendar } from "@/components/learning/repeat-calendar";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
export default function RepeatCalendarScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>(),
    { claims } = useSession(),
    { t } = useTranslation();
  const family = claims?.family_id ?? "";
  const source = useQuery({
    queryKey: ["repeat_calendar", family, attemptId],
    enabled: !!family && !!attemptId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_repeat_calendar", {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
      return repeatCalendarSourceSchema.parse(data);
    },
  });
  return (
    <ParentScreen
      wide
      title={t("repeatCalendar.title")}
      loading={source.isPending}
      error={source.error}
      onRetry={() => void source.refetch()}
    >
      {source.data
        ? (
          <RepeatCalendar
            key={`${family}:${attemptId}:${source.data.hash}`}
            source={source.data}
            family={family}
            onRefresh={() => source.refetch()}
          />
        )
        : null}
    </ParentScreen>
  );
}
