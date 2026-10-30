import "../global.css";
import "@/lib/i18n";

import { Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold, useFonts } from "@expo-google-fonts/baloo-2";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ChildModeProvider } from "@/lib/child-mode";
import { queryClient } from "@/lib/query";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
  // Onaylı tasarım tipografisi: çocuk başlıkları Baloo 2, gövde Nunito (yüklenene dek sistem fontu).
  useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ChildModeProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
        </ChildModeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
