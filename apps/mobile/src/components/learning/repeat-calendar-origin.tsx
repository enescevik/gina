import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { b } from "./prova-builder-ui";
export function RepeatCalendarOrigin(
  { eventId, onOpen, disabled = false }: {
    eventId: string;
    onOpen: () => void;
    disabled?: boolean;
  },
) {
  const { claims } = useSession(), { t } = useTranslation();
  const source = useQuery({
    queryKey: ["repeat_calendar_origin", claims?.family_id, eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_repeat_calendar_event", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return z.object({ attempt_id: z.uuid(), question_ids: z.array(z.uuid()) })
        .nullable().parse(data);
    },
  });
  if (source.error) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={b.muted}>{t("repeatCalendar.originError")}</Text>
        <Button
          variant="ghost"
          title={t("common.retry")}
          onPress={() => void source.refetch()}
        />
      </View>
    );
  }
  if (!source.data) return null;
  return (
    <View style={b.hint}>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={b.copy}>{t("repeatCalendar.origin")}</Text>
        <Button
          variant="ghost"
          disabled={disabled}
          title={t("repeatCalendar.openReview")}
          onPress={() => {
            onOpen();
            router.push(`/parent/prova/repeat/${source.data!.attempt_id}`);
          }}
        />
      </View>
    </View>
  );
}
