import { Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { SatinButton, u } from "./ui";

/** Q02-7: ready documents are paged instead of a fixed first 30. */
export const PLAN_SOURCE_PAGE = 30;
export type PlanSource = { id: string; name: string; mime: string };

export function usePlanSources(scope: unknown[], enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ["learning_plan_sources_paged", ...scope],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      // One extra row tells whether another page exists without a separate count query.
      const { data, error } = await supabase.from("learning_sources")
        .select("id,name,mime").eq("kind", "document").eq("status", "ready")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + PLAN_SOURCE_PAGE);
      if (error) throw error;
      return {
        rows: (data ?? []).slice(0, PLAN_SOURCE_PAGE) as PlanSource[],
        next: (data?.length ?? 0) > PLAN_SOURCE_PAGE
          ? pageParam + PLAN_SOURCE_PAGE
          : undefined,
      };
    },
    getNextPageParam: (last) => last.next,
  });
  const seen = new Set<string>();
  const list = query.data?.pages.flatMap((p) => p.rows).filter((r) =>
    seen.has(r.id) ? false : (seen.add(r.id), true)
  );
  return {
    list,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
    more: !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}

export function PlanSourcesMore(
  { sources }: { sources: ReturnType<typeof usePlanSources> },
) {
  const { t } = useTranslation();
  if (!sources.list?.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={u.small}>
        {t("u05.sourcesShown", { count: sources.list.length })}
      </Text>
      {sources.more
        ? (
          <SatinButton
            secondary
            title={t("u05.moreSources")}
            busy={sources.loadingMore}
            disabled={sources.loadingMore}
            onPress={sources.loadMore}
          />
        )
        : null}
    </View>
  );
}
