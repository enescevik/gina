import { useQuery } from "@tanstack/react-query";

import { DEFAULT_TIMEZONE } from "@gina/core";

import { useSession } from "./session";
import { supabase } from "./supabase";

/**
 * Ailenin saat dilimi (families.timezone): "bugün"/hafta hesapları bununla yapılır
 * (docs/design/room-v2 düzeltmesi; DECISIONS: tarihler UTC, gün aile-yerel).
 * Yüklenene kadar varsayılan Europe/Istanbul kullanılır.
 */
export function useFamilyTimezone(): string {
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const { data } = useQuery({
    queryKey: ["family_timezone", familyId],
    enabled: !!familyId,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data: row, error } = await supabase.from("families").select("timezone").eq("id", familyId).single();
      if (error) throw error;
      return row.timezone;
    },
  });
  return data ?? DEFAULT_TIMEZONE;
}
