import "../global.css";
import "@/lib/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ChildModeProvider } from "@/lib/child-mode";
import { queryClient } from "@/lib/query";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
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
