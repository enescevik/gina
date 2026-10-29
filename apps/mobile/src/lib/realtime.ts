import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "./supabase";

/**
 * Bir tablodaki değişiklikte verilen sorguları geçersiz kılar (Realtime yalnız sinyal taşır, veri taşımaz).
 * `filter` PostgREST biçimindedir: "child_id=eq.<uuid>".
 */
export function useRealtimeInvalidate(table: string, filter: string | null, queryKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  const keysJson = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!filter) return;
    const keys = JSON.parse(keysJson) as QueryKey[];
    const channel = supabase
      .channel(`rt:${table}:${filter}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, keysJson, queryClient]);
}
