import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useSession } from "@/lib/session";

/** Rol yönlendirmesi: JWT'deki `gina` claim'ine göre doğru alana gider. */
export default function Index() {
  const { session, claims, loading, isAnonymous } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream dark:bg-night">
        <ActivityIndicator color="#0FA3A3" />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (claims?.role === "parent") return <Redirect href="/(parent)" />;
  if (claims?.role === "device") return <Redirect href={claims.child_id ? "/(child)/today" : "/(child)"} />;
  if (isAnonymous) return <Redirect href="/(device)/pair" />;
  return <Redirect href="/(auth)/family" />;
}
