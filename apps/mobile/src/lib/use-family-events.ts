import { useQuery } from "@tanstack/react-query";

import type { WeekEvent } from "@/components/calendar/week-list";

import { useRealtimeInvalidate } from "./realtime";
import { useSession } from "./session";
import { supabase } from "./supabase";

/**
 * Ailenin etkinlikleri (tatiller dahil; tür `holiday`) ve iptal edilen tekrar örnekleri.
 * Takvim ve veli ana sayfası aynı önbellek anahtarını paylaşır; veri biçimi tek yerde tanımlı (WeekEvent).
 */
export function useFamilyEvents() {
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";

  const events = useQuery({
    queryKey: ["events", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, type, child_id, starts_at, ends_at, all_day, rrule, location, children(name)")
        .order("starts_at");
      if (error) throw error;
      return data.map<WeekEvent>((e) => ({ ...e, childName: e.children?.name ?? null }));
    },
  });

  const exceptions = useQuery({
    queryKey: ["event_exceptions", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_exceptions").select("event_id, occurrence_date, cancelled");
      if (error) throw error;
      return new Set(data.filter((x) => x.cancelled).map((x) => `${x.event_id}:${x.occurrence_date}`));
    },
  });

  useRealtimeInvalidate("events", familyId ? `family_id=eq.${familyId}` : null, [["events", familyId]]);

  return { events, exceptions };
}
