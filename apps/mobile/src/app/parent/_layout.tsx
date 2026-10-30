import { Redirect, Stack, usePathname } from "expo-router";

import { useChildMode } from "@/lib/child-mode";
import { useIapObserver } from "@/lib/iap";
import { usePush } from "@/lib/push";

export default function ParentLayout() {
  // Push: ilk girişte izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("parent");
  // IAP: bitmemiş işlemler her açılışta sunucuda doğrulanır (web'de no-op).
  useIapObserver();
  const { actingChild } = useChildMode();
  const path = usePathname();
  if (actingChild && !path.startsWith("/parent/child-mode/")) return <Redirect href="/parent/child-mode/today" />;
  if (!actingChild && path.startsWith("/parent/child-mode/") ) return <Redirect href="/parent/child-mode" />;
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: !actingChild }} />;
}
