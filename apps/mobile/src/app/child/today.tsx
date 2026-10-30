import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View, useWindowDimensions } from "react-native";

import { RoomChildHome } from "@/components/room/child-home";
import { WIDE_LAYOUT_MIN_DP } from "@/components/room/layout";
import { TodayView } from "@/components/today-view";
import { Button } from "@/components/ui/button";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { refreshClaims, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Tablet: geniş ekranda oyun odası (onaylı tasarım); dar ekranda dikey akış. */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const childId = claims?.child_id ?? "";
  const queryClient = useQueryClient();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= WIDE_LAYOUT_MIN_DP && fontScale <= 1.2;

  const child = useQuery({
    queryKey: ["child_profile", childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("name, avatar").eq("id", childId).single();
      if (error) throw error;
      return data;
    },
  });

  async function logout() {
    await supabase.rpc("child_logout");
    await refreshClaims();
    queryClient.clear();
    router.replace("/child");
  }

  if (childId && wide) {
    return <RoomChildHome childId={childId} childName={child.data?.name ?? ""} onParentExit={() => void logout()} />;
  }

  return (
    <Screen tone="child" title={t("child.today")}>
      {childId ? <TodayView childId={childId} /> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="secondary" size="child" title={t("child.week")} onPress={() => router.push("/child/week")} />
        </View>
        <View className="flex-1">
          <Button variant="secondary" size="child" title={t("child.calendar")} onPress={() => router.push("/child/calendar")} />
        </View>
      </View>
      <Button variant="secondary" title={t("childV5.customize")} onPress={() => router.push("/child/room-preview")} />
      <Button variant="ghost" title={t("child.switchProfile")} onPress={() => void logout()} />
    </Screen>
  );
}
