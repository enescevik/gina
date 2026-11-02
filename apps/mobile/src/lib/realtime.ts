import { focusManager, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { supabase } from "./supabase";

let subscriptionId = 0;

/** A socket is a hint, not a delivery guarantee. Reconcile on route focus and
 * subscription/reconnection; coalesce bursts and stop listening on hidden routes. */
export function useRealtimeInvalidate(table: string, filter: string | null, queryKeys: QueryKey[]) {
  const client = useQueryClient();
  const keysJson = JSON.stringify(queryKeys);
  useFocusEffect(useCallback(() => {
    if (!filter) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connected = false;
    const keys = JSON.parse(keysJson) as QueryKey[];
    const refresh = () => {
      if (!alive || !focusManager.isFocused()) return;
      for (const key of keys) void client.invalidateQueries({ queryKey: key });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    };
    refresh();
    const channel = supabase.channel(`rt:${table}:${filter}:${++subscriptionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter }, schedule)
      .subscribe(status => {
        connected = status === "SUBSCRIBED";
        if (connected) schedule();
      });
    const resume = focusManager.subscribe(focused => { if (focused) schedule(); });
    // Only fall back while realtime is unavailable; never poll in the background.
    const fallback = setInterval(() => { if (!connected) refresh(); }, 30_000);
    return () => {
      alive = false; if (timer) clearTimeout(timer);
      clearInterval(fallback); resume(); void supabase.removeChannel(channel);
    };
  }, [table, filter, keysJson, client]));
}
