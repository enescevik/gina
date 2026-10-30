import "../global.css";
import "@/lib/i18n";

import { Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold, useFonts } from "@expo-google-fonts/baloo-2";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { StatusBar } from "expo-status-bar";

import { ChildModeProvider, useChildMode } from "@/lib/child-mode";
import { queryClient } from "@/lib/query";
import { SessionProvider, useSession } from "@/lib/session";

export default function RootLayout() {
  // Onaylı tasarım tipografisi: çocuk başlıkları Baloo 2, gövde Nunito (yüklenene dek sistem fontu).
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8EF" }}><ActivityIndicator color="#0B7F7F" /></View>;
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ChildModeProvider>
          <StatusBar style="dark" />
          <AppRoutes />
        </ChildModeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  const { t } = useTranslation();
  const { claims, error: sessionError, loading: sessionLoading, retry: retrySession } = useSession();
  const { actingChild, loading, error, retry } = useChildMode();
  if (sessionError || sessionLoading) return <View className="flex-1 items-center justify-center gap-4 bg-cream p-6">
    {sessionError ? <><Text className="font-body text-base text-ink">{t("accountV5.sessionError")}</Text><Button title={t("common.retry")} onPress={retrySession} /></> : <ActivityIndicator color="#0B7F7F" />}
  </View>;
  if (loading) return <View className="flex-1 items-center justify-center gap-4 bg-cream p-6">
    {error ? <><Text className="font-body text-base text-ink">{t("release.lockRestoreError")}</Text><Button title={t("common.retry")} onPress={retry} /></> : <ActivityIndicator color="#0B7F7F" />}
  </View>;
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
    <Stack.Protected guard={claims?.role === "parent"}><Stack.Screen name="parent" /></Stack.Protected>
    <Stack.Protected guard={!actingChild}>
      <Stack.Screen name="index" /><Stack.Screen name="(auth)" /><Stack.Screen name="child" />
      <Stack.Screen name="reset-password" /><Stack.Screen name="device" /><Stack.Screen name="s/[token]" />
    </Stack.Protected>
  </Stack>;
}
