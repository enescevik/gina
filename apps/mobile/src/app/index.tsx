import { Redirect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";

import { useSession } from "@/lib/session";

/** An auth redirect that falls back to the site root (expired/used e-mail link) keeps its reason for sign-in. */
function rootRedirectError(): { error: string; error_code?: string } | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const read = (raw: string) => new URLSearchParams(raw);
  const query = read(window.location.search);
  const hash = read(window.location.hash.slice(1));
  const error = query.get("error") ?? hash.get("error");
  if (!error || !/^[a-z_]{1,64}$/.test(error)) return null;
  const code = query.get("error_code") ?? hash.get("error_code");
  return { error, ...(code && /^[a-z_]{1,64}$/.test(code) ? { error_code: code } : {}) };
}

/** Rol yönlendirmesi: JWT'deki `gina` claim'ine göre doğru alana gider. */
export default function Index() {
  const { session, claims, loading, isAnonymous } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream dark:bg-night">
        <ActivityIndicator color="#6042DE" />
      </View>
    );
  }
  if (!session) {
    const redirectError = rootRedirectError();
    return <Redirect href={redirectError ? { pathname: "/(auth)/sign-in", params: redirectError } : "/(auth)/sign-in"} />;
  }
  if (claims?.role === "parent") return <Redirect href="/parent" />;
  if (claims?.role === "device") return <Redirect href={claims.child_id ? "/child/today" : "/child"} />;
  if (isAnonymous) return <Redirect href="/device/pair" />;
  return <Redirect href="/(auth)/family" />;
}
