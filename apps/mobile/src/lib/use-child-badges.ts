import { useQuery } from "@tanstack/react-query";

import type { Json } from "@gina/core";

import { useRealtimeInvalidate } from "./realtime";
import { supabase } from "./supabase";

export interface ChildBadge {
  slug: string;
  title: string;
  icon: string;
  earned: boolean;
  awardedAt: string | null;
}

function i18nText(j: Json | null, lang: string): string {
  if (j && typeof j === "object" && !Array.isArray(j)) {
    const map = j as Record<string, Json | undefined>;
    const hit = map[lang] ?? map.en ?? Object.values(map)[0];
    if (typeof hit === "string") return hit;
  }
  return "";
}

/** Rozet tanımları + çocuğun kazandıkları; kazanılanlar en yeni önce, sonra kilitliler. */
export function useChildBadges(childId: string, lang: string) {
  const query = useQuery({
    queryKey: ["child_badges", childId, lang],
    enabled: !!childId,
    queryFn: async (): Promise<ChildBadge[]> => {
      const [defs, awards] = await Promise.all([
        supabase.from("badge_definitions").select("slug, title_i18n, icon, sort_order").eq("active", true).order("sort_order"),
        supabase.from("child_badge_awards").select("badge_slug, awarded_at").eq("child_id", childId),
      ]);
      if (defs.error) throw defs.error;
      if (awards.error) throw awards.error;
      const awarded = new Map(awards.data.map((a) => [a.badge_slug, a.awarded_at]));
      const list = defs.data.map((d) => ({
        slug: d.slug,
        title: i18nText(d.title_i18n, lang),
        icon: d.icon,
        earned: awarded.has(d.slug),
        awardedAt: awarded.get(d.slug) ?? null,
      }));
      return [
        ...list.filter((b) => b.earned).sort((a, b) => (b.awardedAt ?? "").localeCompare(a.awardedAt ?? "")),
        ...list.filter((b) => !b.earned),
      ];
    },
  });
  useRealtimeInvalidate("child_badge_awards", childId ? `child_id=eq.${childId}` : null, [["child_badges", childId, lang]]);
  return query;
}
