import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { TodayView } from "@/components/today-view";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Tablet: çocuğun "Bugün" ekranı; çocuk kimliği JWT claim'inden gelir. */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const childId = claims?.child_id ?? "";
  const queryClient = useQueryClient();

  async function logout() {
    await supabase.rpc("child_logout");
    await refreshClaims();
    queryClient.clear();
    router.replace("/child");
  }

  return (
    <Screen tone="child" title={t("child.today")}>
      {childId ? <TodayView childId={childId} /> : null}
      <Button variant="secondary" size="child" title={t("child.calendar")} onPress={() => router.push("/child/calendar")} />
      <Button variant="ghost" title={t("child.switchProfile")} onPress={() => void logout()} />
    </Screen>
  );
}
