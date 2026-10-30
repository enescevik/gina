import { Stack } from "expo-router";

import { usePush } from "@/lib/push";

export default function ChildLayout() {
  // Push: eşleşmiş tablette izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("device");
  return <Stack screenOptions={{ headerShown: false }} />;
}
