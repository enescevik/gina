import { Stack } from "expo-router";

import { useIapObserver } from "@/lib/iap";
import { usePush } from "@/lib/push";

export default function ParentLayout() {
  // Push: ilk girişte izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("parent");
  // IAP: bitmemiş işlemler her açılışta sunucuda doğrulanır (web'de no-op).
  useIapObserver();
  return <Stack screenOptions={{ headerShown: false }} />;
}
