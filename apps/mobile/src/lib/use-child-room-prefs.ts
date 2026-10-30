import { useQuery } from "@tanstack/react-query";

import { supabase } from "./supabase";

export interface ChildRoomPrefs {
  characterKey: string;
  themeKey: string;
  petKey: string;
}

/** Çocuğun oda tercihleri (child_room_preferences); satır yoksa null (varsayılanlar kullanılır). */
export function useChildRoomPrefs(childId: string) {
  return useQuery({
    queryKey: ["child_room_prefs", childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildRoomPrefs | null> => {
      const { data, error } = await supabase
        .from("child_room_preferences")
        .select("character_key, theme_key, pet_key")
        .eq("child_id", childId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { characterKey: data.character_key, themeKey: data.theme_key, petKey: data.pet_key };
    },
  });
}
