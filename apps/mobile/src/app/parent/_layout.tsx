import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { ChildModeHome } from "@/components/room/child-mode-home";
import { useRouteMotion } from "@/lib/use-route-motion";
import { Redirect, Stack, usePathname } from "expo-router";

import { useSession } from "@/lib/session";
import { useChildMode } from "@/lib/child-mode";
import { useIapObserver } from "@/lib/iap";
import { usePush } from "@/lib/push";

export default function ParentLayout() {
  const motion = useRouteMotion();
  // Push: ilk girişte izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("parent");
  // IAP: bitmemiş işlemler her açılışta sunucuda doğrulanır (web'de no-op).
  useIapObserver();
  const { actingChild } = useChildMode();
  const { claims } = useSession();
  useRealtimeInvalidate(
    "children",
    claims?.family_id ? `family_id=eq.${claims.family_id}` : null,
    [
      ["children"],
      ["education_children"],
      ["children_history"],
      ["events"], ["child_events"],
      ["reward_requests"],
    ],
  );
  const path = usePathname();
  const profile = useQuery({
    queryKey: ["child_mode_archive", actingChild?.id],
    enabled: !!actingChild,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("id,archived_at")
        .eq("id", actingChild!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate(
    "children",
    actingChild ? `id=eq.${actingChild.id}` : null,
    [["child_mode_archive", actingChild?.id]],
  );
  if (actingChild && profile.isLoading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  if (
    actingChild &&
    (profile.error || !profile.data || profile.data.archived_at)
  )
    return (
      <ChildModeHome archiveBlocked archiveUnavailable={!!profile.error} />
    );
  if (actingChild && !path.startsWith("/parent/child-mode/"))
    return <Redirect href="/parent/child-mode/today" />;
  if (!actingChild && path.startsWith("/parent/child-mode/"))
    return <Redirect href="/parent/child-mode" />;
  return (
    <Stack
      screenOptions={{
        ...motion,
        headerShown: false,
        gestureEnabled: !actingChild,
        orientation: "default",
      }}
    />
  );
}
