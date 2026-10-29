import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { DEFAULT_TIMEZONE, localDateOf, occurrencesBetween, weekDatesOf } from "@gina/core";

import { WeekList, type WeekEvent } from "@/components/calendar/week-list";
import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Çocuğun haftalık takvimi: dersler, aktiviteler ve aile etkinlikleri (RLS yalnız çocuğa açık olanları verir). */
export default function ChildCalendarScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const timeZone = DEFAULT_TIMEZONE;
  const today = localDateOf(new Date(), timeZone);
  const week = weekDatesOf(today);
  const from = week[0] ?? today;
  const to = week[6] ?? today;

  const events = useQuery({
    queryKey: ["child_events", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, type, child_id, starts_at, ends_at, all_day, rrule, location")
        .order("starts_at");
      if (error) throw error;
      return data as WeekEvent[];
    },
  });

  useRealtimeInvalidate("events", familyId ? `family_id=eq.${familyId}` : null, [["child_events", familyId]]);

  const occurrences = occurrencesBetween(events.data ?? [], from, to, timeZone);

  return (
    <Screen tone="child" title={t("child.calendar")}>
      <ErrorText error={events.error} />
      <WeekList week={week} occurrences={occurrences} today={today} timeZone={timeZone} showChild={false} />
      <Button variant="ghost" title={t("child.today")} onPress={() => router.back()} />
    </Screen>
  );
}
