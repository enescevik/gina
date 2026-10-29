import { Platform } from "react-native";

import { createGinaClient } from "@gina/api";

import { sessionStorage } from "./storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı; apps/mobile/.env.example dosyasına bak.",
  );
}

export const supabase = createGinaClient({
  url,
  anonKey,
  storage: sessionStorage,
  detectSessionInUrl: Platform.OS === "web",
});
