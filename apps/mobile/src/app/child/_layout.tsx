import { Redirect, Stack, usePathname } from "expo-router";

import { useSession } from "@/lib/session";
import { usePush } from "@/lib/push";

export default function ChildLayout() {
  // Push: eşleşmiş tablette izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("device");
  const { claims } = useSession();
  const path = usePathname();
  if (claims?.role !== "device") return <Redirect href="/" />;
  if (!claims.child_id && path !== "/child" && path !== "/child/pin") return <Redirect href="/child" />;
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, orientation: "landscape" }} />;
}
